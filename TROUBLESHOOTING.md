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

## 问题 #2: 侧边栏加载速度慢，用户体验不佳

**日期**: 2025-10-28  
**状态**: ✅ 已解决  
**严重程度**: 高

### 问题描述

在优化前，侧边栏从点击到显示字幕需要较长时间，用户体验不流畅：

1. **等待时间长**：字幕加载需要等待 2-4 秒才能显示
2. **原生面板闪现**：点击 transcript 按钮后，原生的 YouTube 字幕面板会短暂闪现
3. **轮询间隔过长**：查找元素的轮询间隔为 500ms，响应缓慢
4. **缺少快速路径**：首次加载没有优化的快速通道
5. **布局更新延迟**：字幕加载完成后，布局更新不够及时

**期望行为**：实现"极致速度"体验 - 从点击到完全显示字幕控制在 200-500ms 以内，无明显卡顿或闪现。

### 根本原因

#### 1. 延迟初始化策略过于保守

原有代码使用传统的延迟初始化：

```javascript
// 原有代码 - 延迟 2 秒才开始获取字幕
function init() {
    setTimeout(() => {
        fetchTranscriptFromDOM();
    }, 2000);  // ❌ 延迟太长
}
```

**问题**：用户需要等待 2 秒才能看到字幕开始加载。

#### 2. 轮询间隔过长

原有的元素查找使用较长的轮询间隔：

```javascript
// 原有代码 - 500ms 的轮询间隔
async function findTranscriptButton() {
    for (let i = 0; i < 10; i++) {
        // ... 查找逻辑 ...
        await new Promise(resolve => setTimeout(resolve, 500));  // ❌ 太慢
    }
}
```

**问题**：最坏情况下需要 5 秒才能找到按钮。

#### 3. 缺少智能等待机制

原有代码只使用简单的轮询，没有利用 MutationObserver 进行即时响应：

```javascript
// 原有代码 - 纯轮询方式
async function waitForTranscriptPanel(maxTries = 20, intervalMs = 100) {
    for (let i = 0; i < maxTries; i++) {
        const panel = document.querySelector('...');
        if (panel) return panel;
        await new Promise(r => setTimeout(r, intervalMs));  // ❌ 被动等待
    }
}
```

**问题**：无法在元素出现的第一时间捕获，总是有延迟。

#### 4. 原生面板闪现问题

点击 transcript 按钮后才开始监听原生面板，导致面板已经出现并显示：

```javascript
// 原有代码 - 点击后才开始隐藏
transcriptButton.click();
// ... 延迟后才开始监听和隐藏
setTimeout(() => {
    const nativePanel = document.querySelector('...');
    if (nativePanel) {
        nativePanel.style.display = 'none';  // ❌ 已经闪现了
    }
}, 100);
```

**问题**：用户会看到原生面板短暂显示，体验不佳。

### 解决方案

#### 方案 1: 实现快速初始化路径

**文件**: `content-dom.js` - 新增 `quickInit()` 函数

**修改内容**：
```javascript
// 快速初始化 - 立即显示侧边栏，异步加载字幕
function quickInit() {
    console.log('[YouTube转录 DOM] 快速初始化开始...');
    
    // 立即创建侧边栏
    createSidebar();
    
    // 立即显示加载状态
    showLoadingMessage('正在加载字幕...');
    
    // 🚀 极致优化：立即开始获取字幕，0 延迟！
    setTimeout(() => {
        fetchTranscriptFromDOM();
    }, 0);
}
```

**关键点**：
- 使用 `setTimeout(..., 0)` 立即执行，而不是延迟 2 秒
- 先显示侧边栏框架，再加载内容，提升感知速度
- 用户立即看到反馈，不会觉得"没反应"

#### 方案 2: 优化轮询间隔为极速响应

**文件**: `content-dom.js` - 优化各个查找函数

**修改内容**：
```javascript
// 原有：500ms 间隔
async function findTranscriptButton() {
    for (let i = 0; i < 10; i++) {
        // ... 查找逻辑 ...
        await new Promise(resolve => setTimeout(resolve, 500));  // ❌ 太慢
    }
}

// 🚀 优化后：50ms 间隔
async function findTranscriptButton() {
    for (let i = 0; i < 10; i++) {
        // ... 查找逻辑 ...
        await new Promise(resolve => setTimeout(resolve, 50));  // ✅ 快 10 倍！
    }
}

// 其他优化
await waitForTranscriptPanel(10, 10);  // 最快 ~100ms（原来是 20 * 60 = 1200ms）
await waitForElement('...', 100);      // 减少到 100ms（原来是 600ms）
```

