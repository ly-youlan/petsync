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
        wx.showLoading({
          title: '正在上传...',
        });
        
        const uploadTasks = res.tempFilePaths.map(filePath => {
          return new Promise((resolve, reject) => {
            // 生成随机文件名
            const cloudPath = `pet_records/${Date.now()}_${Math.floor(Math.random() * 1000)}${filePath.match(/\.[^.]+?$/)[0]}`;
            
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: filePath,
              success: res => {
                console.log('上传成功', res);
                resolve(res.fileID);
              },
              fail: err => {
                console.error('上传失败', err);
                reject(err);
              }
            });
          });
        });
        
        Promise.all(uploadTasks).then(fileIDs => {
          that.setData({
            'newRecord.images': that.data.newRecord.images.concat(fileIDs)
          });
          wx.hideLoading();
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
        }).catch(err => {
          wx.hideLoading();
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
          console.error('上传失败', err);
        });
      }
    });
  },

  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.newRecord.images;
    const fileID = images[index];
    
    // 如果是云文件ID，则删除云存储文件
    if (fileID && fileID.startsWith('cloud://')) {
      wx.cloud.deleteFile({
        fileList: [fileID],
        success: res => {
          console.log('删除成功', res);
        },
        fail: err => {
          console.error('删除失败', err);
        }
      });
    }
    
    images.splice(index, 1);
    this.setData({
      'newRecord.images': images
    });
  },

  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    // 如果是云文件ID，需要获取临时链接
    const urls = this.data.newRecord.images;
    
    wx.previewImage({
      current: current,
      urls: urls
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
    wx.showLoading({
      title: '正在保存...',
      mask: true
    });

    const app = getApp();
    const openid = app.globalData.openid;
    console.log('当前用户openid:', openid);
    console.log('当前宠物ID:', this.data.petId);
    
    // 从本地存储中获取宠物记录
    const petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    console.log('获取到的宠物记录列表:', petRecords);
    
    // 查找对应ID的宠物记录
    const petRecordIndex = petRecords.findIndex(record => record._id === this.data.petId);
    console.log('宠物记录索引:', petRecordIndex);
    
    if (petRecordIndex !== -1) {
      // 创建新的记录
      const newUpdate = {
        content: this.data.newRecord.content,
        images: this.data.newRecord.images,
        createTime: this._formatDate(new Date())
      };
      
      console.log('新记录内容:', newUpdate);
      
      // 如果没有updates数组，创建一个
      if (!petRecords[petRecordIndex].updates) {
        petRecords[petRecordIndex].updates = [];
      }
      
      // 将新记录添加到数组开头
      petRecords[petRecordIndex].updates.unshift(newUpdate);
      
      try {
        // 保存到本地存储
        wx.setStorageSync('petRecords_' + openid, petRecords);
        console.log('保存成功，更新后的宠物记录:', petRecords[petRecordIndex]);
        
        // 同步到云端，确保数据不会丢失
        wx.cloud.callFunction({
          name: 'updatePetRecord',
          data: {
            petId: this.data.petId,
            updates: petRecords[petRecordIndex].updates,
            openid: openid
          },
          success: res => {
            console.log('记录同步到云端成功:', res);
            
            wx.hideLoading();
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
          },
          fail: err => {
            console.error('记录同步到云端失败:', err);
            
            wx.hideLoading();
            wx.showToast({
              title: '添加成功(本地)',
              icon: 'success',
              duration: 2000
            });
            
            // 添加成功后返回上一页
            setTimeout(() => {
              this.setData({ loading: false });
              wx.navigateBack();
            }, 2000);
          }
        });
      } catch (error) {
        console.error('保存失败:', error);
        wx.hideLoading();
        this.setData({ loading: false });
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    } else {
      console.error('未找到对应的宠物记录');
      wx.hideLoading();
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
  },
  
  // 返回上一页
  navigateBack: function() {
    wx.navigateBack();
  }
})
