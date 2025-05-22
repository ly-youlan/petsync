// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const assignmentsCollection = db.collection('petAssignments')
const petRecordsCollection = db.collection('petRecords')
const userCollection = db.collection('users')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = event.openid || wxContext.OPENID
  
  console.log('managePetAssignments 云函数收到的参数:', event)
  
  try {
    switch (event.action) {
      case 'assignPet':
        return await assignPet(event.petId, event.staffOpenid, openid, event.clinicId)
      case 'getAssignments':
        return await getAssignments(openid, event.userRole, event.clinicId)
      case 'submitRecord':
        return await submitRecord(event.assignmentId, event.recordContent, event.fileIDs, openid)
      case 'approveRecord':
        return await approveRecord(event.assignmentId, event.approved, event.comments, openid)
      case 'getStaffList':
        return await getStaffList(event.clinicId)
      default:
        return {
          success: false,
          errMsg: '未知操作类型'
        }
    }
  } catch (err) {
    console.error('宠物分配操作失败:', err)
    return {
      success: false,
      errMsg: `操作失败: ${err.message || err.errMsg || '未知错误'}`
    }
  }
}

// 分配宠物给医护人员
async function assignPet(petId, staffOpenid, vetOpenid, clinicId) {
  // 验证参数
  if (!petId || !staffOpenid || !vetOpenid) {
    return {
      success: false,
      errMsg: '缺少必要参数'
    }
  }
  
  // 验证宠物记录是否存在
  const petRecord = await petRecordsCollection.doc(petId).get()
  if (!petRecord.data) {
    return {
      success: false,
      errMsg: '宠物记录不存在'
    }
  }
  
  // 验证医护人员是否存在
  const staffUser = await userCollection.where({
    openid: staffOpenid,
    userRole: 'staff',
    isApproved: true
  }).get()
  
  if (staffUser.data.length === 0) {
    return {
      success: false,
      errMsg: '医护人员不存在或未审核通过'
    }
  }
  
  // 验证兽医是否有权限分配该宠物
  if (petRecord.data.vetId !== vetOpenid) {
    return {
      success: false,
      errMsg: '您没有权限分配此宠物记录'
    }
  }
  
  // 检查是否已经分配
  const existingAssignment = await assignmentsCollection.where({
    petId: petId,
    status: _.neq('completed')
  }).get()
  
  if (existingAssignment.data.length > 0) {
    return {
      success: false,
      errMsg: '该宠物记录已分配给其他医护人员'
    }
  }
  
  // 创建分配记录
  const assignment = {
    petId: petId,
    petInfo: {
      name: petRecord.data.petInfo.name,
      breed: petRecord.data.petInfo.breed,
      avatarUrl: petRecord.data.petInfo.avatarUrl || ''
    },
    staffOpenid: staffOpenid,
    staffInfo: {
      name: staffUser.data[0].staffName || '医护人员',
      avatarUrl: staffUser.data[0].avatarUrl || ''
    },
    vetOpenid: vetOpenid,
    clinicId: clinicId,
    status: 'assigned', // assigned, submitted, approved, rejected, completed
    createTime: db.serverDate(),
    updateTime: db.serverDate(),
    recordContent: '',
    fileIDs: [],
    comments: '',
    approvalTime: null
  }
  
  const result = await assignmentsCollection.add({
    data: assignment
  })
  
  // 更新宠物记录状态
  await petRecordsCollection.doc(petId).update({
    data: {
      assignedToStaff: true,
      staffOpenid: staffOpenid,
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    assignmentId: result._id,
    assignment: {
      ...assignment,
      _id: result._id
    }
  }
}

// 获取分配记录
async function getAssignments(openid, userRole, clinicId) {
  let query = {}
  
  if (userRole === 'vet') {
    // 兽医查看自己分配的记录
    query.vetOpenid = openid
  } else if (userRole === 'staff') {
    // 医护人员查看分配给自己的记录
    query.staffOpenid = openid
  } else {
    return {
      success: false,
      errMsg: '无效的用户角色'
    }
  }
  
  // 如果提供了诊所ID，则只查询该诊所的记录
  if (clinicId) {
    query.clinicId = clinicId
  }
  
  const assignments = await assignmentsCollection.where(query)
    .orderBy('updateTime', 'desc')
    .get()
  
  return {
    success: true,
    assignments: assignments.data
  }
}

// 医护人员提交记录
async function submitRecord(assignmentId, recordContent, fileIDs, staffOpenid) {
  // 验证参数
  if (!assignmentId || !recordContent) {
    return {
      success: false,
      errMsg: '缺少必要参数'
    }
  }
  
  // 验证分配记录是否存在
  const assignment = await assignmentsCollection.doc(assignmentId).get()
  if (!assignment.data) {
    return {
      success: false,
      errMsg: '分配记录不存在'
    }
  }
  
  // 验证医护人员是否有权限提交记录
  if (assignment.data.staffOpenid !== staffOpenid) {
    return {
      success: false,
      errMsg: '您没有权限提交此记录'
    }
  }
  
  // 验证记录状态
  if (assignment.data.status !== 'assigned' && assignment.data.status !== 'rejected') {
    return {
      success: false,
      errMsg: '当前状态不允许提交记录'
    }
  }
  
  // 更新分配记录
  await assignmentsCollection.doc(assignmentId).update({
    data: {
      recordContent: recordContent,
      fileIDs: fileIDs || [],
      status: 'submitted',
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    message: '记录已提交，等待兽医审核'
  }
}

// 兽医审核记录
async function approveRecord(assignmentId, approved, comments, vetOpenid) {
  // 验证参数
  if (!assignmentId || approved === undefined) {
    return {
      success: false,
      errMsg: '缺少必要参数'
    }
  }
  
  // 验证分配记录是否存在
  const assignment = await assignmentsCollection.doc(assignmentId).get()
  if (!assignment.data) {
    return {
      success: false,
      errMsg: '分配记录不存在'
    }
  }
  
  // 验证兽医是否有权限审核记录
  if (assignment.data.vetOpenid !== vetOpenid) {
    return {
      success: false,
      errMsg: '您没有权限审核此记录'
    }
  }
  
  // 验证记录状态
  if (assignment.data.status !== 'submitted') {
    return {
      success: false,
      errMsg: '当前状态不允许审核记录'
    }
  }
  
  // 更新分配记录状态
  const status = approved ? 'approved' : 'rejected'
  await assignmentsCollection.doc(assignmentId).update({
    data: {
      status: status,
      comments: comments || '',
      approvalTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 如果审核通过，更新宠物记录
  if (approved) {
    // 获取宠物记录
    const petRecord = await petRecordsCollection.doc(assignment.data.petId).get()
    
    if (petRecord.data) {
      // 构建更新内容
      const update = {
        content: assignment.data.recordContent,
        images: assignment.data.fileIDs,
        createTime: db.serverDate(),
        creator: {
          openid: assignment.data.staffOpenid,
          name: assignment.data.staffInfo.name,
          role: 'staff'
        },
        approver: {
          openid: vetOpenid,
          time: db.serverDate()
        }
      }
      
      // 更新宠物记录
      await petRecordsCollection.doc(assignment.data.petId).update({
        data: {
          updates: _.push(update),
          updateTime: db.serverDate(),
          assignedToStaff: false
        }
      })
      
      // 更新分配记录为已完成
      await assignmentsCollection.doc(assignmentId).update({
        data: {
          status: 'completed',
          updateTime: db.serverDate()
        }
      })
    }
  }
  
  return {
    success: true,
    message: approved ? '记录已审核通过并发布' : '记录已退回，需要修改'
  }
}

// 获取诊所的医护人员列表
async function getStaffList(clinicId) {
  console.log('获取医护人员列表，诊所ID:', clinicId);
  
  if (!clinicId) {
    return {
      success: false,
      errMsg: '缺少诊所ID'
    }
  }
  
  try {
    // 先获取所有医护人员，不考虑诊所关联
    const allStaff = await userCollection.where({
      userRole: 'staff'
    }).get();
    
    console.log('所有医护人员:', JSON.stringify(allStaff.data));
    
    // 查询医护人员 - 使用更灵活的查询方式
    const db = cloud.database();
    const _ = db.command;
    
    // 获取诊所信息，获取激活码
    let activationCode = null;
    try {
      // 尝试从诊所集合中获取激活码
      const clinicInfo = await db.collection('clinics').doc(clinicId).get();
      if (clinicInfo.data) {
        activationCode = clinicInfo.data.activationCode;
        console.log(`诊所激活码: ${activationCode}`);
      }
    } catch (error) {
      console.log('获取诊所信息失败:', error);
      // 失败也继续，不影响查询
    }
    
    // 查询所有医护人员
    const staffList = await userCollection.where({
      userRole: 'staff'
    }).get();
    
    console.log('查询到的医护人员:', JSON.stringify(staffList.data));
    
    // 手动过滤符合条件的医护人员
    const filteredStaff = staffList.data.filter(user => {
      // 检查是否已审核
      const isApproved = user.isApproved === true;
      
      // 检查诊所关联 - 同时支持多种匹配方式
      const hasClinicMatch = 
        // 直接匹配诊所ID
        (user.clinicInfo && user.clinicInfo._id === clinicId) || 
        user.clinicId === clinicId || 
        user.hospitalId === clinicId ||
        // 匹配激活码
        (activationCode && user.clinicId === activationCode) ||
        (activationCode && user.hospitalId === activationCode);
      
      console.log(`医护人员 ${user.staffName || '未命名'}: 审核状态=${isApproved}, 诊所匹配=${hasClinicMatch}, clinicId=${user.clinicId}, hospitalId=${user.hospitalId}`);
      
      // 同时考虑审核状态和诊所关联
      return isApproved && hasClinicMatch
    });
    
    console.log('过滤后的医护人员:', JSON.stringify(filteredStaff));
    
    // 提取必要信息
    const staff = filteredStaff.map(user => ({
      openid: user.openid,
      name: user.staffName || '医护人员',
      avatarUrl: user.avatarUrl || '',
      phoneNumber: user.phoneNumber || ''
    }));
    
    return {
      success: true,
      staff: staff
    };
  } catch (error) {
    console.error('获取医护人员列表失败:', error);
    return {
      success: false,
      errMsg: '获取医护人员列表失败: ' + error.message,
      error: error
    };
  }
}