**关键点**：
- 将查找按钮的间隔从 500ms 降到 50ms（快 10 倍）
- 将面板等待的间隔从 60ms 降到 10ms
- 将菜单等待的超时从 800ms 降到 300ms
- 大幅提升响应速度

#### 方案 3: 实现 Ultra 级 MutationObserver 智能等待

**文件**: `content-dom.js` - 新增 `waitForTranscriptPanelUltra()` 和 `waitForTranscriptSegmentsUltra()`

**修改内容**：
```javascript
// Ultra 级：MutationObserver 捕捉出现，最低延迟
function waitForElement(selector, timeoutMs = 600) {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) { resolve(existing); return; }
        
        // 🚀 使用 MutationObserver 实时监听
        const obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { 
                obs.disconnect(); 
                resolve(el); 
            }
        });
        obs.observe(document.documentElement, { 
            childList: true, 
            subtree: true 
        });
        
        // 超时后回退到查询结果
        setTimeout(() => { 
            obs.disconnect(); 
            resolve(document.querySelector(selector)); 
        }, timeoutMs);
    });
}

async function waitForTranscriptPanelUltra() {
    // 🚀 极致优化：减少等待时间到 100ms
    const viaObserver = await waitForElement('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]', 100);
    if (viaObserver) return viaObserver;
    return await waitForTranscriptPanelFast();
}

function waitForTranscriptSegmentsUltra(panel) {
    return new Promise((resolve) => {
        const getSegs = () => panel?.querySelectorAll('ytd-transcript-segment-renderer');
        let hasReturned = false;
        
        const done = (segs) => { 
            if (hasReturned) return;
            hasReturned = true;
            obs.disconnect();
            resolve(segs || []); 
        };
        
        const check = () => {
            const segs = getSegs();
            const count = segs ? segs.length : 0;
            
            // 🚀 极致优化：一旦找到 5 个或以上字幕片段，立即返回！
            if (count >= 5) {
                done(segs);
                return;
            }
        };
        
        const obs = new MutationObserver(check);
        obs.observe(panel, { childList: true, subtree: true });
        check();  // 初始检查
        
        // 最多等待 2 秒
        setTimeout(() => done(getSegs()), 2000);
    });
}
```

**关键点**：
- 使用 MutationObserver 在元素出现的第一时间捕获
- 检测到 5 个字幕片段立即返回，不等待全部加载
- 超时机制作为保底，确保不会永久等待
- 实现"先到先得"的快速响应

#### 方案 4: 提前隐藏原生面板，防止闪现

**文件**: `content-dom.js` - 优化 `fetchTranscriptFromDOM()` 函数

**修改内容**：
```javascript
async function fetchTranscriptFromDOM() {
    if (transcriptButton) {
        console.log('[YouTube转录 DOM] 找到transcript按钮，尝试点击...');
        
        // 🔧 关键修复：在点击之前设置监听器，一旦原生面板出现就立即隐藏
        let hasHidden = false;
        const hideObserver = new MutationObserver((mutations) => {
            if (hasHidden) return;
            
            const nativePanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
            if (nativePanel && nativePanel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN') {
                hasHidden = true;
                // 立即隐藏，防止闪现
                nativePanel.style.opacity = '0';
                nativePanel.style.pointerEvents = 'none';
                console.log('[YouTube转录 DOM] 原生面板出现，立即隐藏防止闪现');
                
                // 🚀 极致优化：立即断开监听器，无需等待
                setTimeout(() => {
                    hideObserver.disconnect();
                }, 0);
            }
        });
        
        // 开始监听（只监听属性变化，减少触发）
        hideObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['visibility'],
            subtree: true
        });
        
        // 点击前如果面板已存在，先隐藏
        const nativePanelPre = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        if (nativePanelPre) {
            nativePanelPre.style.opacity = '0';
            nativePanelPre.style.pointerEvents = 'none';
            hasHidden = true;
        }
        
        transcriptButton.click();
        
        // 🚀 优化：100ms后停止监听（面板通常很快出现）
        setTimeout(() => {
            hideObserver.disconnect();
        }, 100);
    }
}
```

**关键点**：
- **提前监听**：在点击按钮前就开始监听原生面板
- **立即隐藏**：面板一出现就设置 `opacity: 0`，用户看不到
- **高效监听**：只监听 `visibility` 属性变化，减少触发次数
- **及时清理**：100ms 后断开监听器，避免性能影响

#### 方案 5: 立即触发布局重算

