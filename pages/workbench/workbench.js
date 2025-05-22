// pages/workbench/workbench.js
Page({
  data: {
    filters: ['全部', '在院', '出院', '自定义'],
    selectedFilters: ['在院'],
    searchValue: '',
    petRecords: [],
    loading: true,
    clinicInfo: null,
    userInfo: null,
    isApproved: false,
    showAddFilterModal: false,
    newFilter: ''
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
    
    // 先检查全局数据中的登录状态
    console.log('Global data:', app.globalData);
    
    if (!app.globalData.isLoggedIn || !app.globalData.openid) {
      console.log('Not logged in (global check), redirecting to login page');
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }

    // 优先使用全局数据，如果没有再使用本地存储
    const openid = app.globalData.openid;
    let userData = app.globalData.userInfo;
    
    // 如果全局数据中没有用户信息，尝试从本地存储获取
    if (!userData) {
      userData = wx.getStorageSync('userInfo_' + openid);
    }
    
    console.log('User data for workbench:', userData);
    
    if (!userData) {
      console.log('No user data found, redirecting to login page');
      // 用户数据不存在，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }
    
    // 检查诊所信息，优先使用全局数据中的诊所信息
    console.log('用户数据:', userData);
    
    // 优先使用全局数据中的诊所信息
    let clinicInfo = app.globalData.clinicInfo || userData.clinicInfo || userData.hospitalInfo || null;
    console.log('诊所信息:', clinicInfo);
    
    // 如果没有诊所信息，但有hospitalId(激活码)，尝试从云数据库获取诊所信息
    if (!clinicInfo && userData.userRole === 'vet' && userData.hospitalId) {
      console.log('没有诊所信息，但有激活码，尝试获取诊所信息');
      
      // 显示加载中
      this.setData({ loading: true });
      
      // 从云数据库获取诊所信息
      wx.cloud.callFunction({
        name: 'manageUser',
        data: {
          action: 'getClinicByCode',
          clinicCode: userData.hospitalId
        },
        success: res => {
          console.log('获取诊所信息成功:', res);
          if (res.result && res.result.success && res.result.clinic) {
            // 更新用户数据中的诊所信息
            userData.clinicInfo = res.result.clinic;
            clinicInfo = res.result.clinic;
            
            // 保存到本地存储
            wx.setStorageSync('userInfo_' + openid, userData);
            wx.setStorageSync('userInfo', userData);
            
            // 更新页面数据
            // 直接设置页面数据
            this.setData({
              clinicInfo: clinicInfo,
              userInfo: userData,
              isApproved: true,
              loading: false
            });
            
            // 更新全局数据
            const app = getApp();
            app.globalData.clinicInfo = clinicInfo;
            
            console.log('诊所信息已更新:', clinicInfo);
          } else {
            console.log('未找到诊所信息，跳转到登录页');
            wx.redirectTo({
              url: '/pages/login/login',
            });
          }
        },
        fail: err => {
          console.error('获取诊所信息失败:', err);
          wx.redirectTo({
            url: '/pages/login/login',
          });
        },
        complete: () => {
          this.setData({ loading: false });
        }
      });
      return; // 等待异步操作完成
    } else if (!clinicInfo && userData.userRole === 'vet') {
      console.log('没有诊所信息也没有激活码，跳转到登录页');
      // 既没有诊所信息也没有激活码，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }
    
    // 判断用户是否已审核通过
    const isApproved = userData.isApproved === true || userData.approvalStatus === 'approved';
    console.log('用户审核状态:', isApproved, userData);
    
    if (!isApproved) {
      console.log('User not approved, redirecting to login page');
      // 未审核通过，重定向到登录页
      wx.showToast({
        title: '账号审核中',
        icon: 'none',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/login/login'
        });
      }, 1500);
      return;
    }
    
    console.log('User approved, fetching pet records');
    // 已审核通过，获取宠物记录
    
    // 使用用户信息
    // 使用上面已经定义的app变量
    const userInfo = {
      vetName: userData.vetName,
      openid: userData.openid,
      userRole: userData.userRole
    };
    
    // 设置页面数据
    this.setData({
      clinicInfo: clinicInfo,
      userInfo: userInfo,
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
    const clinicInfo = app.globalData.clinicInfo || this.data.clinicInfo;
    
    // 使用云函数获取宠物记录
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        openid: openid,
        userRole: 'vet', // 添加用户角色参数，指定为兽医
        clinicId: clinicInfo ? clinicInfo._id : null,
        filter: this.data.selectedFilters.includes('全部') ? null : this.data.selectedFilters,
        searchValue: this.data.searchValue || null
      },
      success: res => {
        console.log('从云端获取宠物记录成功:', res);
        
        if (res.result && res.result.success) {
          // 使用云端返回的数据
          const petRecords = res.result.petRecords || [];
          
          this.setData({
            petRecords: petRecords,
            loading: false
          });
          
          // 将数据缓存到本地
          wx.setStorageSync('petRecords_' + openid, petRecords);
          
          console.log('Pet records loaded from cloud:', petRecords);
        } else {
          // 如果云函数调用失败或返回错误，尝试使用本地缓存
          this._fallbackToLocalPetRecords(openid);
        }
      },
      fail: err => {
        console.error('从云端获取宠物记录失败:', err);
        // 如果云函数调用失败，尝试使用本地缓存
        this._fallbackToLocalPetRecords(openid);
      }
    });
  },
  
  // 当云函数调用失败时，回退到本地缓存
  _fallbackToLocalPetRecords: function(openid) {
    console.log('回退到本地缓存的宠物记录');
    
    // 从本地存储中获取宠物记录
    let petRecords = wx.getStorageSync('petRecords_' + openid) || [];
    
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
    
    this.setData({
      petRecords: filteredRecords,
      loading: false
    });
    
    // 显示提示
    if (filteredRecords.length === 0) {
      wx.showToast({
        title: '暂无宠物记录',
        icon: 'none',
        duration: 2000
      });
    } else {
      console.log('使用本地缓存的宠物记录:', filteredRecords);
    }
  },
  
  // 切换筛选条件
  toggleFilter: function(e) {
    const filter = e.currentTarget.dataset.filter;
    let selectedFilters = [...this.data.selectedFilters];
    
    if (filter === '全部') {
      // 如果点击全部，则只选中全部
      selectedFilters = ['全部'];
    } else {
      // 如果点击其他标签
      
      // 先移除全部标签
      if (selectedFilters.includes('全部')) {
        selectedFilters = selectedFilters.filter(item => item !== '全部');
      }
      
      // 切换点击的标签状态
      if (selectedFilters.includes(filter)) {
        // 如果已选中，则移除
        selectedFilters = selectedFilters.filter(item => item !== filter);
      } else {
        // 如果未选中，则添加
        selectedFilters.push(filter);
      }
      
      // 如果没有选中任何标签，则默认选中全部
      if (selectedFilters.length === 0) {
        selectedFilters = ['全部'];
      }
    }
    
    this.setData({ selectedFilters });
    this.fetchPetRecords();
  },
  
  // 显示添加标签对话框
  showAddFilterModal: function() {
    // 这里可以实现添加自定义标签的功能
    // 简单起见，我们可以使用wx.showModal来实现
    wx.showModal({
      title: '添加自定义标签',
      editable: true,
      placeholderText: '请输入标签名称',
      success: (res) => {
        if (res.confirm && res.content) {
          const newFilter = res.content.trim();
          if (newFilter) {
            // 检查是否已存在
            if (!this.data.filters.includes(newFilter)) {
              // 添加到标签列表
              const filters = [...this.data.filters, newFilter];
              this.setData({ filters });
            }
            
            // 选中新标签
            let selectedFilters = [...this.data.selectedFilters];
            if (selectedFilters.includes('全部')) {
              selectedFilters = [newFilter];
            } else {
              selectedFilters.push(newFilter);
            }
            this.setData({ selectedFilters });
            this.fetchPetRecords();
          }
        }
      }
    });
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
      url: '/pages/createPetRecord/createPetRecord'
    });
  },
  
  // 跳转到医护管理页面
  goToStaffManagement: function() {
    wx.navigateTo({
      url: '/pages/staffManagement/staffManagement'
    });
  },
  
  // 跳转到测试工具页面
  goToTestTools: function() {
    wx.navigateTo({
      url: '/pages/testTools/testTools'
    });
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
