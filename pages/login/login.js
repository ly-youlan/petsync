// pages/login/login.js
Page({
  data: {
    phoneNumber: '',
    isLoading: false,
    showHospitalModal: false,
    hospitalName: '',
    hospitalAddress: '',
    vetName: ''
  },

  onLoad: function() {
    // 检查用户是否已登录
    const app = getApp();
    if (app.globalData.isLoggedIn && app.globalData.openid) {
      // 如果已登录，检查是否已绑定医院
      this.checkHospitalBinding(app.globalData.openid);
    }
  },

  // 开发环境直接登录
  devLogin: function() {
    console.log('开发环境直接登录');
    
    this.setData({ isLoading: true });
    
    // 设置指定手机号
    const mockPhoneNumber = '18926139619';
    this.setData({ phoneNumber: mockPhoneNumber });
    
    // 获取用户OpenID并创建用户
    this.getUserOpenId().then(openid => {
      console.log('获取开发环境openid成功:', openid);
      
      // 检查用户是否存在
      return this.checkUserExists(openid, mockPhoneNumber);
    }).then(userInfo => {
      console.log('用户信息:', userInfo);
      
      // 自动设置为已审核状态
      userInfo.isApproved = true;
      userInfo.hospitalName = '演示医院';
      userInfo.hospitalAddress = '演示地址';
      userInfo.vetName = '演示兽医';
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', userInfo);
      
      // 直接跳转到工作台
      wx.reLaunch({
        url: '/pages/workbench/workbench'
      });
    }).catch(err => {
      console.error('开发环境登录错误:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isLoading: false });
    });
  },
  
  // 获取微信手机号
  getPhoneNumber: function(e) {
    console.log('getPhoneNumber event:', e);
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '获取手机号失败',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });
    
    // 先获取用户OpenID，然后才解析手机号
    this.getUserOpenId().then(openid => {
      console.log('Got openid:', openid);
      
      // 使用云函数获取手机号
      return wx.cloud.callFunction({
        name: 'getPhoneNumber',
        data: {
          code: e.detail.code  // 新版微信小程序使用 code 而非 cloudID
        }
      }).then(res => {
        console.log('云函数获取手机号结果:', res);
        
        if (res.result && res.result.success && res.result.phoneNumber) {
          const phoneNumber = res.result.phoneNumber;
          console.log('获取到手机号:', phoneNumber);
          this.setData({ phoneNumber });
          return this.checkUserExists(openid, phoneNumber);
        } else {
          // 如果云函数调用失败，在开发环境下使用模拟手机号
          console.warn('云函数获取手机号失败，使用模拟手机号:', res);
          const mockPhoneNumber = '18926139619';
          this.setData({ phoneNumber: mockPhoneNumber });
          return this.checkUserExists(openid, mockPhoneNumber);
        }
      });
    }).catch(err => {
      console.error('获取手机号错误:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isLoading: false });
    });
  },

  // 获取用户OpenID
  getUserOpenId: function() {
    return new Promise((resolve, reject) => {
      const app = getApp();
      if (app.globalData.openid) {
        resolve(app.globalData.openid);
        return;
      }
      
      // 先使用微信原生登录获取code
      wx.login({
        success: loginRes => {
          console.log('wx.login success:', loginRes);
          if (loginRes.code) {
            // 模拟一个openid进行测试
            // 注意：在真实环境中，应该使用云函数获取openid
            const mockOpenid = 'test_openid_' + new Date().getTime();
            app.globalData.openid = mockOpenid;
            resolve(mockOpenid);
            
            /* 下面是正常的云函数调用方式，当云函数配置好后可以使用
            wx.cloud.callFunction({
              name: 'login',
              data: {}
            }).then(res => {
              if (res.result && res.result.openid) {
                app.globalData.openid = res.result.openid;
                resolve(res.result.openid);
              } else {
                reject(new Error('获取openid失败'));
              }
            }).catch(reject);
            */
          } else {
            reject(new Error('登录失败：' + loginRes.errMsg));
          }
        },
        fail: err => {
          console.error('wx.login fail:', err);
          reject(err);
        }
      });
    });
  },

  // 检查用户是否已存在
  checkUserExists: function(openid, phoneNumber) {
    console.log('Checking if user exists:', openid, phoneNumber);
    
    // 使用模拟数据进行测试
    // 模拟用户不存在的情况，直接创建新用户
    const app = getApp();
    app.globalData.isLoggedIn = true;
    
    // 尝试使用本地存储检查用户是否存在
    const userInfo = wx.getStorageSync('userInfo_' + openid);
    if (userInfo) {
      console.log('Found user in local storage:', userInfo);
      return this.checkHospitalBinding(openid);
    } else {
      // 新用户，创建用户记录
      return this.createNewUser(openid, phoneNumber);
    }
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    return db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        // 用户已存在，检查是否已绑定医院
        const userData = res.data[0];
        const app = getApp();
        app.globalData.isLoggedIn = true;
        
        return this.checkHospitalBinding(openid);
      } else {
        // 新用户，创建用户记录
        return this.createNewUser(openid, phoneNumber);
      }
    });
    */
  },

  // 创建新用户
  createNewUser: function(openid, phoneNumber) {
    console.log('Creating new user:', openid, phoneNumber);
    
    // 使用本地存储模拟数据库操作
    const userData = {
      _openid: openid,
      phoneNumber: phoneNumber,
      createTime: new Date().toISOString(),
      hospitalInfo: null,  // 医院信息初始为空
      isApproved: false,   // 是否已审核通过
      role: 'vet'          // 角色为兽医
    };
    
    // 将用户数据保存到本地存储
    wx.setStorageSync('userInfo_' + openid, userData);
    
    const app = getApp();
    app.globalData.isLoggedIn = true;
    
    // 显示医院绑定弹窗
    this.setData({ showHospitalModal: true });
    
    return Promise.resolve();
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    return db.collection('users').add({
      data: {
        phoneNumber: phoneNumber,
        createTime: db.serverDate(),
        hospitalInfo: null,  // 医院信息初始为空
        isApproved: false,   // 是否已审核通过
        role: 'vet'          // 角色为兽医
      }
    }).then(() => {
      const app = getApp();
      app.globalData.isLoggedIn = true;
      
      // 显示医院绑定弹窗
      this.setData({ showHospitalModal: true });
    });
    */
  },

  // 检查医院绑定状态
  checkHospitalBinding: function(openid) {
    console.log('Checking hospital binding for:', openid);
    
    // 使用本地存储模拟数据库操作
    const userData = wx.getStorageSync('userInfo_' + openid);
    const app = getApp();
    
    if (userData && userData.hospitalInfo) {
      // 已绑定医院
      app.globalData.hospitalInfo = userData.hospitalInfo;
      
      if (userData.isApproved) {
        // 已审核通过，跳转到工作台
        wx.redirectTo({
          url: '/pages/workbench/workbench',
        });
      } else {
        // 待审核，显示待审核提示
        wx.showModal({
          title: '审核中',
          content: '您的医院绑定信息正在审核中，请耐心等待',
          showCancel: false
        });
      }
    } else {
      // 未绑定医院，显示医院绑定弹窗
      this.setData({ showHospitalModal: true });
    }
    
    return Promise.resolve();
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    return db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const userData = res.data[0];
        const app = getApp();
        
        if (userData.hospitalInfo) {
          // 已绑定医院
          app.globalData.hospitalInfo = userData.hospitalInfo;
          
          if (userData.isApproved) {
            // 已审核通过，跳转到工作台
            wx.redirectTo({
              url: '/pages/workbench/workbench',
            });
          } else {
            // 待审核，显示待审核提示
            wx.showModal({
              title: '审核中',
              content: '您的医院绑定信息正在审核中，请耐心等待',
              showCancel: false
            });
          }
        } else {
          // 未绑定医院，显示医院绑定弹窗
          this.setData({ showHospitalModal: true });
        }
      }
    });
    */
  },

  // 输入手机号
  inputPhoneNumber: function(e) {
    this.setData({
      phoneNumber: e.detail.value
    });
  },

  // 手动登录
  login: function() {
    if (this.data.phoneNumber.length !== 11) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });
    
    // 获取当前用户openid
    this.getUserOpenId().then(openid => {
      return this.checkUserExists(openid, this.data.phoneNumber);
    }).catch(err => {
      console.error('登录错误:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isLoading: false });
    });
  },

  // 输入医院名称
  inputHospitalName: function(e) {
    this.setData({
      hospitalName: e.detail.value
    });
  },

  // 输入医院地址
  inputHospitalAddress: function(e) {
    this.setData({
      hospitalAddress: e.detail.value
    });
  },

  // 输入兽医姓名
  inputVetName: function(e) {
    this.setData({
      vetName: e.detail.value
    });
  },

  // 提交医院信息
  submitHospitalInfo: function() {
    if (!this.data.hospitalName || !this.data.hospitalAddress || !this.data.vetName) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });
    
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 使用本地存储模拟数据库操作
    const userData = wx.getStorageSync('userInfo_' + openid) || {};
    
    // 更新医院信息
    userData.hospitalInfo = {
      name: this.data.hospitalName,
      address: this.data.hospitalAddress,
      vetName: this.data.vetName
    };
    userData.updateTime = new Date().toISOString();
    
    // 保存到本地存储
    wx.setStorageSync('userInfo_' + openid, userData);
    
    // 更新全局数据
    app.globalData.hospitalInfo = userData.hospitalInfo;
    
    // 关闭弹窗并显示成功提示
    this.setData({ 
      showHospitalModal: false,
      isLoading: false
    });
    
    wx.showModal({
      title: '提交成功',
      content: '您的医院绑定信息已提交，请等待管理员审核',
      showCancel: false
    });
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    
    // 更新用户的医院信息
    db.collection('users').where({
      _openid: app.globalData.openid
    }).update({
      data: {
        hospitalInfo: {
          name: this.data.hospitalName,
          address: this.data.hospitalAddress,
          vetName: this.data.vetName
        },
        updateTime: db.serverDate()
      }
    }).then(() => {
      this.setData({ showHospitalModal: false });
      
      app.globalData.hospitalInfo = {
        name: this.data.hospitalName,
        address: this.data.hospitalAddress,
        vetName: this.data.vetName
      };
      
      wx.showModal({
        title: '提交成功',
        content: '您的医院绑定信息已提交，请等待管理员审核',
        showCancel: false
      });
    }).catch(err => {
      console.error('提交医院信息错误:', err);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isLoading: false });
    });
    */
  },

  // 关闭医院信息弹窗
  closeHospitalModal() {
    this.setData({
      showHospitalModal: false
    });
  },
  
  // 跳转到开发工具页面
  goToDevTools() {
    wx.navigateTo({
      url: '/pages/devTools/devTools'
    });
  }
})
