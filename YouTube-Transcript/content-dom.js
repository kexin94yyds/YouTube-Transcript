// YouTube转录侧边栏 - 使用DOM版本（无需网络请求）
console.log('[YouTube转录 DOM] 插件加载开始...');

// 提前隐藏原生转录面板（不使用 display:none，避免阻断加载）
(function ensureNativeTranscriptHiddenEarly() {
    try {
        if (document.getElementById('ext-hide-native-transcript-style')) return;
        const style = document.createElement('style');
        style.id = 'ext-hide-native-transcript-style';
        style.textContent = `
          ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"],
          ytd-transcript-search-panel-renderer,
          ytd-transcript-renderer {
            opacity: 0 !important;
            pointer-events: none !important;
            transition: none !important;
          }
          /* 一旦我们加上 transcript-hidden 类，彻底不占位 */
          ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"].transcript-hidden {
            display: none !important;
            width: 0 !important;
            max-width: 0 !important;
          }
        `;
        (document.documentElement || document.head || document.body)?.appendChild(style);
    } catch (e) {}
})();

let transcriptData = [];
let chapters = [];
let currentActiveIndex = -1;
let timeTrackingInterval = null;
let videoElement = null;
let searchQuery = '';
// 用户手动滚动后的自动跟随冷却时间（毫秒）
const AUTOSCROLL_COOLDOWN_MS = 2000;
let blockAutoScrollUntil = 0; // 时间戳：在此时间前不自动滚动

// 初始化
function init() {
    try {
        console.log('[YouTube转录 DOM] 初始化开始...');
        
        if (!location.href.includes('/watch')) {
            return;
        }
        
        videoElement = document.querySelector('video');
        
        if (!videoElement) {
            setTimeout(init, 1000);
            return;
        }
        
        console.log('[YouTube转录 DOM] 创建侧边栏...');
        createSidebar();
        
        // 等待一下再获取字幕
        setTimeout(() => {
            fetchTranscriptFromDOM();
        }, 2000);
        
        videoElement.addEventListener('play', startTimeTracking);
        videoElement.addEventListener('pause', updateCurrentHighlight);
        videoElement.addEventListener('seeked', updateCurrentHighlight);
        videoElement.addEventListener('timeupdate', onTimeUpdate);
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 初始化错误:', error);
    }
}

// 从YouTube DOM获取字幕
async function fetchTranscriptFromDOM() {
    try {
        console.log('[YouTube转录 DOM] 开始从DOM获取字幕...');
        // 🔧 关键修复：设置标记，告诉监控器不要干扰
        isLoadingTranscript = true;
        showLoadingMessage('正在获取字幕...');

        // 优先：从 ytInitialPlayerResponse 提取章节信息
        try {
            const playerResponse = await getYtInitialPlayerResponse();
            if (playerResponse) {
                extractChaptersFromPlayerResponse(playerResponse);
            }
        } catch (e) {
            console.warn('[YouTube转录 DOM] 获取playerResponse失败，稍后重试章节提取');
        }
        
        // 方法1: 尝试直接找到 transcript 按钮
        let transcriptButton = await findTranscriptButton();
        
        // 若未找到，则尝试自动打开“更多操作 ...”菜单并在弹窗中寻找
        if (!transcriptButton) {
            transcriptButton = await openMenuAndFindTranscript();
        }

        if (transcriptButton) {
            console.log('[YouTube转录 DOM] 找到transcript按钮，尝试点击...');
            
            // 🔧 强制重置面板：无论什么状态，都先关闭再打开
            // 这样可以确保100%加载当前视频的字幕，避免旧视频字幕残留
            try {
                const nativePanelPre = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
                if (nativePanelPre) {
                    const visibility = nativePanelPre.getAttribute('visibility');
                    
                    // 🚀 关键优化：如果面板存在（无论打开还是关闭），都先强制关闭
                    // 这样YouTube会清理旧的transcript数据
                    if (visibility === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED' || visibility === 'ENGAGEMENT_PANEL_VISIBILITY_COLLAPSED') {
                        console.log('[YouTube转录 DOM] 检测到面板存在（visibility=' + visibility + '），强制关闭以清理旧数据...');
                        transcriptButton.click(); // 第一次点击：关闭
                        await new Promise(r => setTimeout(r, 400)); // 等待YouTube完全关闭和清理
                        console.log('[YouTube转录 DOM] 面板已关闭，现在重新打开加载新字幕...');
                    }
                    
                    // 点击前确保面板不可见，减少闪现时间
                    nativePanelPre.style.opacity = '0';
                    nativePanelPre.style.pointerEvents = 'none';
                    nativePanelPre.style.transform = '';
                    nativePanelPre.style.position = '';
                    nativePanelPre.style.right = '';
                    nativePanelPre.style.top = '';
                    nativePanelPre.style.overflow = '';
                }
            } catch (_) {}
            
            transcriptButton.click(); // 最终点击：打开并加载当前视频字幕
            
            // 尽快等待面板出现：优先用DOM变化捕捉，其次走快速轮询
            const transcriptPanel = await waitForTranscriptPanelUltra();
            
            if (transcriptPanel) {
                console.log('[YouTube转录 DOM] 找到transcript面板');
                
                // 提取章节信息
                await extractChapters(transcriptPanel);
                
                // 🚀 优化：检查是否是第一次加载还是刷新后加载
                const hasRefreshed = sessionStorage.getItem('yt-transcript-refreshed');
                
                // 🔧 修复：使用 Ultra 方法等待字幕片段
                let segments = await waitForTranscriptSegmentsUltra(transcriptPanel, hasRefreshed);
                console.log('[YouTube转录 DOM] Ultra方法找到字幕片段:', segments.length);
                
                // 🔧 修复：如果 Ultra 方法失败（返回0个），使用备用 Fast 方法重试
                if (!segments || segments.length === 0) {
                    console.log('[YouTube转录 DOM] Ultra方法未找到字幕，尝试Fast备用方法...');
                    segments = await waitForTranscriptSegmentsFast(transcriptPanel, hasRefreshed);
                    console.log('[YouTube转录 DOM] Fast方法找到字幕片段:', segments.length);
                }
                
                transcriptData = [];
                
                segments.forEach(segment => {
                    const timestamp = segment.querySelector('.segment-timestamp');
                    const text = segment.querySelector('.segment-text');
                    
                    if (timestamp && text) {
                        const timeText = timestamp.textContent.trim();
                        const seconds = parseTimestamp(timeText);
                        
                        transcriptData.push({
                            start: seconds,
                            end: seconds + 3,
                            text: text.textContent.trim()
                        });
                    }
                });
                
                if (transcriptData.length > 0) {
                    console.log('[YouTube转录 DOM] 成功获取', transcriptData.length, '条字幕');
                    console.log('[YouTube转录 DOM] 章节数量:', chapters.length);
                    renderTranscript();
                    
                    // 立即显示当前位置的高亮
                    setTimeout(() => {
                        if (videoElement) {
                            updateCurrentHighlight();
                            startTimeTracking();
                        }
                    }, 100);
                    
                    // 立即关闭原生面板，避免占位
                    closeNativeTranscript(transcriptPanel);
                    
                    // 🔧 关键修复：字幕加载完成后，强制触发布局更新，让视频立即填充满屏
                    setTimeout(() => {
                        console.log('[YouTube转录 DOM] 字幕加载完成，重新确保固定状态');
                        applyPinnedState();
                        updatePinnedSpace();
                        
                        // 🚀 多次触发 resize 事件，确保 YouTube 完全响应
                        requestAnimationFrame(() => {
                            window.dispatchEvent(new Event('resize'));
                            console.log('[YouTube转录 DOM] 触发第1次 resize');
                        });
                        
                        setTimeout(() => {
                            window.dispatchEvent(new Event('resize'));
                            console.log('[YouTube转录 DOM] 触发第2次 resize');
                        }, 100);
                        
                        setTimeout(() => {
                            window.dispatchEvent(new Event('resize'));
                            console.log('[YouTube转录 DOM] 触发第3次 resize');
                        }, 300);
                    }, 100);
                    
                    // 保存标记：字幕加载成功
                    sessionStorage.setItem('yt-transcript-loaded', 'true');
                    
                    // 🔧 关键修复：字幕加载完成，恢复监控
                    isLoadingTranscript = false;
                    return;
                } else {
                    // 🚀 优化加载策略：第一次给合理时间（~3.5s），失败则刷新
                    // 刷新后给更充分时间（~8s），确保能加载完整字幕
                    const hasRefreshed = sessionStorage.getItem('yt-transcript-refreshed');
                    if (!hasRefreshed) {
                        console.log('[YouTube转录 DOM] ⚡ 第一次未找到字幕（~3.5s），刷新页面重试...');
                        sessionStorage.setItem('yt-transcript-refreshed', 'true');
                        sessionStorage.setItem('yt-transcript-auto-open', 'true'); // 标记刷新后自动打开
                        location.reload();
                        return;
                    } else {
                        console.log('[YouTube转录 DOM] ❌ 刷新后仍未找到字幕，尝试备用方法...');
                    }
                }
            }
        }
        
        // 方法2: 使用ytInitialPlayerResponse（备用）
        console.log('[YouTube转录 DOM] 尝试备用方法...');
        await fetchFromPlayerResponse();
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 获取失败:', error);
        showErrorMessage('无法获取字幕');
    } finally {
        // 🔧 确保无论成功失败都恢复监控
        isLoadingTranscript = false;
    }
}

