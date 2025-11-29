# macOS Books 风格手势导航

## 📚 功能简介

这是一个模仿 macOS Books 应用的手势翻页功能，为 EPUB 阅读器提供流畅自然的翻页体验。

## ✨ 主要特性

### 🖱️ 触控板支持
- **双指左右滑动**：在 macOS 触控板上用两个手指左右滑动即可翻页
- **灵敏度控制**：智能识别滑动手势，避免误触发
- **方向检测**：左滑下一页，右滑上一页（符合直觉）

### 📱 触摸屏支持
- **手指滑动**：在触摸屏设备上用手指左右滑动翻页
- **速度识别**：支持快速滑动和慢速拖动两种方式
- **流畅动画**：滑动时有平滑的过渡效果

### 🛡️ 边缘安全区域
- **防误触设计**：左右两边各有 80px 的安全区域
- **可视化提示**：鼠标悬停时显示半透明的边缘区域
- **智能识别**：在边缘区域内的滑动不会触发翻页

### 🎨 动画效果
- **页面过渡**：翻页时有流畅的滑动动画
- **自然感觉**：模仿真实书籍的翻页体验
- **性能优化**：使用 CSS3 transform 实现高性能动画

## 🚀 快速开始

### 1. 查看演示
打开浏览器访问：
```
http://localhost:3002/gesture-demo.html
```

### 2. 使用说明
1. 点击"打开电子书"按钮选择一个 EPUB 文件
2. 加载完成后，尝试以下操作：
   - **触控板**：双指左右滑动
   - **触摸屏**：手指左右滑动
   - **键盘**：使用左右方向键
   - **鼠标**：点击左右导航按钮

### 3. 集成到现有项目

#### 步骤 1：引入脚本
```html
<script src="books-gesture-navigation.js"></script>
```

#### 步骤 2：初始化
在创建 EPUB rendition 后添加：
```javascript
// 创建 EPUB 渲染器
const rendition = book.renderTo('viewer', {
    width: '100%',
    height: '100%',
    flow: 'paginated',
    spread: 'none'
});

await rendition.display();

// 初始化手势导航
const gestureNavigation = new BooksGestureNavigation(rendition, {
    edgeSafeZoneWidth: 80,        // 边缘安全区域宽度（像素）
    minSwipeDistance: 50,         // 最小滑动距离（像素）
    minSwipeVelocity: 0.3,        // 最小滑动速度（像素/毫秒）
    enableTrackpad: true,         // 启用触控板支持
    enableTouch: true,            // 启用触摸支持
    showEdgeZones: true,          // 显示边缘区域
    animationDuration: 300        // 动画持续时间（毫秒）
});
```

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `edgeSafeZoneWidth` | Number | 80 | 左右边缘安全区域宽度（像素） |
| `minSwipeDistance` | Number | 50 | 触发翻页的最小滑动距离（像素） |
| `minSwipeVelocity` | Number | 0.3 | 触发翻页的最小滑动速度（像素/毫秒） |
| `enableTrackpad` | Boolean | true | 是否启用触控板手势 |
| `enableTouch` | Boolean | true | 是否启用触摸手势 |
| `showEdgeZones` | Boolean | true | 是否显示边缘区域视觉提示 |
| `animationDuration` | Number | 300 | 翻页动画持续时间（毫秒） |

## 💡 使用技巧

### 调整灵敏度
如果觉得翻页太容易或太难触发，可以调整这两个参数：

```javascript
new BooksGestureNavigation(rendition, {
    minSwipeDistance: 30,    // 减小值 = 更容易触发
    minSwipeVelocity: 0.5    // 增大值 = 需要更快的滑动
});
```

### 调整边缘区域
如果经常误触翻页或觉得边缘太宽：

```javascript
new BooksGestureNavigation(rendition, {
    edgeSafeZoneWidth: 100   // 增大值 = 更大的安全区域
});
```

### 禁用某些功能
如果只想在桌面端使用：

```javascript
new BooksGestureNavigation(rendition, {
    enableTouch: false       // 禁用触摸支持
});
```

## 🎯 体验对比

### macOS Books 原生应用
- ✅ 触控板双指滑动
- ✅ 边缘区域保护
- ✅ 流畅动画
- ✅ 手势识别

### 本实现
- ✅ 触控板双指滑动 - **已实现**
- ✅ 边缘区域保护 - **已实现**
- ✅ 流畅动画 - **已实现**
- ✅ 手势识别 - **已实现**
- 🎁 额外支持触摸屏 - **增强功能**
- 🎁 可自定义配置 - **增强功能**

## 📝 技术细节

### 触控板检测
使用 `wheel` 事件监听触控板的水平滚动（`deltaX`），通过累积滑动距离来判断是否触发翻页。

### 触摸检测
使用 `touchstart`、`touchmove`、`touchend` 事件监听触摸操作，计算滑动距离和速度来判断翻页方向。

### 边缘保护
在滑动开始时检查触发位置，如果在左右边缘 80px 范围内则不响应翻页。

### 动画实现
使用 CSS3 `transform` 和 `transition` 实现流畅的翻页动画，避免重绘提高性能。

## 🐛 故障排除

### 问题：触控板滑动不生效
**解决方案**：
- 确保浏览器支持 `wheel` 事件的 `deltaX` 属性
- 检查是否有其他脚本阻止了 `wheel` 事件
- 尝试在不同浏览器中测试（推荐 Chrome/Safari）

### 问题：经常误触翻页
**解决方案**：
```javascript
// 增大安全区域和最小滑动距离
new BooksGestureNavigation(rendition, {
    edgeSafeZoneWidth: 120,
    minSwipeDistance: 80
});
```

### 问题：翻页不够灵敏
**解决方案**：
```javascript
// 减小最小滑动距离和速度阈值
new BooksGestureNavigation(rendition, {
    minSwipeDistance: 30,
    minSwipeVelocity: 0.2
});
```

## 📦 文件说明

- `books-gesture-navigation.js` - 核心手势导航库
- `gesture-demo.html` - 功能演示页面
- `epub-reader.html` - 已集成手势导航的阅读器
- `GESTURE_NAVIGATION_README.md` - 本说明文档

## 🔧 销毁实例

当不再需要手势导航时，记得销毁实例：

```javascript
if (gestureNavigation) {
    gestureNavigation.destroy();
    gestureNavigation = null;
}
```

## 📄 许可证

本功能作为 Tobooks 项目的一部分，遵循项目的整体许可证。

## 🙏 致谢

灵感来源于 macOS Books 应用的优秀用户体验设计。

---

**享受流畅的阅读体验！** 📚✨
