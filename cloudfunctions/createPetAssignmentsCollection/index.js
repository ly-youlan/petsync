// 创建petAssignments集合脚本
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 尝试创建集合
    await db.createCollection('petAssignments');
    return {
      success: true,
      message: 'petAssignments集合创建成功'
    };
  } catch (error) {
    // 如果集合已存在，也返回成功
    if (error.errCode === -502001) {
      return {
        success: true,
        message: 'petAssignments集合已存在'
      };
    }
    return {
      success: false,
      error
    };
  }
};
