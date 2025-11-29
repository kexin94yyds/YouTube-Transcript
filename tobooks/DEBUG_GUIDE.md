# 🔍 调试指南

## 已完成的修改

### ✅ 添加了详细的调试日志

**修改的文件：**
- `books-gesture-navigation.js` 
- 已复制到 `tobooks-main/books-gesture-navigation.js`

**添加的调试信息：**
1. ✅ 初始化日志
2. ✅ Wheel 事件触发日志（每次滑动都会显示）
3. ✅ 水平滚动检测日志
4. ✅ 安全区域检查日志（显示具体坐标）
5. ✅ 累积滑动距离日志
6. ✅ 翻页触发日志
7. ✅ 翻页动画执行日志

**关键改动：**
- 🔄 将 wheel 事件监听器从 `element` 改为 `document`（全局监听）

## 🧪 测试步骤

### 1. 刷新页面
在浏览器中按 **Cmd + Shift + R** 强制刷新

### 2. 打开控制台
按 **Cmd + Option + I** 或 **F12**

### 3. 加载电子书
拖拽或选择一个 EPUB 文件

### 4. 查看初始化日志
应该看到：
```
🔧 初始化手势导航...
📦 ViewerElement: <div>
⚙️ 配置: {edgeSafeZoneWidth: 80, ...}
✅ 触摸手势已设置
✅ 触控板手势已设置
✅ 边缘区域已创建
✅ Wheel事件监听器已添加到: document
📚 macOS Books 风格手势导航已启用
```

### 5. 测试触控板滑动
在触控板上**双指左右滑动**

### 6. 观察控制台输出

#### 🎯 预期看到的日志：

**每次滑动都应该显示：**
```
🔄 Wheel事件触发: {deltaX: 10, deltaY: 0, clientX: 500, ...}
➡️ 检测到水平滚动
🔍 安全区域检查: {clientX: 500, windowWidth: 1200, leftEdge: 80, rightEdge: 1120, inZone: false}
📊 累积滑动距离: 10
...
⏱️ 滑动结束，累积距离: 120
📖 触发翻页：下一页
🎬 开始翻页动画: next
✅ Rendition 存在，开始翻页
```

## 📊 问题诊断

### 情况 A: 没有看到 "🔄 Wheel事件触发"
**问题：** wheel 事件根本没被触发
**可能原因：**
- 浏览器不支持触控板手势
- 其他脚本阻止了事件
**解决：** 尝试用鼠标滚轮滚动

### 情况 B: 看到 "🔄 Wheel事件触发" 但没有 "➡️ 检测到水平滚动"
**问题：** deltaX 太小或为 0
**可能原因：**
- 触控板滑动不够用力
- 滑动方向不是完全水平
**解决：** 尝试更用力、更水平地滑动

### 情况 C: 看到 "🛡️ 在安全区域内"
**问题：** 滑动位置在边缘区域
**解决：** 在屏幕中央滑动

### 情况 D: 看到 "⚠️ 滑动距离不足"
**问题：** 累积滑动距离 < 50px
**解决：** 滑动距离更长一些

### 情况 E: 看到 "📖 触发翻页" 但页面没变化
**问题：** rendition.prev() 或 rendition.next() 没工作
**解决：** 检查 EPUB 是否正常加载

## 💡 调整建议

如果频繁出现 "滑动距离不足"，可以在 `tobooks-main/index.html` 中修改：

```javascript
gestureNavigation = new window.BooksGestureNavigation(rendition, {
    edgeSafeZoneWidth: 80,
    minSwipeDistance: 30,    // 从 50 改为 30（更灵敏）
    minSwipeVelocity: 0.2,   // 从 0.3 改为 0.2（更灵敏）
    // ...
});
```

---

**请在控制台中查看日志，然后告诉我看到了什么！** 🔍
