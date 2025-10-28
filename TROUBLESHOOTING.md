# 问题排除文档 (Troubleshooting)

本文档记录了开发过程中遇到的典型问题、原因分析和解决方案，供将来参考。

---

## 问题 #1: 视频与侧边栏未实现实时自适应联动

**日期**: 2025-10-28  
**状态**: ✅ 已解决  
**严重程度**: 中等

### 问题描述

在实现视频侧边栏功能时，遇到以下问题：

1. **首次呼出侧边栏**：视频能够移动到左边，但侧边栏显示后视频不会自动调整大小
2. **拖拽/调整侧边栏**：手动调整侧边栏位置或大小时，视频保持不变，不会实时响应
3. **隐藏侧边栏**：关闭侧边栏后，视频不会自动恢复满屏状态
4. **再次呼出侧边栏**：第二次打开侧边栏时，视频仍然不会自适应

**期望行为**：实现"你大我小，我大你小"的动态联动效果 - 侧边栏和视频区域能够实时响应彼此的变化。

### 根本原因

#### 1. CSS 选择器不够具体
原有的 CSS 规则只针对外层容器，没有直接控制视频播放器本身：

```css
/* 原有 CSS - 只控制容器 */
html.yt-transcript-pinned ytd-watch-flexy #player {
  max-width: calc(100vw - var(--yt-transcript-sidebar-width, 400px)) !important;
}
```

**问题**：YouTube 的视频播放器 (`#movie_player`, `video` 元素) 嵌套层级深，外层容器的尺寸约束无法直接传递到视频元素。

#### 2. 缺少实时布局更新机制
在拖拽和调整侧边栏时，只更新了 CSS 变量，但没有触发 YouTube 重新计算布局：

```javascript
// 原有代码 - 只更新 CSS 变量
function updatePinnedSpace() {
    document.documentElement.style.setProperty('--yt-transcript-sidebar-width', w + 'px');
    // 缺少触发布局更新的代码
}
```

**问题**：YouTube 播放器不会自动监听 CSS 变量变化，需要手动触发 `resize` 事件。

#### 3. 显示/隐藏侧边栏时未触发布局刷新
`showSidebar()` 和 `hideSidebar()` 函数只处理了侧边栏本身的显示状态，没有通知 YouTube 重新计算视频尺寸。

### 解决方案

#### 方案 1: 增强 CSS 规则，直接控制视频播放器

**文件**: `content-dom.js` - `ensurePinStyleElement()` 函数

**修改内容**：
```javascript
function ensurePinStyleElement() {
    const style = document.createElement('style');
    style.textContent = `
      /* 原有：控制容器 */
      html.yt-transcript-pinned ytd-watch-flexy #primary {
        max-width: calc(100vw - var(--yt-transcript-sidebar-width, 400px)) !important;
        width: calc(100vw - var(--yt-transcript-sidebar-width, 400px)) !important;
      }
      
      /* 🔧 新增：直接控制视频播放器 */
      html.yt-transcript-pinned #player-container,
      html.yt-transcript-pinned #movie_player,
      html.yt-transcript-pinned .html5-video-container,
      html.yt-transcript-pinned .html5-video-player,
      html.yt-transcript-pinned video {
        max-width: calc(100vw - var(--yt-transcript-sidebar-width, 400px)) !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(style);
}
```

**关键点**：
- 使用更具体的选择器直接控制视频元素
- 同时设置 `max-width` 和 `width` 确保优先级
- 使用 `!important` 覆盖 YouTube 的默认样式

#### 方案 2: 在 updatePinnedSpace() 中添加强制刷新机制

**文件**: `content-dom.js` - `updatePinnedSpace()` 函数

**修改内容**：
```javascript
function updatePinnedSpace() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    if (!isPinned()) return;
    
    const rect = sidebar.getBoundingClientRect();
    const w = Math.max(280, Math.min(900, rect.width || parseInt(sidebar.style.width || '400', 10)));
    document.documentElement.style.setProperty('--yt-transcript-sidebar-width', w + 'px');
    
    // 🔧 新增：强制 YouTube 播放器重新计算尺寸
    try {
        const player = document.querySelector('#movie_player');
        if (player && typeof player.updateVideoElementSize === 'function') {
            player.updateVideoElementSize();
        }
        
        // 触发视频容器的尺寸重算
        const video = document.querySelector('video');
        if (video) {
            // 通过微小的样式变化触发重排
            video.style.opacity = '0.9999';
            requestAnimationFrame(() => {
                video.style.opacity = '1';
            });
        }
    } catch (e) {
        // 忽略错误
    }
}
```

**关键点**：
- 调用 YouTube 播放器的内部方法 `updateVideoElementSize()`
- 通过微小的样式变化强制触发浏览器重排
- 使用 `requestAnimationFrame` 确保在下一帧执行

#### 方案 3: 在拖拽/调整时实时触发布局更新

**文件**: `content-dom.js` - `enableSidebarDrag()` 和 `enableSidebarResize()` 函数

**修改内容**：
```javascript
// 在拖拽移动的回调中添加
const onMouseMove = (e) => {
    // ... 原有的位置计算代码 ...
    
    // 🔧 新增：实时更新布局
    updatePinnedSpace();
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
};

