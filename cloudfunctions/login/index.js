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
  console.log('login 云函数收到的参数:', event);
  
  try {
    // 获取微信上下文
    const wxContext = cloud.getWXContext()
    console.log('微信上下文:', wxContext);
    
    // 检查必要的上下文信息
    if (!wxContext.OPENID) {
      console.error('获取OPENID失败');
      return {
        success: false,
        errMsg: '获取用户身份信息失败，请检查小程序配置',
      };
    }
    
    // 返回用户身份信息
    return {
      success: true,
      event,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    }
  } catch (err) {
    console.error('登录过程中发生错误:', err);
    return {
      success: false,
      errMsg: `登录失败: ${err.message || err.errMsg || '未知错误'}`,
    }
  }
}
