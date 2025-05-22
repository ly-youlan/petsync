// pages/staffWorkbench/staffWorkbench.js
Page({
  data: {
    clinicInfo: null,
    userInfo: null,
    assignments: [],
    loading: true,
    activeTab: 'pending', // pending, completed
    emptyState: false
  },

  onLoad: function() {
    // 检查用户是否已登录和审核状态
    this.checkLoginStatus();
  },

  onShow: function() {
    // 每次显示页面时刷新数据
    if (this.data.userInfo && this.data.userInfo.userRole === 'staff') {
      this.fetchAssignments();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    console.log('Checking login status');
    const app = getApp();
    
    // 先检查全局数据中的登录状态
    if (!app.globalData.isLoggedIn || !app.globalData.openid || app.globalData.userRole !== 'staff') {
      console.log('Not logged in as staff, redirecting to login page');
      // 未登录或非医护人员，跳转到登录页
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
    
    // 获取分配记录
    this.fetchAssignments();
  },

  // 获取分配记录
  fetchAssignments: function() {
    wx.showLoading({
      title: '加载中',
    });
    
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'getAssignments',
        userRole: 'staff',
        clinicId: this.data.clinicInfo._id
      },
      success: res => {
        console.log('获取分配记录成功:', res.result);
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          const assignments = res.result.assignments || [];
          
          // 设置空状态
          const emptyState = assignments.length === 0;
          
          // 计算待处理任务数量
          const pendingTasksCount = assignments.filter(a => a.status === 'assigned' || a.status === 'rejected').length;
          
          // 计算历史任务数量
          const historyTasksCount = assignments.filter(a => a.status === 'submitted' || a.status === 'approved' || a.status === 'completed').length;
          
          this.setData({
            assignments: assignments,
            emptyState: emptyState,
            pendingTasksCount: pendingTasksCount,
            historyTasksCount: historyTasksCount,
            loading: false
          });
        } else {
          wx.showToast({
            title: res.result.errMsg || '获取分配记录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取分配记录失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '获取分配记录失败',
          icon: 'none'
        });
        
        this.setData({
          loading: false,
          emptyState: true
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
  },

  // 查看宠物详情
  viewPetDetail: function(e) {
    const petId = e.currentTarget.dataset.petid;
    
    // 跳转到宠物详情页
    wx.navigateTo({
      url: `/pages/petDetail/petDetail?id=${petId}`
    });
  },

  // 提交记录
  submitRecord: function(e) {
    const assignment = e.currentTarget.dataset.assignment;
    
    // 跳转到提交记录页面
    wx.navigateTo({
      url: `/pages/submitRecord/submitRecord?id=${assignment._id}`
    });
  },

  // 刷新数据
  refreshData: function() {
    this.fetchAssignments();
  },

  // 返回
  goBack: function() {
    wx.navigateBack();
  }
});
