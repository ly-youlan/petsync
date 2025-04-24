// pages/devTools/devTools.js
Page({
  data: {
    userInfo: null,
    isApproved: false
  },

  onLoad: function() {
    this.loadUserInfo();
  },

  loadUserInfo: function() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isApproved: userInfo.isApproved || false
      });
    } else {
      wx.showToast({
        title: '未找到用户信息',
        icon: 'none'
      });
    }
  },

  toggleApproval: function() {
    const userInfo = this.data.userInfo;
    if (!userInfo) return;

    // 切换审核状态
    userInfo.isApproved = !userInfo.isApproved;
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    
    this.setData({
      userInfo: userInfo,
      isApproved: userInfo.isApproved
    });
    
    wx.showToast({
      title: userInfo.isApproved ? '已审核通过' : '已取消审核',
      icon: 'success'
    });
  },

  clearStorage: function() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地存储数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({
            title: '已清除所有数据',
            icon: 'success'
          });
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },

  navigateBack: function() {
    wx.navigateBack();
  }
})
