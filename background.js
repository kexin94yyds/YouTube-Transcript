// Background Service Worker

console.log('[YouTube转录 Background] Service Worker启动');

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    console.log('[YouTube转录 Background] 扩展图标被点击');
    
    // 检查是否是YouTube视频页面
    if (tab.url && tab.url.includes('youtube.com/watch')) {
        // 向content script发送切换侧边栏的消息
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[YouTube转录 Background] 发送消息失败:', chrome.runtime.lastError);
            } else {
                console.log('[YouTube转录 Background] 侧边栏状态:', response?.visible ? '显示' : '隐藏');
            }
        });
    } else {
        console.log('[YouTube转录 Background] 不在YouTube视频页面');
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[YouTube转录 Background] 收到消息:', request.type);
    
    if (request.type === 'FETCH_TRANSCRIPT') {
        // 使用background script获取字幕，绕过CORS
        fetch(request.url)
            .then(response => response.text())
            .then(text => {
                console.log('[YouTube转录 Background] 成功获取字幕');
                sendResponse({ success: true, data: text });
            })
            .catch(error => {
                console.error('[YouTube转录 Background] 获取字幕失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // 返回true表示异步响应
        return true;
    }
});
