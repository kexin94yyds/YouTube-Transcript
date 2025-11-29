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
        
        this.colors = [
            { id: 'yellow', color: '#FFD54F', label: '黄色', class: 'highlight-yellow' },
            { id: 'green', color: '#81C784', label: '绿色', class: 'highlight-green' },
            { id: 'blue', color: '#64B5F6', label: '蓝色', class: 'highlight-blue' },
            { id: 'pink', color: '#F06292', label: '粉色', class: 'highlight-pink' },
            { id: 'purple', color: '#CE93D8', label: '紫色', class: 'highlight-purple' },
            { id: 'underline', color: 'transparent', label: '下划线', class: 'highlight-underline', isUnderline: true }
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

            .color-btn.underline {
                background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
                border: 1.5px solid #ddd;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .color-btn.underline::after {
                content: 'U';
                font-size: 16px;
                color: #E91E63;
                font-weight: 600;
                text-decoration: underline;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
                    background-color: rgba(255, 213, 79, 0.4) !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-green {
                    background-color: rgba(129, 199, 132, 0.4) !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-blue {
                    background-color: rgba(100, 181, 246, 0.4) !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-pink {
                    background-color: rgba(240, 98, 146, 0.4) !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-purple {
                    background-color: rgba(206, 147, 216, 0.3) !important;
                    transition: background-color 0.2s ease;
                }
                .highlight-underline {
                    background: transparent !important;
                    border-bottom: 2px solid #E91E63 !important;
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
                label: '复制', 
                icon: '📋', 
                action: () => this.copyText() 
            },
            {
                label: '翻译',
                icon: '🌐',
                action: () => this.translateText()
            },
            {
                label: '搜索',
                icon: '🔍',
                action: () => this.searchText()
            },
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
            
            // Calculate position (centered above selection)
            let top = rect.top + iframeRect.top + window.scrollY - this.menu.offsetHeight - 10;
            let left = rect.left + iframeRect.left + window.scrollX + (rect.width / 2) - (this.menu.offsetWidth / 2);
            
            // Adjust if menu goes off screen
            if (top < 10) {
                top = rect.bottom + iframeRect.top + window.scrollY + 10;
            }
            if (left < 10) {
                left = 10;
            }
            if (left + this.menu.offsetWidth > window.innerWidth - 10) {
                left = window.innerWidth - this.menu.offsetWidth - 10;
            }
            
            this.menu.style.top = `${top}px`;
            this.menu.style.left = `${left}px`;
            this.menu.classList.add('show');
            
            console.log('✅ 菜单已显示');
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
            const text = range.toString();
            const cfi = this.currentCfiRange;
            
            // 隐藏菜单
            this.hideMenu();
            
            // 派发事件，让笔记面板打开并进入编辑模式
            const event = new CustomEvent('openNotePanelForEdit', {
                detail: {
                    cfi: cfi,
                    text: text
                }
            });
            window.dispatchEvent(event);
            
            console.log('✅ 打开笔记面板进行编辑');
        } catch (err) {
            console.error('❌ 添加笔记失败:', err);
            this.showToast('添加笔记失败');
        }
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
                
                // Restore highlights to the book
                this.highlights.forEach(h => {
                    const colorConfig = this.colors.find(c => c.id === h.colorId);
                    if (colorConfig) {
                        this.rendition.annotations.add(
                            'highlight', 
                            h.cfi, 
                            { color: colorConfig.id }, 
                            null,
                            colorConfig.class,
                            { 'fill': colorConfig.color, 'fill-opacity': '0.3' }
                        );
                    }
                });
            }
        } catch (e) {
            console.error('❌ 加载高亮失败:', e);
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
