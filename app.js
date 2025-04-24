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
                // 将用户信息保存到全局数据
                this.globalData.userInfo = latestUserData;
                this.globalData.isLoggedIn = true; // 确保设置登录状态
                
                // 保存诊所信息到全局数据
                if (latestUserData.clinicInfo) {
                  this.globalData.clinicInfo = latestUserData.clinicInfo;
                }
                
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
                    
                    setTimeout(() => {
                      wx.hideLoading();
                      // 根据用户角色跳转到不同页面
                      if (latestUserData.userRole === 'owner') {
                        console.log('宠物主人登录，跳转到宠物主人主页');
                        wx.reLaunch({
                          url: '/pages/ownerHome/ownerHome'
                        });
                      } else {
                        console.log('兽医登录，跳转到工作台');
                        wx.reLaunch({
                          url: '/pages/workbench/workbench'
                        });
                      }
                    }, 1000);
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
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    openid: null,
    hospitalInfo: null,
    clinicInfo: null
  }
})