// 在左侧调整宽度的回调中添加
const onMove = (ev) => {
    // ... 原有的宽度计算代码 ...
    
    // 🔧 新增：实时更新布局
    updatePinnedSpace();
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
};

// 在右下角调整大小的回调中添加
const onMove = (ev) => {
    // ... 原有的尺寸计算代码 ...
    
    // 🔧 新增：实时更新布局
    updatePinnedSpace();
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
};
```

**关键点**：
- 在每次拖拽/调整的过程中都调用 `updatePinnedSpace()`
- 使用 `requestAnimationFrame` 确保布局更新先完成，再触发 `resize` 事件
- 实现流畅的实时响应

#### 方案 4: 在显示侧边栏时触发布局刷新

**文件**: `content-dom.js` - `showSidebar()` 函数

**修改内容**：
```javascript
function showSidebar() {
    // ... 原有的显示代码 ...
    
    applyPinnedState();
    
    // 🔧 新增：触发布局更新，让视频立即自适应
    requestAnimationFrame(() => {
        updatePinnedSpace();
        window.dispatchEvent(new Event('resize'));
        
        // 再次触发确保 YouTube 完全响应
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
    
    // ... 原有的其他代码 ...
}
```

**关键点**：
- 在侧边栏显示后立即更新布局
- 双重触发 `resize` 事件确保 YouTube 完全响应
- 第二次触发延迟 100ms，给 YouTube 足够的时间处理

#### 方案 5: 在隐藏侧边栏时释放空间并刷新布局

**文件**: `content-dom.js` - `hideSidebar()` 函数

**修改内容**：
```javascript
function hideSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    
    // 使用平滑动画隐藏
    sidebar.style.opacity = '0';
    sidebar.style.transform = 'translateX(100%)';
    
    // 🔧 新增：立即清理页面预留空间
    document.documentElement.classList.remove('yt-transcript-pinned');
    document.documentElement.style.removeProperty('--yt-transcript-sidebar-width');
    
    // 🔧 新增：触发布局更新，让视频恢复满屏
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
    
    // ... 原有的其他代码 ...
}
```

**关键点**：
- 在动画开始时就释放预留空间，而不是等动画结束
- 双重触发布局更新确保视频立即恢复满屏
- 动画和布局更新并行执行，提升用户体验

### 验证方法

完成修改后，通过以下步骤验证问题是否解决：

1. **首次呼出测试**
   - 点击扩展图标呼出侧边栏
   - ✅ 验证视频是否立即移到左边并调整大小

2. **拖拽测试**
   - 拖拽侧边栏标题移动位置
   - ✅ 验证视频是否实时跟随移动

3. **调整宽度测试**
   - 拖拽侧边栏左侧边缘调整宽度
   - ✅ 验证视频是否实时变大/变小

4. **调整大小测试**
   - 拖拽侧边栏右下角调整整体大小
   - ✅ 验证视频是否实时响应

5. **隐藏测试**
   - 点击关闭按钮隐藏侧边栏
   - ✅ 验证视频是否恢复满屏

6. **再次显示测试**
   - 再次点击扩展图标显示侧边栏
   - ✅ 验证视频是否再次自适应侧边栏大小

### 相关提交

- **首次实现**: `153eb93` - feat: 实现视频与侧边栏实时自适应联动
- **后续优化**: `3f2b88c` - refactor: 优化滚动事件监听机制

### 经验教训

1. **CSS 选择器要足够具体**：对于复杂的第三方页面（如 YouTube），需要直接控制目标元素，而不是依赖层级传递

2. **事件触发时机很重要**：使用 `requestAnimationFrame` 确保 DOM 更新完成后再触发事件，避免时序问题

3. **多次触发增强可靠性**：对于复杂的 SPA 应用，单次事件可能不够，适当的延迟重试可以提高成功率

4. **实时响应提升体验**：在用户交互过程中（拖拽/调整）实时更新，比只在交互结束后更新体验更好

5. **保持代码幂等性**：`updatePinnedSpace()` 可以被多次调用而不会产生副作用，这样可以放心地在多个地方调用

---

## 问题 #2: [预留位置]

待补充...

---

## 附录

### 相关文件

- `content-dom.js` - 主要的内容脚本文件
- `sidebar.css` - 侧边栏样式文件
- `manifest.json` - 扩展配置文件

### 调试技巧

1. **查看 CSS 变量值**：
   ```javascript
   console.log(getComputedStyle(document.documentElement).getPropertyValue('--yt-transcript-sidebar-width'));
   ```

2. **检查元素尺寸**：
   ```javascript
   const video = document.querySelector('video');
   console.log(video.getBoundingClientRect());
   ```

3. **监听 resize 事件**：
   ```javascript
   window.addEventListener('resize', () => {
       console.log('Resize triggered at', Date.now());
   });
   ```

4. **检查 YouTube 播放器状态**：
   ```javascript
   const player = document.querySelector('#movie_player');
   console.log(player.getPlayerSize());
   ```

### 参考资源

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [MDN: ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)

# YouTube 转录侧边栏 · TROUBLESHOOTING

记录典型问题的“现象 → 根因 → 解决 → 验证”。遇到类似问题可按本文档快速排查。后续有新的典型问题，也按同一模板补充到此文件。

— 最后更新：2025-10-28

## 使用方法
- 先对照“现象”与“复现步骤”。
- 查看“根因”是否匹配你当前的 DOM/CSS/事件绑定状态。
- 对照“解决方案”的具体代码定位点（文件:行），验证是否已经包含修复。
- 按“验证清单”自检是否恢复。

---

## 问题 1：第二次呼出侧边栏后无法滚动目录，且不自动高亮跟随

### 现象
- 第一次打开侧边栏一切正常；关闭后再次打开：
  - 目录无法上下滚动；
  - 播放进度高亮却不自动滚动到可见位置；
  - Console 仍会打印“侧边栏已显示”。

### 复现步骤
1. 打开任意 `watch` 页面，使用扩展呼出侧边栏；
2. 关闭侧边栏；
3. 再次呼出侧边栏；
4. 尝试滚动目录或等待自动跟随。

### 根因（多因素叠加）
1) display 被错误改写
- 再次显示时把 `#transcript-sidebar` 设置成 `display: block`，覆盖了 CSS 定义的 `display: flex`，导致内部 `#transcript-content` 高度不再由 flex 约束，`overflow-y: auto` 失效，表现为“看起来定住了”。

2) `<video>` 节点被 YouTube 动态替换
- YouTube 在某些布局/面板切换时会替换 `<video>` 节点。之前缓存的 `videoElement` 失效后不再发出 `timeupdate` 事件，导致高亮不再更新或不触发跟随。

