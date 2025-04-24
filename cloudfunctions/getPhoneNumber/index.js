// 云函数入口文件
const cloud = require('wx-server-sdk')

// 使用当前环境
// 注意：如果你的云环境ID已知，也可以直接填写你的云环境ID
// 例如：cloud.init({ env: 'your-env-id' })
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('getPhoneNumber 云函数收到的参数:', event);
  
  // 获取微信上下文
  const wxContext = cloud.getWXContext()
  console.log('微信上下文:', wxContext);
  
  // 获取手机号
  try {
    // 新版微信小程序使用 code 获取手机号
    if (event.code) {
      console.log('使用code获取手机号:', event.code);
      try {
        const result = await cloud.openapi.phonenumber.getPhoneNumber({
          code: event.code
        })
        
        console.log('获取手机号成功:', result);
        return {
          success: true,
          phoneNumber: result.phoneInfo.phoneNumber,
          purePhoneNumber: result.phoneInfo.purePhoneNumber,
          countryCode: result.phoneInfo.countryCode,
          openid: wxContext.OPENID
        }
      } catch (error) {
        console.error('获取手机号API调用失败:', error);
        return {
          success: false,
          errMsg: `获取手机号API调用失败: ${error.message || error.errMsg || '未知错误'}`,
          errCode: error.errCode || -1,
          openid: wxContext.OPENID
        }
      }
    }
    // 兼容旧版使用 cloudID 获取手机号
    else if (event.weRunData) {
      console.log('使用cloudID获取手机号');
      try {
        const res = await cloud.getOpenData({
          list: [event.weRunData]
        })
        console.log('cloudID获取手机号成功:', res);
        return {
          success: true,
          phoneNumber: res.list[0].data.phoneNumber,
          openid: wxContext.OPENID
        }
      } catch (err) {
        console.error('cloudID获取手机号失败:', err);
        return {
          success: false,
          errMsg: `cloudID获取手机号失败: ${err.message || err.errMsg || '未知错误'}`,
          openid: wxContext.OPENID
        }
      }
    }
    
    // 如果没有提供code或weRunData
    console.warn('未提供有效的code或weRunData参数');
    return {
      success: false,
      errMsg: '未提供有效的code或weRunData参数',
      openid: wxContext.OPENID
    }
  } catch (err) {
    // 处理主try块中的错误
    console.error('获取手机号时发生未处理的错误:', err);
    return {
      success: false,
      errMsg: `获取手机号时发生错误: ${err.message || err.errMsg || '未知错误'}`,
      openid: wxContext.OPENID
    }
  }
}
