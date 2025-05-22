// 创建测试医护人员账号
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const userCollection = db.collection('users');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  
  try {
    // 获取当前用户的诊所信息
    const currentUser = await userCollection.where({
      openid: wxContext.OPENID,
      userRole: 'vet'
    }).get();
    
    if (currentUser.data.length === 0) {
      return {
        success: false,
        message: '您不是兽医，无法创建测试医护账号'
      };
    }
    
    const vetUser = currentUser.data[0];
    const clinicInfo = vetUser.clinicInfo;
    const hospitalId = vetUser.hospitalId;
    
    if (!clinicInfo && !hospitalId) {
      return {
        success: false,
        message: '未找到诊所信息'
      };
    }
    
    // 创建一个固定的openid，便于每次测试都能使用同一个账号
    const testStaffOpenid = 'permanent_test_staff_' + hospitalId;
    
    // 检查测试医护人员是否已存在
    const existingStaff = await userCollection.where({
      openid: testStaffOpenid
    }).get();
    
    // 如果已存在，直接返回现有的医护人员信息
    if (existingStaff.data.length > 0) {
      return {
        success: true,
        message: '测试医护人员已存在，直接使用',
        staffId: existingStaff.data[0]._id,
        staffOpenid: testStaffOpenid,
        staffInfo: existingStaff.data[0]
      };
    }
    
    // 获取诊所名称
    const clinicName = clinicInfo ? clinicInfo.name : '测试诊所';
    
    // 创建测试医护人员 - 确保所有必要的字段都存在
    const testStaff = {
      openid: testStaffOpenid,
      staffName: '测试医护-' + clinicName,
      userRole: 'staff',
      hospitalId: hospitalId,
      // 确保诊所信息完整
      clinicInfo: clinicInfo || {
        _id: hospitalId,  // 如果没有诊所信息，使用hospitalId作为诊所ID
        name: clinicName || '测试诊所'
      },
      clinicId: clinicInfo ? clinicInfo._id : hospitalId,
      isApproved: true,
      approvalStatus: 'approved',
      // 添加其他可能需要的字段
      phoneNumber: '13800138000',  // 添加测试电话号码
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };
    
    // 添加到用户集合
    const result = await userCollection.add({
      data: testStaff
    });
    
    return {
      success: true,
      message: '测试医护人员创建成功',
      staffId: result._id,
      staffOpenid: testStaffOpenid,
      staffInfo: testStaff
    };
  } catch (error) {
    return {
      success: false,
      error
    };
  }
};