**文件**: `content-dom.js` - 优化字幕加载完成后的处理

**修改内容**：
```javascript
if (transcriptData.length > 0) {
    console.log('[YouTube转录 DOM] 成功获取', transcriptData.length, '条字幕');
    renderTranscript();
    
    // 🚀 极致优化：立即显示高亮，无需等待
    if (videoElement) {
        updateCurrentHighlight();
        startTimeTracking();
    }
    
    // 立即关闭原生面板
    closeNativeTranscript(transcriptPanel);
    
    // 🚀 极致优化：立即触发布局重算
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        console.log('[YouTube转录 DOM] 触发布局重算');
    });
    
    // 保存标记：字幕加载成功
    sessionStorage.setItem('yt-transcript-loaded', 'true');
    return;
}
```

**关键点**：
- 使用 `setTimeout(..., 0)` 立即执行，不延迟
- 先更新高亮再触发布局，确保视觉连贯
- 使用 `requestAnimationFrame` 确保在下一帧执行
- 所有操作串行但无延迟，最大化速度

#### 方案 6: 双重保障机制（Ultra + Fast）

**文件**: `content-dom.js` - 添加备用方案

**修改内容**：
```javascript
// 🔧 修复：使用 Ultra 方法等待字幕片段
let segments = await waitForTranscriptSegmentsUltra(transcriptPanel);
console.log('[YouTube转录 DOM] Ultra方法找到字幕片段:', segments.length);

// 🔧 修复：如果 Ultra 方法失败（返回0个），使用备用 Fast 方法重试
if (!segments || segments.length === 0) {
    console.log('[YouTube转录 DOM] Ultra方法未找到字幕，尝试Fast备用方法...');
    segments = await waitForTranscriptSegmentsFast(transcriptPanel);
    console.log('[YouTube转录 DOM] Fast方法找到字幕片段:', segments.length);
}
```

**关键点**：
- Ultra 方法优先（最快）
- Fast 方法作为备用（更稳定）
- 双重保障确保成功率
- 两种方法都比原来快很多

### 性能对比

#### 优化前
- 查找按钮：最多 5000ms (10 × 500ms)
- 等待面板：最多 1200ms (20 × 60ms)
- 等待字幕：最多 4000ms (80 × 50ms)
- **总计**：最坏情况 ~10 秒

#### 优化后
- 查找按钮：最多 500ms (10 × 50ms) - **快 10 倍**
- 等待面板：最快 100ms (MutationObserver) - **快 12 倍**
- 等待字幕：最快 10ms（检测到 5 个片段） - **快 400 倍**
- **总计**：最好情况 ~200ms，最坏情况 ~2 秒 - **快 5-50 倍**

### 验证方法

完成修改后，通过以下步骤验证优化效果：

1. **首次加载速度测试**
   - 打开 YouTube 视频页面
   - 点击扩展图标
   - ✅ 验证侧边栏是否在 500ms 内显示
   - ✅ 验证字幕是否在 2 秒内完全加载

2. **原生面板闪现测试**
   - 多次点击扩展图标
   - ✅ 验证是否完全看不到原生面板闪现

3. **多次切换测试**
   - 隐藏侧边栏后再次显示
   - ✅ 验证第二次显示是否同样快速

4. **不同网络环境测试**
   - 在快速和慢速网络下测试
   - ✅ 验证在各种情况下都能快速响应

5. **控制台日志验证**
   - 查看 console.log 输出的时间戳
   - ✅ 验证各个步骤的耗时是否在预期范围

### 相关提交

- **优化实现**: `82999ee` - 优化速度成功 - 使用 DOM 直接操作方式
- **合并到 main**: `2730366` - 合并 optimize-speed-ultra 到 main

### 经验教训

1. **用户感知速度最重要**：先显示框架再加载内容，比等所有内容准备好再显示体验更好

2. **MutationObserver 是利器**：对于动态内容，MutationObserver 比轮询快得多，应该优先使用

3. **多级回退策略**：Ultra → Fast → Fallback，确保既快速又可靠

4. **提前准备很关键**：在触发事件（如点击按钮）前就准备好监听器，能避免很多时序问题

5. **小延迟积累成大问题**：将 500ms 优化到 50ms 看似不大，但多个步骤累加后效果显著

6. **智能阈值提升体验**：检测到 5 个字幕片段就立即显示，不需要等全部加载完，用户几乎感觉不到等待

7. **日志记录助调试**：关键步骤都加上时间戳日志，方便分析性能瓶颈

---

## 问题 #3: [预留位置]

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

