// pages/workbench/workbench.js
Page({
  data: {
    filters: ['全部', '住院', '术后'],
    currentFilter: '全部',
    searchValue: '',
    petRecords: [],
    loading: true,
    hospitalInfo: null,
    userInfo: null,
    isApproved: false
  },

  onLoad: function() {
    // 检查用户是否已登录和审核状态
    this.checkLoginStatus();
  },

  onShow: function() {
    // 每次显示页面时刷新数据
    if (this.data.isApproved) {
      this.fetchPetRecords();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    console.log('Checking login status');
    const app = getApp();
    
    if (!app.globalData.isLoggedIn || !app.globalData.openid) {
      console.log('Not logged in, redirecting to login page');
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }

    // 使用本地存储模拟数据库操作
    const openid = app.globalData.openid;
    const userData = wx.getStorageSync('userInfo_' + openid);
    console.log('User data from storage:', userData);
    
    if (!userData) {
      console.log('No user data found, redirecting to login page');
      // 用户数据不存在，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }
    
    // 检查医院信息，可能在hospitalInfo对象中或直接在根级别
    if (!userData.hospitalName && !userData.hospitalInfo) {
      console.log('No hospital info found, redirecting to login page');
      // 未绑定医院，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }
    
    if (!userData.isApproved) {
      console.log('User not approved, showing pending status');
      // 未审核通过，显示待审核提示
      this.setData({
        hospitalInfo: userData.hospitalInfo,
        isApproved: false,
        loading: false
      });
      return;
    }
    
    console.log('User approved, fetching pet records');
    // 已审核通过，获取宠物记录
    
    // 构建医院信息对象，兼容两种数据结构
    const hospitalInfo = userData.hospitalInfo || {
      name: userData.hospitalName,
      address: userData.hospitalAddress
    };
    
    this.setData({
      hospitalInfo: hospitalInfo,
      userInfo: {
        vetName: userData.vetName || (userData.hospitalInfo && userData.hospitalInfo.vetName)
      },
      isApproved: true
    });
    
    this.fetchPetRecords();
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: app.globalData.openid
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const userData = res.data[0];
        
        if (!userData.hospitalInfo) {
          // 未绑定医院，跳转到登录页
          wx.redirectTo({
            url: '/pages/login/login',
          });
          return;
        }
        
        if (!userData.isApproved) {
          // 未审核通过，显示待审核提示
          this.setData({
            hospitalInfo: userData.hospitalInfo,
            isApproved: false,
            loading: false
          });
          return;
        }
        
        // 已审核通过，获取宠物记录
        this.setData({
          hospitalInfo: userData.hospitalInfo,
          userInfo: {
            phoneNumber: userData.phoneNumber,
            vetName: userData.hospitalInfo.vetName
          },
          isApproved: true
        });
        
        this.fetchPetRecords();
      } else {
        // 用户数据不存在，跳转到登录页
        wx.redirectTo({
          url: '/pages/login/login',
        });
      }
    }).catch(err => {
      console.error('获取用户信息错误:', err);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      });
    });
    */
  },

  // 获取宠物记录
  fetchPetRecords: function() {
    console.log('Fetching pet records');
    this.setData({ loading: true });
    
    const app = getApp();
    const openid = app.globalData.openid;
    
    // 使用模拟数据
    // 从本地存储中获取宠物记录
    let petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    
    // 如果没有数据，创建一些模拟数据供测试
    if (petRecords.length === 0) {
      console.log('No pet records found, creating mock data');
      // 创建模拟数据
      petRecords = [
        {
          _id: 'pet1',
          _openid: openid,
          petInfo: {
            name: '豆豆',
            breed: '金毛対特犬',
            avatar: '/images/default-pet.png'
          },
          ownerInfo: {
            phoneNumber: '13800138001',
            name: '张三'
          },
          status: '住院',
          reason: '肠炎',
          createTime: '2025-04-22 10:30:00'
        },
        {
          _id: 'pet2',
          _openid: openid,
          petInfo: {
            name: '小花',
            breed: '斑点狗',
            avatar: '/images/default-pet.png'
          },
          ownerInfo: {
            phoneNumber: '13800138002',
            name: '李四'
          },
          status: '术后',
          reason: '绑育手术',
          createTime: '2025-04-21 15:45:00'
        }
      ];
      
      // 将模拟数据保存到本地存储
      wx.setStorageSync('petRecords_' + openid, petRecords);
    }
    
    // 根据筛选条件过滤
    let filteredRecords = petRecords;
    if (this.data.currentFilter !== '全部') {
      filteredRecords = petRecords.filter(record => record.status === this.data.currentFilter);
    }
    
    // 根据搜索关键词过滤
    if (this.data.searchValue) {
      const searchValue = this.data.searchValue.toLowerCase();
      filteredRecords = filteredRecords.filter(record => {
        return record.petInfo.name.toLowerCase().includes(searchValue) || 
               record.ownerInfo.phoneNumber.includes(searchValue);
      });
    }
    
    // 模拟延迟，以显示加载状态
    setTimeout(() => {
      this.setData({
        petRecords: filteredRecords,
        loading: false
      });
      console.log('Pet records loaded:', filteredRecords);
    }, 500);
    
    /* 下面是正常的云数据库调用方式，当云环境配置好后可以使用
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 构建查询条件
    let query = {
      _openid: app.globalData.openid
    };
    
    // 根据筛选条件过滤
    if (this.data.currentFilter !== '全部') {
      query.status = this.data.currentFilter;
    }
    
    // 根据搜索关键词过滤
    if (this.data.searchValue) {
      // 模糊搜索宠物名称或主人手机号
      query = _.or([
        {
          _openid: app.globalData.openid,
          'petInfo.name': db.RegExp({
            regexp: this.data.searchValue,
            options: 'i'
          })
        },
        {
          _openid: app.globalData.openid,
          'ownerInfo.phoneNumber': db.RegExp({
            regexp: this.data.searchValue,
            options: 'i'
          })
        }
      ]);
    }
    
    db.collection('petRecords')
      .where(query)
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        this.setData({
          petRecords: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('获取宠物记录错误:', err);
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
    */
  },

  // 切换筛选条件
  changeFilter: function(e) {
    this.setData({
      currentFilter: e.currentTarget.dataset.filter
    });
    
    if (this.data.isApproved) {
      this.fetchPetRecords();
    }
  },

  // 搜索
  search: function(e) {
    this.setData({
      searchValue: e.detail.value
    });
    
    // 使用节流函数，避免频繁请求
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    this.searchTimer = setTimeout(() => {
      if (this.data.isApproved) {
        this.fetchPetRecords();
      }
    }, 500);
  },

  // 跳转到宠物详情页
  goToPetDetail: function(e) {
    const petId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/petDetail/petDetail?id=${petId}`,
    });
  },

  // 跳转到创建宠物记录页
  goToCreatePetRecord: function() {
    wx.navigateTo({
      url: '/pages/createPetRecord/createPetRecord',
    })
  },
  
  // 跳转到设置页面
  goToSettings: function() {
    // 目前只是显示一个提示，未来会实现设置页面
    wx.showActionSheet({
      itemList: ['修改医院信息', '退出登录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 修改医院信息（未来实现）
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        } else if (res.tapIndex === 1) {
          // 调用退出登录功能
          this.logout();
        }
      }
    });
  },
  
  // 退出登录
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '您确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          const app = getApp();
          app.globalData.isLoggedIn = false;
          app.globalData.openid = null;
          app.globalData.hospitalInfo = null;
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
})
