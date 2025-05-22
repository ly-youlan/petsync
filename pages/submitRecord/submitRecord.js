// pages/submitRecord/submitRecord.js
Page({
  data: {
    assignmentId: '',
    assignment: null,
    recordContent: '',
    fileIDs: [],
    tempFilePaths: [],
    maxImageCount: 9,
    loading: true,
    submitting: false,
    characterCount: 0,
    maxCharacterCount: 500
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
        userRole: 'staff'
      },
      success: res => {
        console.log('获取分配记录成功:', res.result);
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          const assignments = res.result.assignments || [];
          const assignment = assignments.find(a => a._id === assignmentId);
          
          if (assignment) {
            // 如果已经有记录内容，则填充
            const recordContent = assignment.recordContent || '';
            const fileIDs = assignment.fileIDs || [];
            
            this.setData({
              assignment: assignment,
              recordContent: recordContent,
              fileIDs: fileIDs,
              characterCount: recordContent.length,
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

  // 输入记录内容
  onInputRecord: function(e) {
    const content = e.detail.value;
    const count = content.length;
    
    // 限制最大字符数
    if (count <= this.data.maxCharacterCount) {
      this.setData({
        recordContent: content,
        characterCount: count
      });
    }
  },

  // 选择图片
  chooseImage: function() {
    const currentCount = this.data.tempFilePaths.length;
    const remainCount = this.data.maxImageCount - currentCount;
    
    if (remainCount <= 0) {
      wx.showToast({
        title: `最多只能上传${this.data.maxImageCount}张图片`,
        icon: 'none'
      });
      return;
    }
    
    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFilePaths = res.tempFilePaths;
        
        // 更新临时文件路径
        this.setData({
          tempFilePaths: [...this.data.tempFilePaths, ...tempFilePaths]
        });
      }
    });
  },

  // 预览图片
  previewImage: function(e) {
    const current = e.currentTarget.dataset.src;
    const urls = [...this.data.tempFilePaths, ...this.data.fileIDs];
    
    wx.previewImage({
      current: current,
      urls: urls
    });
  },

  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type; // temp 或 cloud
    
    if (type === 'temp') {
      const tempFilePaths = this.data.tempFilePaths;
      tempFilePaths.splice(index, 1);
      this.setData({
        tempFilePaths: tempFilePaths
      });
    } else if (type === 'cloud') {
      const fileIDs = this.data.fileIDs;
      fileIDs.splice(index, 1);
      this.setData({
        fileIDs: fileIDs
      });
    }
  },

  // 上传图片到云存储
  uploadImages: function() {
    return new Promise((resolve, reject) => {
      const tempFilePaths = this.data.tempFilePaths;
      
      if (tempFilePaths.length === 0) {
        // 没有新图片需要上传，直接返回现有的fileIDs
        resolve(this.data.fileIDs);
        return;
      }
      
      const uploadTasks = tempFilePaths.map(filePath => {
        return new Promise((resolve, reject) => {
          const fileName = filePath.split('/').pop();
          const cloudPath = `pet_records/${Date.now()}_${Math.random().toString(36).substr(2)}_${fileName}`;
          
          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            success: res => {
              resolve(res.fileID);
            },
            fail: err => {
              console.error('上传图片失败:', err);
              reject(err);
            }
          });
        });
      });
      
      Promise.all(uploadTasks)
        .then(newFileIDs => {
          // 合并新上传的fileIDs和已有的fileIDs
          const allFileIDs = [...this.data.fileIDs, ...newFileIDs];
          resolve(allFileIDs);
        })
        .catch(err => {
          reject(err);
        });
    });
  },

  // 提交记录
  submitRecord: function() {
    // 验证输入
    if (!this.data.recordContent.trim()) {
      wx.showToast({
        title: '请输入记录内容',
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
      title: '正在提交',
    });
    
    // 先上传图片
    this.uploadImages()
      .then(fileIDs => {
        // 提交记录
        return wx.cloud.callFunction({
          name: 'managePetAssignments',
          data: {
            action: 'submitRecord',
            assignmentId: this.data.assignmentId,
            recordContent: this.data.recordContent,
            fileIDs: fileIDs
          }
        });
      })
      .then(res => {
        console.log('提交记录成功:', res.result);
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          });
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.errMsg || '提交失败',
            icon: 'none'
          });
          this.setData({
            submitting: false
          });
        }
      })
      .catch(err => {
        console.error('提交记录失败:', err);
        wx.hideLoading();
        
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        });
        this.setData({
          submitting: false
        });
      });
  },

  // 返回
  goBack: function() {
    wx.navigateBack();
  }
});
