// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = event.openid || wxContext.OPENID
  
  console.log('创建宠物记录请求参数:', event)
  
  try {
    // 检查必要参数 - 只要求宠物名称和主人电话必填
    if (!event.petInfo || !event.petInfo.name) {
      return {
        success: false,
        errMsg: '请填写宠物名称'
      }
    }
    
    if (!event.ownerInfo || !event.ownerInfo.phoneNumber) {
      return {
        success: false,
        errMsg: '请填写主人电话'
      }
    }
    
    if (!event.recordContent) {
      return {
        success: false,
        errMsg: '请填写初次记录内容'
      }
    }
    
    // 获取用户信息
    const userInfo = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!userInfo.data || userInfo.data.length === 0) {
      return {
        success: false,
        errMsg: '用户信息不存在'
      }
    }
    
    const user = userInfo.data[0]
    
    // 获取诊所信息
    let clinicId = null
    if (user.clinicInfo && user.clinicInfo._id) {
      clinicId = user.clinicInfo._id
    } else if (user.hospitalId) {
      // 如果没有clinicInfo但有hospitalId，尝试获取诊所信息
      const clinic = await db.collection('clinics').where({
        activationCode: user.hospitalId
      }).get()
      
      if (clinic.data && clinic.data.length > 0) {
        clinicId = clinic.data[0]._id
      }
    }
    
    if (!clinicId && user.userRole === 'vet') {
      return {
        success: false,
        errMsg: '未找到关联的诊所信息'
      }
    }
    
    // 处理前端上传的图片ID
    let fileIDs = []
    
    // 检查是否有文件ID
    if (event.fileIDs && event.fileIDs.length > 0) {
      console.log('收到前端上传的文件ID:', event.fileIDs)
      fileIDs = event.fileIDs
    } else {
      console.log('没有收到图片ID')
      // 使用默认图片（可选）
      // const defaultImageID = 'cloud://cloud1-2gq53kbja8238be1.636c-cloud1-2gq53kbja8238be1-1356051063/default_pet_avatar.jpg'
      // fileIDs.push(defaultImageID)
    }
    
    // 使用第一张上传的图片作为宠物头像
    let avatarFileID = fileIDs.length > 0 ? fileIDs[0] : ''
    
    // 创建宠物记录
    const petRecord = {
      openid: openid,
      clinicId: clinicId,
      vetId: user.userRole === 'vet' ? openid : null,
      ownerOpenid: user.userRole === 'owner' ? openid : event.ownerOpenid || null,
      petInfo: {
        name: event.petInfo.name,
        breed: event.petInfo.breed,
        avatar: fileIDs.length > 0 ? fileIDs[0] : ''
      },
      ownerInfo: event.ownerInfo || {
        phoneNumber: event.ownerPhone || '未知',
        name: event.ownerName || '宠物主人'
      },
      // 为兼容旧版本，保留status字段，使用第一个标签作为主要状态
      status: event.status || '在院',
      // 添加标签数组
      tags: event.tags || ['在院'],
      reason: event.petInfo.reason,
      surgeryType: event.petInfo.surgeryType || '',
      createTime: new Date(),
      updateTime: new Date(),
      updates: [
        {
          content: event.recordContent,
          images: fileIDs,
          createTime: new Date(),
          vetId: user.userRole === 'vet' ? openid : null,
          vetName: user.vetName || user.nickName || '医生'
        }
      ]
    }
    
    // 保存到数据库
    const result = await db.collection('petRecords').add({
      data: petRecord
    })
    
    return {
      success: true,
      petRecordId: result._id,
      petRecord: petRecord
    }
  } catch (err) {
    console.error('创建宠物记录失败:', err)
    return {
      success: false,
      errMsg: err.message || '创建宠物记录失败'
    }
  }
}