// 提取章节信息
async function extractChapters(transcriptPanel) {
    const found = [];
    
    try {
        // 方法1: 从 transcript 面板中提取章节标题
        const sectionHeaders = transcriptPanel.querySelectorAll('ytd-transcript-section-header-renderer');
        sectionHeaders.forEach(header => {
            const titleElement = header.querySelector('#header-title');
            const timestampElement = header.querySelector('.segment-timestamp');
            
            if (titleElement && timestampElement) {
                const title = titleElement.textContent.trim();
                const timeText = timestampElement.textContent.trim();
                const seconds = parseTimestamp(timeText);
                
                found.push({
                    title: title,
                    start: seconds
                });
            }
        });
        
        // 方法2: 从视频描述区的章节信息提取
        if (chapters.length === 0) {
            const chaptersFromDescription = document.querySelectorAll('ytd-macro-markers-list-item-renderer');
            chaptersFromDescription.forEach(item => {
                const titleElement = item.querySelector('#details h4');
                const timeButton = item.querySelector('#endpoint');
                
                if (titleElement && timeButton) {
                    const title = titleElement.textContent.trim();
                    const timeAttr = timeButton.getAttribute('aria-label') || timeButton.textContent;
                    const match = timeAttr.match(/(\d+):(\d+)/);
                    
                    if (match) {
                        const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
                        found.push({
                            title: title,
                            start: seconds
                        });
                    }
                }
            });
        }
        
        // 按时间排序并去重
        if (found.length > 0) {
            chapters = found
                .filter(c => Number.isFinite(c.start))
                .sort((a, b) => a.start - b.start)
                .filter((c, i, arr) => i === 0 || c.start !== arr[i - 1].start);
        }
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 提取章节失败:', error);
    }
}

// 关闭YouTube原生转录面板
function closeNativeTranscript(panel) {
    try {
        console.log('[YouTube转录 DOM] 开始关闭原生面板...');
        
        // 直接隐藏面板（不点击关闭按钮，避免触发YouTube的布局重置）
        if (panel) {
            // 彻底隐藏，不再占位
            panel.classList.add('transcript-hidden');
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            panel.style.display = 'none';
            panel.style.width = '0';
            panel.style.maxWidth = '0';
            try { panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN'); } catch (_) {}
            console.log('[YouTube转录 DOM] 原生面板已隐藏（不触发布局重置）');
        }
        
        // 持续监控，防止被重新打开
        keepNativeTranscriptHidden();
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 关闭原生面板失败:', error);
    }
}

// 持续隐藏原生transcript面板
let nativeTranscriptObserver = null;
let isLoadingTranscript = false; // 🔧 新增：标记是否正在加载字幕

function keepNativeTranscriptHidden() {
    // 避免重复创建 observer
    if (nativeTranscriptObserver) return;
    
    nativeTranscriptObserver = new MutationObserver(() => {
        // 🔧 关键修复：如果正在加载字幕，不要干扰原生面板
        if (isLoadingTranscript) {
            return;
        }
        
        const nativePanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        if (nativePanel) {
            const isVisible = nativePanel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
            if (isVisible && !nativePanel.classList.contains('transcript-hidden')) {
                console.log('[YouTube转录 DOM] 检测到原生面板打开，强制隐藏（不触发布局重置）');
                // 不点击关闭按钮，直接隐藏，避免触发YouTube布局重置
                nativePanel.classList.add('transcript-hidden');
                nativePanel.style.opacity = '0';
                nativePanel.style.pointerEvents = 'none';
                nativePanel.style.display = 'none';
                nativePanel.style.width = '0';
                nativePanel.style.maxWidth = '0';
                try { nativePanel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN'); } catch (_) {}
            }
        }
    });
    
    nativeTranscriptObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['visibility'],
        subtree: true,
        childList: true
    });
}

