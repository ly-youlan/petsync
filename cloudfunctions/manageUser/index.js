// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const userCollection = db.collection('users')

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('manageUser 云函数收到的参数:', event)
  const { action, userData } = event
  const wxContext = cloud.getWXContext()
  
  // 确保有openid
  if (!wxContext.OPENID) {
    return {
      success: false,
      errMsg: '无法获取用户身份信息'
    }
  }
  
  try {
    switch (action) {
      case 'createUser':
        return await createUser(userData, wxContext)
      case 'getUser':
        return await getUser(wxContext)
      case 'updateUser':
        return await updateUser(userData, wxContext)
      case 'approveVet':
        return await approveVet(userData.targetOpenid || wxContext.OPENID)
      case 'getClinicByCode':
        return await getClinicByCode(event.clinicCode)
      case 'getUserByRoleAndOpenid':
        return await getUserByRoleAndOpenid(event.openid, event.userRole)
      default:
        return {
          success: false,
          errMsg: '未知操作类型'
        }
    }
  } catch (err) {
    console.error('用户管理操作失败:', err)
    return {
      success: false,
      errMsg: `操作失败: ${err.message || err.errMsg || '未知错误'}`
    }
  }
}

// 创建用户
async function createUser(userData, wxContext) {
  // 检查用户是否已存在
  const existingUser = await userCollection.where({
    openid: wxContext.OPENID
  }).get()
  
  if (existingUser.data.length > 0) {
    return {
      success: false,
      errMsg: '用户已存在',
      existingUser: existingUser.data[0]
    }
  }
  
  // 如果是兵医用户，验证诊所邀请码
  if (userData.userRole === 'vet' && userData.hospitalId) {
    try {
      // 查询诊所集合
      const clinicsCollection = db.collection('clinics')
      const clinic = await clinicsCollection.where({
        activationCode: userData.hospitalId
      }).get()
      
      if (clinic.data.length === 0) {
        return {
          success: false,
          errMsg: '无效的诊所邀请码'
        }
      }
      
      // 将诊所信息关联到用户
      userData.clinicInfo = clinic.data[0]
      userData.clinicId = clinic.data[0]._id
    } catch (err) {
      console.error('验证诊所邀请码失败:', err)
      // 如果验证失败，使用原始医院信息
      console.log('使用原始医院信息')
    }
  }
  
  // 添加必要字段
  const userInfo = {
    ...userData,
    openid: wxContext.OPENID,
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  
  // 创建用户
  const result = await userCollection.add({
    data: userInfo
  })
  
  return {
    success: true,
    _id: result._id,
    userInfo
  }
}

// 获取用户信息
async function getUser(wxContext) {
  const result = await userCollection.where({
    openid: wxContext.OPENID
  }).get()
  
  if (result.data.length === 0) {
    return {
      success: false,
      errMsg: '用户不存在'
    }
  }
  
  return {
    success: true,
    userInfo: result.data[0]
  }
}

// 更新用户信息
async function updateUser(userData, wxContext) {
  // 检查用户是否存在
  const existingUser = await userCollection.where({
    openid: wxContext.OPENID
  }).get()
  
  if (existingUser.data.length === 0) {
    return {
      success: false,
      errMsg: '用户不存在'
    }
  }
  
  // 更新用户信息
  const result = await userCollection.where({
    openid: wxContext.OPENID
  }).update({
    data: {
      ...userData,
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    updated: result.stats.updated
  }
}

// 根据激活码获取诊所信息
async function getClinicByCode(clinicCode) {
  if (!clinicCode) {
    return {
      success: false,
      errMsg: '缺少诊所激活码'
    }
  }
  
  try {
    // 查询诊所集合
    const clinicsCollection = db.collection('clinics')
    const clinic = await clinicsCollection.where({
      activationCode: clinicCode
    }).get()
    
    if (clinic.data.length === 0) {
      return {
        success: false,
        errMsg: '未找到对应的诊所信息'
      }
    }
    
    return {
      success: true,
      clinic: clinic.data[0]
    }
  } catch (err) {
    console.error('获取诊所信息失败:', err)
    return {
      success: false,
      errMsg: `获取诊所信息失败: ${err.message || err.errMsg || '未知错误'}`
    }
  }
}

// 根据角色和openid获取用户信息
async function getUserByRoleAndOpenid(openid, userRole) {
  console.log('根据角色和openid获取用户信息:', { openid, userRole });
  
  if (!openid || !userRole) {
    return {
      success: false,
      errMsg: '缺少openid或userRole'
    };
  }
  
  try {
    // 查询指定角色的用户信息
    const result = await userCollection.where({
      openid: openid,
      userRole: userRole
    }).get();
    
    if (result.data.length === 0) {
      // 如果没有找到指定角色的用户，创建一个新的用户信息
      if (userRole === 'owner') {
        // 如果是宠物主人角色，创建一个基本的宠物主人用户
        // 首先查询用户的其他信息，如手机号
        const anyUser = await userCollection.where({
          openid: openid
        }).get();
        
        let phoneNumber = '';
        if (anyUser.data.length > 0) {
          // 从现有用户信息中提取手机号
          phoneNumber = anyUser.data[0].phoneNumber || anyUser.data[0].ownerPhone || '';
        }
        
        // 创建新的宠物主人用户
        const newOwner = {
          openid: openid,
          userRole: 'owner',
          ownerPhone: phoneNumber,
          phoneNumber: phoneNumber,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        };
        
        // 添加到数据库
        const addResult = await userCollection.add({
          data: newOwner
        });
        
        console.log('创建新的宠物主人用户:', newOwner);
        
        return {
          success: true,
          userInfo: {
            ...newOwner,
            _id: addResult._id
          }
        };
      }
      
      return {
        success: false,
        errMsg: '未找到指定角色的用户信息'
      };
    }
    
    return {
      success: true,
      userInfo: result.data[0]
    };
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return {
      success: false,
      errMsg: `获取用户信息失败: ${err.message || err.errMsg || '未知错误'}`
    };
  }
}

// 审核兽医
async function approveVet(openid) {
  // 检查用户是否存在
  const existingUser = await userCollection.where({
    openid: openid,
    userRole: 'vet'
  }).get()
  
  if (existingUser.data.length === 0) {
    return {
      success: false,
      errMsg: '兽医用户不存在'
    }
  }
  
  // 更新审核状态
  const result = await userCollection.where({
    openid: openid,
    userRole: 'vet'
  }).update({
    data: {
      isApproved: true,
      approvalStatus: 'approved',
      approvalTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    updated: result.stats.updated
  }
}
