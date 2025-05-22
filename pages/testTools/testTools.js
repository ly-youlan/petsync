// pages/testTools/testTools.js
Page({
  data: {
    loading: false,
    results: '',
    testStaffInfo: null
  },

  // 创建petAssignments集合
  createCollection: function() {
    this.setData({
      loading: true,
      results: '正在创建集合...'
    });

    wx.cloud.callFunction({
      name: 'createPetAssignmentsCollection',
      success: res => {
        console.log('创建集合结果:', res);
        this.setData({
          results: JSON.stringify(res.result, null, 2),
          loading: false
        });
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '集合创建成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '集合创建失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('创建集合失败:', err);
        this.setData({
          results: JSON.stringify(err, null, 2),
          loading: false
        });
        
        wx.showToast({
          title: '创建集合失败',
          icon: 'none'
        });
      }
    });
  },

  // 创建测试医护人员账号
  createTestStaff: function() {
    this.setData({
      loading: true,
      results: '正在创建测试医护人员...'
    });

    wx.cloud.callFunction({
      name: 'createTestStaff',
      success: res => {
        console.log('创建测试医护人员结果:', res);
        this.setData({
          results: JSON.stringify(res.result, null, 2),
          loading: false
        });
        
        if (res.result && res.result.success) {
          this.setData({
            testStaffInfo: res.result.staffInfo
          });
          
          wx.showToast({
            title: '测试医护人员创建成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '创建测试医护人员失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('创建测试医护人员失败:', err);
        this.setData({
          results: JSON.stringify(err, null, 2),
          loading: false
        });
        
        wx.showToast({
          title: '创建测试医护人员失败',
          icon: 'none'
        });
      }
    });
  },

  // 测试医护登录
  loginAsTestStaff: function() {
    if (!this.data.testStaffInfo) {
      wx.showToast({
        title: '请先创建测试医护人员',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    
    const staffInfo = this.data.testStaffInfo;
    const app = getApp();
    
    // 设置全局数据
    app.globalData.openid = staffInfo.openid;
    app.globalData.isLoggedIn = true;
    app.globalData.userRole = 'staff';
    app.globalData.userInfo = staffInfo;
    
    if (staffInfo.clinicInfo) {
      app.globalData.clinicInfo = staffInfo.clinicInfo;
    }
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', staffInfo);
    wx.setStorageSync('userInfo_' + staffInfo.openid, staffInfo);
    
    // 跳转到医护工作台
    wx.reLaunch({
      url: '/pages/staffWorkbench/staffWorkbench'
    });
  },

  // 返回工作台
  goBack: function() {
    wx.navigateBack();
  }
});