// 查找transcript按钮
async function findTranscriptButton() {
    // 等待按钮加载
    for (let i = 0; i < 10; i++) {
        const buttons = document.querySelectorAll('button[aria-label*="transcript" i], button[aria-label*="字幕" i]');
        
        for (let button of buttons) {
            if (button.textContent.toLowerCase().includes('transcript') || 
                button.textContent.includes('文字版') ||
                button.textContent.includes('字幕')) {
                return button;
            }
        }
        
        // 也尝试查找菜单中的按钮
        const menuButtons = document.querySelectorAll('ytd-menu-service-item-renderer');
        for (let button of menuButtons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('transcript') || text.includes('字幕') || text.includes('文字')) {
                return button;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return null;
}

// 打开“更多操作 …”菜单并查找“显示文字记录/Transcript”菜单项
async function openMenuAndFindTranscript() {
    // 1) 尝试定位 watch 页主操作区的“更多操作”按钮
    const selectors = [
        'ytd-watch-metadata #actions button[aria-label*="more" i]',
        'ytd-watch-metadata #actions tp-yt-paper-icon-button[aria-label*="more" i]',
        'ytd-watch-metadata #actions button[aria-label*="更多" i]',
        '#actions button[aria-label*="more" i]',
        '#actions tp-yt-paper-icon-button[aria-label*="more" i]',
        'button[aria-label*="more actions" i]',
        'button[aria-label*="更多操作" i]',
    ];
    let moreBtn = null;
    for (const sel of selectors) {
        moreBtn = document.querySelector(sel);
        if (moreBtn) break;
    }
    // 找不到就不再尝试
    if (!moreBtn) return null;

    // 2) 打开菜单
    moreBtn.click();
    // 等待弹窗出现
    const menu = await waitForElement('ytd-menu-popup-renderer:not([hidden]) tp-yt-paper-listbox, ytd-menu-popup-renderer tp-yt-paper-listbox', 800);
    if (!menu) return null;
    // 3) 在弹窗中查找包含 transcript/字幕/文字 的菜单项
    const items = menu.querySelectorAll('ytd-menu-service-item-renderer');
    for (const it of items) {
        const t = (it.textContent || '').toLowerCase();
        if (t.includes('transcript') || t.includes('文字') || t.includes('字幕')) {
            return it;
        }
    }
    return null;
}

// 解析时间戳 (00:05)
function parseTimestamp(timestamp) {
    const parts = timestamp.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
}

// 备用方法：从playerResponse获取
async function fetchFromPlayerResponse() {
    const playerResponse = window.ytInitialPlayerResponse;
    
    if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        console.log('[YouTube转录 DOM] 找到字幕轨道');
        
        // 显示提示：需要手动点击
        showManualInstructions();
    } else {
        showNoTranscriptMessage();
    }
}

// 快速等待原生Transcript面板出现
async function waitForTranscriptPanel(maxTries = 20, intervalMs = 60) {
    for (let i = 0; i < maxTries; i++) {
        const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        if (panel) return panel;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
}

// 等待字幕片段渲染出来（避免太早关闭）
async function waitForTranscriptSegments(panel, maxTries = 80, intervalMs = 50) {
    for (let i = 0; i < maxTries; i++) {
        const segs = panel?.querySelectorAll('ytd-transcript-segment-renderer');
        if (segs && segs.length > 0) return segs;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return panel?.querySelectorAll('ytd-transcript-segment-renderer') || [];
}

// 快速优先：更短间隔先试几次，失败再走稳妥方案
async function waitForTranscriptPanelFast() {
    const fast = await waitForTranscriptPanel(15, 20); // 最快 ~300ms
    if (fast) return fast;
    return await waitForTranscriptPanel(60, 35);        // 备份 ~2.1s 上限
}

async function waitForTranscriptSegmentsFast(panel, hasRefreshed) {
    let segs = panel?.querySelectorAll('ytd-transcript-segment-renderer');
    if (segs && segs.length) return segs;
    
    if (hasRefreshed) {
        // 🔧 刷新后：给足够时间加载（总共最多5s+）
        console.log('[YouTube转录 DOM] 刷新后加载，给足够时间...');
        segs = await waitForTranscriptSegments(panel, 15, 30); // ~450ms
        if (segs && segs.length) return segs;
        segs = await waitForTranscriptSegments(panel, 50, 40); // 再等 ~2s
        if (segs && segs.length) return segs;
        return await waitForTranscriptSegments(panel, 60, 40); // 再等 ~2.4s（总共5s+）
    } else {
        // 🚀 第一次：给合理时间（总共最多2s），大部分情况能成功
        console.log('[YouTube转录 DOM] 第一次加载，等待字幕渲染...');
        segs = await waitForTranscriptSegments(panel, 15, 30); // ~450ms
        if (segs && segs.length) return segs;
        return await waitForTranscriptSegments(panel, 50, 30); // 再等 ~1.5s（总共2s）
    }
}

// Ultra 级：MutationObserver 捕捉出现，最低延迟；超时则回退
function waitForElement(selector, timeoutMs = 600) {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) { resolve(existing); return; }
        const obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { obs.disconnect(); resolve(el); }
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(document.querySelector(selector)); }, timeoutMs);
    });
}

async function waitForTranscriptPanelUltra() {
    const viaObserver = await waitForElement('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]', 600);
    if (viaObserver) return viaObserver;
    return await waitForTranscriptPanelFast();
}

function waitForTranscriptSegmentsUltra(panel, hasRefreshed) {
    return new Promise((resolve) => {
        const getSegs = () => panel?.querySelectorAll('ytd-transcript-segment-renderer');
        let lastCount = -1;
        let stableTimer = null;
        const done = (segs) => { try { obs.disconnect(); } catch(_){}; if (stableTimer) clearTimeout(stableTimer); resolve(segs || []); };
        const check = () => {
            const segs = getSegs();
            const count = segs ? segs.length : 0;
            if (count > 0) {
                if (count === lastCount) {
                    if (!stableTimer) stableTimer = setTimeout(() => done(segs), 120);
                } else {
                    lastCount = count;
                    if (stableTimer) { clearTimeout(stableTimer); stableTimer = null; }
                }
            }
        };
        const obs = new MutationObserver(check);
        try { obs.observe(panel, { childList: true, subtree: true }); } catch(_) { /* ignore */ }
        // 初始检查
        check();
        // 🚀 优化：第一次给合理时间（1500ms），刷新后给更充分时间（3000ms）
        const timeout = hasRefreshed ? 3000 : 1500;
        setTimeout(() => done(getSegs()), timeout);
    });
}

// 从 ytInitialPlayerResponse 提取章节（优先方式）
function extractChaptersFromPlayerResponse(playerResponse) {
    try {
        const markersMap = playerResponse?.playerOverlays?.playerOverlayRenderer
            ?.decoratedPlayerBarRenderer?.decoratedPlayerBarRenderer?.playerBar
            ?.multiMarkersPlayerBarRenderer?.markersMap;

        const result = [];

        if (Array.isArray(markersMap)) {
            for (const marker of markersMap) {
                if (marker?.key === 'DESCRIPTION_CHAPTERS') {
                    const chapterMarkers = marker.value?.chapters || [];
                    chapterMarkers.forEach(ch => {
                        const r = ch.chapterRenderer;
                        if (r) {
                            result.push({
                                title: (r.title?.simpleText || '').trim(),
                                start: (r.timeRangeStartMillis || 0) / 1000
                            });
                        }
                    });
                    break;
                }
            }
        }

        if (result.length > 0) {
            // 合并到全局 chapters（覆盖旧的）
            chapters = result
                .filter(c => Number.isFinite(c.start))
                .sort((a, b) => a.start - b.start)
                .filter((c, i, arr) => i === 0 || c.start !== arr[i - 1].start);
            console.log('[YouTube转录 DOM] 从playerResponse提取章节:', chapters.length);
        }
    } catch (err) {
        console.error('[YouTube转录 DOM] 提取章节失败:', err);
    }
}

// 获取 ytInitialPlayerResponse（容错实现）
function getYtInitialPlayerResponse() {
    return new Promise((resolve) => {
        // 方式1：window
        if (window.ytInitialPlayerResponse) {
            resolve(window.ytInitialPlayerResponse);
            return;
        }
        // 方式2：遍历 script 标签提取
        const scripts = document.getElementsByTagName('script');
        for (const script of scripts) {
            const content = script.textContent;
            if (!content || !content.includes('ytInitialPlayerResponse')) continue;
            try {
                const patterns = [
                    /var ytInitialPlayerResponse\s*=\s*({.+?});/,
                    /ytInitialPlayerResponse\s*=\s*({.+?});/
                ];
                for (const p of patterns) {
                    const m = content.match(p);
                    if (m && m[1]) {
                        const obj = JSON.parse(m[1]);
                        resolve(obj);
                        return;
                    }
                }
            } catch (_) { /* ignore */ }
        }
        // 方式3：延时回查
        setTimeout(() => resolve(window.ytInitialPlayerResponse || null), 1200);
    });
}

