// pages/createPetRecord/createPetRecord.js
Page({
  data: {
    petInfo: { name: '', breed: '', reason: '', surgeryType: '', ownerPhone: '', ownerName: '' },
    newRecord: { content: '', images: [] },
    tempFilePaths: [],
    cloudFileIDs: [], // 云存储文件ID
    // 常用标签
    commonTags: ['在院', '出院', '自定义'],
    // 已选标签，默认选中在院
    selectedTags: ['在院'],
    // 自定义标签相关
    showCustomTagInput: false,
    customTag: '',
    // 提交状态
    isSubmitting: false,
    // 图片上传状态
    isUploading: false
  },
  // 输入宠物信息
  inputPetInfo: function(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`petInfo.${field}`]: e.detail.value
    })
  },
  // 输入记录内容
  inputRecordContent: function(e) {
    const content = e.detail.value;
    // 限制最大字符数为500
    if (content.length <= 500) {
      this.setData({
        'newRecord.content': content
      });
    } else {
      // 如果超过500字符，截取前500字符
      this.setData({
        'newRecord.content': content.substring(0, 500)
      });
      wx.showToast({
        title: '记录内容最多500字',
        icon: 'none',
        duration: 1500
      });
    }
  },

  
  // 选择图片
  chooseImage: function() {
    // 如果正在上传，不允许再次选择
    if (this.data.isUploading) {
      wx.showToast({
        title: '正在上传图片，请稍后',
        icon: 'none'
      });
      return;
    }
    
    wx.chooseImage({
      count: 9 - this.data.tempFilePaths.length, // 最多9张图片
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 显示上传中状态
        this.setData({ isUploading: true });
        wx.showLoading({ title: '正在上传图片...', mask: true });
        
        // 先将图片显示出来
        const newTempFilePaths = this.data.tempFilePaths.concat(res.tempFilePaths);
        this.setData({ tempFilePaths: newTempFilePaths });
        
        // 上传图片到云存储
        const uploadTasks = res.tempFilePaths.map((filePath, index) => {
          return new Promise((resolve, reject) => {
            const cloudPath = `pet_images/${Date.now()}_${index}.jpg`;
            
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: filePath,
              success: (uploadRes) => {
                console.log('上传成功，文件ID:', uploadRes.fileID);
                resolve(uploadRes.fileID);
              },
              fail: (err) => {
                console.error('上传失败:', err);
                reject(err);
              }
            });
          });
        });
        
        // 等待所有图片上传完成
        Promise.all(uploadTasks).then(fileIDs => {
          // 更新云文件ID列表
          const newCloudFileIDs = this.data.cloudFileIDs.concat(fileIDs);
          this.setData({
            cloudFileIDs: newCloudFileIDs,
            'newRecord.images': newCloudFileIDs,
            isUploading: false
          });
          wx.hideLoading();
          wx.showToast({
            title: '图片上传成功',
            icon: 'success'
          });
        }).catch(err => {
          this.setData({ isUploading: false });
          wx.hideLoading();
          wx.showToast({
            title: '图片上传失败',
            icon: 'none'
          });
          console.error('图片上传失败:', err);
        });
      }
    });
  },
  
  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const tempFilePaths = [...this.data.tempFilePaths];
    const cloudFileIDs = [...this.data.cloudFileIDs];
    
    // 删除云存储中的文件
    const fileID = cloudFileIDs[index];
    if (fileID) {
      // 尝试删除云文件，但不阻塞用户操作
      wx.cloud.deleteFile({
        fileList: [fileID],
        success: (res) => {
          console.log('删除云文件成功:', res);
        },
        fail: (err) => {
          console.error('删除云文件失败:', err);
        }
      });
    }
    
    // 从数组中移除
    tempFilePaths.splice(index, 1);
    cloudFileIDs.splice(index, 1);
    
    this.setData({
      tempFilePaths: tempFilePaths,
      cloudFileIDs: cloudFileIDs,
      'newRecord.images': cloudFileIDs
    });
  },
  
  // 切换标签选中状态
  toggleTag: function(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedTags = [...this.data.selectedTags];
    
    if (selectedTags.includes(tag)) {
      // 如果已选中，则移除
      const index = selectedTags.indexOf(tag);
      selectedTags.splice(index, 1);
    } else {
      // 如果未选中，则添加
      selectedTags.push(tag);
    }
    
    this.setData({ selectedTags });
  },
  
  // 显示自定义标签输入框
  showCustomTagInput: function() {
    this.setData({ 
      showCustomTagInput: true,
      customTag: ''
    });
  },
  
  // 输入自定义标签
  inputCustomTag: function(e) {
    this.setData({ customTag: e.detail.value });
  },
  
  // 添加自定义标签
  addCustomTag: function() {
    const customTag = this.data.customTag.trim();
    
    if (!customTag) {
      wx.showToast({
        title: '标签不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否已存在相同标签
    if (this.data.selectedTags.includes(customTag)) {
      wx.showToast({
        title: '标签已存在',
        icon: 'none'
      });
      return;
    }
    
    // 添加到已选标签
    const selectedTags = [...this.data.selectedTags, customTag];
    
    // 如果不在常用标签中，添加到常用标签
    let commonTags = [...this.data.commonTags];
    if (!commonTags.includes(customTag)) {
      commonTags.push(customTag);
    }
    
    this.setData({ 
      selectedTags,
      commonTags,
      showCustomTagInput: false,
      customTag: ''
    });
  },
  
  // 移除标签
  removeTag: function(e) {
    const index = e.currentTarget.dataset.index;
    const selectedTags = [...this.data.selectedTags];
    selectedTags.splice(index, 1);
    
    this.setData({ selectedTags });
  },
  // 提交宠物记录
  submitPetRecord: function() {
    // 验证表单 - 只验证必填项
    if (!this.data.petInfo.name) {
      wx.showToast({
        title: '请输入宠物名称',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.petInfo.ownerPhone) {
      wx.showToast({
        title: '请输入主人电话',
        icon: 'none'
      });
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(this.data.petInfo.ownerPhone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.newRecord.content) {
      wx.showToast({
        title: '请输入记录内容',
        icon: 'none'
      });
      return;
    }
    
    console.log('提交宠物记录', this.data.petInfo, this.data.newRecord, this.data.selectedTags);
    
    // 检查是否选择了标签
    if (this.data.selectedTags.length === 0) {
      wx.showToast({
        title: '请选择至少一个状态标签',
        icon: 'none'
      });
      return;
    }
    
    const app = getApp();
    const openid = app.globalData.openid;
    const clinicInfo = app.globalData.clinicInfo;
    
    // 设置提交状态
    this.setData({ isSubmitting: true });
    
    // 显示加载中
    wx.showLoading({
      title: '创建中...',
      mask: true
    });
    
    // 调用云函数创建宠物记录
    wx.cloud.callFunction({
      name: 'createPetRecord',
      data: {
        openid: openid,
        petInfo: {
          name: this.data.petInfo.name,
          breed: this.data.petInfo.breed,
          reason: this.data.petInfo.reason,
          surgeryType: this.data.petInfo.surgeryType || ''
        },
        ownerInfo: {
          phoneNumber: this.data.petInfo.ownerPhone || ('13800138' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')),
          name: this.data.petInfo.ownerName || '宠物主人'
        },
        recordContent: this.data.newRecord.content,
        // 传递云文件ID而非临时路径
        fileIDs: this.data.cloudFileIDs,
        // 使用第一张上传的图片作为宠物头像
        clinicInfo: clinicInfo,
        // 添加标签数组
        tags: this.data.selectedTags,
        // 为了兼容旧版本，设置主要状态
        status: this.data.selectedTags[0] || '住院'
      },
      success: res => {
        console.log('创建宠物记录成功:', res);
        
        if (res.result && res.result.success) {
          // 重置提交状态
          this.setData({ isSubmitting: false });
          wx.hideLoading();
          
          wx.showToast({
            title: '创建成功',
            icon: 'success',
            duration: 1500
          });
          
          // 跳转回工作台
          setTimeout(() => {
            wx.navigateBack();
          }, 1800);
        } else {
          // 重置提交状态
          this.setData({ isSubmitting: false });
          wx.hideLoading();
          wx.showToast({
            title: res.result.errMsg || '创建失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: err => {
        console.error('创建宠物记录失败:', err);
        
        // 重置提交状态
        this.setData({ isSubmitting: false });
        wx.hideLoading();
        
        wx.showModal({
          title: '创建失败',
          content: '创建宠物记录失败，请检查网络连接或重试',
          showCancel: false,
          confirmText: '知道了'
        });
        
        // 如果云函数调用失败，尝试使用本地存储保存
        this._saveToLocalStorage(openid);
      }
    });
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
  
  // 如果云函数调用失败，使用本地存储保存
  _saveToLocalStorage: function(openid) {
    console.log('使用本地存储保存宠物记录');
    
    // 从本地存储中获取宠物记录
    let petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    
    // 创建新记录
    const newPetRecord = {
      _id: 'pet_' + Date.now(),
      _openid: openid,
      petInfo: {
        name: this.data.petInfo.name,
        breed: this.data.petInfo.breed,
        avatar: this.data.tempFilePaths.length > 0 ? this.data.tempFilePaths[0] : '/images/default-pet.png'
      },
      ownerInfo: {
        phoneNumber: this.data.petInfo.ownerPhone || ('13800138' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')),
        name: this.data.petInfo.ownerName || '宠物主人'
      },
      status: this.data.petInfo.surgeryType ? '术后' : '住院',
      reason: this.data.petInfo.reason,
      surgeryType: this.data.petInfo.surgeryType || '',
      createTime: this._formatDate(new Date()),
      updates: [
        {
          content: this.data.newRecord.content,
          images: this.data.newRecord.images,
          createTime: this._formatDate(new Date())
        }
      ]
    };
    
    // 将新记录添加到数组中
    petRecords.unshift(newPetRecord);
    
    // 保存到本地存储
    wx.setStorageSync('petRecords_' + openid, petRecords);
    
    wx.showToast({
      title: '已保存到本地',
      icon: 'success',
      duration: 2000
    });
    
    // 保存成功后返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
  }
})
