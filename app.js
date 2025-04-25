// app.js
App({
  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        // 注意：请将下面的 DYNAMIC_CURRENT_ENV 替换为您的实际云环境ID
        // 例如：env: 'your-env-id'
        env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前所选云环境
        traceUser: true,
      })
    }
    
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    
    // 检查用户登录状态，实现自动登录
    this.checkLoginStatus()
  },
  
  // 检查用户登录状态
  checkLoginStatus: function() {
    console.log('检查用户登录状态')
    // 先检查本地存储中是否有用户信息
    const userInfo = wx.getStorageSync('userInfo')
    
    if (userInfo) {
      console.log('本地存储中有用户信息:', userInfo)
      // 如果有用户信息，调用云函数获取openid
      wx.cloud.callFunction({
        name: 'login',
        success: res => {
          console.log('获取openid成功:', res.result)
          const openid = res.result.openid
          this.globalData.openid = openid
          this.globalData.isLoggedIn = true; // 设置登录状态标志
          
          // 获取用户完整信息
          const userData = wx.getStorageSync('userInfo_' + openid) || userInfo
          
          // 从云端获取最新的用户信息
          wx.cloud.callFunction({
            name: 'manageUser',
            data: {
              action: 'getUser'
            },
            success: userRes => {
              console.log('从云端获取用户信息成功:', userRes.result);
              
              // 定义新变量存储用户数据
              let latestUserData = userData;
              
              // 如果云端有用户信息，使用云端数据
              if (userRes.result && userRes.result.success && userRes.result.userInfo) {
                latestUserData = userRes.result.userInfo;
                // 更新本地存储
                wx.setStorageSync('userInfo', latestUserData);
                wx.setStorageSync('userInfo_' + openid, latestUserData);
              }
              
              // 判断用户是否已审核通过
              const isApproved = latestUserData.isApproved === true || latestUserData.approvalStatus === 'approved'
              
              if (isApproved) {
                console.log('用户已审核通过，自动跳转到工作台');
                // 设置全局数据
                this.globalData.userInfo = latestUserData;
                this.globalData.isLoggedIn = true;
                this.globalData.userRole = latestUserData.userRole; // 设置用户角色
                
                // 如果有诊所信息，也设置到全局数据
                if (latestUserData.clinicInfo) {
                  this.globalData.clinicInfo = latestUserData.clinicInfo;
                }
                
                console.log('自动登录成功，用户角色:', latestUserData.userRole);
                
                // 输出全局数据状态，便于调试
                console.log('全局数据已设置:', this.globalData);
                
                // 显示自动登录成功的提示
                wx.showToast({
                  title: '自动登录成功',
                  icon: 'success',
                  duration: 1500
                });
                
                // 如果当前页面是登录页，根据用户角色跳转到相应页面
                const pages = getCurrentPages();
                if (pages.length === 0 || (pages.length > 0 && pages[0].route === 'pages/login/login')) {
                  setTimeout(() => {
                    wx.showLoading({
                      title: '正在登录',
                      mask: true
                    });
                    
                    // 先检查是否有双重身份标记
                    const hasDualRole = wx.getStorageSync('hasDualRole_' + openid);
                    this.log('AUTH', '自动登录时检查双重身份', { hasDualRole, openid });
                    
                    // 强制显示选择对话框，确保用户可以选择身份
                    if (hasDualRole) {
                      this._showRoleSelectionDialog(openid);
                    } else {
                      // 如果不是双重身份用户，正常处理
                      this._checkDualRole(latestUserData, openid);
                    }
                  }, 800);
                }
              } else {
                console.log('用户未审核通过或需要重新登录');
              }
            },
            fail: err => {
              console.error('从云端获取用户信息失败:', err);
            }
          });
        },
        fail: err => {
          console.error('获取openid失败:', err);
        }
      });
    } else {
      console.log('本地没有用户信息，需要登录');
    }
    
    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        console.log('wx.login 成功:', res);
      }
    });
  },
  // 检查用户是否有双重身份，并处理登录跳转
  _checkDualRole: function(userData, openid) {
    // 检查是否存在双重身份的标记
    const hasDualRole = wx.getStorageSync('hasDualRole_' + openid);
    
    this.log('AUTH', '检查用户是否有双重身份', { hasDualRole, openid });
    
    // 如果用户有双重身份，则使用专用的角色选择对话框
    if (hasDualRole) {
      this._showRoleSelectionDialog(openid);
      return; // 直接返回，避免执行后面的代码
    }
    
    // 检查是否有上次选择的角色
    const lastRole = wx.getStorageSync('lastRole_' + openid);
    
    // 如果有上次选择的角色，使用该角色登录
    if (lastRole) {
      this.globalData.userRole = lastRole;
      this.log('AUTH', '使用上次选择的角色登录', lastRole);
      
      // 加载对应角色的用户信息
      this._loadUserInfoByRole(openid, lastRole);
    } else {
      // 否则使用用户数据中的角色
      this.globalData.userRole = userData.userRole;
      this.log('AUTH', '使用用户数据中的角色', userData.userRole);
      
      // 确保全局数据中的用户信息与角色匹配
      if (userData.userRole !== 'vet' && this.globalData.userInfo && this.globalData.userInfo.userRole === 'vet') {
        // 如果当前用户角色不是兽医，但全局数据中的用户信息是兽医，加载正确的用户信息
        this._loadUserInfoByRole(openid, userData.userRole);
      }
    }
    
    setTimeout(() => {
      wx.hideLoading();
      // 根据用户角色跳转到不同页面
      if (this.globalData.userRole === 'owner') {
        this.log('AUTH', '宠物主人登录，跳转到宠物主人主页');
        wx.reLaunch({
          url: '/pages/ownerHome/ownerHome'
        });
      } else {
        this.log('AUTH', '兽医登录，跳转到工作台');
        wx.reLaunch({
          url: '/pages/workbench/workbench'
        });
      }
    }, 1000);
  },
  
  // 显示角色选择对话框
  _showRoleSelectionDialog: function(openid) {
    this.log('AUTH', '显示角色选择对话框');
    wx.hideLoading();
    wx.showModal({
      title: '选择登录身份',
      content: '您同时拥有兽医和宠物主人身份，请选择登录方式',
      cancelText: '宠物主人',
      confirmText: '兽医',
      success: (res) => {
        if (res.confirm) {
          // 选择兽医身份
          this.globalData.userRole = 'vet';
          // 保存最后选择的角色
          wx.setStorageSync('lastRole_' + openid, 'vet');
          this.log('AUTH', '用户选择以兽医身份登录');
          
          // 加载兽医身份的用户信息
          this._loadUserInfoByRole(openid, 'vet');
          
          wx.reLaunch({
            url: '/pages/workbench/workbench'
          });
        } else {
          // 选择宠物主人身份
          this.globalData.userRole = 'owner';
          // 保存最后选择的角色
          wx.setStorageSync('lastRole_' + openid, 'owner');
          this.log('AUTH', '用户选择以宠物主人身份登录');
          
          // 加载宠物主人身份的用户信息
          this._loadUserInfoByRole(openid, 'owner');
          
          wx.reLaunch({
            url: '/pages/ownerHome/ownerHome'
          });
        }
      }
    });
  },
  
  // 根据角色加载用户信息
  _loadUserInfoByRole: function(openid, role) {
    this.log('AUTH', '根据角色加载用户信息', { openid, role });
    
    // 查询指定角色的用户信息
    wx.cloud.callFunction({
      name: 'manageUser',
      data: {
        action: 'getUserByRoleAndOpenid',
        openid: openid,
        userRole: role
      },
      success: res => {
        if (res.result && res.result.success && res.result.userInfo) {
          const userInfo = res.result.userInfo;
          this.log('AUTH', '成功加载用户信息', userInfo);
          
          // 更新全局数据
          this.globalData.userInfo = userInfo;
          
          // 更新本地缓存
          wx.setStorageSync('userInfo', userInfo);
          wx.setStorageSync('userInfo_' + openid, userInfo);
        } else {
          this.log('AUTH', '加载用户信息失败', res);
        }
      },
      fail: err => {
        this.log('AUTH', '调用云函数加载用户信息失败', err);
      }
    });
  },
  
  // 日志控制函数
  log: function(tag, message, data) {
    // 设置为true开启日志，false关闭日志
    const enableLogging = true;
    // 设置要显示的日志标签，空数组表示显示所有
    const enabledTags = ['AUTH', 'DUAL_ROLE'];
    
    if (!enableLogging) return;
    
    // 如果标签列表为空或者包含当前标签，则显示日志
    if (enabledTags.length === 0 || enabledTags.includes(tag)) {
      if (data) {
        console.log(`[${tag}] ${message}`, data);
      } else {
        console.log(`[${tag}] ${message}`);
      }
    }
  },
  
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    openid: null,
    userRole: null,
    hospitalInfo: null,
    clinicInfo: null
  }
})