// 显示手动指引
function showManualInstructions() {
    const container = document.getElementById('transcript-content');
    if (container) {
        container.innerHTML = `
            <div style="padding: 20px; color: #f1f1f1;">
                <h4 style="margin-bottom: 15px;">📝 手动获取字幕</h4>
                <p style="line-height: 1.6; margin-bottom: 10px;">请按以下步骤操作：</p>
                <ol style="line-height: 1.8; padding-left: 20px;">
                    <li>在视频下方点击 <strong>"更多"</strong> 按钮 (...)</li>
                    <li>选择 <strong>"显示文字记录"</strong></li>
                    <li>字幕将自动显示在这里</li>
                </ol>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #065fd4; color: #fff; border: none; border-radius: 4px; cursor: pointer;">刷新重试</button>
            </div>
        `;
    }
}

// 创建侧边栏
function createSidebar() {
    // 清除所有之前的清理定时器，防止与新侧边栏冲突
    clearAllCleanupTimers();
    
    const existingSidebar = document.getElementById('transcript-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }
    
    const sidebar = document.createElement('div');
    sidebar.id = 'transcript-sidebar';
    sidebar.className = 'transcript-sidebar';
    
    const header = document.createElement('div');
    header.className = 'transcript-header';
    
    header.innerHTML = `
        <div class="header-top">
            <h3>Transcript</h3>
            <div class="header-controls">
                <button id="pin-sidebar" class="control-btn" title="固定侧边栏">📌</button>
                <button id="copy-transcript" class="control-btn" title="Copy transcript">📋</button>
                <button id="copy-url" class="control-btn" title="Copy URL">🔗</button>
                <button id="download-epub" class="control-btn" title="下载 EPUB 电子书">📚</button>
                <button id="toggle-sidebar" class="toggle-btn" title="Close">×</button>
            </div>
        </div>
        <input type="text" id="search-box" class="search-box" placeholder="Search in video">
    `;
    
    const content = document.createElement('div');
    content.id = 'transcript-content';
    content.className = 'transcript-content';
    
    sidebar.appendChild(header);
    sidebar.appendChild(content);

    // 创建尺寸手柄（左侧和右下角）
    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle-left';
    sidebar.appendChild(leftHandle);
    const brHandle = document.createElement('div');
    brHandle.className = 'resize-handle-br';
    sidebar.appendChild(brHandle);
    
    // 添加侧边栏到页面，初始状态为隐藏（准备动画）
    sidebar.style.transform = 'translateX(100%)';
    sidebar.style.opacity = '0';
    document.body.appendChild(sidebar);
    
    // 绑定事件
    const toggleBtn = document.getElementById('toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }
    const pinBtn = document.getElementById('pin-sidebar');
    if (pinBtn) {
        pinBtn.addEventListener('click', () => setPinned(!isPinned()));
        // 🔧 设置 pin 按钮的初始状态为激活（因为默认是固定的）
        pinBtn.classList.add('active');
        pinBtn.title = '取消固定';
    }
    const copyBtn = document.getElementById('copy-transcript');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => copyTranscript());
    }
    const copyUrlBtn = document.getElementById('copy-url');
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => copyPageUrl());
    }
    
    const epubBtn = document.getElementById('download-epub');
    if (epubBtn) {
        epubBtn.addEventListener('click', () => downloadTranscriptAsEpub());
    }
    
    const searchBox = document.getElementById('search-box');
    if (searchBox) {
        searchBox.addEventListener('input', handleSearch);
    }
    
    // 启用拖拽和缩放
    enableSidebarDrag(sidebar, header);
    enableSidebarResize(sidebar, leftHandle, brHandle);
    
    // 恢复之前的尺寸设置
    const savedState = getSavedSidebarState();
    const targetWidth = (savedState && savedState.width) ? savedState.width : 300;
    
    // 设置侧边栏尺寸但暂不触发布局变化
    sidebar.style.width = targetWidth + 'px';
    sidebar.style.right = '0px';
    // 🔧 确保侧边栏填满整个高度（自适应窗口大小）
    sidebar.style.top = '0';
    sidebar.style.bottom = '0';
    sidebar.style.height = '100vh';
    
    // 🔧 优化：先设置固定状态（保存到 localStorage），但暂不应用到页面
    // 等字幕加载完成后再应用，避免加载期间出现空隙
    try { localStorage.setItem('transcriptPinned', '1'); } catch (_) {}
    
    // 使用 requestAnimationFrame 实现丝滑的入场动画
    // 先让浏览器完成布局计算
    requestAnimationFrame(() => {
        // 再下一帧开始动画
        requestAnimationFrame(() => {
            // 1. 暂不应用固定状态，避免"正在加载字幕"时出现空隙
            // applyPinnedState();  // ❌ 注释掉，改为在字幕加载完成后应用
            
            // 2. 让侧边栏滑入（但不挤压视频）
            sidebar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.opacity = '1';
            
            console.log('[YouTube转录 DOM] 侧边栏丝滑入场动画已触发（延迟应用固定状态）');
            
            // 3. 动画完成后清理transition，避免影响后续操作
            setTimeout(() => {
                sidebar.style.transition = '';
            }, 450);
        });
    });

    // 在用户与滚动区域交互时，短暂禁用自动跟随
    const markUserScroll = () => { blockAutoScrollUntil = Date.now() + AUTOSCROLL_COOLDOWN_MS; };
    content.addEventListener('wheel', markUserScroll, { passive: true });
    content.addEventListener('touchstart', markUserScroll, { passive: true });
    content.addEventListener('pointerdown', markUserScroll, { passive: true });
    content.addEventListener('scroll', markUserScroll, { passive: true });
    content.dataset.scrollHandlers = '1';

    // 双击标题，停靠到右侧并恢复默认尺寸
    header.addEventListener('dblclick', () => {
        dockSidebarRight(sidebar);
    });
}

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

function saveSidebarState(state) {
    try {
        localStorage.setItem('transcriptSidebarState', JSON.stringify(state));
    } catch (_) {}
}

