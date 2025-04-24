// pages/petDetail/petDetail.js
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
    
    // 使用本地存储模拟数据库操作
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 从本地存储中获取宠物记录
    const petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    console.log('获取到的宠物记录列表:', petRecords);
    console.log('当前宠物ID:', this.petId);
    
    // 查找对应ID的宠物记录
    const petRecord = petRecords.find(record => record._id === this.petId);
    
    if (petRecord) {
      console.log('找到宠物记录:', petRecord);
      
      // 检查是否有updates字段
      if (petRecord.updates) {
        console.log('状态记录数量:', petRecord.updates.length);
      } else {
        console.log('没有状态记录');
      }
      
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
          ownerInfo: petRecord.ownerInfo
        },
        records: petRecord.updates ? petRecord.updates.map((update, index) => ({
          id: index,
          content: update.content,
          images: update.images || [],
          createdAt: update.createTime
        })) : [],
        loading: false,
        refreshing: false
      });
      
      // 如果是下拉刷新，停止下拉动画
      wx.stopPullDownRefresh();
    } else {
      console.log('未找到宠物记录');
      wx.showToast({
        title: '未找到宠物记录',
        icon: 'none'
      });
      
      // 模拟数据供测试
      this.setData({
        pet: { 
          id: this.petId, 
          name: '小花', 
          breed: '金毛', 
          reason: '手术',
          status: '术后',
          createTime: '2025-04-22 10:30:00',
          ownerInfo: {
            phoneNumber: '13800138000',
            name: '张三'
          }
        },
        records: [
          { id: 1, content: '小花今天进行了手术', images: [], createdAt: '2025-04-22 10:30:00' },
          { id: 2, content: '手术完成，恢复良好', images: [], createdAt: '2025-04-22 14:00:00' },
        ],
        loading: false,
        refreshing: false
      });
      
      // 如果是下拉刷新，停止下拉动画
      wx.stopPullDownRefresh();
    }
  },
  // 编辑宠物记录
  editRecord: function(e) {
    const recordId = e.currentTarget.dataset.id;
    console.log('编辑记录', recordId);
    
    wx.showToast({
      title: '暂不支持编辑功能',
      icon: 'none'
    });
  },
  
  // 删除宠物记录
  deleteRecord: function(e) {
    const recordId = e.currentTarget.dataset.id;
    console.log('删除记录', recordId);
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: res => {
        if (res.confirm) {
          // 使用本地存储模拟数据库操作
          const app = getApp();
          const openid = app.globalData.openid;
          
          // 从本地存储中获取宠物记录
          const petRecords = wx.getStorageSync('petRecords_' + openid) || [];
          
          // 查找对应ID的宠物记录
          const petRecordIndex = petRecords.findIndex(record => record._id === this.petId);
          
          if (petRecordIndex !== -1) {
            // 删除指定的记录
            petRecords[petRecordIndex].updates.splice(recordId, 1);
            
            // 保存到本地存储
            wx.setStorageSync('petRecords_' + openid, petRecords);
            
            // 重新加载数据
            this.loadPetDetail();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          }
        }
      }
    });
  },
  
  // 添加新记录
  addNewRecord: function() {
    // 标记需要刷新，在返回时触发
    this.needRefresh = true;
    wx.navigateTo({
      url: '/pages/addRecord/addRecord?petId=' + this.petId
    });
  },
  
  // 分享宠物记录
  sharePetRecord: function() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  }
})
