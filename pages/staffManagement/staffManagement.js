// pages/staffManagement/staffManagement.js
Page({
  data: {
    clinicInfo: null,
    userInfo: null,
    staffList: [],
    petRecords: [],
    assignments: [],
    loading: true,
    activeTab: 'assign', // assign, review
    selectedPetId: '',
    selectedStaffId: '',
    pendingReviews: 0
  },

  onLoad: function() {
    // 检查用户是否已登录和审核状态
    this.checkLoginStatus();
  },

  onShow: function() {
    // 每次显示页面时刷新数据
    if (this.data.userInfo && this.data.userInfo.userRole === 'vet') {
      this.fetchStaffList();
      this.fetchPetRecords();
      this.fetchAssignments();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    console.log('Checking login status');
    const app = getApp();
    
    // 先检查全局数据中的登录状态
    if (!app.globalData.isLoggedIn || !app.globalData.openid || app.globalData.userRole !== 'vet') {
      console.log('Not logged in as vet, redirecting to login page');
      // 未登录或非兽医，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }

    // 使用全局数据
    const userInfo = app.globalData.userInfo;
    const clinicInfo = app.globalData.clinicInfo;
    
    if (!userInfo || !clinicInfo) {
      console.log('No user or clinic info found, redirecting to login page');
      // 用户数据不存在，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return;
    }
    
    // 设置页面数据
    this.setData({
      clinicInfo: clinicInfo,
      userInfo: userInfo,
      loading: false
    });
    
    // 获取医护人员列表和宠物记录
    this.fetchStaffList();
    this.fetchPetRecords();
    this.fetchAssignments();
  },

  // 获取医护人员列表
  fetchStaffList: function() {
    wx.showLoading({
      title: '加载中',
    });
    
    // 输出诊所信息便于调试
    console.log('当前诊所信息:', this.data.clinicInfo);
    console.log('诊所ID:', this.data.clinicInfo ? this.data.clinicInfo._id : '无诊所ID');
    
    // 如果没有诊所ID，尝试使用hospitalId
    const clinicId = this.data.clinicInfo && this.data.clinicInfo._id ? 
                    this.data.clinicInfo._id : 
                    (this.data.userInfo && this.data.userInfo.hospitalId ? 
                     this.data.userInfo.hospitalId : '');
    
    console.log('最终使用的诊所ID:', clinicId);
    
    if (!clinicId) {
      wx.showToast({
        title: '无法获取诊所信息',
        icon: 'none'
      });
      wx.hideLoading();
      return;
    }
    
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'getStaffList',
        clinicId: clinicId
      },
      success: res => {
        console.log('获取医护人员列表成功:', res.result);
        if (res.result && res.result.success) {
          const staffList = res.result.staff || [];
          console.log('医护人员列表:', staffList);
          this.setData({
            staffList: staffList
          });
          
          if (staffList.length === 0) {
            wx.showToast({
              title: '没有找到医护人员',
              icon: 'none'
            });
          }
        } else {
          wx.showToast({
            title: res.result.errMsg || '获取医护人员列表失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取医护人员列表失败:', err);
        wx.showToast({
          title: '获取医护人员列表失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 获取宠物记录
  fetchPetRecords: function() {
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        userRole: 'vet',
        clinicId: this.data.clinicInfo._id
      },
      success: res => {
        console.log('获取宠物记录成功:', res);
        if (res.result && res.result.success) {
          this.setData({
            petRecords: res.result.petRecords || []
          });
        } else {
          wx.showToast({
            title: res.result.errMsg || '获取宠物记录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取宠物记录失败:', err);
        wx.showToast({
          title: '获取宠物记录失败',
          icon: 'none'
        });
      }
    });
  },

  // 获取分配记录
  fetchAssignments: function() {
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'getAssignments',
        userRole: 'vet',
        clinicId: this.data.clinicInfo._id
      },
      success: res => {
        console.log('获取分配记录成功:', res.result);
        if (res.result && res.result.success) {
          const assignments = res.result.assignments || [];
          
          // 计算待审核的记录数量
          const pendingReviews = assignments.filter(a => a.status === 'submitted').length;
          
          // 计算历史记录数量
          const historyRecords = assignments.filter(a => a.status !== 'submitted').length;
          
          this.setData({
            assignments: assignments,
            pendingReviews: pendingReviews,
            historyRecords: historyRecords
          });
          
          // 如果有待审核记录且当前不在审核标签页，显示提示
          if (pendingReviews > 0 && this.data.activeTab !== 'review') {
            wx.showToast({
              title: `有${pendingReviews}条记录待审核`,
              icon: 'none',
              duration: 2000
            });
          }
        } else {
          wx.showToast({
            title: res.result.errMsg || '获取分配记录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取分配记录失败:', err);
        wx.showToast({
          title: '获取分配记录失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    
    // 刷新数据
    if (tab === 'assign') {
      this.fetchPetRecords();
      this.fetchStaffList();
    } else if (tab === 'review') {
      this.fetchAssignments();
    }
  },

  // 选择宠物
  selectPet: function(e) {
    const petId = e.currentTarget.dataset.id;
    this.setData({
      selectedPetId: petId
    });
  },

  // 选择医护人员
  selectStaff: function(e) {
    const staffId = e.currentTarget.dataset.id;
    this.setData({
      selectedStaffId: staffId
    });
  },

  // 分配宠物给医护人员
  assignPet: function() {
    if (!this.data.selectedPetId || !this.data.selectedStaffId) {
      wx.showToast({
        title: '请选择宠物和医护人员',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '分配中',
    });
    
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'assignPet',
        petId: this.data.selectedPetId,
        staffOpenid: this.data.selectedStaffId,
        clinicId: this.data.clinicInfo._id
      },
      success: res => {
        console.log('分配宠物成功:', res.result);
        if (res.result && res.result.success) {
          wx.showToast({
            title: '分配成功',
            icon: 'success'
          });
          
          // 重置选择
          this.setData({
            selectedPetId: '',
            selectedStaffId: ''
          });
          
          // 刷新数据
          this.fetchPetRecords();
          this.fetchAssignments();
        } else {
          wx.showToast({
            title: res.result.errMsg || '分配失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('分配宠物失败:', err);
        wx.showToast({
          title: '分配失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 审核记录
  reviewRecord: function(e) {
    const assignment = e.currentTarget.dataset.assignment;
    
    // 跳转到审核页面
    wx.navigateTo({
      url: `/pages/recordReview/recordReview?id=${assignment._id}`
    });
  },

  // 返回工作台
  goBack: function() {
    wx.navigateBack();
  }
});
