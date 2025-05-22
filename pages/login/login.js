// pages/login/login.js
Page({
  data: {
    isLoading: false,
    hospitalCode: '',  // 医院邀请码
    vetName: '',       // 兽医姓名
    staffName: '',     // 医疗人员姓名
    ownerPhone: '',    // 宠物主人手机号
    userRole: 'vet'    // 默认选中兽医角色
  },

  onLoad: function() {
    // 检查用户是否已登录
    const app = getApp();
    if (app.globalData.isLoggedIn && app.globalData.openid) {
      // 如果已登录，直接跳转到工作台
      wx.reLaunch({
        url: '/pages/workbench/workbench'
      });
    }
  },

  // 开发环境兽医登录
  devLogin: function() {
    console.log('开发环境兽医登录');
    
    this.setData({ isLoading: true });
    
    // 直接创建模拟用户
    const mockOpenid = 'vet_' + new Date().getTime();
    const app = getApp();
    app.globalData.openid = mockOpenid;
    app.globalData.isLoggedIn = true;
    app.globalData.userRole = 'vet';
    
    // 模拟医院信息
    const hospitalInfo = {
      id: 'hospital_123',
      name: '演示宠物医院',
      address: '北京市海淀区中关村大街 1 号',
      code: 'DEMO123'
    };
    
    // 创建模拟用户信息
    const userInfo = {
      openid: mockOpenid,
      vetName: '演示兽医',
      userRole: 'vet',
      hospitalId: hospitalInfo.id,
      hospitalInfo: hospitalInfo,
      isApproved: true, // 开发环境默认已审核
      approvalStatus: 'approved', // 开发环境默认已审核
      createTime: new Date().getTime()
    };
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userInfo_' + mockOpenid, userInfo);
    wx.setStorageSync('hospitalInfo_' + hospitalInfo.id, hospitalInfo);
    
    // 设置全局数据
    app.globalData.hospitalInfo = hospitalInfo;
    
    // 直接跳转到工作台
    wx.reLaunch({
      url: '/pages/workbench/workbench'
    });
    
    setTimeout(() => {
      this.setData({ isLoading: false });
    }, 500);
  },
  
  // 输入医院邀请码
  inputHospitalCode: function(e) {
    this.setData({
      hospitalCode: e.detail.value
    });
  },

  // 输入兽医姓名
  inputVetName: function(e) {
    this.setData({
      vetName: e.detail.value
    });
  },
  
  // 输入医护姓名
  inputStaffName: function(e) {
    this.setData({
      staffName: e.detail.value
    });
  },
  
  // 输入宠物主人手机号
  inputOwnerPhone: function(e) {
    this.setData({
      ownerPhone: e.detail.value
    });
  },
  
  // 兽医登录
  vetLogin: function() {
    // 验证表单字段
    if (!this.data.hospitalCode) {
      wx.showToast({
        title: '请输入医院邀请码',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.vetName) {
      wx.showToast({
        title: '请输入兽医姓名',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 使用微信原生登录获取openid
    wx.login({
      success: loginRes => {
        console.log('wx.login success:', loginRes);
        if (!loginRes.code) {
          console.error('wx.login失败，未获取到code');
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
          this.setData({ isLoading: false });
          return;
        }
        
        // 调用云函数获取openid
        wx.cloud.callFunction({
          name: 'login',
          data: {},
          success: res => {
            console.log('云函数调用成功', res);
            // 兼容不同的返回结果格式
            if (!res.result || !res.result.openid) {
              console.error('获取openid失败', res);
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
              this.setData({ isLoading: false });
              return;
            }
            
            const openid = res.result.openid;
            const app = getApp();
            app.globalData.openid = openid;
            
            // 使用诊所邀请码
            // 现在云函数会从 clinics 集合中验证这个邀请码
            const clinicCode = this.data.hospitalCode;
            
            // 创建用户信息
            const userData = {
              vetName: this.data.vetName,
              userRole: 'vet',
              hospitalId: clinicCode, // 使用邀请码作为医院ID
              isApproved: false,
              approvalStatus: 'pending'
            };
            
            // 调用云函数存储用户信息
            wx.cloud.callFunction({
              name: 'manageUser',
              data: {
                action: 'createUser',
                userData: userData
              },
              success: userRes => {
                console.log('创建用户成功', userRes);
                console.log('返回结果详情:', JSON.stringify(userRes.result));
                
                // 兼容不同的返回结果格式
                if (!userRes.result) {
                  console.error('返回结果为空');
                  wx.showToast({
                    title: '创建用户失败，请重试',
                    icon: 'none'
                  });
                  return;
                }
                
                if (userRes.result.success === false) {
                  // 用户已存在，获取现有用户信息
                  if (userRes.result.existingUser) {
                    console.log('用户已存在，使用现有用户信息');
                    const userInfo = userRes.result.existingUser;
                    
                    // 设置登录状态
                    app.globalData.isLoggedIn = true;
                    app.globalData.userInfo = userInfo;
                    app.globalData.userRole = 'vet';
                    
                    // 诊所信息已经在云函数中关联到用户
                    // 如果有clinicInfo，则使用它
                    if (userInfo.clinicInfo) {
                      app.globalData.clinicInfo = userInfo.clinicInfo;
                    }
                    
                    // 检查用户是否已经有宠物主人身份
                    this._checkExistingOwnerRole(openid, userInfo);
                    
                    // 根据审核状态决定跳转页面
                    this.handleVetApprovalStatus(userInfo, openid);
                    return;
                  }
                  
                  wx.showToast({
                    title: userRes.result.errMsg || '创建用户失败',
                    icon: 'none'
                  });
                  return;
                }
                
                // 创建成功或返回结果中有用户信息
                console.log('创建成功或返回结果中有用户信息');
                
                // 尝试从返回结果中获取用户信息
                let userInfo;
                if (userRes.result.userInfo) {
                  userInfo = userRes.result.userInfo;
                } else if (userRes.result._id) {
                  // 如果没有userInfo字段，但有_id，说明创建成功
                  // 构造一个用户信息对象
                  userInfo = {
                    ...userData,
                    openid: openid,
                    _id: userRes.result._id,
                    isApproved: false,
                    approvalStatus: 'pending',
                    createTime: new Date().getTime()
                  };
                } else {
                  // 如果无法获取用户信息，显示错误
                  console.error('无法获取用户信息', userRes.result);
                  wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none'
                  });
                  return;
                }
                
                console.log('最终使用的用户信息:', userInfo);
                
                // 存储到本地缓存
                wx.setStorageSync('userInfo', userInfo);
                wx.setStorageSync('userInfo_' + openid, userInfo);
                
                // 设置登录状态
                app.globalData.isLoggedIn = true;
                app.globalData.userInfo = userInfo;
                
                // 诊所信息已经在云函数中关联到用户
                // 如果有clinicInfo，则使用它
                if (userInfo.clinicInfo) {
                  app.globalData.clinicInfo = userInfo.clinicInfo;
                }
                
                // 根据审核状态决定跳转页面
                console.log('准备跳转页面，审核状态:', userInfo.approvalStatus);
                this.handleVetApprovalStatus(userInfo, openid);
              },
              fail: err => {
                console.error('创建用户失败', err);
                wx.showToast({
                  title: '登录失败，请重试',
                  icon: 'none'
                });
              },
              complete: () => {
                this.setData({ isLoading: false });
              }
            });
          },
          fail: err => {
            console.error('云函数调用失败', err);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
            this.setData({ isLoading: false });
          }
        });
      },
      fail: err => {
        console.error('wx.login 失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },
  
  // 处理兵医审核状态
  handleVetApprovalStatus: function(userInfo, openid) {
    console.log('处理审核状态:', userInfo);
    
    // 先判断用户信息是否完整
    if (!userInfo) {
      console.error('用户信息为空');
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
      return;
    }
    
    // 判断审核状态
    const isApproved = userInfo.isApproved === true || userInfo.approvalStatus === 'approved';
    console.log('是否已审核通过:', isApproved);
    
    if (isApproved) {
      // 已审核通过，跳转到工作台
      console.log('已审核通过，跳转到工作台');
      
      // 显示登录成功的提示
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });
      
      // 显示加载中的提示，然后跳转到工作台
      setTimeout(() => {
        wx.showLoading({
          title: '正在进入工作台',
          mask: true
        });
        
        setTimeout(() => {
          wx.hideLoading();
          wx.reLaunch({
            url: '/pages/workbench/workbench'
          });
        }, 1000);
      }, 800);
    } else {
      // 显示审核中的提示
      console.log('显示审核中的提示');
      // 先停止加载状态
      this.setData({ isLoading: false });
      
      // 直接显示弹窗
      console.log('显示审核中弹窗');
      wx.showModal({
        title: '审核中',
        content: '您的账号正在审核中，请耐心等待管理员审核。',
        confirmText: '知道了',
        showCancel: false,
        success: (res) => {
          console.log('弹窗关闭');
          // 用户关闭弹窗后不做任何操作
        }
      });
    }
  },
  
  // 关闭医院信息弹窗
  closeHospitalModal: function() {
    this.setData({
      showHospitalModal: false
    });
  },
  
  // 跳转到开发工具页面
  goToDevTools: function() {
    wx.navigateTo({
      url: '/pages/devTools/devTools'
    });
  },
  
  // 选择用户角色
  selectRole: function(e) {
    const role = e.currentTarget.dataset.role;
    console.log('选择角色:', role);
    this.setData({
      userRole: role
    });
  },
  
  // 输入宠物主人姓名
  inputOwnerName: function(e) {
    this.setData({
      ownerName: e.detail.value
    });
  },
  
  // 检查用户是否已经有兽医身份
  _checkExistingVetRole: function(openid, userInfo) {
    const app = getApp();
    app.log('DUAL_ROLE', '检查用户是否已有兽医身份', openid);
    // 查询云数据库中是否有该openid的兽医记录
    const db = wx.cloud.database();
    db.collection('users').where({
      openid: openid,
      userRole: 'vet'
    }).get({
      success: res => {
        app.log('DUAL_ROLE', '检查兽医身份结果', res);
        if (res.data && res.data.length > 0) {
          app.log('DUAL_ROLE', '该用户已有兽医身份，标记为双重身份用户');
          // 标记用户有双重身份
          wx.setStorageSync('hasDualRole_' + openid, true);
        }
      },
      fail: err => {
        app.log('DUAL_ROLE', '检查兽医身份失败', err);
      }
    });
  },
  
  // 检查用户是否已经有宠物主人身份
  _checkExistingOwnerRole: function(openid, userInfo) {
    const app = getApp();
    app.log('DUAL_ROLE', '检查用户是否已有宠物主人身份', openid);
    // 查询云数据库中是否有该openid的宠物主人记录
    const db = wx.cloud.database();
    db.collection('users').where({
      openid: openid,
      userRole: 'owner'
    }).get({
      success: res => {
        app.log('DUAL_ROLE', '检查宠物主人身份结果', res);
        if (res.data && res.data.length > 0) {
          app.log('DUAL_ROLE', '该用户已有宠物主人身份，标记为双重身份用户');
          // 标记用户有双重身份
          wx.setStorageSync('hasDualRole_' + openid, true);
        }
      },
      fail: err => {
        app.log('DUAL_ROLE', '检查宠物主人身份失败', err);
      }
    });
  },

  // 宠物主人登录
  ownerLogin: function() {
    // 验证表单字段
    if (!this.data.ownerPhone || this.data.ownerPhone.length !== 11) {
      wx.showToast({
        title: '请输入有效的手机号',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 使用微信原生登录获取openid
    wx.login({
      success: loginRes => {
        console.log('wx.login success:', loginRes);
        if (!loginRes.code) {
          console.error('wx.login失败，未获取到code');
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
          this.setData({ isLoading: false });
          return;
        }
        
        // 调用login云函数获取openid
        wx.cloud.callFunction({
          name: 'login',
          data: {},
          success: res => {
            console.log('云函数调用成功', res);
            // 兼容不同的返回结果格式
            if (!res.result || !res.result.openid) {
              console.error('获取openid失败', res);
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
              this.setData({ isLoading: false });
              return;
            }
            
            const openid = res.result.openid;
            const app = getApp();
            app.globalData.openid = openid;
            
            // 创建用户信息
            const userData = {
              ownerPhone: this.data.ownerPhone,
              phoneNumber: this.data.ownerPhone,
              userRole: 'owner'
            };
            
            // 先检查是否已经有宠物主人身份的用户
            wx.cloud.callFunction({
              name: 'manageUser',
              data: {
                action: 'getUserByRoleAndOpenid',
                openid: openid,
                userRole: 'owner'
              },
              success: ownerRes => {
                console.log('检查宠物主人身份结果', ownerRes);
                
                let userInfo = null;
                
                if (ownerRes.result && ownerRes.result.success && ownerRes.result.userInfo) {
                  // 已有宠物主人身份，直接使用
                  userInfo = ownerRes.result.userInfo;
                  
                  // 更新手机号，确保手机号正确
                  if (userInfo.ownerPhone !== this.data.ownerPhone || userInfo.phoneNumber !== this.data.ownerPhone) {
                    // 更新用户手机号
                    wx.cloud.callFunction({
                      name: 'manageUser',
                      data: {
                        action: 'updateUser',
                        userData: {
                          ownerPhone: this.data.ownerPhone,
                          phoneNumber: this.data.ownerPhone
                        }
                      }
                    });
                    
                    // 同时更新本地用户信息
                    userInfo.ownerPhone = this.data.ownerPhone;
                    userInfo.phoneNumber = this.data.ownerPhone;
                  }
                  
                  this._finishOwnerLogin(openid, userInfo);
                } else {
                  // 如果没有宠物主人身份，创建新用户
                  wx.cloud.callFunction({
                    name: 'manageUser',
                    data: {
                      action: 'createUser',
                      userData: userData
                    },
                    success: createRes => {
                      if (createRes.result && createRes.result.success) {
                        userInfo = createRes.result.userInfo;
                        console.log('创建新的宠物主人用户成功', userInfo);
                      } else if (createRes.result && createRes.result.existingUser) {
                        userInfo = createRes.result.existingUser;
                        console.log('使用现有用户', userInfo);
                      }
                      
                      if (userInfo) {
                        this._finishOwnerLogin(openid, userInfo);
                      } else {
                        wx.showToast({
                          title: '创建用户失败',
                          icon: 'none'
                        });
                        this.setData({ isLoading: false });
                      }
                    },
                    fail: err => {
                      console.error('创建用户失败', err);
                      wx.showToast({
                        title: '登录失败，请重试',
                        icon: 'none'
                      });
                      this.setData({ isLoading: false });
                    }
                  });
                }
              },
              fail: err => {
                console.error('检查宠物主人身份失败', err);
                
                // 如果检查失败，尝试直接创建用户
                wx.cloud.callFunction({
                  name: 'manageUser',
                  data: {
                    action: 'createUser',
                    userData: userData
                  },
                  success: userRes => {
                    console.log('创建用户成功', userRes);
                    
                    let userInfo = null;
                    
                    if (userRes.result && userRes.result.success) {
                      userInfo = userRes.result.userInfo;
                    } else if (userRes.result && userRes.result.existingUser) {
                      userInfo = userRes.result.existingUser;
                    } else {
                      wx.showToast({
                        title: userRes.result && userRes.result.errMsg || '创建用户失败',
                        icon: 'none'
                      });
                      this.setData({ isLoading: false });
                      return;
                    }
                    
                    this._finishOwnerLogin(openid, userInfo);
                  },
                  fail: err => {
                    console.error('创建用户失败', err);
                    wx.showToast({
                      title: '登录失败，请重试',
                      icon: 'none'
                    });
                    this.setData({ isLoading: false });
                  }
                });
              },
              complete: () => {
                // 在完成回调中不设置 isLoading，因为可能还有其他异步操作
              }
            });
          },
          fail: err => {
            console.error('获取openid失败', err);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
            this.setData({ isLoading: false });
          }
        });
      },
      fail: err => {
        console.error('wx.login失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },
  
  // 完成宠物主人登录流程
  _finishOwnerLogin: function(openid, userInfo) {
    const app = getApp();
    
    // 设置登录状态
    app.globalData.isLoggedIn = true;
    app.globalData.userInfo = userInfo;
    app.globalData.userRole = 'owner';
    
    // 存储到本地缓存，确保下次能自动登录
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userInfo_' + openid, userInfo);
    
    console.log('宠物主人登录成功，用户信息已保存到本地存储');
    
    // 检查用户是否已经有兽医身份
    this._checkExistingVetRole(openid, userInfo);
    
    // 跳转到宠物主人页面
    wx.reLaunch({
      url: '/pages/ownerHome/ownerHome'
    });
    
    this.setData({ isLoading: false });
  },
  
  // 开发环境宠物主人直接登录
  devLoginAsOwner: function() {
    console.log('开发环境宠物主人登录');
    
    this.setData({ isLoading: true });
    
    // 直接创建模拟用户
    const mockOpenid = 'owner_' + new Date().getTime();
    const app = getApp();
    app.globalData.openid = mockOpenid;
    app.globalData.isLoggedIn = true;
    app.globalData.userRole = 'owner';
    
    // 创建模拟用户信息
    const userInfo = {
      openid: mockOpenid,
      ownerName: '演示宠物主人',
      ownerPhone: '13800138000',
      phoneNumber: '13800138000', // 兼容两种字段名
      userRole: 'owner',
      createTime: new Date().getTime()
    };
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userInfo_' + mockOpenid, userInfo);
    
    console.log('开发环境宠物主人登录成功，用户信息已保存到本地存储');
    
    // 跳转到宠物主人页面
    wx.reLaunch({
      url: '/pages/ownerHome/ownerHome'
    });
    
    setTimeout(() => {
      this.setData({ isLoading: false });
    }, 500);
  },

  // 医护登录
  staffLogin: function() {
    // 验证表单字段
    if (!this.data.hospitalCode) {
      wx.showToast({
        title: '请输入医院邀请码',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.staffName) {
      wx.showToast({
        title: '请输入医护姓名',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 使用微信原生登录获取openid
    wx.login({
      success: loginRes => {
        console.log('wx.login success:', loginRes);
        if (!loginRes.code) {
          console.error('wx.login失败，未获取到code');
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
          this.setData({ isLoading: false });
          return;
        }
        
        // 调用云函数获取openid
        wx.cloud.callFunction({
          name: 'login',
          data: {},
          success: res => {
            console.log('云函数调用成功', res);
            // 兼容不同的返回结果格式
            if (!res.result || !res.result.openid) {
              console.error('获取openid失败', res);
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
              this.setData({ isLoading: false });
              return;
            }
            
            const openid = res.result.openid;
            const app = getApp();
            app.globalData.openid = openid;
            
            // 使用诊所邀请码
            const clinicCode = this.data.hospitalCode;
            
            // 创建用户信息
            const userData = {
              staffName: this.data.staffName,
              userRole: 'staff',
              hospitalId: clinicCode, // 使用邀请码作为医院ID
              isApproved: false,
              approvalStatus: 'pending'
            };
            
            // 调用云函数存储用户信息
            wx.cloud.callFunction({
              name: 'manageUser',
              data: {
                action: 'createUser',
                userData: userData
              },
              success: userRes => {
                console.log('创建用户成功', userRes);
                console.log('返回结果详情:', JSON.stringify(userRes.result));
                
                // 兼容不同的返回结果格式
                if (!userRes.result) {
                  console.error('返回结果为空');
                  wx.showToast({
                    title: '创建用户失败，请重试',
                    icon: 'none'
                  });
                  return;
                }
                
                if (userRes.result.success === false) {
                  // 用户已存在，获取现有用户信息
                  if (userRes.result.existingUser) {
                    console.log('用户已存在，使用现有用户信息');
                    const userInfo = userRes.result.existingUser;
                    
                    // 设置登录状态
                    app.globalData.isLoggedIn = true;
                    app.globalData.userInfo = userInfo;
                    app.globalData.userRole = 'staff';
                    
                    // 诊所信息已经在云函数中关联到用户
                    if (userInfo.clinicInfo) {
                      app.globalData.clinicInfo = userInfo.clinicInfo;
                    }
                    
                    // 保存到本地存储
                    wx.setStorageSync('userInfo', userInfo);
                    wx.setStorageSync('userInfo_' + openid, userInfo);
                    
                    // 处理医护审核状态
                    this.handleStaffApprovalStatus(userInfo, openid);
                  } else {
                    console.error('用户已存在但未返回用户信息');
                    wx.showToast({
                      title: '登录失败，请重试',
                      icon: 'none'
                    });
                    this.setData({ isLoading: false });
                  }
                } else {
                  // 新用户创建成功
                  console.log('新用户创建成功');
                  const userInfo = userRes.result.userInfo;
                  
                  // 设置登录状态
                  app.globalData.isLoggedIn = true;
                  app.globalData.userInfo = userInfo;
                  app.globalData.userRole = 'staff';
                  
                  // 诊所信息已经在云函数中关联到用户
                  if (userInfo.clinicInfo) {
                    app.globalData.clinicInfo = userInfo.clinicInfo;
                  }
                  
                  // 保存到本地存储
                  wx.setStorageSync('userInfo', userInfo);
                  wx.setStorageSync('userInfo_' + openid, userInfo);
                  
                  // 处理医护审核状态
                  this.handleStaffApprovalStatus(userInfo, openid);
                }
              },
              fail: err => {
                console.error('创建用户失败', err);
                wx.showToast({
                  title: '创建用户失败，请重试',
                  icon: 'none'
                });
                this.setData({ isLoading: false });
              }
            });
          },
          fail: err => {
            console.error('云函数调用失败', err);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
            this.setData({ isLoading: false });
          }
        });
      },
      fail: err => {
        console.error('wx.login失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },

  // 处理医护审核状态
  handleStaffApprovalStatus: function(userInfo, openid) {
    if (!userInfo.isApproved) {
      // 如果未审核，显示待审核提示
      wx.showModal({
        title: '待审核',
        content: '您的医护账号正在审核中，请耐心等待审核通过后再登录。',
        showCancel: false,
        success: () => {
          this.setData({ isLoading: false });
        }
      });
    } else {
      // 如果已审核，跳转到医护工作台
      wx.reLaunch({
        url: '/pages/staffWorkbench/staffWorkbench'
      });
      
      setTimeout(() => {
        this.setData({ isLoading: false });
      }, 500);
    }
  },

  // 开发环境医护登录
  devLoginAsStaff: function() {
    console.log('开发环境医护登录');
    
    this.setData({ isLoading: true });
    
    // 直接创建模拟用户
    const mockOpenid = 'staff_' + new Date().getTime();
    const app = getApp();
    app.globalData.openid = mockOpenid;
    app.globalData.isLoggedIn = true;
    app.globalData.userRole = 'staff';
    
    // 模拟医院信息
    const hospitalInfo = {
      id: 'hospital_123',
      name: '演示宠物医院',
      address: '北京市海淀区中关村大街 1 号',
      code: 'DEMO123'
    };
    
    // 创建模拟用户信息
    const userInfo = {
      openid: mockOpenid,
      staffName: '演示医护',
      userRole: 'staff',
      hospitalId: hospitalInfo.id,
      hospitalInfo: hospitalInfo,
      isApproved: true, // 开发环境默认已审核
      approvalStatus: 'approved', // 开发环境默认已审核
      createTime: new Date().getTime()
    };
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userInfo_' + mockOpenid, userInfo);
    wx.setStorageSync('hospitalInfo_' + hospitalInfo.id, hospitalInfo);
    
    // 设置全局数据
    app.globalData.hospitalInfo = hospitalInfo;
    
    // 直接跳转到医护工作台
    wx.reLaunch({
      url: '/pages/staffWorkbench/staffWorkbench'
    });
    
    setTimeout(() => {
      this.setData({ isLoading: false });
    }, 500);
  }
})