function getSavedSidebarState() {
    try {
        const s = localStorage.getItem('transcriptSidebarState');
        return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
}

function applySavedSidebarState(sidebar) {
    const s = getSavedSidebarState();
    if (!s) return;
    if (s.mode === 'free') {
        sidebar.style.right = 'auto';
        sidebar.style.left = (s.left || 0) + 'px';
        sidebar.style.top = (s.top || 0) + 'px';
        const maxW = Math.min(900, window.innerWidth - 20);
        const maxH = window.innerHeight - 20;
        if (s.width) sidebar.style.width = Math.min(s.width, maxW) + 'px';
        if (s.height) sidebar.style.height = Math.min(s.height, maxH) + 'px';
    } else if (s.mode === 'dock-right') {
        dockSidebarRight(sidebar, s.width);
    }
}

function dockSidebarRight(sidebar, width = 300) {
    sidebar.style.left = '';
    sidebar.style.top = '0';  // 🔧 明确设置 top 为 0，确保从顶部开始
    sidebar.style.right = '0px';
    sidebar.style.bottom = '0';  // 🔧 设置 bottom 为 0，确保延伸到底部
    const w = Math.min(width, Math.min(600, window.innerWidth - 20));
    sidebar.style.width = w + 'px';
    sidebar.style.height = '100vh';  // 填满整个视口高度
    saveSidebarState({ mode: 'dock-right', width: w });
    // 若处于固定模式，更新右侧保留空间
    updatePinnedSpace();
}

// --- 固定模式（Pin）支持 ---
const PIN_STYLE_ID = 'yt-transcript-pin-style';

function ensurePinStyleElement() {
    if (document.getElementById(PIN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PIN_STYLE_ID;
    style.textContent = `
      /* 固定模式：为页面右侧预留侧边栏空间，视频自动填充剩余空间 */
      html.yt-transcript-pinned {
        --sidebar-width: var(--yt-transcript-sidebar-width, 300px);
      }
      
      /* 页面右侧预留空间（直接作用于 body，最稳妥） */
      html.yt-transcript-pinned body {
        margin-right: var(--sidebar-width) !important;
        transition: margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* 让播放器贴左，不留中间黑边（仅在固定模式下生效） */
      html.yt-transcript-pinned ytd-watch-flexy {
        width: 100% !important;
        max-width: 100% !important;
      }
      html.yt-transcript-pinned ytd-watch-flexy #columns {
        gap: 0 !important;
        column-gap: 0 !important;
      }
      /* 移除右侧推荐/次要列，避免占位造成中间黑块 */
      html.yt-transcript-pinned ytd-watch-flexy #secondary {
        display: none !important;
        width: 0 !important;
        max-width: 0 !important;
        flex: 0 0 0 !important;
      }
      html.yt-transcript-pinned ytd-watch-flexy #player-theater-container,
      html.yt-transcript-pinned ytd-watch-flexy #player-wide-container,
      html.yt-transcript-pinned ytd-watch-flexy #player-container,
      html.yt-transcript-pinned ytd-watch-flexy #player {
        margin-left: 0 !important;
        margin-right: 0 !important;
        justify-content: flex-start !important;
      }
      /* 🔧 关键：控制主容器宽度，填充剩余空间，消除中间空隙 */
      html.yt-transcript-pinned ytd-watch-flexy #primary {
        max-width: calc(100vw - var(--sidebar-width)) !important;
        width: calc(100vw - var(--sidebar-width)) !important;
      }
      
      /* 一些页面变体使用外层容器控制对齐，统一贴左 */
      html.yt-transcript-pinned #primary,
      html.yt-transcript-pinned #columns,
      html.yt-transcript-pinned #center,
      html.yt-transcript-pinned #player-container-outer {
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-right: 0 !important;
      }
      
      /* 🔧 关键：直接控制视频播放器元素，确保视频实时自适应 */
      html.yt-transcript-pinned #player-container,
      html.yt-transcript-pinned #movie_player,
      html.yt-transcript-pinned .html5-video-container,
      html.yt-transcript-pinned .html5-video-player {
        max-width: calc(100vw - var(--sidebar-width)) !important;
        width: 100% !important;
      }
      html.yt-transcript-pinned video {
        max-width: 100% !important;
        width: 100% !important;
      }
      
      /* 🔧 关键：直接控制视频播放器元素，确保视频实时自适应 */
      html.yt-transcript-pinned #player-container,
      html.yt-transcript-pinned #movie_player,
      html.yt-transcript-pinned .html5-video-container,
      html.yt-transcript-pinned .html5-video-player {
        max-width: calc(100vw - var(--sidebar-width)) !important;
        width: 100% !important;
      }
      html.yt-transcript-pinned video {
        max-width: 100% !important;
        width: 100% !important;
      }
      
      /* 取消固定时恢复 */
      html:not(.yt-transcript-pinned) body {
        margin-right: 0 !important;
        transition: margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* 确保侧边栏始终可见 */
      .transcript-sidebar {
        z-index: 2147483647 !important;
      }
      
      /* 全屏模式下移除预留空间 */
      html.yt-transcript-pinned:fullscreen ytd-app,
      html.yt-transcript-pinned:-webkit-full-screen ytd-app,
      html.yt-transcript-pinned:-moz-full-screen ytd-app {
        margin-right: 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
}

function isPinned() {
    try { return localStorage.getItem('transcriptPinned') === '1'; } catch (_) { return false; }
}

function setPinned(pinned) {
    try { localStorage.setItem('transcriptPinned', pinned ? '1' : '0'); } catch (_) {}
    applyPinnedState();
}

function applyPinnedState() {
    const sidebar = document.getElementById('transcript-sidebar');
    const pinBtn = document.getElementById('pin-sidebar');
    const pinned = isPinned();
    if (!sidebar) return;
    ensurePinStyleElement();
    if (pinned) {
        // 固定时将侧边栏停靠在右侧，确保尺寸和位置稳定
        dockSidebarRight(sidebar, parseInt(sidebar.style.width || '300', 10));
        document.documentElement.classList.add('yt-transcript-pinned');
        if (pinBtn) { pinBtn.classList.add('active'); pinBtn.title = '取消固定'; }
    } else {
        document.documentElement.classList.remove('yt-transcript-pinned');
        if (pinBtn) { pinBtn.classList.remove('active'); pinBtn.title = '固定侧边栏'; }
    }
    updatePinnedSpace();
}

function updatePinnedSpace() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    if (!isPinned()) return;
    const rect = sidebar.getBoundingClientRect();
    const w = Math.max(280, Math.min(900, rect.width || parseInt(sidebar.style.width || '300', 10)));
    document.documentElement.style.setProperty('--yt-transcript-sidebar-width', w + 'px');
    
    // 🔧 强制 YouTube 播放器重新计算尺寸
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
        
        // 触发窗口 resize 事件，让 YouTube 重新计算布局
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
        });
    } catch (e) {
        // 忽略错误
    }
}

// 禁用布局过渡动画（拖动时用，实现实时挤压效果）
function disableLayoutTransition() {
    const body = document.body;
    if (body) {
        body.style.transition = 'none';
    }
    
    // 也禁用YouTube容器的transition
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy) {
        watchFlexy.style.transition = 'none';
    }
    
    console.log('[YouTube转录 DOM] 🎯 已禁用布局过渡（拖动中，实时挤压）');
}

// 恢复布局过渡动画（拖动结束后，恢复丝滑动画）
function enableLayoutTransition() {
    const body = document.body;
    if (body) {
        // 移除内联样式，让CSS规则生效
        body.style.transition = '';
    }
    
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy) {
        watchFlexy.style.transition = '';
    }
    
    console.log('[YouTube转录 DOM] ✨ 已恢复布局过渡');
}

function enableSidebarDrag(sidebar, handle) {
    let dragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;

    const onMouseMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = clamp(origLeft + dx, 0, window.innerWidth - sidebar.offsetWidth - 10);
        const newTop = clamp(origTop + dy, 0, window.innerHeight - 80); // 留出上方空间
        sidebar.style.left = newLeft + 'px';
        sidebar.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveSidebarState({
            mode: 'free',
            left: parseInt(sidebar.style.left || '0'),
            top: parseInt(sidebar.style.top || '0'),
            width: parseInt(sidebar.style.width || '300'),
            height: parseInt(sidebar.style.height || (window.innerHeight)),
        });
        handle.style.cursor = 'move';
        updatePinnedSpace();
    };

    handle.addEventListener('mousedown', (e) => {
        // 避免按钮触发拖拽
        if (e.target.closest('button') || e.target.closest('input')) return;
        dragging = true;
        const rect = sidebar.getBoundingClientRect();
        // 切换为自由模式
        sidebar.style.right = 'auto';
        sidebar.style.left = rect.left + 'px';
        sidebar.style.top = rect.top + 'px';
        sidebar.style.height = rect.height + 'px';
        startX = e.clientX; startY = e.clientY;
        origLeft = rect.left; origTop = rect.top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        handle.style.cursor = 'grabbing';
        e.preventDefault();
    });
}

function enableSidebarResize(sidebar, leftHandle, brHandle) {
    const minW = 280, minH = 240;

    // 左侧宽度拖拽
    leftHandle.addEventListener('mousedown', (e) => {
        const rect = sidebar.getBoundingClientRect();
        const startX = e.clientX;
        const startLeft = rect.left;
        const startWidth = rect.width;
        const dockedRight = (sidebar.style.right === '0px') || isPinned();
        if (!dockedRight) sidebar.style.right = 'auto';
        
        // 🎯 拖动开始：禁用transition，实现实时挤压
        disableLayoutTransition();
        
        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const maxW = Math.min(900, window.innerWidth - 20);
            let newWidth = startWidth - dx; // 向左拖大，向右拖小
            newWidth = clamp(newWidth, minW, maxW);
            if (dockedRight) {
                // 仍停靠右侧，仅改变宽度
                sidebar.style.width = newWidth + 'px';
            } else {
                let newLeft = startLeft + dx;
                newLeft = clamp(newLeft, 0, window.innerWidth - newWidth - 10);
                sidebar.style.left = newLeft + 'px';
                sidebar.style.width = newWidth + 'px';
            }
            updatePinnedSpace();  // 实时更新，视频立即跟随
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            
            // ✨ 拖动结束：恢复transition，保持丝滑动画
            enableLayoutTransition();
            
            const rect2 = sidebar.getBoundingClientRect();
            if (dockedRight) {
                saveSidebarState({ mode: 'dock-right', width: rect2.width });
            } else {
                saveSidebarState({ mode: 'free', left: rect2.left, top: rect2.top, width: rect2.width, height: rect2.height });
            }
            updatePinnedSpace();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
        e.stopPropagation();
    });

    // 右下角宽高拖拽
    brHandle.addEventListener('mousedown', (e) => {
        const rect = sidebar.getBoundingClientRect();
        const startX = e.clientX, startY = e.clientY;
        const startW = rect.width, startH = rect.height;
        const dockedRight = (sidebar.style.right === '0px') || isPinned();
        
        // 🎯 拖动开始：禁用transition，实现实时挤压
        disableLayoutTransition();
        
        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const maxW = Math.min(900, window.innerWidth - 20);
            const maxH = window.innerHeight - 20;
            let w = clamp(startW + dx, minW, maxW);
            let h = clamp(startH + dy, minH, maxH);
            sidebar.style.width = w + 'px';
            sidebar.style.height = h + 'px';
            updatePinnedSpace();  // 实时更新，视频立即跟随
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            
            // ✨ 拖动结束：恢复transition，保持丝滑动画
            enableLayoutTransition();
            
            const rect2 = sidebar.getBoundingClientRect();
            if (dockedRight) {
                saveSidebarState({ mode: 'dock-right', width: rect2.width });
            } else {
                // 进入自由模式以保存大小
                sidebar.style.right = 'auto';
                sidebar.style.left = rect2.left + 'px';
                sidebar.style.top = rect2.top + 'px';
                saveSidebarState({ mode: 'free', left: rect2.left, top: rect2.top, width: rect2.width, height: rect2.height });
            }
            updatePinnedSpace();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
        e.stopPropagation();
    });
}

// 一键复制整个字幕（章节+时间戳+文本）
async function copyTranscript() {
    try {
        if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
            showErrorMessage('暂无字幕可复制');
            return;
        }
        const lines = [];
        let ci = 0;
        const hasCh = Array.isArray(chapters) && chapters.length > 0;
        for (let i = 0; i < transcriptData.length; i++) {
            const seg = transcriptData[i];
            if (hasCh) {
                while (ci < chapters.length && seg.start >= chapters[ci].start) {
                    const ch = chapters[ci];
                    if (i === 0 || transcriptData[i - 1].start < ch.start) {
                        lines.push(`${formatTime(ch.start)} ${ch.title}`.trim());
                        lines.push('');
                    }
                    ci++;
                }
            }
            lines.push(`${formatTime(seg.start)} ${seg.text}`);
        }
        const text = lines.join('\n');
        await writeToClipboard(text);
        const btn = document.getElementById('copy-transcript');
        if (btn) {
            const old = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = old, 1000);
        }
    } catch (err) {
        console.error('[YouTube转录 DOM] 复制失败:', err);
    }
}

// 複制當前頁面的網址
async function copyPageUrl() {
    try {
        const url = window.location.href;
        await writeToClipboard(url);
        const btn = document.getElementById('copy-url');
        if (btn) {
            const old = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = old, 1000);
        }
    } catch (err) {
        console.error('[YouTube轉錄 DOM] 複制頁面網址失敗:', err);
    }
}

function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
    });
}

// 🔧 复制单条字幕文本并显示视觉反馈
async function copyTextToClipboard(text, element) {
    try {
        await writeToClipboard(text);
        
        // 显示复制成功的视觉反馈
        const originalBg = element.style.backgroundColor;
        const originalColor = element.style.color;
        
        // 闪烁绿色表示复制成功
        element.style.backgroundColor = '#4caf50';
        element.style.color = '#fff';
        element.style.transition = 'background-color 0.2s, color 0.2s';
        
        // 显示复制成功提示
        showCopyToast('已复制');
        
        // 0.5秒后恢复原样
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
            element.style.color = originalColor;
        }, 500);
        
        console.log('[YouTube转录 DOM] 已复制文本:', text.substring(0, 30) + '...');
    } catch (err) {
        console.error('[YouTube转录 DOM] 复制失败:', err);
        showCopyToast('复制失败');
    }
}

// 显示复制提示 Toast
function showCopyToast(message) {
    // 移除已存在的 toast
    const existingToast = document.getElementById('transcript-copy-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'transcript-copy-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 2147483647;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;
    
    document.body.appendChild(toast);
    
    // 淡入
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });
    
    // 1.5秒后淡出并移除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 1500);
}

// 渲染字幕
function renderTranscript(filterQuery = '') {
    const container = document.getElementById('transcript-content');
    if (!container || transcriptData.length === 0) return;
    
    container.innerHTML = '';
    
    const query = filterQuery.toLowerCase().trim();
    let currentChapterIndex = 0;
    
    transcriptData.forEach((item, index) => {
        // 搜索过滤
        if (query && !item.text.toLowerCase().includes(query)) {
            return;
        }
        
        // 检查是否需要显示章节标题
        if (!query && chapters.length > 0 && currentChapterIndex < chapters.length) {
            const chapter = chapters[currentChapterIndex];
            if (item.start >= chapter.start && (index === 0 || transcriptData[index - 1].start < chapter.start)) {
                // 创建章节标题（带蓝色时间戳）
                const chapterDiv = document.createElement('div');
                chapterDiv.className = 'chapter-header';
                const ts = document.createElement('span');
                ts.className = 'chapter-timestamp';
                ts.textContent = formatTime(chapter.start);
                const titleEl = document.createElement('span');
                titleEl.className = 'chapter-title';
                titleEl.textContent = chapter.title || '';
                chapterDiv.appendChild(ts);
                chapterDiv.appendChild(titleEl);
                chapterDiv.addEventListener('click', () => {
                    if (videoElement) {
                        videoElement.currentTime = chapter.start;
                    }
                });
                container.appendChild(chapterDiv);
                currentChapterIndex++;
            }
        }
        
        const div = document.createElement('div');
        div.className = 'transcript-item';
        div.dataset.index = index;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(item.start);
        
        const text = document.createElement('span');
        text.className = 'text';
        
        // 高亮搜索结果
        if (query) {
            const regex = new RegExp(`(${query})`, 'gi');
            text.innerHTML = item.text.replace(regex, '<mark style="background-color: #ffeb3b; color: #000;">$1</mark>');
            div.classList.add('highlight');
        } else {
            text.textContent = item.text;
        }
        
        div.appendChild(timestamp);
        div.appendChild(text);
        
        // 🔧 点击时间戳：跳转到视频对应位置
        timestamp.addEventListener('click', (e) => {
            e.stopPropagation();  // 阻止冒泡
            if (videoElement) {
                videoElement.currentTime = item.start;
                highlightTranscript(index);
            }
        });
        
        // 🔧 点击文本：复制该段文字
        text.addEventListener('click', (e) => {
            e.stopPropagation();  // 阻止冒泡
            const textToCopy = item.text;
            copyTextToClipboard(textToCopy, text);
        });
        
        // 保留整行点击跳转功能（作为备用）
        div.addEventListener('click', (e) => {
            // 如果点击的是时间戳或文本，不处理（它们有自己的事件）
            if (e.target === timestamp || e.target === text || text.contains(e.target)) {
                return;
            }
            if (videoElement) {
                videoElement.currentTime = item.start;
                highlightTranscript(index);
            }
        });
        
        container.appendChild(div);
    });
    
    // 如果有搜索结果，显示统计
    if (query) {
        const count = container.children.length;
        if (count === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #606060;">No results found</div>';
        }
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showLoadingMessage(msg) {
    const container = document.getElementById('transcript-content');
    if (container) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa;"><div style="margin-bottom: 10px;">⏳</div><p>${msg}</p></div>`;
    }
}

function showErrorMessage(msg) {
    const container = document.getElementById('transcript-content');
    if (container) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b;"><div style="margin-bottom: 10px;">❌</div><p>${msg}</p></div>`;
    }
}

function showNoTranscriptMessage() {
    const container = document.getElementById('transcript-content');
    if (container) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa;"><div style="margin-bottom: 10px;">📝</div><p>此视频没有可用的字幕</p></div>`;
    }
}

