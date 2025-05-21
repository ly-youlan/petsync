const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = event.openid || wxContext.OPENID
  
  console.log('获取宠物记录请求参数:', event)
  
  try {
    // 构建查询条件
    let query = {}
    
    // 如果提供了宠物ID，则直接查询该宠物记录
    if (event.petId) {
      console.log('根据宠物ID查询:', event.petId)
      const petRecord = await db.collection('petRecords').doc(event.petId).get()
      
      // 如果是宠物主人查询，需要验证手机号
      if (event.userRole === 'owner' && petRecord.data) {
        // 检查宠物记录的主人手机号是否与用户匹配
        const ownerPhone = event.ownerPhone || (await db.collection('users').where({ openid }).get()).data[0]?.phoneNumber
        
        if (ownerPhone && petRecord.data.ownerInfo && petRecord.data.ownerInfo.phoneNumber === ownerPhone) {
          return await enrichPetRecordsWithClinicInfo([petRecord.data])
        } else {
          console.log('手机号不匹配，无权查看此宠物记录')
          return {
            success: false,
            errMsg: '无权查看此宠物记录'
          }
        }
      }
      
      return await enrichPetRecordsWithClinicInfo([petRecord.data])
    }
    
    // 如果没有提供宠物ID，则根据其他条件查询
    if (event.userRole === 'owner') {
      // 宠物主人查询自己的宠物记录
      const ownerPhone = event.ownerPhone || (await db.collection('users').where({ openid }).get()).data[0]?.phoneNumber
      
      if (!ownerPhone) {
        console.log('未找到宠物主人手机号，无法查询宠物记录')
        return {
          success: false,
          errMsg: '未找到宠物主人手机号'
        }
      }
      
      console.log('根据宠物主人手机号查询:', ownerPhone)
      query = {
        'ownerInfo.phoneNumber': ownerPhone
      }
    } else if (event.userRole === 'vet') {
      // 兽医查询自己创建的宠物记录
      console.log('兽医查询自己创建的宠物记录:', openid)
      query = {
        vetId: openid
      }
      
      // 如果提供了诊所ID，则只查询该诊所的宠物记录
      if (event.clinicId) {
        query.clinicId = event.clinicId
      }
    } else {
      // 其他情况，返回错误
      console.log('无效的用户角色:', event.userRole)
      return {
        success: false,
        errMsg: '无效的用户角色'
      }
    }
    
    // 执行查询
    console.log('执行查询:', query)
    const petRecordsQuery = db.collection('petRecords').where(query)
    
    // 如果提供了状态过滤，则添加状态条件
    if (event.status) {
      petRecordsQuery.where({
        status: event.status
      })
    }
    
    // 执行查询并获取结果
    const petRecords = await petRecordsQuery.orderBy('createTime', 'desc').get()
    
    // 使用辅助函数处理诊所信息
    return await enrichPetRecordsWithClinicInfo(petRecords.data)
  } catch (err) {
    console.error('获取宠物记录失败:', err)
    return {
      success: false,
      errMsg: err.message || '获取宠物记录失败'
    }
  }
}

