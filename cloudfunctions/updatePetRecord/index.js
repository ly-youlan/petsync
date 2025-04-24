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
  const { petId, updates, openid } = event
  
  console.log('更新宠物记录', { petId, openid, updatesCount: updates ? updates.length : 0 })
  
  // 验证参数
  if (!petId) {
    return {
      success: false,
      message: '缺少宠物ID'
    }
  }
  
  if (!updates || !Array.isArray(updates)) {
    return {
      success: false,
      message: '缺少更新记录或格式不正确'
    }
  }
  
  try {
    // 获取当前用户的openid，如果未提供则使用当前调用者的openid
    const userOpenid = openid || wxContext.OPENID
    
    // 查询宠物记录是否存在
    const petRecord = await db.collection('petRecords').doc(petId).get()
    
    if (!petRecord.data) {
      return {
        success: false,
        message: '未找到宠物记录'
      }
    }
    
    // 更新宠物记录的updates字段
    const result = await db.collection('petRecords').doc(petId).update({
      data: {
        updates: updates,
        updateTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '更新成功',
      result
    }
  } catch (error) {
    console.error('更新宠物记录失败', error)
    return {
      success: false,
      message: '更新宠物记录失败: ' + error.message,
      error
    }
  }
}