// 节流控制：限制更新频率，避免性能问题
let lastTimeUpdateCall = 0;
const TIME_UPDATE_THROTTLE_MS = 500; // 每500ms最多更新一次

function onTimeUpdate() {
    if (videoElement && !videoElement.paused) {
        const now = Date.now();
        if (now - lastTimeUpdateCall >= TIME_UPDATE_THROTTLE_MS) {
            lastTimeUpdateCall = now;
            updateTranscriptHighlight(videoElement.currentTime);
        }
    }
}

function startTimeTracking() {
    if (videoElement) {
        updateTranscriptHighlight(videoElement.currentTime);
    }
}

function stopTimeTracking() {
    // 保留函数，但不停止追踪，由 timeupdate 事件处理
}

function updateTranscriptHighlight(currentTime) {
    // 使用二分查找优化性能（适用于大量字幕数据）
    if (transcriptData.length === 0) return;
    
    let left = 0;
    let right = transcriptData.length - 1;
    let currentIndex = -1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const item = transcriptData[mid];
        const nextItem = transcriptData[mid + 1];
        
        if (currentTime >= item.start && (!nextItem || currentTime < nextItem.start)) {
            currentIndex = mid;
            break;
        } else if (currentTime < item.start) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    
    if (currentIndex !== -1 && currentIndex !== currentActiveIndex) {
        highlightTranscript(currentIndex);
    }
}