3) 程序化滚动被当作“用户滚动”，持续触发冷却
- 自动跟随调用 `scrollIntoView` 会触发 `scroll` 事件。若把 `scroll` 也纳入“用户滚动冷却”来源，会导致冷却时间被不断刷新，从而长时间禁止自动跟随。

### 解决方案
A) 保留 flex 布局，恢复滚动
- 改为用 `display: flex` 重新显示侧边栏。
  - 文件：`content-dom.js:1389`
  - 代码：`sidebar.style.display = 'flex';`

B) 监听并重绑 `<video>` 事件
- 新增 `observeVideoElement()` 与 `rebindVideoElement()`，在 `<video>` 被替换时自动解绑旧监听并重绑新节点。
  - 定义：`content-dom.js:108`（观察器），`content-dom.js:120`（重绑函数）
  - 初始化调用：`content-dom.js:49`、`content-dom.js:85`、`content-dom.js:1372`（再次显示时也重绑）

C) 只把“明确的用户输入”纳入冷却
- 移除对 `scroll` 的监听，仅监听 `wheel`/`touchstart`/`pointerdown`。同时为滚动容器设置 `touch-action: pan-y`，确保触摸滚动识别。
  - 第一次创建时的绑定：`content-dom.js:752` 起
  - 再次显示时的幂等绑定：`content-dom.js:1386` 起

D) 确保滚动容器可交互
- 每次显示侧边栏时，强制：
  - `#transcript-content.style.overflowY = 'auto'`
  - `#transcript-content.style.pointerEvents = 'auto'`
  - `#transcript-content.style.touchAction = 'pan-y'`
  - 定位：`content-dom.js:1386` 附近

### 验证清单
- 再次打开侧边栏，目录可正常上下滚动；
- 播放时当前行高亮且能平滑跟随到可见区域；
- 快速隐藏/显示侧边栏或切视频分辨率模式后，行为仍正常；
- Console 不再频繁出现“自动滚动被用户操作冷却阻止”。

### 相关日志/提示
- “Added non-passive event listener …” 为 YouTube 自身脚本提示；本扩展的事件监听均为 `passive: true`，可忽略。

---

## 新问题记录模板
复制粘贴本模板，在下方追加条目：

### 问题 N：<一句话描述>

- 现象：<用户可感知的表现/截图关键信息>
- 复现步骤：<条目化步骤，越短越好>
- 根因：<明确的技术原因，最好指向具体代码/样式/生命周期>
- 解决方案：
  - 变更点 1：`文件:行` 描述
  - 变更点 2：`文件:行` 描述
- 验证清单：<3-5条自测要点>
- 备注：<兼容性、回归风险、后续优化方向>

---

## 附：快速自检片段
在 Console 执行，判断是否处于健康状态：

```js
(() => {
  const s = document.getElementById('transcript-sidebar');
  const c = document.getElementById('transcript-content');
  const okLayout = s && getComputedStyle(s).display === 'flex';
  const okScroll = c && c.scrollHeight > c.clientHeight && getComputedStyle(c).overflowY !== 'hidden';
  const v = document.querySelector('video');
  const okVideo = !!v;
  return { okLayout, okScroll, okVideo };
})();
```

若 `okLayout/okScroll/okVideo` 不是 `true`，依次对照“解决方案”部分排查。
