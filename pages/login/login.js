// pages/login/login.js
Page({
  data: {
    isLoading: false,
    hospitalCode: '',  // 医院邀请码
    vetName: '',       // 兽医姓名
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
  
  // 输入宠物主人手机号
  inputOwnerPhone: function(e) {
    this.setData({
      ownerPhone: e.detail.value
    });
  },
  
  // 兽医登录
  vetLogin: function() {
    // 验证表单字段
    if (!this.data.vetName) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.hospitalCode) {
      wx.showToast({
        title: '请输入医院邀请码',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 调用云函数获取 openid
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('云函数调用成功', res);
        const openid = res.result.openid;
        const app = getApp();
        app.globalData.openid = openid;
        app.globalData.isLoggedIn = true;
        app.globalData.userRole = 'vet';
        
        // 模拟从云数据库查询医院信息
        // 实际应用中应该从数据库查询医院邀请码是否有效
        const hospitalInfo = {
          id: 'hospital_' + this.data.hospitalCode,
          name: '宠物医院_' + this.data.hospitalCode,
          address: '北京市海淀区中关村大街 1 号',
          code: this.data.hospitalCode
        };
        
        // 创建用户信息
        const userInfo = {
          openid: openid,
          vetName: this.data.vetName,
          userRole: 'vet',
          hospitalId: hospitalInfo.id,
          hospitalInfo: hospitalInfo,
          isApproved: false, // 默认未审核
          approvalStatus: 'pending', // pending, approved, rejected
          createTime: new Date().getTime()
        };
        
        // 保存到本地存储
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('userInfo_' + openid, userInfo);
        wx.setStorageSync('hospitalInfo_' + hospitalInfo.id, hospitalInfo);
        
        // 设置全局数据
        app.globalData.hospitalInfo = hospitalInfo;
        
        // 根据审核状态决定跳转页面
        if (userInfo.isApproved || userInfo.approvalStatus === 'approved') {
          // 已审核通过，跳转到工作台
          wx.reLaunch({
            url: '/pages/workbench/workbench'
          });
        } else {
          // 显示审核中的提示
          wx.showModal({
            title: '审核中',
            content: '您的账号正在审核中，请耐心等待。\n\n开发环境下可以点击“确定”模拟审核通过。',
            confirmText: '模拟审核通过',
            cancelText: '返回',
            success: (res) => {
              if (res.confirm) {
                // 模拟审核通过
                userInfo.isApproved = true;
                userInfo.approvalStatus = 'approved';
                wx.setStorageSync('userInfo', userInfo);
                wx.setStorageSync('userInfo_' + openid, userInfo);
                
                // 跳转到工作台
                wx.reLaunch({
                  url: '/pages/workbench/workbench'
                });
              }
            }
          });
        }
      },
      fail: err => {
        console.error('云函数调用失败', err);
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
          data: {}
        }).then(loginResult => {
          console.log('login云函数结果:', loginResult);
          
          if (!loginResult.result || !loginResult.result.openid) {
            throw new Error('获取openid失败');
          }
          
          const openid = loginResult.result.openid;
          console.log('获取到openid:', openid);
          
          // 创建宠物主人信息
          const userInfo = {
            openid: openid,
            ownerPhone: this.data.ownerPhone,
            userRole: 'owner',
            createTime: new Date().getTime()
          };
          
          // 保存到本地存储
          wx.setStorageSync('userInfo', userInfo);
          wx.setStorageSync('userInfo_' + openid, userInfo);
          wx.setStorageSync('ownerPhone_' + this.data.ownerPhone, userInfo);
          
          // 设置全局数据
          const app = getApp();
          app.globalData.openid = openid;
          app.globalData.isLoggedIn = true;
          app.globalData.userRole = 'owner';
          
          // 登录成功，跳转到宠物列表页面
          wx.reLaunch({
            url: '/pages/petList/petList'
          });
        }).catch(err => {
          console.error('登录过程中出错:', err);
          wx.showToast({
            title: err.message || '登录失败，请重试',
            icon: 'none'
          });
        }).finally(() => {
          this.setData({ isLoading: false });
        });
      },
      fail: err => {
        console.error('wx.login失败:', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },
  
  // 开发环境宠物主人直接登录
  devLoginAsOwner: function() {
    console.log('开发环境宠物主人直接登录');
    
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
      ownerPhone: '13800138000',
      userRole: 'owner',
      createTime: new Date().getTime()
    };
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('userInfo_' + mockOpenid, userInfo);
    
    // 直接跳转到宠物列表页面
    wx.reLaunch({
      url: '/pages/petList/petList'
    });
    
    setTimeout(() => {
      this.setData({ isLoading: false });
    }, 500);
  }
})
