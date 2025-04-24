// 云函数入口文件
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
          return {
            success: true,
            petRecords: [petRecord.data]
          }
        } else {
          console.log('手机号不匹配，无权查看此宠物记录')
          return {
            success: false,
            errMsg: '无权查看此宠物记录'
          }
        }
      }
      
      return {
        success: true,
        petRecords: petRecord.data ? [petRecord.data] : []
      }
    }
    
    // 如果提供了诊所ID，则按诊所ID查询
    if (event.clinicId) {
      query.clinicId = event.clinicId
    }
    
    // 如果提供了主人手机号，则按主人手机号查询（用于宠物主人查看自己的宠物记录）
    if (event.ownerPhone) {
      console.log('根据主人手机号查询:', event.ownerPhone)
      query['ownerInfo.phoneNumber'] = event.ownerPhone
      
      // 如果是宠物主人查询模式，直接返回该手机号下的所有宠物记录
      if (event.userRole === 'owner') {
        // 跳过后续的用户角色检查
        console.log('宠物主人查询模式，直接返回该手机号下的所有宠物记录')
      } else {
        // 继续进行用户角色检查
        const userInfo = await db.collection('users').where({
          openid: openid
        }).get()
        
        if (userInfo.data && userInfo.data.length > 0) {
          const user = userInfo.data[0]
          
          if (user.userRole === 'vet') {
            // 兽医用户，获取其所在诊所的所有宠物记录
            if (user.clinicInfo && user.clinicInfo._id) {
              query.clinicId = user.clinicInfo._id
            } else if (user.hospitalId) {
              // 如果没有clinicInfo但有hospitalId，尝试获取诊所信息
              const clinic = await db.collection('clinics').where({
                activationCode: user.hospitalId
              }).get()
              
              if (clinic.data && clinic.data.length > 0) {
                query.clinicId = clinic.data[0]._id
              }
            }
          } else {
            // 普通用户，只获取自己的宠物记录
            query.ownerOpenid = openid
          }
        } else {
          // 用户信息不存在，返回空结果
          return {
            success: true,
            petRecords: []
          }
        }
      }
    } else {
      // 没有提供主人手机号，按照正常流程处理
      const userInfo = await db.collection('users').where({
        openid: openid
      }).get()
      
      if (userInfo.data && userInfo.data.length > 0) {
        const user = userInfo.data[0]
        
        if (user.userRole === 'vet') {
          // 兽医用户，获取其所在诊所的所有宠物记录
          if (user.clinicInfo && user.clinicInfo._id) {
            query.clinicId = user.clinicInfo._id
          } else if (user.hospitalId) {
            // 如果没有clinicInfo但有hospitalId，尝试获取诊所信息
            const clinic = await db.collection('clinics').where({
              activationCode: user.hospitalId
            }).get()
            
            if (clinic.data && clinic.data.length > 0) {
              query.clinicId = clinic.data[0]._id
            }
          }
        } else {
          // 普通用户，只获取自己的宠物记录
          query.ownerOpenid = openid
        }
      } else {
        // 用户信息不存在，返回空结果
        return {
          success: true,
          petRecords: []
        }
      }
    }
    
    // 根据筛选条件过滤
    if (event.filter) {
      if (Array.isArray(event.filter)) {
        // 多标签筛选
        if (event.filter.length > 0) {
          // 如果包含全部，则不进行标签过滤
          if (event.filter.includes('全部')) {
            // 不添加标签过滤条件，显示所有记录
          } else {
            // 使用 or 查询，兼容旧数据
            const conditions = [];
            
            // 处理标签查询
            if (event.filter.includes('在院')) {
              conditions.push({
                tags: db.command.all(['在院'])
              });
              // 兼容旧数据，没有tags字段或者status为住院的记录
              conditions.push({
                tags: db.command.exists(false),
                status: '住院'
              });
            }
            
            if (event.filter.includes('出院')) {
              conditions.push({
                tags: db.command.all(['出院'])
              });
              // 兼容旧数据，没有tags字段或者status为出院的记录
              conditions.push({
                tags: db.command.exists(false),
                status: '出院'
              });
            }
            
            if (event.filter.includes('自定义')) {
              conditions.push({
                tags: db.command.all(['自定义'])
              });
            }
            
            // 如果有其他标签，也添加到查询条件中
            event.filter.forEach(tag => {
              if (tag !== '在院' && tag !== '出院' && tag !== '自定义') {
                conditions.push({
                  tags: db.command.all([tag])
                });
              }
            });
            
            if (conditions.length > 0) {
              // 使用 or 查询，满足任一条件即可
              query = db.command.or(conditions);
            }
          }
        }
      } else {
        // 兼容旧版本的单标签筛选
        if (event.filter === '全部') {
          // 不添加标签过滤条件，显示所有记录
        } else if (event.filter === '在院') {
          query = db.command.or([
            { tags: db.command.all(['在院']) },
            { tags: db.command.exists(false), status: '住院' }
          ]);
        } else if (event.filter === '出院') {
          query = db.command.or([
            { tags: db.command.all(['出院']) },
            { tags: db.command.exists(false), status: '出院' }
          ]);
        } else {
          query.tags = db.command.all([event.filter]);
        }
      }
    } else {
      // 默认情况下，显示在院的宠物记录，兼容旧数据
      query = db.command.or([
        { tags: db.command.all(['在院']) },
        { tags: db.command.exists(false), status: '住院' }
      ]);
    }
    
    // 查询宠物记录
    let petRecordsQuery = db.collection('petRecords').where(query)
    
    // 根据搜索关键词过滤
    if (event.searchValue) {
      // 由于微信云开发的限制，复杂的or查询需要多次查询合并结果
      const nameQuery = {
        ...query,
        'petInfo.name': db.RegExp({
          regexp: event.searchValue,
          options: 'i'
        })
      }
      
      const phoneQuery = {
        ...query,
        'ownerInfo.phoneNumber': db.RegExp({
          regexp: event.searchValue,
          options: 'i'
        })
      }
      
      const nameResults = await db.collection('petRecords').where(nameQuery).get()
      const phoneResults = await db.collection('petRecords').where(phoneQuery).get()
      
      // 合并结果并去重
      const combinedResults = [...nameResults.data, ...phoneResults.data]
      const uniqueResults = Array.from(new Set(combinedResults.map(record => record._id)))
        .map(id => combinedResults.find(record => record._id === id))
      
      return {
        success: true,
        petRecords: uniqueResults
      }
    } else {
      // 没有搜索关键词，直接查询
      const petRecords = await petRecordsQuery.orderBy('createTime', 'desc').get()
      
      return {
        success: true,
        petRecords: petRecords.data
      }
    }
  } catch (err) {
    console.error('获取宠物记录失败:', err)
    return {
      success: false,
      errMsg: err.message || '获取宠物记录失败'
    }
  }
}
