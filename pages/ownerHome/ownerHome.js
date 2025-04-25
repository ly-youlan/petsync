// pages/ownerHome/ownerHome.js
Page({
  data: {
    loading: true,
    petRecords: [],
    ownerInfo: null,
    refreshing: false,
    emptyState: false,
    hasUserInfo: false,
    userInfo: null
  },

  onLoad: function (options) {
    const app = getApp();
    app.log('OWNER_HOME', '宠物主人主页加载');
    this.loadOwnerInfo();
    this.getPetRecords();
    this.checkUserInfo();
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({ refreshing: true });
    this.getPetRecords();
  },
  
  // 加载宠物主人信息
  loadOwnerInfo: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    
    if (userInfo) {
      this.setData({
        ownerInfo: {
          phone: userInfo.ownerPhone || '',
          name: userInfo.ownerName || ''
        }
      });
    }
  },
  
  // 检查是否已有用户信息
  checkUserInfo: function() {
    // 尝试从本地缓存获取用户信息
    const userInfo = wx.getStorageSync('wxUserInfo');
    if (userInfo) {
      this.setData({
        hasUserInfo: true,
        userInfo: userInfo
      });
    }
  },
  
  // 获取用户信息
  getUserProfile: function() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res);
        
        // 存储到本地
        wx.setStorageSync('wxUserInfo', res.userInfo);
        
        this.setData({
          hasUserInfo: true,
          userInfo: res.userInfo
        });
        
        // 更新到云端
        this.updateUserInfoToCloud(res.userInfo);
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '获取信息失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 将用户信息更新到云端
  updateUserInfoToCloud: function(wxUserInfo) {
    const app = getApp();
    const openid = app.globalData.openid;
    
    if (!openid) {
      console.error('未获取到openid，无法更新用户信息');
      return;
    }
    
    // 调用云函数更新用户信息
    wx.cloud.callFunction({
      name: 'manageUser',
      data: {
        action: 'updateUser',
        userData: {
          wxUserInfo: wxUserInfo
        }
      },
      success: (res) => {
        console.log('更新用户信息成功:', res);
      },
      fail: (err) => {
        console.error('更新用户信息失败:', err);
      }
    });
  },
  
  // 获取宠物记录
  getPetRecords: function() {
    const app = getApp();
    const openid = app.globalData.openid;
    const userInfo = app.globalData.userInfo;
    
    console.log('当前用户信息:', userInfo);
    
    if (!openid || !userInfo) {
      console.log('用户信息不完整，无法获取宠物记录');
      this.setData({
        loading: false,
        emptyState: true
      });
      return;
    }
    
    // 确保有手机号，优先使用ownerPhone，如果没有则使用phoneNumber
    const phoneNumber = userInfo.ownerPhone || userInfo.phoneNumber;
    
    if (!phoneNumber) {
      console.log('未找到用户手机号，无法获取宠物记录');
      this.setData({
        loading: false,
        emptyState: true
      });
      return;
    }
    
    console.log('使用手机号查询宠物记录:', phoneNumber);
    
    wx.showLoading({
      title: '加载中'
    });
    
    // 调用云函数获取宠物记录
    wx.cloud.callFunction({
      name: 'getPetRecords',
      data: {
        ownerPhone: phoneNumber,
        userRole: 'owner' // 指定用户角色为宠物主人
      },
      success: res => {
        wx.hideLoading();
        app.log('OWNER_HOME', '获取宠物记录成功', res);
        
        let petRecords = [];
        
        // 兼容两种返回格式
        if (res.result && res.result.data) {
          petRecords = res.result.data;
        } else if (res.result && res.result.petRecords) {
          petRecords = res.result.petRecords;
        }
        
        if (petRecords.length === 0) {
          app.log('OWNER_HOME', '未找到宠物记录');
          this.setData({
            petRecords: [],
            loading: false,
            refreshing: false,
            emptyState: true
          });
          return;
        }
        
        app.log('OWNER_HOME', '第一条宠物记录数据', petRecords[0]);
        
        // 处理每条记录的最新更新时间，转换为相对时间格式
        const processedRecords = petRecords.map(record => {
          // 获取最新的更新时间
          let latestUpdateTime = record.updateTime || record.createTime;
          app.log('TIME', '最新更新时间', { time: latestUpdateTime, type: typeof latestUpdateTime });
          
          // 确保时间是字符串类型
          if (typeof latestUpdateTime !== 'string') {
            latestUpdateTime = latestUpdateTime.toString();
          }
          
          // 计算相对时间
          try {
            const relativeTime = this.getRelativeTime(latestUpdateTime);
            app.log('TIME', '转换后的相对时间', relativeTime);
            
            // 格式化具体时间
            const formattedTime = this.formatSpecificTime(latestUpdateTime);
            
            return {
              ...record,
              relativeTime: relativeTime,
              formattedTime: formattedTime
            };
          } catch (err) {
            app.log('TIME', '处理时间出错', { error: err, time: latestUpdateTime });
            return {
              ...record,
              relativeTime: '未知时间',
              formattedTime: ''
            };
          }
        });
        
        this.setData({
          petRecords: processedRecords,
          loading: false,
          refreshing: false,
          emptyState: false
        });
        
        // 将数据缓存到本地
        wx.setStorageSync('ownerPetRecords_' + openid, petRecords);
      },
      fail: err => {
        wx.hideLoading();
        app.log('OWNER_HOME', '获取宠物记录失败', err);
        // 如果云函数调用失败，尝试使用本地缓存
        this._fallbackToLocalPetRecords(openid);
      },
      complete: () => {
        wx.stopPullDownRefresh();
      }
    });
  },
  
  // 当云函数调用失败时，回退到本地缓存
  _fallbackToLocalPetRecords: function(openid) {
    console.log('回退到本地缓存的宠物记录');
    const petRecords = wx.getStorageSync('ownerPetRecords_' + openid) || [];
    
    // 处理每条记录的最新更新时间，转换为相对时间格式
    const processedRecords = petRecords.map(record => {
      // 创建一个新对象，避免修改原始数据
      const newRecord = {...record};
      
      // 如果有更新记录，计算最新更新的相对时间
      if (newRecord.updates && newRecord.updates.length > 0) {
        const latestUpdate = newRecord.updates[newRecord.updates.length - 1];
        
        // 直接设置相对时间
        const now = new Date();
        let date;
        try {
          if (typeof latestUpdate.createTime === 'number') {
            date = new Date(latestUpdate.createTime);
          } else if (typeof latestUpdate.createTime === 'string') {
            // 直接使用new Date()解析ISO格式时间
            date = new Date(latestUpdate.createTime);
          } else {
            date = new Date();
          }
          
          const diffMs = now - date;
          const diffSec = Math.floor(diffMs / 1000);
          const diffMin = Math.floor(diffSec / 60);
          const diffHour = Math.floor(diffMin / 60);
          const diffDay = Math.floor(diffHour / 24);
          
          if (diffSec < 60) {
            newRecord.updateTimeAgo = diffSec + ' 秒前';
          } else if (diffMin < 60) {
            newRecord.updateTimeAgo = diffMin + ' 分钟前';
          } else if (diffHour < 24) {
            newRecord.updateTimeAgo = diffHour + ' 小时前';
          } else if (diffDay < 30) {
            newRecord.updateTimeAgo = diffDay + ' 天前';
          } else {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            newRecord.updateTimeAgo = year + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
          }
        } catch (e) {
          console.error('计算相对时间错误:', e);
          newRecord.updateTimeAgo = '最近更新';
        }
        
        // 格式化时间
        try {
          // 直接使用new Date()解析ISO格式时间
          const d = new Date(latestUpdate.createTime);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const hours = d.getHours();
            const minutes = d.getMinutes();
            
            newRecord.updateTimeFormatted = year + '-' + 
              (month < 10 ? '0' + month : month) + '-' + 
              (day < 10 ? '0' + day : day) + ' ' + 
              (hours < 10 ? '0' + hours : hours) + ':' + 
              (minutes < 10 ? '0' + minutes : minutes);
          } else {
            // 如果日期无效，尝试处理字符串
            if (typeof latestUpdate.createTime === 'string') {
              newRecord.updateTimeFormatted = latestUpdate.createTime
                .replace('T', ' ')
                .replace('Z', '')
                .replace(/\.[0-9]+$/, '');
            } else {
              newRecord.updateTimeFormatted = '无效时间';
            }
          }
        } catch (e) {
          console.error('格式化时间错误:', e);
          newRecord.updateTimeFormatted = '无效时间';
        }
      }
      
      return newRecord;
    });
    
    this.setData({
      petRecords: processedRecords,
      loading: false,
      refreshing: false,
      emptyState: processedRecords.length === 0
    });
  },
  

  
  // 查看宠物详情
  viewPetDetail: function(e) {
    const petId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/ownerPetDetail/ownerPetDetail?id=' + petId
    });
  },
  
  // 退出登录
  logout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          // 清除登录状态
          const app = getApp();
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          
          // 清除本地存储
          wx.removeStorageSync('userInfo');
          
          // 跳转到登录页面
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  },
  
  // 计算相对时间（几天前、几小时前等）
  _getTimeAgo: function(dateString) {
    if (!dateString) return '';
    
    console.log('计算相对时间输入:', dateString, '类型:', typeof dateString);
    
    // 尝试解析日期字符串
    let date;
    try {
      // 如果是时间戳，直接转换
      if (typeof dateString === 'number') {
        date = new Date(dateString);
      } else {
        // 尝试处理常见的日期格式
        date = new Date(dateString.replace(/-/g, '/'));
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return dateString; // 如果日期无效，返回原始字符串
      }
    } catch (e) {
      console.error('日期解析错误:', e);
      return dateString; // 出错时返回原始字符串
    }
    
    const now = new Date();
    const diffMs = now - date; // 时间差（毫秒）
    
    console.log('当前时间:', now, '目标时间:', date, '时间差(毫秒):', diffMs);
    
    // 转换为秒、分、小时、天
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    console.log('时间差: ', diffSec, '秒,', diffMin, '分钟,', diffHour, '小时,', diffDay, '天');
    
    // 根据时间差返回不同的格式
    let result = '';
    if (diffSec < 60) {
      result = diffSec + ' 秒前';
    } else if (diffMin < 60) {
      result = diffMin + ' 分钟前';
    } else if (diffHour < 24) {
      result = diffHour + ' 小时前';
    } else if (diffDay < 30) {
      result = diffDay + ' 天前';
    } else {
      // 超过30天则显示具体日期（年月日）
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      result = year + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
    }
    
    console.log('返回的相对时间:', result);
    return result;
  },
  
  // 格式化时间，返回年-月-日 时:分格式
  _formatTime: function(dateString) {
    if (!dateString) return '';
    
    // 尝试解析日期字符串
    let date;
    try {
      // 如果是时间戳，直接转换
      if (typeof dateString === 'number') {
        date = new Date(dateString);
      } else if (typeof dateString === 'string') {
        if (dateString.includes('T')) {
          // 处理ISO格式的时间字符串，如"2025-04-24T15:49:23.539Z"
          date = new Date(dateString);
          
          // 检查日期是否有效，如果无效则尝试其他方法
          if (isNaN(date.getTime())) {
            // 尝试将ISO格式转换为普通格式
            const normalizedDateString = dateString
              .replace('T', ' ')
              .replace('Z', '')
              .replace(/\.[0-9]+$/, '');
            date = new Date(normalizedDateString.replace(/-/g, '/'));
          }
        } else {
          // 尝试处理常见的日期格式
          date = new Date(dateString.replace(/-/g, '/'));
        }
      } else {
        // 如果是其他类型，转为字符串处理
        date = new Date(String(dateString));
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        // 如果日期无效，尝试处理常见的时间格式
        if (typeof dateString === 'string' && dateString.length > 0) {
          // 尝试处理常见的时间格式，去掉不必要的字符
          const cleanDateString = dateString
            .replace('T', ' ')
            .replace('Z', '')
            .replace(/\.[0-9]+$/, '');
          return cleanDateString;
        }
        return dateString;
      }
    } catch (e) {
      console.error('日期解析错误:', e);
      // 尝试处理常见的时间格式，去掉不必要的字符
      if (typeof dateString === 'string' && dateString.length > 0) {
        const cleanDateString = dateString
          .replace('T', ' ')
          .replace('Z', '')
          .replace(/\.[0-9]+$/, '');
        return cleanDateString;
      }
      return dateString; // 出错时返回原始字符串
    }
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // 格式化为 YYYY-MM-DD HH:MM
    return year + '-' + 
           (month < 10 ? '0' + month : month) + '-' + 
           (day < 10 ? '0' + day : day) + ' ' + 
           (hours < 10 ? '0' + hours : hours) + ':' + 
           (minutes < 10 ? '0' + minutes : minutes);
  }
})