function updateCurrentHighlight() {
    if (videoElement) {
        updateTranscriptHighlight(videoElement.currentTime);
    }
}

function highlightTranscript(index) {
    // 优化：直接通过 ID 查找，避免遍历所有元素
    const previousActive = document.querySelector('.transcript-item.active');
    if (previousActive) {
        previousActive.classList.remove('active');
    }
    
    // 使用 data-index 属性直接查找目标元素
    const targetItem = document.querySelector(`.transcript-item[data-index="${index}"]`);
    
    if (targetItem) {
        targetItem.classList.add('active');
        // 仅在未处于用户滚动冷却期且目标不在可视区域内时，自动滚动到视图
        const container = document.getElementById('transcript-content');
        if (container) {
            const now = Date.now();
            if (now >= blockAutoScrollUntil) {
                const cRect = container.getBoundingClientRect();
                const iRect = targetItem.getBoundingClientRect();
                const fullyVisible = iRect.top >= cRect.top + 8 && iRect.bottom <= cRect.bottom - 8;
                if (!fullyVisible) {
                    // 使用 requestAnimationFrame 避免阻塞主线程
                    requestAnimationFrame(() => {
                        targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                }
            }
        }
    }
    
    currentActiveIndex = index;
}

// 搜索功能
function handleSearch(event) {
    searchQuery = event.target.value;
    renderTranscript(searchQuery);
}

// 用于跟踪清理定时器，避免时序冲突
let cleanupTimers = [];

// 清除所有清理定时器（定义在前面，供多个函数使用）
function clearAllCleanupTimers() {
    cleanupTimers.forEach(timer => clearTimeout(timer));
    cleanupTimers = [];
    console.log('[YouTube转录 DOM] 已清除所有清理定时器');
}

function hideSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    
    console.log('[YouTube转录 DOM] 🚀 关闭侧边栏（简化版）');
    
    // 清除之前的定时器
    clearAllCleanupTimers();
    
    // 第一步：立即清除所有固定模式相关的样式
    document.documentElement.classList.remove('yt-transcript-pinned');
    document.documentElement.style.removeProperty('--yt-transcript-sidebar-width');
    
    // 第二步：强制设置body margin为0（使用!important级别的内联样式）
    document.body.style.setProperty('margin-right', '0', 'important');
    
    // 🔧 新增：触发布局更新，让视频立即恢复满屏
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
    
    // 第三步：启动侧边栏滑出动画
    sidebar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
    sidebar.style.transform = 'translateX(100%)';
    sidebar.style.opacity = '0';
    
    // 第四步：动画完成后移除侧边栏
    setTimeout(() => {
        try {
            sidebar.remove();
            console.log('[YouTube转录 DOM] ✅ 侧边栏已移除');
        } catch(_) {
            sidebar.style.display = 'none';
        }
    }, 450);
    
    // 第五步：清理完成后移除内联样式，让页面恢复正常
    setTimeout(() => {
        const currentSidebar = document.getElementById('transcript-sidebar');
        if (!currentSidebar) {
            // 只有确认没有新侧边栏时才清理
            document.body.style.removeProperty('margin-right');
            console.log('[YouTube转录 DOM] ✅ 视频已恢复正常大小');
        }
    }, 500);
}

function showSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    
    console.log('[YouTube转录 DOM] 开始显示侧边栏，启动丝滑动画...');
    
    sidebar.classList.remove('collapsed');
    sidebar.style.display = 'flex';  // 使用 flex 而不是 block，确保内部布局正确
    sidebar.style.pointerEvents = 'auto';
    
    // 恢复尺寸设置
    const savedState = getSavedSidebarState();
    const targetWidth = (savedState && savedState.width) ? savedState.width : 300;
    sidebar.style.width = targetWidth + 'px';
    sidebar.style.right = '0px';
    
    // 🔧 确保侧边栏填满整个高度
    sidebar.style.top = '0';
    sidebar.style.bottom = '0';
    sidebar.style.height = '100vh';
    
    // 始终固定在右侧
    setPinned(true);
    
    // 设置初始隐藏状态（在屏幕右侧外）
    sidebar.style.transform = 'translateX(100%)';
    sidebar.style.opacity = '0';
    
    const headerEl = document.querySelector('#transcript-sidebar .transcript-header');
    if (headerEl) headerEl.style.cursor = 'move';
    
    // 确保滚动容器处于可滚动状态
    const content = document.getElementById('transcript-content');
    if (content) {
        content.style.overflowY = 'auto';
        content.style.pointerEvents = 'auto';
        // 再次绑定一次（幂等）
        if (!content.dataset.scrollHandlers) {
            const markUserScroll = () => { blockAutoScrollUntil = Date.now() + AUTOSCROLL_COOLDOWN_MS; };
            content.addEventListener('wheel', markUserScroll, { passive: true });
            content.addEventListener('touchstart', markUserScroll, { passive: true });
            content.addEventListener('pointerdown', markUserScroll, { passive: true });
            content.addEventListener('scroll', markUserScroll, { passive: true });
            content.dataset.scrollHandlers = '1';
        }
    }
    
    // 使用 requestAnimationFrame 实现丝滑的入场动画
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // 1. 应用固定状态，让页面布局开始调整
            applyPinnedState();
            
            // 🔧 新增：触发布局更新，让视频立即自适应侧边栏
            requestAnimationFrame(() => {
                updatePinnedSpace();
                window.dispatchEvent(new Event('resize'));
                
                // 再次触发确保 YouTube 完全响应
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 100);
            });
            
            // 2. 同时让侧边栏滑入
            sidebar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.opacity = '1';
            
            console.log('[YouTube转录 DOM] 侧边栏显示动画已触发');
            
            // 3. 动画完成后清理transition
            setTimeout(() => {
                sidebar.style.transition = '';
            }, 450);
        });
    });
    
    // 立即同步一次高亮和滚动
    blockAutoScrollUntil = 0;
    setTimeout(updateCurrentHighlight, 50);
}

function toggleSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    hideSidebar();
}

// 🚀 性能优化：移除自动初始化，改为按需加载
// 只有用户点击扩展图标（或刷新后自动恢复）时才初始化
// 避免影响视频加载性能，防止卡顿
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
// } else {
//     setTimeout(init, 1000);
// }

// 监听URL变化
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('[YouTube转录 DOM] URL 变化，清除刷新标记和旧数据');
        // 清除刷新标记
        sessionStorage.removeItem('yt-transcript-refreshed');
        sessionStorage.removeItem('yt-transcript-auto-open');
        sessionStorage.removeItem('yt-transcript-loaded');
        
        // 🔧 清除旧的字幕数据，避免显示上一个视频的字幕
        transcriptData = [];
        chapters = [];
        currentActiveIndex = -1;
        
        // 🚀 性能优化：移除旧的侧边栏，但不自动初始化
        // 让用户主动点击扩展图标来打开字幕，避免自动加载导致视频卡顿
        if (url.includes('/watch')) {
            const existingSidebar = document.getElementById('transcript-sidebar');
            if (existingSidebar) existingSidebar.remove();
            
            // ⚠️ 不在这里关闭原生面板！
            // 因为YouTube需要时间处理，过早关闭会导致下次打开时状态混乱
            // 改为在用户点击扩展时强制重置面板状态
            
            // 不再自动初始化，只有用户点击时才初始化
            // setTimeout(init, 2000);
        }
    }
}).observe(document, { subtree: true, childList: true });

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[YouTube转录 DOM] 收到消息:', request.type);
    
    if (request.type === 'PING_TRANSCRIPT') {
        sendResponse({ ok: true });
        return; // 同步响应
    }

    if (request.type === 'TOGGLE_SIDEBAR') {
        const sidebar = document.getElementById('transcript-sidebar');
        
        if (sidebar) {
            // 切换显示/隐藏
            const isVisible = sidebar.style.display !== 'none';
            if (isVisible) {
                hideSidebar();
                console.log('[YouTube转录 DOM] 侧边栏已隐藏');
                sendResponse({ visible: false });
            } else {
                // 为保险起见，移除并重新初始化
                hideSidebar();
                init();
                console.log('[YouTube转录 DOM] 侧边栏已重建并显示');
                sendResponse({ visible: true });
            }
        } else {
            console.log('[YouTube转录 DOM] 侧边栏不存在，初始化...');
            // 如果侧边栏不存在，创建它
            init();
            sendResponse({ visible: true });
        }
        
        return true; // 异步响应
    }
});

// 适配窗口变化：确保侧边栏在屏幕内并按窗口收缩
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar || sidebar.style.display === 'none') return;
    const rect = sidebar.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width - 10);
    const maxTop = Math.max(0, window.innerHeight - 80);
    if (sidebar.style.right !== '0px') {
        // 自由模式：限制在屏幕内
        sidebar.style.left = clamp(rect.left, 0, maxLeft) + 'px';
        sidebar.style.top = clamp(rect.top, 0, maxTop) + 'px';
        const maxW = Math.min(900, window.innerWidth - 20);
        const maxH = window.innerHeight - 20;
        sidebar.style.width = Math.min(rect.width, maxW) + 'px';
        sidebar.style.height = Math.min(rect.height, maxH) + 'px';
    } else {
        // 🔧 固定在右侧时：确保填满整个高度
        const w = Math.min(parseInt(sidebar.style.width || '300', 10), Math.min(600, window.innerWidth - 20));
        sidebar.style.width = w + 'px';
        sidebar.style.top = '0';
        sidebar.style.bottom = '0';
        sidebar.style.height = '100vh';
    }
    // 固定模式下同步预留空间
    updatePinnedSpace();
});

// 🔧 智能刷新后自动打开：检查是否是刷新后需要自动打开侧边栏
window.addEventListener('load', () => {
    const shouldAutoOpen = sessionStorage.getItem('yt-transcript-auto-open');
    if (shouldAutoOpen) {
        console.log('[YouTube转录 DOM] 检测到刷新标记，自动打开侧边栏...');
        // 清除标记
        sessionStorage.removeItem('yt-transcript-auto-open');
        // 延迟一下确保页面完全加载
        setTimeout(() => {
            init();
        }, 1000);
    }
});
