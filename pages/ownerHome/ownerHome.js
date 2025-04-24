// pages/ownerHome/ownerHome.js
Page({
  data: {
    loading: true,
    petRecords: [],
    ownerInfo: null,
    searchValue: '',
    refreshing: false,
    emptyState: false
  },

  onLoad: function() {
    this.loadOwnerInfo();
    this.fetchPetRecords();
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({ refreshing: true });
    this.fetchPetRecords();
  },
  
  // 加载宠物主人信息
  loadOwnerInfo: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    
    if (userInfo) {
      this.setData({
        ownerInfo: {
          phone: userInfo.ownerPhone || '',
          name: userInfo.ownerName || ''
        }
      });
    }
  },
  
  // 获取宠物记录
  fetchPetRecords: function() {
    const app = getApp();
    const openid = app.globalData.openid;
    
    if (!openid) {
      console.error('未获取到openid');
      this.setData({ 
        loading: false,
        refreshing: false,
        emptyState: true
      });
      wx.stopPullDownRefresh();
      return;
    }
    
    // 使用云函数获取宠物记录
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        openid: openid,
        userRole: 'owner',
        ownerPhone: this.data.ownerInfo ? this.data.ownerInfo.phone : '',
        searchValue: this.data.searchValue || null
      },
      success: res => {
        console.log('获取宠物记录成功:', res);
        
        if (res.result && res.result.success) {
          // 使用云端返回的数据
          const petRecords = res.result.petRecords || [];
          
          this.setData({
            petRecords: petRecords,
            loading: false,
            refreshing: false,
            emptyState: petRecords.length === 0
          });
          
          // 将数据缓存到本地
          wx.setStorageSync('ownerPetRecords_' + openid, petRecords);
        } else {
          // 如果云函数调用失败或返回错误，尝试使用本地缓存
          this._fallbackToLocalPetRecords(openid);
        }
      },
      fail: err => {
        console.error('获取宠物记录失败:', err);
        // 如果云函数调用失败，尝试使用本地缓存
        this._fallbackToLocalPetRecords(openid);
      },
      complete: () => {
        wx.stopPullDownRefresh();
      }
    });
  },
  
  // 当云函数调用失败时，回退到本地缓存
  _fallbackToLocalPetRecords: function(openid) {
    console.log('回退到本地缓存的宠物记录');
    const petRecords = wx.getStorageSync('ownerPetRecords_' + openid) || [];
    
    this.setData({
      petRecords: petRecords,
      loading: false,
      refreshing: false,
      emptyState: petRecords.length === 0
    });
  },
  
  // 搜索宠物记录
  onSearch: function(e) {
    this.setData({
      searchValue: e.detail.value
    });
    this.fetchPetRecords();
  },
  
  // 清除搜索
  clearSearch: function() {
    this.setData({
      searchValue: ''
    });
    this.fetchPetRecords();
  },
  
  // 查看宠物详情
  viewPetDetail: function(e) {
    const petId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/ownerPetDetail/ownerPetDetail?id=' + petId
    });
  },
  
  // 退出登录
  logout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          // 清除登录状态
          const app = getApp();
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          
          // 清除本地存储
          wx.removeStorageSync('userInfo');
          
          // 跳转到登录页面
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
})
