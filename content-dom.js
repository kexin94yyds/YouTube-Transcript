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
        
        // 方法1: 尝试点击transcript按钮
        const transcriptButton = await findTranscriptButton();
        
        if (transcriptButton) {
            console.log('[YouTube转录 DOM] 找到transcript按钮，尝试点击...');
            // 点击前确保面板处于不可见状态，避免闪现
            try {
                const nativePanelPre = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
                if (nativePanelPre) {
                    nativePanelPre.style.opacity = '0';
                    nativePanelPre.style.pointerEvents = 'none';
                }
            } catch (_) {}
            transcriptButton.click();
            
            // 等待transcript面板出现
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // 查找transcript面板
            const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
            
            if (transcriptPanel) {
                console.log('[YouTube转录 DOM] 找到transcript面板');
                
                // 提取章节信息
                await extractChapters(transcriptPanel);
                
                const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
                console.log('[YouTube转录 DOM] 找到字幕片段:', segments.length);
                
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
                    
                    // 渲染完成后保持原生面板隐藏（不打断加载）
                    setTimeout(() => {
                        closeNativeTranscript(transcriptPanel);
                    }, 0);
                    
                    return;
                }
            }
        }
        
        // 方法2: 使用ytInitialPlayerResponse（备用）
        console.log('[YouTube转录 DOM] 尝试备用方法...');
        await fetchFromPlayerResponse();
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 获取失败:', error);
        showErrorMessage('无法获取字幕');
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
        
        // 直接隐藏面板
        if (panel) {
            // 不使用 display:none，保持DOM在场，避免后续加载失效
            panel.classList.add('transcript-hidden');
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            try { panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN'); } catch (_) {}
            console.log('[YouTube转录 DOM] 原生面板已隐藏');
        }
        
        // 持续监控，防止被重新打开
        keepNativeTranscriptHidden();
        
    } catch (error) {
        console.error('[YouTube转录 DOM] 关闭原生面板失败:', error);
    }
}

