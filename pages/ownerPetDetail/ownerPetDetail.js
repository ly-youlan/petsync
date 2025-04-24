// pages/ownerPetDetail/ownerPetDetail.js
Page({
  data: {
    pet: null,
    records: [],
    loading: true,
    refreshing: false
  },
  
  onLoad: function (options) {
    console.log('加载宠物详情，宠物ID:', options.id);
    this.petId = options.id;
    this.loadPetDetail();
  },
  
  // 页面显示时触发，用于从添加记录页面返回时刷新
  onShow: function() {
    // 如果是从添加记录页面返回，则刷新数据
    if (this.needRefresh) {
      this.loadPetDetail();
      this.needRefresh = false;
    }
  },
  
  // 启用页面下拉刷新
  onPullDownRefresh: function() {
    this.setData({ refreshing: true });
    this.loadPetDetail();
  },
  
  // 加载宠物详情
  loadPetDetail: function() {
    if (!this.data.refreshing) {
      this.setData({ loading: true });
    }
    
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 使用云函数获取宠物详情
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        petId: this.petId,
        openid: openid,
        userRole: 'owner'
      },
      success: res => {
        console.log('获取宠物详情成功:', res);
        
        if (res.result && res.result.success) {
          // 使用云端返回的数据
          const petRecords = res.result.petRecords || [];
          
          if (petRecords.length > 0) {
            const petRecord = petRecords[0];
            
            // 将宠物记录转换为页面所需格式
            this.setData({
              pet: {
                id: petRecord._id,
                name: petRecord.petInfo.name,
                breed: petRecord.petInfo.breed,
                avatar: petRecord.petInfo.avatar,
                reason: petRecord.reason,
                status: petRecord.status,
                surgeryType: petRecord.surgeryType,
                createTime: petRecord.createTime,
                ownerInfo: petRecord.ownerInfo,
                clinicName: petRecord.clinicName || '未知诊所',
                tags: petRecord.tags || []
              },
              records: petRecord.updates ? petRecord.updates.map((update, index) => ({
                id: index,
                content: update.content,
                images: update.images || [],
                createdAt: update.createTime,
                vetName: update.vetName
              })) : [],
              loading: false,
              refreshing: false
            });
          } else {
            this.setData({
              loading: false,
              refreshing: false
            });
            
            wx.showToast({
              title: '未找到宠物记录',
              icon: 'none'
            });
          }
        } else {
          // 如果云函数调用失败或返回错误，尝试使用本地缓存
          this._fallbackToLocalPetRecord();
        }
        
        // 如果是下拉刷新，停止下拉动画
        wx.stopPullDownRefresh();
      },
      fail: err => {
        console.error('获取宠物详情失败:', err);
        // 如果云函数调用失败，尝试使用本地缓存
        this._fallbackToLocalPetRecord();
        wx.stopPullDownRefresh();
      }
    });
  },
  
  // 当云函数调用失败时，回退到本地缓存
  _fallbackToLocalPetRecord: function() {
    console.log('回退到本地缓存的宠物记录');
    
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 从本地存储中获取宠物记录
    const petRecords = wx.getStorageSync('ownerPetRecords_' + openid) || [];
    
    // 查找对应ID的宠物记录
    const petRecord = petRecords.find(record => record._id === this.petId);
    
    if (petRecord) {
      console.log('找到宠物记录:', petRecord);
      
      // 将宠物记录转换为页面所需格式
      this.setData({
        pet: {
          id: petRecord._id,
          name: petRecord.petInfo.name,
          breed: petRecord.petInfo.breed,
          avatar: petRecord.petInfo.avatar,
          reason: petRecord.reason,
          status: petRecord.status,
          surgeryType: petRecord.surgeryType,
          createTime: petRecord.createTime,
          ownerInfo: petRecord.ownerInfo,
          clinicName: petRecord.clinicName || '未知诊所',
          tags: petRecord.tags || []
        },
        records: petRecord.updates ? petRecord.updates.map((update, index) => ({
          id: index,
          content: update.content,
          images: update.images || [],
          createdAt: update.createTime,
          vetName: update.vetName
        })) : [],
        loading: false,
        refreshing: false
      });
    } else {
      console.log('未找到宠物记录');
      wx.showToast({
        title: '未找到宠物记录',
        icon: 'none'
      });
      
      this.setData({
        loading: false,
        refreshing: false
      });
    }
  },
  
  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    const urls = e.currentTarget.dataset.urls;
    
    wx.previewImage({
      current: current,
      urls: urls
    });
  },
  
  // 返回上一页
  navigateBack: function() {
    wx.navigateBack();
  },
  
  // 分享宠物记录
  shareRecord: function() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  }
})
