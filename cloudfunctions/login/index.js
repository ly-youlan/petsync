// 云函数入口文件
const cloud = require('wx-server-sdk')

// 使用当前环境
// 注意：如果你的云环境ID已知，也可以直接填写你的云环境ID
// 例如：cloud.init({ env: 'your-env-id' })
cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  return {
    event,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}
