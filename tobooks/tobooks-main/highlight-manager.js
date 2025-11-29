/**
 * HighlightManager
 * Manages text highlighting and context menu for the EPUB reader
 * Mimics macOS Books style
 */
class HighlightManager {
    constructor(rendition) {
        this.rendition = rendition;
        this.highlights = [];
        this.menu = null;
        this.currentCfiRange = null;
        this.currentSelection = null;
        this._highlightsRestored = false;
        this._refreshing = false;
        
        this.colors = [
            { id: 'yellow', color: '#FFD54F', label: '黄色', class: 'highlight-yellow' },
            { id: 'green', color: '#81C784', label: '绿色', class: 'highlight-green' },
            { id: 'blue', color: '#64B5F6', label: '蓝色', class: 'highlight-blue' },
            { id: 'pink', color: '#F06292', label: '粉色', class: 'highlight-pink' },
            { id: 'purple', color: '#CE93D8', label: '紫色', class: 'highlight-purple' }
        ];

        this.init();
    }

    init() {
        this.createMenu();
        this.injectGlobalStyles();
        this.setupRenditionHooks();
        this.loadHighlights();
        console.log('✅ HighlightManager 已初始化');
    }

    injectGlobalStyles() {
        const style = document.createElement('style');
        style.id = 'highlight-manager-styles';
        style.textContent = `
            .highlight-menu {
                position: fixed;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
                padding: 8px;
                display: none;
                z-index: 999999;
                min-width: 280px;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
                border: 0.5px solid rgba(0,0,0,0.08);
            }
            
            .highlight-menu.show {
                display: block;
                animation: menuFadeIn 0.2s ease-out;
            }
            
            @keyframes menuFadeIn {
                from { 
                    opacity: 0; 
                    transform: scale(0.95) translateY(-5px); 
                }
                to { 
                    opacity: 1; 
                    transform: scale(1) translateY(0); 
                }
            }

            .highlight-colors {
                display: flex;
                gap: 10px;
                margin: 8px 0;
                justify-content: center;
                padding: 8px 4px;
                border-bottom: 0.5px solid rgba(0,0,0,0.1);
            }

            .color-btn {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                position: relative;
                border: 2px solid transparent;
                transition: all 0.15s ease;
                flex-shrink: 0;
            }

            .color-btn:hover {
                transform: scale(1.15);
                border-color: rgba(0,0,0,0.15);
            }

            .color-btn:active {
                transform: scale(1.05);
            }


            .menu-actions {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 4px;
            }

            .action-item {
                padding: 10px 12px;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                display: flex;
                align-items: center;
                gap: 10px;
                border-radius: 6px;
                transition: background 0.1s ease;
                user-select: none;
            }

            .action-item:hover {
                background: rgba(0,0,0,0.06);
            }

            .action-item:active {
                background: rgba(0,0,0,0.1);
            }

            .action-icon {
                font-size: 16px;
                width: 20px;
                text-align: center;
            }

            .action-label {
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }

    setupRenditionHooks() {
        // Inject styles into the book iframe
        this.rendition.hooks.content.register((contents) => {
            const doc = contents.document;
            
            // Add styles for highlights
            const style = doc.createElement('style');
            style.textContent = `
                .highlight-yellow {
                    background-color: rgba(255, 213, 79, 0.5) !important;
                    font-weight: bold !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-green {
                    background-color: rgba(129, 199, 132, 0.5) !important;
                    font-weight: bold !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-blue {
                    background-color: rgba(100, 181, 246, 0.5) !important;
                    font-weight: bold !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-pink {
                    background-color: rgba(240, 98, 146, 0.5) !important;
                    font-weight: bold !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-purple {
                    background-color: rgba(206, 147, 216, 0.4) !important;
                    font-weight: bold !important;
                    transition: background-color 0.2s ease;
                }
                
                /* 临时搜索高亮样式 - 类似浏览器搜索高亮 */
                .highlight-search-temp {
                    background-color: rgba(255, 221, 0, 0.6) !important;
                    animation: searchHighlightPulse 0.5s ease-in-out 3;
                    border-radius: 2px;
                    box-shadow: 0 0 4px rgba(255, 221, 0, 0.8);
                }
                
                @keyframes searchHighlightPulse {
                    0% { background-color: rgba(255, 221, 0, 0.6); box-shadow: 0 0 4px rgba(255, 221, 0, 0.8); }
                    50% { background-color: rgba(255, 221, 0, 0.9); box-shadow: 0 0 8px rgba(255, 221, 0, 1); }
                    100% { background-color: rgba(255, 221, 0, 0.6); box-shadow: 0 0 4px rgba(255, 221, 0, 0.8); }
                }
            `;
            doc.head.appendChild(style);
            
            // Add click listener to iframe content to hide menu when clicking outside
            doc.addEventListener('mousedown', (e) => {
                // Small delay to allow selection to complete first
                setTimeout(() => {
                    const selection = doc.getSelection();
                    // Only hide if there's no new selection being made
                    if (!selection || selection.toString().trim() === '') {
                        this.hideMenu();
                    }
                }, 10);
            });
            
            // Also hide on click (for cases where mousedown doesn't fire properly)
            doc.addEventListener('click', (e) => {
                const selection = doc.getSelection();
                if (!selection || selection.toString().trim() === '') {
                    this.hideMenu();
                }
            });
            
            // 监听 iframe DOM 变化（检测浏览器翻译等）
            let mutationTimeout = null;
            const observer = new MutationObserver((mutations) => {
                // 只处理文本内容变化
                const hasTextChange = mutations.some(m => 
                    m.type === 'characterData' || 
                    (m.type === 'childList' && m.addedNodes.length > 0)
                );
                
                if (hasTextChange) {
                    clearTimeout(mutationTimeout);
                    mutationTimeout = setTimeout(() => {
                        this.refreshHighlightPositions();
                    }, 500);
                }
            });
            
            observer.observe(doc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        // Listen for text selections
        this.rendition.on('selected', (cfiRange, contents) => {
            console.log('📝 文本已选中:', cfiRange);
            this.currentCfiRange = cfiRange;
            this.showMenu(cfiRange, contents);
        });

        // Hide menu on clicks outside (main document)
        document.addEventListener('mousedown', (e) => {
            if (this.menu && !this.menu.contains(e.target)) {
                // Don't hide immediately if clicking in reading area - let iframe handler deal with it
                const viewArea = document.getElementById('viewer') || document.getElementById('area');
                if (!viewArea || !viewArea.contains(e.target)) {
                    this.hideMenu();
                }
            }
        }, true);
        
        // Also hide on any click outside the menu
        document.addEventListener('click', (e) => {
            if (this.menu && this.menu.classList.contains('show') && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        }, true);

        // Hide menu on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideMenu();
            }
        });
        
        // 监听 rendition 的 relocated 事件，用于在页面变化后刷新高亮
        this.rendition.on('relocated', () => {
            // 延迟刷新，等待渲染完成
            setTimeout(() => this.refreshHighlightPositions(), 200);
        });
        
        // 监听窗口 resize 事件
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.refreshHighlightPositions(), 300);
        });
    }
    
    /**
     * 刷新所有高亮的位置（用于翻译后重新定位）
     */
    refreshHighlightPositions() {
        // 等待初始高亮恢复完成后才能刷新
        if (!this._highlightsRestored) {
            console.log('⏳ 等待初始高亮恢复完成...');
            return;
        }
        
        if (this.highlights.length === 0) return;
        
        // 防止频繁刷新
        if (this._refreshing) return;
        this._refreshing = true;
        
        console.log('🔄 刷新高亮位置...');
        
        try {
            // 获取当前视图
            const currentViews = this.rendition.views();
            if (!currentViews || currentViews.length === 0) {
                this._refreshing = false;
                return;
            }
            
            // 获取当前视图的 section indices
            const currentSectionIndices = new Set();
            currentViews.forEach(view => {
                if (view && view.index !== undefined) {
                    currentSectionIndices.add(view.index);
                }
            });
            
            // 只刷新当前可见章节的高亮
            this.highlights.forEach(h => {
                try {
                    this.rendition.annotations.remove(h.cfi, 'highlight');
                } catch (e) {}
            });
            
            // 重新添加高亮
            setTimeout(() => {
                this.highlights.forEach(h => {
                    const colorConfig = this.colors.find(c => c.id === h.colorId);
                    if (colorConfig) {
                        try {
                            // 先验证 CFI 是否有效
                            const range = this.rendition.getRange(h.cfi);
                            if (!range || !range.startContainer) {
                                return; // 跳过无效的高亮
                            }
                            
                            this.rendition.annotations.add(
                                'highlight',
                                h.cfi,
                                { color: colorConfig.id },
                                null,
                                colorConfig.class,
                                { 'fill': colorConfig.color, 'fill-opacity': '0.3' }
                            );
                        } catch (e) {
                            // 忽略不在当前视图的高亮错误
                        }
                    }
                });
                this._refreshing = false;
            }, 50);
        } catch (err) {
            console.warn('刷新高亮失败:', err);
            this._refreshing = false;
        }
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'highlight-menu';
        
        // Colors Section
        const colorsDiv = document.createElement('div');
        colorsDiv.className = 'highlight-colors';
        
        this.colors.forEach(c => {
            const btn = document.createElement('div');
            btn.className = `color-btn ${c.id === 'underline' ? 'underline' : ''}`;
            if (c.id !== 'underline') {
                btn.style.backgroundColor = c.color;
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }
            btn.title = c.label;
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.applyHighlight(c);
            };
            colorsDiv.appendChild(btn);
        });
        
        this.menu.appendChild(colorsDiv);
        
        // Actions Section
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'menu-actions';
        
        const actions = [
            { 
                label: '添加笔记', 
                icon: '📝', 
                action: () => this.addNote() 
            }
        ];
        
        actions.forEach(a => {
            const item = document.createElement('div');
            item.className = 'action-item';
            item.innerHTML = `<span class="action-icon">${a.icon}</span><span class="action-label">${a.label}</span>`;
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                a.action();
            };
            actionsDiv.appendChild(item);
        });
        
        this.menu.appendChild(actionsDiv);
        document.body.appendChild(this.menu);
    }

    showMenu(cfiRange, contents) {
        try {
            this.currentCfiRange = cfiRange;
            
            // Get selection range
            const range = this.rendition.getRange(cfiRange);
            if (!range) {
                console.warn('⚠️ 无法获取选中范围');
                return;
            }
            
            const rect = range.getBoundingClientRect();
            
            // Get iframe position
            let iframe = contents.document.defaultView.frameElement;
            let iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
            
            // 先显示菜单（但位置在屏幕外），以便获取正确的尺寸
            this.menu.style.visibility = 'hidden';
            this.menu.classList.add('show');
            
            // 获取菜单的实际尺寸
            const menuHeight = this.menu.offsetHeight || 200;
            const menuWidth = this.menu.offsetWidth || 280;
            
            // Calculate position - 始终在选中文字下方
            let top = rect.bottom + iframeRect.top + window.scrollY + 10;
            let left = rect.left + iframeRect.left + window.scrollX + (rect.width / 2) - (menuWidth / 2);
            
            // 只有在下方空间确实不足时才移到上方（留出更大余量）
            const spaceBelow = window.innerHeight - (rect.bottom + iframeRect.top);
            if (spaceBelow < menuHeight + 30) {
                // 下方空间不足，移到上方
                top = rect.top + iframeRect.top + window.scrollY - menuHeight - 10;
                // 如果上方也没空间，还是放下方
                if (top < 10) {
                    top = rect.bottom + iframeRect.top + window.scrollY + 10;
                }
            }
            
            // 水平边界调整
            if (left < 10) {
                left = 10;
            }
            if (left + menuWidth > window.innerWidth - 10) {
                left = window.innerWidth - menuWidth - 10;
            }
            
            this.menu.style.top = `${top}px`;
            this.menu.style.left = `${left}px`;
            this.menu.style.visibility = 'visible';
            
            console.log('✅ 菜单已显示，位置:', { top, left, spaceBelow, menuHeight });
        } catch (error) {
            console.error('❌ 显示菜单失败:', error);
        }
    }

    hideMenu() {
        if (this.menu) {
            this.menu.classList.remove('show');
            this.currentCfiRange = null;
        }
    }

    applyHighlight(colorConfig) {
        if (!this.currentCfiRange) {
            console.warn('⚠️ 没有选中的文本范围');
            return;
        }
        
        try {
            const cfiRange = this.currentCfiRange;
            
            // Check if highlight already exists at this location with the same color
            const existingIndex = this.highlights.findIndex(h => 
                h.cfi === cfiRange && h.colorId === colorConfig.id
            );
            
            if (existingIndex !== -1) {
                // Toggle off: remove the existing highlight
                this.rendition.annotations.remove(cfiRange, 'highlight');
                this.highlights.splice(existingIndex, 1);
                this.saveHighlights();
                this.showToast(`已取消${colorConfig.label}高亮`);
                this.hideMenu();
                this.clearSelection();
                console.log('✅ 高亮已取消:', colorConfig.label);
                return;
            }
            
            // Check if there's a different color highlight at this location
            const differentColorIndex = this.highlights.findIndex(h => h.cfi === cfiRange);
            if (differentColorIndex !== -1) {
                // Remove old highlight first
                this.rendition.annotations.remove(cfiRange, 'highlight');
                this.highlights.splice(differentColorIndex, 1);
            }
            
            // Add highlight using epub.js annotations
            this.rendition.annotations.add(
                'highlight', 
                cfiRange, 
                { color: colorConfig.id }, 
                null,
                colorConfig.class,
                { 'fill': colorConfig.color, 'fill-opacity': '0.3' }
            );
            
            // Save to highlights list
            this.highlights.push({
                cfi: cfiRange,
                colorId: colorConfig.id,
                created: new Date().toISOString()
            });
            
            this.saveHighlights();
            this.showToast(`已添加${colorConfig.label}高亮`);
            this.hideMenu();
            
            // Clear selection
            this.clearSelection();
            
            console.log('✅ 高亮已应用:', colorConfig.label);
        } catch (error) {
            console.error('❌ 应用高亮失败:', error);
            this.showToast('添加高亮失败');
        }
    }

    async copyText() {
        if (!this.currentCfiRange) return;
        
        try {
            const range = this.rendition.getRange(this.currentCfiRange);
            const text = range.toString();
            
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板');
            this.hideMenu();
            console.log('✅ 文本已复制:', text.substring(0, 50) + '...');
        } catch (err) {
            console.error('❌ 复制失败:', err);
            this.showToast('复制失败');
        }
    }
    
    translateText() {
        if (!this.currentCfiRange) return;
        
        try {
            const range = this.rendition.getRange(this.currentCfiRange);
            const text = range.toString().trim();
            
            if (text) {
                const url = `https://translate.google.com/?sl=auto&tl=zh-CN&text=${encodeURIComponent(text)}&op=translate`;
                window.open(url, '_blank', 'width=800,height=600');
                this.showToast('正在打开翻译...');
                this.hideMenu();
                console.log('✅ 打开翻译:', text.substring(0, 50) + '...');
            }
        } catch (err) {
            console.error('❌ 翻译失败:', err);
            this.showToast('翻译失败');
        }
    }
    
    searchText() {
        if (!this.currentCfiRange) return;
        
        try {
            const range = this.rendition.getRange(this.currentCfiRange);
            const text = range.toString().trim();
            
            const searchInput = document.getElementById('search-input');
            if (searchInput && text) {
                searchInput.value = text;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.focus();
                this.showToast('已添加到搜索');
                this.hideMenu();
                console.log('✅ 搜索文本:', text);
            }
        } catch (err) {
            console.error('❌ 搜索失败:', err);
            this.showToast('搜索失败');
        }
    }

    addNote() {
        if (!this.currentCfiRange) return;
        
        try {
            const range = this.rendition.getRange(this.currentCfiRange);
            let text = range.toString();
            let cfi = this.currentCfiRange;
            
            // 检查当前CFI是否已有高亮，获取其颜色
            let existingHighlight = this.highlights.find(h => h.cfi === cfi);
            
            // 如果没有精确匹配，检查选中的文本是否在某个已存在的高亮范围内
            if (!existingHighlight) {
                existingHighlight = this.findContainingHighlight(cfi);
                if (existingHighlight) {
                    // 使用已存在高亮的 CFI 和文本
                    cfi = existingHighlight.cfi;
                    try {
                        const existingRange = this.rendition.getRange(existingHighlight.cfi);
                        if (existingRange) {
                            text = existingRange.toString();
                        }
                    } catch (e) {
                        console.warn('获取已存在高亮文本失败:', e);
                    }
                    console.log('✅ 检测到选中在已有高亮内，使用已有高亮:', existingHighlight.cfi);
                }
            }
            
            const existingColorId = existingHighlight ? existingHighlight.colorId : 'yellow';
            
            // 隐藏菜单
            this.hideMenu();
            
            // 派发事件，让笔记面板打开并进入编辑模式
            const event = new CustomEvent('openNotePanelForEdit', {
                detail: {
                    cfi: cfi,
                    text: text,
                    bookTitle: this.getBookTitle(),
                    bookId: this.getBookId(),
                    colorId: existingColorId  // 传递已有的高亮颜色
                }
            });
            window.dispatchEvent(event);
            
            console.log('✅ 打开笔记面板进行编辑，颜色:', existingColorId);
        } catch (err) {
            console.error('❌ 添加笔记失败:', err);
            this.showToast('添加笔记失败');
        }
    }
    
    // 获取当前书籍标题
    getBookTitle() {
        try {
            if (window.book && window.book.package && window.book.package.metadata) {
                return window.book.package.metadata.title || '未知书名';
            }
        } catch (e) {
            console.warn('获取书名失败:', e);
        }
        return '未知书名';
    }
    
    // 获取当前书籍ID（使用书名的hash作为ID）
    getBookId() {
        const title = this.getBookTitle();
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            const char = title.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'book_' + Math.abs(hash).toString(16);
    }
    
    // 获取当前书籍的所有笔记
    static getNotesForBook(bookId) {
        try {
            const notes = JSON.parse(localStorage.getItem('book-notes') || '[]');
            if (bookId) {
                return notes.filter(n => n.bookId === bookId);
            }
            return notes;
        } catch (e) {
            console.error('获取笔记失败:', e);
            return [];
        }
    }
    
    // 删除笔记
    static deleteNote(noteId) {
        try {
            let notes = JSON.parse(localStorage.getItem('book-notes') || '[]');
            notes = notes.filter(n => n.id !== noteId);
            localStorage.setItem('book-notes', JSON.stringify(notes));
            return true;
        } catch (e) {
            console.error('删除笔记失败:', e);
            return false;
        }
    }
    
    /**
     * 查找包含当前选中CFI的已存在高亮
     * @param {string} selectedCfi - 当前选中的CFI
     * @returns {Object|null} - 包含选中范围的高亮对象，或null
     */
    findContainingHighlight(selectedCfi) {
        if (!selectedCfi || this.highlights.length === 0) {
            return null;
        }
        
        try {
            // 获取选中范围
            const selectedRange = this.rendition.getRange(selectedCfi);
            if (!selectedRange || !selectedRange.startContainer) {
                return null;
            }
            
            // 遍历所有已存在的高亮，检查选中范围是否在其中
            for (const highlight of this.highlights) {
                try {
                    const highlightRange = this.rendition.getRange(highlight.cfi);
                    if (!highlightRange || !highlightRange.startContainer) {
                        continue;
                    }
                    
                    // 检查选中范围是否完全在高亮范围内
                    // 使用 compareBoundaryPoints 来比较范围
                    // START_TO_START: 选中的起点 >= 高亮的起点
                    // END_TO_END: 选中的终点 <= 高亮的终点
                    const startComparison = selectedRange.compareBoundaryPoints(Range.START_TO_START, highlightRange);
                    const endComparison = selectedRange.compareBoundaryPoints(Range.END_TO_END, highlightRange);
                    
                    // 如果选中范围的起点 >= 高亮起点 且 选中范围的终点 <= 高亮终点
                    // 则选中范围在高亮范围内
                    if (startComparison >= 0 && endComparison <= 0) {
                        console.log('🔍 找到包含选中范围的高亮:', highlight.cfi);
                        return highlight;
                    }
                } catch (e) {
                    // 跳过无法比较的高亮
                    continue;
                }
            }
        } catch (err) {
            console.warn('⚠️ 查找包含高亮失败:', err);
        }
        
        return null;
    }

    clearSelection() {
        try {
            this.rendition.getContents().forEach(contents => {
                const selection = contents.window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                }
            });
        } catch (err) {
            console.warn('⚠️ 清除选择失败:', err);
        }
    }

    saveHighlights() {
        try {
            localStorage.setItem('book-highlights', JSON.stringify(this.highlights));
            console.log('✅ 高亮已保存到本地');
        } catch (err) {
            console.error('❌ 保存高亮失败:', err);
        }
    }

    loadHighlights() {
        try {
            const saved = localStorage.getItem('book-highlights');
            if (saved) {
                this.highlights = JSON.parse(saved);
                console.log(`✅ 已加载 ${this.highlights.length} 个高亮`);
                
                if (this.highlights.length > 0) {
                    // 只注册一次，等待首次渲染完成后加载高亮
                    this.rendition.once('rendered', () => {
                        // 延迟执行，确保 DOM 完全准备好
                        setTimeout(() => {
                            this.restoreHighlightsToCurrentView();
                        }, 100);
                    });
                } else {
                    // 没有高亮需要恢复，直接标记为完成
                    this._highlightsRestored = true;
                }
            } else {
                // 没有保存的高亮，直接标记为完成
                this._highlightsRestored = true;
            }
        } catch (e) {
            console.error('❌ 加载高亮失败:', e);
            this._highlightsRestored = true; // 出错也标记为完成，允许后续操作
        }
    }
    
    restoreHighlightsToCurrentView() {
        // 防止重复加载
        if (this._highlightsRestored) {
            return;
        }
        this._highlightsRestored = true;
        
        console.log(`🔄 开始恢复 ${this.highlights.length} 个高亮...`);
        
        // 获取当前视图的 section index
        const currentViews = this.rendition.views();
        const currentSectionIndices = new Set();
        currentViews.forEach(view => {
            if (view && view.index !== undefined) {
                currentSectionIndices.add(view.index);
            }
        });
        
        let restoredCount = 0;
        let skippedCount = 0;
        
        // Restore highlights to the book with error handling
        this.highlights.forEach(h => {
            try {
                // 先验证 CFI 是否有效，尝试获取 range
                const range = this.rendition.getRange(h.cfi);
                
                // 如果无法获取 range，跳过这个高亮
                if (!range) {
                    skippedCount++;
                    console.warn('⚠️ 跳过无法解析的高亮:', h.cfi);
                    return;
                }
                
                // 验证 range 是否有有效的起始节点
                if (!range.startContainer) {
                    skippedCount++;
                    console.warn('⚠️ 跳过无起始节点的高亮:', h.cfi);
                    return;
                }
                
                const colorConfig = this.colors.find(c => c.id === h.colorId);
                if (colorConfig) {
                    // 只添加到 annotations 系统，让 epub.js 自动处理 attach 时机
                    this.rendition.annotations.add(
                        'highlight', 
                        h.cfi, 
                        { color: colorConfig.id }, 
                        null,
                        colorConfig.class,
                        { 'fill': colorConfig.color, 'fill-opacity': '0.3' }
                    );
                    restoredCount++;
                }
            } catch (err) {
                skippedCount++;
                console.warn('⚠️ 跳过无效高亮:', h.cfi, err.message);
            }
        });
        
        console.log(`✅ 高亮恢复完成: ${restoredCount} 个成功, ${skippedCount} 个跳过`);
    }
    
    /**
     * 显示临时高亮效果（类似浏览器搜索高亮）
     * @param {string} cfi - 要高亮的CFI位置
     * @param {number} duration - 高亮持续时间（毫秒），默认2500ms
     */
    showTemporaryHighlight(cfi, duration = 2500) {
        if (!cfi || !this.rendition) {
            console.warn('⚠️ 无法显示临时高亮：缺少CFI或rendition');
            return;
        }
        
        try {
            console.log('🔍 显示临时搜索高亮:', cfi);
            
            // 先验证 CFI 是否有效
            const range = this.rendition.getRange(cfi);
            if (!range || !range.startContainer) {
                console.warn('⚠️ 无法显示临时高亮：CFI无效');
                return;
            }
            
            // 添加临时高亮
            this.rendition.annotations.add(
                'highlight',
                cfi,
                { color: 'search-temp', temporary: true },
                null,
                'highlight-search-temp',
                { 'fill': '#FFDD00', 'fill-opacity': '0.6' }
            );
            
            // 设定时间后移除高亮
            setTimeout(() => {
                try {
                    this.rendition.annotations.remove(cfi, 'highlight');
                    console.log('✅ 临时高亮已移除');
                } catch (err) {
                    console.warn('⚠️ 移除临时高亮失败:', err);
                }
            }, duration);
            
        } catch (err) {
            console.error('❌ 显示临时高亮失败:', err);
        }
    }
    
    showToast(msg) {
        let toast = document.getElementById('highlight-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'highlight-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.85);
                color: white;
                padding: 12px 24px;
                border-radius: 24px;
                font-size: 14px;
                z-index: 1000000;
                pointer-events: none;
                transition: opacity 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2000);
    }
}

// Export to global scope
window.HighlightManager = HighlightManager;
