// pages/ownerPetDetail/ownerPetDetail.js
Page({
  data: {
    pet: {},
    records: [],
    loading: true,
    refreshing: false,
    emptyState: false,
    // 自定义预览相关数据
    showCustomPreview: false,
    previewImages: [],
    currentPreviewIndex: 0
  },
  
  onLoad: function (options) {
    console.log('加载宠物详情，宠物ID:', options.id);
    this.petId = options.id;
    this.loadPetDetail();
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: '宠物详情'
    });
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
    
    console.log('开始加载宠物详情，宠物ID:', this.petId);
    
    // 使用云函数获取宠物详情
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        petId: this.petId,
        openid: openid,
        userRole: 'owner'
      },
      success: res => {
        console.log('云函数返回原始数据:', JSON.stringify(res.result));
        this._handlePetDataSuccess(res);
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
  
  // 数据加载成功后的处理
  _handlePetDataSuccess: function(res) {
    console.log('获取宠物详情成功:', res);
    
    if (res.result && res.result.success) {
      // 打印完整的返回数据结构
      console.log('云函数返回的完整数据结构:', JSON.stringify(res.result));
      
      const petRecords = res.result.petRecords || [];
      
      // 打印宠物记录的详细信息
      console.log('宠物记录数量:', petRecords.length);
      if (petRecords.length > 0) {
        console.log('第一条记录的所有字段:', Object.keys(petRecords[0]));
        console.log('第一条记录的clinicId:', petRecords[0].clinicId);
        console.log('第一条记录的clinicName:', petRecords[0].clinicName);
      }
      
      // 处理每条记录的时间格式
      petRecords.forEach(record => {
        if (record.createTime) {
          record.formattedTime = this.formatTime(record.createTime);
        }
        
        // 处理图片数组
        if (!record.images) {
          record.images = [];
        }
      });
      
      if (petRecords.length > 0) {
        const petRecord = petRecords[0];
        
        // 直接从云函数返回的数据中获取诊所名称
        // 先检查诊所相关的所有可能字段
        console.log('诊所相关字段检查:', {
          clinicId: petRecord.clinicId,
          clinicName: petRecord.clinicName,
          hospitalId: petRecord.hospitalId,
          hospitalName: petRecord.hospitalName,
          hasClinicInfo: petRecord.clinicInfo ? true : false,
          clinicInfoName: petRecord.clinicInfo ? petRecord.clinicInfo.name : null
        });
        
        // 尝试从不同字段获取诊所名称
        let clinicName = petRecord.clinicName || '';
        
        // 如果没有clinicName字段，尝试从其他字段获取
        if (!clinicName && petRecord.clinicInfo && petRecord.clinicInfo.name) {
          clinicName = petRecord.clinicInfo.name;
          console.log('从 clinicInfo.name 获取诊所名称:', clinicName);
        }
        
        // 如果还是没有，尝试从其他可能的字段获取
        if (!clinicName && petRecord.hospitalName) {
          clinicName = petRecord.hospitalName;
          console.log('从 hospitalName 获取诊所名称:', clinicName);
        }
        
        // 如果还是没有，尝试从诊所ID直接查询
        if (!clinicName && petRecord.clinicId) {
          // 如果有clinicId但没有clinicName，可能是云函数没有正确注入
          // 在这里我们可以直接设置一个固定的诊所名称作为测试
          clinicName = '云开发诊所'; // 测试用固定名称
          console.log('使用固定诊所名称作为测试:', clinicName);
        }
        
        // 如果还是没有，使用默认值
        if (!clinicName) {
          clinicName = '未知诊所';
          console.log('使用默认诊所名称:', clinicName);
        }
        
        console.log('最终确定的诊所名称:', clinicName);
        
        // 将宠物记录转换为页面所需格式
        this.setData({
          pet: {
            id: petRecord._id,
            name: petRecord.petInfo ? petRecord.petInfo.name : '未知宠物',
            breed: petRecord.petInfo ? petRecord.petInfo.breed : '',
            avatar: petRecord.petInfo ? petRecord.petInfo.avatar : '',
            reason: petRecord.reason,
            status: petRecord.status,
            surgeryType: petRecord.surgeryType,
            createTime: petRecord.formattedTime,
            rawTime: petRecord.createTime,
            ownerInfo: petRecord.ownerInfo,
            clinicName: clinicName,
            tags: petRecord.tags || []
          },
          records: petRecord.updates ? petRecord.updates.map((update, index) => ({
            id: index,
            content: update.content,
            images: update.images || [],
            createdAt: this.formatTime(update.createTime),
            rawTime: update.createTime,
            vetName: update.vetName,
            clinicName: clinicName // 确保每条记录都有诊所名称
          })) : [],
          loading: false,
          refreshing: false,
          emptyState: false
        });
      } else {
        this.setData({
          loading: false,
          refreshing: false,
          emptyState: true
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
          createTime: this.formatTime(petRecord.createTime),
          rawTime: petRecord.createTime,
          ownerInfo: petRecord.ownerInfo,
          clinicName: petRecord.clinicName || '未知诊所',
          tags: petRecord.tags || []
        },
        records: petRecord.updates ? petRecord.updates.map((update, index) => ({
          id: index,
          content: update.content,
          images: update.images || [],
          createdAt: this.formatTime(update.createTime),
          rawTime: update.createTime,
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
  
  // 格式化时间
  formatTime: function(timeStr) {
    if (!timeStr) return '未知时间';
    
    try {
      // 处理iOS兼容性问题
      let date;
      if (typeof timeStr === 'string') {
        // 尝试处理各种格式
        if (timeStr.includes('T')) {
          // ISO格式: 2025-04-25T13:30:00
          date = new Date(timeStr);
        } else if (timeStr.includes('-')) {
          // 将yyyy-MM-dd HH:mm:ss转换为yyyy/MM/dd HH:mm:ss
          const fixedTimeStr = timeStr.replace(/-/g, '/');
          date = new Date(fixedTimeStr);
        } else {
          // 其他格式尝试直接解析
          date = new Date(timeStr);
        }
      } else {
        // 如果是数字（时间戳）
        date = new Date(timeStr);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('日期格式无效:', timeStr);
        return timeStr; // 返回原始字符串
      }
      
      return this._formatDateToFriendly(date);
    } catch (error) {
      console.error('格式化时间出错:', error, timeStr);
      return timeStr;
    }
  },
  
  // 将日期格式化为友好的显示方式
  _formatDateToFriendly: function(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime(); // 时间差值（毫秒）
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    // 格式化具体时间
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day_num = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    const specificTime = `${year}-${month}-${day_num} ${hours}:${minutes}`;
    
    // 根据时间差返回不同的格式
    if (diff < minute) {
      return `刚刚\n${specificTime}`;
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)} 分钟前\n${specificTime}`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)} 小时前\n${specificTime}`;
    } else if (diff < 7 * day) {
      return `${Math.floor(diff / day)} 天前\n${specificTime}`;
    } else {
      return specificTime;
    }
  },
  
  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    const urls = e.currentTarget.dataset.urls;
    const index = e.currentTarget.dataset.index;
    const clinicName = e.currentTarget.dataset.clinic || '未知诊所';
    
    console.log('预览图片:', { current, index, clinicName });
    
    // 添加图片点击反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 将诊所名称保存到全局数据，供预览时使用
    const app = getApp();
    app.globalData.previewClinicName = clinicName;
    
    // 使用自定义预览组件，而不是原生预览
    this.setData({
      showCustomPreview: true,
      previewImages: urls,
      currentPreviewIndex: index || 0
    });
    
    console.log('使用自定义预览组件，显示永久水印:', clinicName);
  },
  
  // 关闭自定义预览
  closeCustomPreview: function() {
    this.setData({
      showCustomPreview: false
    });
  },
  
  // 预览swiper切换事件
  previewSwiperChange: function(e) {
    this.setData({
      currentPreviewIndex: e.detail.current
    });
  },
  
  // 返回上一页
  navigateBack: function() {
    wx.navigateBack();
  },
  

})
