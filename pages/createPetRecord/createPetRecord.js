// pages/createPetRecord/createPetRecord.js
Page({
  data: {
    petInfo: { name: '', breed: '', reason: '', surgeryType: '' },
    newRecord: { content: '', images: [] },
    tempFilePaths: []
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
    this.setData({
      'newRecord.content': e.detail.value
    })
  },
  // 选择图片
  chooseImage: function() {
    wx.chooseImage({
      count: 9,
      success: (res) => {
        this.setData({
          tempFilePaths: this.data.tempFilePaths.concat(res.tempFilePaths),
          'newRecord.images': this.data.newRecord.images.concat(res.tempFilePaths)
        })
      }
    })
  },
  // 提交宠物记录
  submitPetRecord: function() {
    // 验证表单
    if (!this.data.petInfo.name) {
      wx.showToast({
        title: '请输入宠物名称',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.petInfo.breed) {
      wx.showToast({
        title: '请输入宠物品种',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.petInfo.reason) {
      wx.showToast({
        title: '请输入入院原因',
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
    
    console.log('提交宠物记录', this.data.petInfo, this.data.newRecord);
    
    // 使用本地存储模拟数据库操作
    const app = getApp();
    const openid = app.globalData.openid;
    
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
        phoneNumber: '13800138' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        name: '宠物主人'
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
      title: '创建成功',
      icon: 'success',
      duration: 2000
    });
    
    // 创建成功后返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
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
