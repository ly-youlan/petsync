// pages/addRecord/addRecord.js
Page({
  data: {
    petId: '',
    petInfo: null,
    newRecord: {
      content: '',
      images: []
    },
    loading: false
  },

  onLoad: function(options) {
    console.log('添加记录页面加载，宠物ID:', options.petId);
    if (options.petId) {
      this.setData({
        petId: options.petId
      });
      this.loadPetInfo(options.petId);
    } else {
      wx.showToast({
        title: '缺少宠物ID',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载宠物信息
  loadPetInfo: function(petId) {
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 从本地存储中获取宠物记录
    const petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    
    // 查找对应ID的宠物记录
    const petRecord = petRecords.find(record => record._id === petId);
    
    if (petRecord) {
      console.log('找到宠物记录:', petRecord);
      
      this.setData({
        petInfo: {
          id: petRecord._id,
          name: petRecord.petInfo.name,
          breed: petRecord.petInfo.breed,
          status: petRecord.status
        }
      });
    } else {
      wx.showToast({
        title: '未找到宠物记录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 输入记录内容
  inputContent: function(e) {
    this.setData({
      'newRecord.content': e.detail.value
    });
  },

  // 选择图片
  chooseImage: function() {
    const that = this;
    wx.chooseImage({
      count: 9 - that.data.newRecord.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        // 返回选定照片的本地文件路径列表
        that.setData({
          'newRecord.images': that.data.newRecord.images.concat(res.tempFilePaths)
        });
      }
    });
  },

  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.newRecord.images;
    images.splice(index, 1);
    this.setData({
      'newRecord.images': images
    });
  },

  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    wx.previewImage({
      current: current,
      urls: this.data.newRecord.images
    });
  },

  // 提交记录
  submitRecord: function() {
    // 验证表单
    if (!this.data.newRecord.content.trim()) {
      wx.showToast({
        title: '请输入记录内容',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    const app = getApp();
    const openid = app.globalData.openid;
    
    // 从本地存储中获取宠物记录
    const petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    
    // 查找对应ID的宠物记录
    const petRecordIndex = petRecords.findIndex(record => record._id === this.data.petId);
    
    if (petRecordIndex !== -1) {
      // 创建新的记录
      const newUpdate = {
        content: this.data.newRecord.content,
        images: this.data.newRecord.images,
        createTime: this._formatDate(new Date())
      };
      
      // 如果没有updates数组，创建一个
      if (!petRecords[petRecordIndex].updates) {
        petRecords[petRecordIndex].updates = [];
      }
      
      // 将新记录添加到数组开头
      petRecords[petRecordIndex].updates.unshift(newUpdate);
      
      // 保存到本地存储
      wx.setStorageSync('petRecords_' + openid, petRecords);
      
      wx.showToast({
        title: '添加成功',
        icon: 'success',
        duration: 2000
      });
      
      // 添加成功后返回上一页
      setTimeout(() => {
        this.setData({ loading: false });
        wx.navigateBack();
      }, 2000);
    } else {
      this.setData({ loading: false });
      wx.showToast({
        title: '未找到宠物记录',
        icon: 'none'
      });
    }
  },
  
  // 格式化日期
  _formatDate: function(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
})