// 辅助函数：为宠物记录添加诊所信息
async function enrichPetRecordsWithClinicInfo(petRecordsData) {
  try {
    if (!petRecordsData || petRecordsData.length === 0) {
      return {
        success: true,
        petRecords: []
      }
    }
    
    // 获取所有宠物记录的诊所ID
    const clinicIds = petRecordsData
      .filter(record => record && record.clinicId)
      .map(record => record.clinicId);
    
    // 去重
    const uniqueClinicIds = Array.from(new Set(clinicIds));
    
    // 查询诊所信息
    const clinicsData = {};
    if (uniqueClinicIds.length > 0) {
      // 由于微信云开发的限制，一次最多查询20条记录，这里分批查询
      const batchSize = 20;
      for (let i = 0; i < uniqueClinicIds.length; i += batchSize) {
        const batchIds = uniqueClinicIds.slice(i, i + batchSize);
        try {
          const clinicsResult = await db.collection('clinics').where({
            _id: db.command.in(batchIds)
          }).get();
          
          // 将诊所信息按ID存储便于查找
          clinicsResult.data.forEach(clinic => {
            clinicsData[clinic._id] = clinic;
          });
        } catch (err) {
          console.error('批量查询诊所信息失败:', err);
        }
      }
    }
    
    // 获取所有宠物记录的hospitalId
    const hospitalIds = petRecordsData
      .filter(record => record && !record.clinicName && !record.clinicId && record.hospitalId)
      .map(record => record.hospitalId);
    
    // 去重
    const uniqueHospitalIds = Array.from(new Set(hospitalIds));
    
    // 根据hospitalId查询诊所信息
    const hospitalClinicsData = {};
    if (uniqueHospitalIds.length > 0) {
      try {
        // 分批查询
        const batchSize = 20;
        for (let i = 0; i < uniqueHospitalIds.length; i += batchSize) {
          const batchIds = uniqueHospitalIds.slice(i, i + batchSize);
          const clinicsResult = await db.collection('clinics').where({
            activationCode: db.command.in(batchIds)
          }).get();
          
          // 将诊所信息按activationCode存储便于查找
          clinicsResult.data.forEach(clinic => {
            if (clinic.activationCode) {
              hospitalClinicsData[clinic.activationCode] = clinic;
            }
          });
        }
      } catch (err) {
        console.error('批量查询诊所信息失败:', err);
      }
    }
    
    // 记录诊所数据信息
    console.log('已查询到的诊所数据:', Object.keys(clinicsData));
    
    // 将诊所名称添加到宠物记录中
    const enrichedPetRecords = petRecordsData.map(record => {
      if (!record) return null;
      
      const enrichedRecord = { ...record };
      
      // 从多个可能的来源获取诊所名称
      let clinicName = null;
      
      // 方式1：通过clinicId从诊所集合中获取
      if (record.clinicId && clinicsData[record.clinicId]) {
        clinicName = clinicsData[record.clinicId].name;
        console.log('从clinicsData中找到诊所名称:', clinicName);
      }
      
      // 方式2：直接从记录中的clinicName字段获取
      if (!clinicName && record.clinicName) {
        clinicName = record.clinicName;
        console.log('从记录的clinicName字段获取名称:', clinicName);
      }
      
      // 方式3：从记录中的clinicInfo字段获取
      if (!clinicName && record.clinicInfo && record.clinicInfo.name) {
        clinicName = record.clinicInfo.name;
        console.log('从记录的clinicInfo.name字段获取名称:', clinicName);
      }
      
      // 方式4：从记录中的hospitalName字段获取
      if (!clinicName && record.hospitalName) {
        clinicName = record.hospitalName;
        console.log('从记录的hospitalName字段获取名称:', clinicName);
      }
      
      // 方式5：从预先查询的hospitalClinicsData中获取
      if (!clinicName && record.hospitalId && hospitalClinicsData[record.hospitalId]) {
        clinicName = hospitalClinicsData[record.hospitalId].name;
        console.log('从hospitalClinicsData获取名称:', clinicName);
      }
      
      // 如果还是没有找到，但有诊所ID，使用ID前缀作为名称
      if (!clinicName && record.clinicId) {
        const shortId = record.clinicId.substring(0, 6);
        clinicName = '诊所' + shortId;
        console.log('使用诊所ID前缀作为诊所名称:', clinicName);
      }
      
      // 如果还是没有找到，使用默认值
      if (!clinicName) {
        clinicName = '未知诊所';
        console.log('使用默认诊所名称:', clinicName);
      }
      
      // 设置诊所名称
      enrichedRecord.clinicName = clinicName;
      
      return enrichedRecord;
    }).filter(record => record !== null);
    
    return {
      success: true,
      petRecords: enrichedPetRecords
    }
  } catch (err) {
    console.error('处理诊所信息失败:', err);
    return {
      success: false,
      errMsg: err.message || '处理诊所信息失败'
    }
  }
}