// 持续隐藏原生transcript面板
let nativeTranscriptObserver = null;
function keepNativeTranscriptHidden() {
    // 避免重复创建 observer
    if (nativeTranscriptObserver) return;
    
    nativeTranscriptObserver = new MutationObserver(() => {
        const nativePanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        if (nativePanel) {
            const isVisible = nativePanel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
            if (isVisible && !nativePanel.classList.contains('transcript-hidden')) {
                console.log('[YouTube转录 DOM] 检测到原生面板打开，强制隐藏');
                nativePanel.classList.add('transcript-hidden');
                nativePanel.style.opacity = '0';
                nativePanel.style.pointerEvents = 'none';
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
                <button id="copy-transcript" class="control-btn" title="Copy transcript">📋</button>
                <button id="copy-url" class="control-btn" title="Copy URL">🔗</button>
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
    document.body.appendChild(sidebar);

    // 创建尺寸手柄（左侧和右下角）
    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle-left';
    sidebar.appendChild(leftHandle);
    const brHandle = document.createElement('div');
    brHandle.className = 'resize-handle-br';
    sidebar.appendChild(brHandle);
    
    // 绑定事件
    const toggleBtn = document.getElementById('toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }
    const copyBtn = document.getElementById('copy-transcript');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => copyTranscript());
    }
    const copyUrlBtn = document.getElementById('copy-url');
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => copyPageUrl());
    }
    
    const searchBox = document.getElementById('search-box');
    if (searchBox) {
        searchBox.addEventListener('input', handleSearch);
    }
    // 启用拖拽和缩放，并恢复上次位置
    enableSidebarDrag(sidebar, header);
    enableSidebarResize(sidebar, leftHandle, brHandle);
    applySavedSidebarState(sidebar);

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

function dockSidebarRight(sidebar, width = 400) {
    sidebar.style.left = '';
    sidebar.style.top = '';
    sidebar.style.right = '0px';
    const w = Math.min(width, Math.min(600, window.innerWidth - 20));
    sidebar.style.width = w + 'px';
    sidebar.style.height = '100vh';
    saveSidebarState({ mode: 'dock-right', width: w });
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
            width: parseInt(sidebar.style.width || '400'),
            height: parseInt(sidebar.style.height || (window.innerHeight)),
        });
        handle.style.cursor = 'move';
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
        sidebar.style.right = 'auto';
        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            let newLeft = startLeft + dx;
            let newWidth = startWidth - dx;
            if (newWidth < minW) { newWidth = minW; newLeft = startLeft + (startWidth - minW); }
            const maxW = Math.min(900, window.innerWidth - 20);
            if (newWidth > maxW) { newWidth = maxW; newLeft = startLeft + (startWidth - maxW); }
            newLeft = clamp(newLeft, 0, window.innerWidth - newWidth - 10);
            sidebar.style.left = newLeft + 'px';
            sidebar.style.width = newWidth + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const rect2 = sidebar.getBoundingClientRect();
            saveSidebarState({
                mode: 'free', left: rect2.left, top: rect2.top,
                width: rect2.width, height: rect2.height
            });
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
        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const maxW = Math.min(900, window.innerWidth - 20);
            const maxH = window.innerHeight - 20;
            let w = clamp(startW + dx, minW, maxW);
            let h = clamp(startH + dy, minH, maxH);
            sidebar.style.width = w + 'px';
            sidebar.style.height = h + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const rect2 = sidebar.getBoundingClientRect();
            // 进入自由模式以保存大小
            sidebar.style.right = 'auto';
            sidebar.style.left = rect2.left + 'px';
            sidebar.style.top = rect2.top + 'px';
            saveSidebarState({
                mode: 'free', left: rect2.left, top: rect2.top,
                width: rect2.width, height: rect2.height
            });
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
        
        div.addEventListener('click', () => {
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

function onTimeUpdate() {
    if (videoElement && !videoElement.paused) {
        updateTranscriptHighlight(videoElement.currentTime);
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
    const currentIndex = transcriptData.findIndex((item, index) => {
        const nextItem = transcriptData[index + 1];
        return currentTime >= item.start && (!nextItem || currentTime < nextItem.start);
    });
    
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
    const previousActive = document.querySelector('.transcript-item.active');
    if (previousActive) {
        previousActive.classList.remove('active');
    }
    
    const items = document.querySelectorAll('.transcript-item');
    const targetItem = Array.from(items).find(item => item.dataset.index == index);
    
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
                    targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

function hideSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    // 结束任何可能未完成的拖拽/缩放，避免状态卡住
    try {
        document.dispatchEvent(new MouseEvent('mouseup'));
        document.dispatchEvent(new PointerEvent('pointerup'));
        // 兼容触摸
        const touch = new Touch({ identifier: 1, target: document.body, clientX: 0, clientY: 0 });
        document.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], bubbles: true }));
    } catch (_) {}
    // 直接移除节点，避免隐藏后残留状态导致交互异常
    try { sidebar.remove(); } catch(_) { sidebar.style.display = 'none'; }
}

function showSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('collapsed');
    sidebar.style.display = 'block';
    sidebar.style.pointerEvents = 'auto';
    applySavedSidebarState(sidebar);
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
    // 立即同步一次高亮和滚动
    blockAutoScrollUntil = 0;
    setTimeout(updateCurrentHighlight, 50);
}

function toggleSidebar() {
    const sidebar = document.getElementById('transcript-sidebar');
    if (!sidebar) return;
    hideSidebar();
}

// 初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
} else {
    setTimeout(init, 1000);
}

// 监听URL变化
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (url.includes('/watch')) {
            const existingSidebar = document.getElementById('transcript-sidebar');
            if (existingSidebar) existingSidebar.remove();
            setTimeout(init, 2000);
        }
    }
}).observe(document, { subtree: true, childList: true });

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[YouTube转录 DOM] 收到消息:', request.type);
    
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
        sidebar.style.left = clamp(rect.left, 0, maxLeft) + 'px';
        sidebar.style.top = clamp(rect.top, 0, maxTop) + 'px';
        const maxW = Math.min(900, window.innerWidth - 20);
        const maxH = window.innerHeight - 20;
        sidebar.style.width = Math.min(rect.width, maxW) + 'px';
        sidebar.style.height = Math.min(rect.height, maxH) + 'px';
    } else {
        const w = Math.min(parseInt(sidebar.style.width || '400', 10), Math.min(600, window.innerWidth - 20));
        sidebar.style.width = w + 'px';
    }
});
