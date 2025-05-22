// pages/recordReview/recordReview.js
Page({
  data: {
    assignmentId: '',
    assignment: null,
    comments: '',
    loading: true,
    submitting: false,
    maxCommentLength: 200,
    commentCount: 0
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({
        assignmentId: options.id
      });
      this.fetchAssignmentDetail(options.id);
    } else {
      wx.showToast({
        title: '缺少必要参数',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 获取分配记录详情
  fetchAssignmentDetail: function(assignmentId) {
    wx.showLoading({
      title: '加载中',
    });
    
    // 使用云函数获取分配记录详情
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'getAssignments',
        userRole: 'vet'
      },
      success: res => {
        console.log('获取分配记录成功:', res.result);
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          const assignments = res.result.assignments || [];
          const assignment = assignments.find(a => a._id === assignmentId);
          
          if (assignment) {
            this.setData({
              assignment: assignment,
              loading: false
            });
          } else {
            wx.showToast({
              title: '未找到分配记录',
              icon: 'none'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        } else {
          wx.showToast({
            title: res.result.errMsg || '获取分配记录失败',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      },
      fail: err => {
        console.error('获取分配记录失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '获取分配记录失败',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  // 输入评论
  onInputComments: function(e) {
    const content = e.detail.value;
    const count = content.length;
    
    // 限制最大字符数
    if (count <= this.data.maxCommentLength) {
      this.setData({
        comments: content,
        commentCount: count
      });
    }
  },

  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    const urls = this.data.assignment.fileIDs || [];
    
    if (urls.length > 0) {
      wx.previewImage({
        current: current,
        urls: urls
      });
    }
  },

  // 查看宠物详情
  viewPetDetail: function() {
    if (this.data.assignment && this.data.assignment.petId) {
      wx.navigateTo({
        url: `/pages/petDetail/petDetail?id=${this.data.assignment.petId}`
      });
    }
  },

  // 审核记录
  reviewRecord: function(e) {
    const approved = e.currentTarget.dataset.approved;
    
    // 如果拒绝但没有填写原因
    if (!approved && !this.data.comments.trim()) {
      wx.showToast({
        title: '请填写退回原因',
        icon: 'none'
      });
      return;
    }
    
    // 防止重复提交
    if (this.data.submitting) {
      return;
    }
    
    this.setData({
      submitting: true
    });
    
    wx.showLoading({
      title: approved ? '正在通过' : '正在退回',
    });
    
    // 提交审核结果
    wx.cloud.callFunction({
      name: 'managePetAssignments',
      data: {
        action: 'approveRecord',
        assignmentId: this.data.assignmentId,
        approved: approved,
        comments: this.data.comments
      },
      success: res => {
        console.log('审核记录成功:', res.result);
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: approved ? '已通过' : '已退回',
            icon: 'success'
          });
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.errMsg || '审核失败',
            icon: 'none'
          });
          this.setData({
            submitting: false
          });
        }
      },
      fail: err => {
        console.error('审核记录失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '审核失败',
          icon: 'none'
        });
        this.setData({
          submitting: false
        });
      }
    });
  },

  // 返回
  goBack: function() {
    wx.navigateBack();
  }
});
