// pages/petList/petList.js
Page({
  data: {
    pets: [
      { id: 1, name: '小花', status: '住院', createdAt: '2023-04-01' },
      { id: 2, name: '小白', status: '术后', createdAt: '2023-04-02' },
      { id: 3, name: '小黑', status: '住院', createdAt: '2023-04-03' },
    ]
  },
  onLoad: function (options) {
    // 页面加载时获取宠物列表数据
    // 这里应该调用API获取实际数据
  },
  // 跳转到宠物详情页
  goToPetDetail: function(e) {
    const petId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/petDetail/petDetail?id=${petId}`,
    })
  }
})
