// 云函数入口文件
const cloud = require('wx-server-sdk')

// 使用当前环境
// 注意：如果你的云环境ID已知，也可以直接填写你的云环境ID
// 例如：cloud.init({ env: 'your-env-id' })
cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取微信上下文
  const wxContext = cloud.getWXContext()
  
  // 获取手机号
  try {
    // 新版微信小程序使用 code 获取手机号
    if (event.code) {
      console.log('使用code获取手机号:', event.code);
      const result = await cloud.openapi.phonenumber.getPhoneNumber({
        code: event.code
      })
      
      return {
        success: true,
        phoneNumber: result.phoneInfo.phoneNumber,
        purePhoneNumber: result.phoneInfo.purePhoneNumber,
        countryCode: result.phoneInfo.countryCode,
        openid: wxContext.OPENID
      }
    }
    // 兼容旧版使用 cloudID 获取手机号
    else if (event.weRunData) {
      try {
        const res = await cloud.getOpenData({
          list: [event.weRunData]
        })
        return {
          success: true,
          phoneNumber: res.list[0].data.phoneNumber,
          openid: wxContext.OPENID
        }
      } catch (err) {
        return {
          success: false,
          errMsg: err.message,
          openid: wxContext.OPENID
        }
      }
    }
    
    // 如果没有提供code或weRunData
    return {
      success: false,
      errMsg: '未提供有效的code或weRunData参数',
      openid: wxContext.OPENID
    }
  } catch (err) {
    // 处理主try块中的错误
    return {
      success: false,
      errMsg: err.message || '获取手机号时发生错误',
      openid: wxContext.OPENID
    }
  }
}
