/**
 * 极简卷曲翻页 - 全新实现
 */

class PageTurn {
    constructor(rendition, options = {}) {
        this.rendition = rendition;
        this.deltaX = 0;
        this.isAnimating = false;
        this.locked = false; // 手势锁，确保一次手势只翻一页
        this.iframes = new Set();
        this.boundHandlers = new Map();
        this.processedTs = 0; // 事件去重
        // 双指滑动翻页 - 禁用点击翻页
        this.twoFingerSwipeActive = false;
        this.twoFingerStartX = 0;
        this.twoFingerStartY = 0;
        this.twoFingerLastX = 0;
        this.minTwoFingerSwipeDistance = options.minTwoFingerSwipeDistance || 50; // 双指滑动最小距离
        
        // 参数
        this.gain = options.gain || 60; // 放大倍数，提升触控板 deltaX 的有效性
        this.thresholdPx = options.thresholdPx || 40; // 触发阈值（像素）
        this.commitDelay = options.commitDelay || 120; // 去抖时间
        this.cooldownMs = options.cooldownMs || 350; // 翻页冷却期
        this.fadeDuration = options.fadeDuration || 220; // 淡入淡出时长
        
        // DOM
        this.container = this.rendition.manager && this.rendition.manager.container;
        
        console.log('🆕 初始化翻页系统');
        this.setupGestures();
        this.hookRenditionFrames();
        
        // 初次绑定（容器中可能已经有 iframe）
        setTimeout(() => this.attachExistingIframes(), 0);
    }
    
    setupGestures() {
        this.commitTimer = null;
        
        const recordDelta = (dx, source, ts) => {
            if (this.locked || this.isAnimating) return;
            if (typeof ts === 'number' && ts === this.processedTs) return; // 去重
            this.processedTs = ts || 0;
            this.deltaX += dx;
            console.log(`📊 [${source}] 累积: ${this.deltaX.toFixed(2)}px`);
            this.scheduleCommit();
        };
        
        this._recordDelta = recordDelta; // 暴露给 frame 处理器使用
        
        // 检查是否有文本选中
        const hasActiveSelection = () => {
            try {
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length > 0) return true;
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    const iframeSel = iframe.contentDocument?.getSelection?.();
                    if (iframeSel && iframeSel.toString().trim().length > 0) return true;
                }
            } catch {}
            return false;
        };
        
        // 触控板双指滑动（wheel 事件）
        const onWheel = (e) => {
            // 如果有文本选中，不处理翻页
            if (hasActiveSelection()) return;
            // 只处理水平滑动
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            try { e.preventDefault(); } catch {}
            recordDelta(e.deltaX * this.gain, 'wheel', e.timeStamp);
        };
        
        // 双指触摸滑动翻页（移动设备）- 禁用单指点击翻页
        const onTouchStart = (e) => {
            // 只处理双指触摸
            if (!e.touches || e.touches.length !== 2) {
                this.twoFingerSwipeActive = false;
                return;
            }
            if (this.locked || this.isAnimating) return;
            
            // 计算双指中点
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            this.twoFingerStartX = (t1.clientX + t2.clientX) / 2;
            this.twoFingerStartY = (t1.clientY + t2.clientY) / 2;
            this.twoFingerLastX = this.twoFingerStartX;
            this.twoFingerSwipeActive = true;
            console.log('👆👆 双指触摸开始');
        };
        
        const onTouchMove = (e) => {
            // 只处理双指滑动
            if (!this.twoFingerSwipeActive || !e.touches || e.touches.length !== 2) {
                return;
            }
            
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentX = (t1.clientX + t2.clientX) / 2;
            this.twoFingerLastX = currentX;
            
            // 防止页面滚动
            try { e.preventDefault(); } catch {}
        };
        
        const onTouchEnd = (e) => {
            if (!this.twoFingerSwipeActive) return;
            if (this.locked || this.isAnimating) return;
            
            this.twoFingerSwipeActive = false;
            
            const deltaX = this.twoFingerLastX - this.twoFingerStartX;
            const absDeltaX = Math.abs(deltaX);
            
            console.log(`👆👆 双指滑动距离: ${deltaX.toFixed(2)}px`);
            
            if (absDeltaX >= this.minTwoFingerSwipeDistance) {
                if (deltaX < 0) {
                    console.log('👆👆 双指左滑 → 下一页');
                    this.turnPage('next');
                } else {
                    console.log('👆👆 双指右滑 → 上一页');
                    this.turnPage('prev');
                }
            }
        };
        
        // 绑定到 window（捕获阶段）- 只处理 wheel 和双指触摸
        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
        this.boundHandlers.set(window, { wheel: onWheel, touchStart: onTouchStart, touchMove: onTouchMove, touchEnd: onTouchEnd });
        
        console.log('✅ 手势已绑定（只允许双指滑动翻页）');
    }
    
    scheduleCommit() {
        if (this.commitTimer) clearTimeout(this.commitTimer);
        this.commitTimer = setTimeout(() => {
            if (Math.abs(this.deltaX) >= this.thresholdPx) {
                const dir = this.deltaX > 0 ? 'next' : 'prev';
                console.log(dir === 'next' ? '➡️ 触发下一页' : '⬅️ 触发上一页');
                this.turnPage(dir);
            } else {
                console.log('❌ 距离不够，不翻页');
            }
            this.deltaX = 0;
        }, this.commitDelay);
    }
    
    hookRenditionFrames() {
        if (!this.rendition || !this.rendition.on) return;
        // 在每次渲染/显示时绑定到 iframe 内部
        try {
            this.rendition.on('displayed', (view) => {
                // 每次显示新章节时，确保绑定手势，并在需要时执行淡入
                this.attachToView(view);
                if (this.pendingFadeIn) {
                    if (this.container) {
                        this.container.style.opacity = '1';
                        setTimeout(() => {
                            this.isAnimating = false;
                            this.locked = false;
                            this.container.style.transition = '';
                            this.container.style.willChange = '';
                        }, this.fadeDuration + this.cooldownMs);
                    }
                    this.pendingFadeIn = false;
                }
            });
            this.rendition.on('rendered', (section, view) => {
                this.attachToView(view);
            });
        } catch (err) {
            console.warn('⚠️ 无法绑定 rendition 事件:', err);
        }
    }

    attachExistingIframes() {
        const container = this.rendition && this.rendition.manager && this.rendition.manager.container;
        if (!container) return;
        const iframes = container.querySelectorAll('iframe');
        iframes.forEach((iframe) => this.attachToIframe(iframe));
    }

    attachToView(view) {
        if (!view) return;
        const iframe = view.iframe || (view.document && view.document.defaultView && view.document.defaultView.frameElement);
        if (iframe) this.attachToIframe(iframe);
    }

    attachToIframe(iframe) {
        if (!iframe || this.iframes.has(iframe)) return;
        try {
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument;
            const handler = (e) => {
                // 检查是否有文本选中
                const frameSel = doc.getSelection && doc.getSelection();
                if (frameSel && frameSel.toString().trim().length > 0) return;
                // 只处理水平滑动
                if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
                try { e.preventDefault(); } catch {}
                const dx = e.deltaX * this.gain;
                this._recordDelta(dx, 'frame', e.timeStamp);
            };
            // 双指触摸滑动翻页（iframe 内）- 禁用单指点击
            const tStart = (e) => {
                // 只处理双指触摸
                if (!e.touches || e.touches.length !== 2) {
                    this.twoFingerSwipeActive = false;
                    return;
                }
                if (this.locked || this.isAnimating) return;
                
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                this.twoFingerStartX = (t1.clientX + t2.clientX) / 2;
                this.twoFingerLastX = this.twoFingerStartX;
                this.twoFingerSwipeActive = true;
                console.log('👆👆(frame) 双指触摸开始');
            };
            const tMove = (e) => {
                if (!this.twoFingerSwipeActive || !e.touches || e.touches.length !== 2) {
                    return;
                }
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                this.twoFingerLastX = (t1.clientX + t2.clientX) / 2;
                try { e.preventDefault(); } catch {}
            };
            const tEnd = (e) => {
                if (!this.twoFingerSwipeActive) return;
                if (this.locked || this.isAnimating) return;
                
                this.twoFingerSwipeActive = false;
                
                const deltaX = this.twoFingerLastX - this.twoFingerStartX;
                const absDeltaX = Math.abs(deltaX);
                
                console.log(`👆👆(frame) 双指滑动距离: ${deltaX.toFixed(2)}px`);
                
                if (absDeltaX >= this.minTwoFingerSwipeDistance) {
                    if (deltaX < 0) {
                        console.log('👆👆(frame) 双指左滑 → 下一页');
                        this.turnPage('next');
                    } else {
                        console.log('👆👆(frame) 双指右滑 → 上一页');
                        this.turnPage('prev');
                    }
                }
            };

            win.addEventListener('wheel', handler, { passive: false, capture: true });
            doc.addEventListener('wheel', handler, { passive: false, capture: true });
            win.addEventListener('touchstart', tStart, { passive: true, capture: true });
            doc.addEventListener('touchstart', tStart, { passive: true, capture: true });
            win.addEventListener('touchmove', tMove, { passive: false, capture: true });
            doc.addEventListener('touchmove', tMove, { passive: false, capture: true });
            win.addEventListener('touchend', tEnd, { passive: true, capture: true });
            doc.addEventListener('touchend', tEnd, { passive: true, capture: true });
            this.iframes.add(iframe);
            this.boundHandlers.set(iframe, { wheel: handler, touchStart: tStart, touchMove: tMove, touchEnd: tEnd });
            console.log('✅ 已绑定 iframe 手势监听');
        } catch (err) {
            console.warn('⚠️ 绑定 iframe 失败:', err);
        }
    }

    turnPage(direction) {
        if (this.locked) return;
        this.locked = true;
        this.isAnimating = true;
        
        console.log(`🎬 执行翻页: ${direction}`);
        
        // 淡出
        if (this.container) {
            this.container.style.willChange = 'opacity';
            this.container.style.transition = `opacity ${this.fadeDuration}ms ease`;
            this.container.style.opacity = '0';
        }
        
        // 在淡出中途执行翻页
        setTimeout(() => {
            if (direction === 'next') {
                this.rendition.next();
            } else {
                this.rendition.prev();
            }
        }, Math.max(50, Math.floor(this.fadeDuration * 0.45)));
        
        // 在内容显示后淡入（监听 displayed/rendered 任一事件即可）
        const fadeIn = () => {
            if (!this.container) return;
            this.container.style.opacity = '1';
            setTimeout(() => {
                this.isAnimating = false;
                this.locked = false;
                // 清理
                this.container.style.transition = '';
                this.container.style.willChange = '';
            }, this.fadeDuration + this.cooldownMs);
        };
        
        // 保险：如果事件机制不可用，使用延时淡入
        setTimeout(fadeIn, this.fadeDuration + 60);
        this.pendingFadeIn = true;
    }

    destroy() {
        // 解绑 window
        const winHandlers = this.boundHandlers.get(window);
        if (winHandlers) {
            try { window.removeEventListener('wheel', winHandlers.wheel, { capture: true }); } catch {}
            try { window.removeEventListener('touchstart', winHandlers.touchStart, { capture: true }); } catch {}
            try { window.removeEventListener('touchmove', winHandlers.touchMove, { capture: true }); } catch {}
            try { window.removeEventListener('touchend', winHandlers.touchEnd, { capture: true }); } catch {}
        }
        // 解绑 iframes
        this.iframes.forEach((iframe) => {
            const rec = this.boundHandlers.get(iframe);
            try {
                if (rec && iframe.contentWindow) {
                    iframe.contentWindow.removeEventListener('wheel', rec.wheel, { capture: true });
                    iframe.contentWindow.removeEventListener('touchstart', rec.touchStart, { capture: true });
                    iframe.contentWindow.removeEventListener('touchmove', rec.touchMove, { capture: true });
                    iframe.contentWindow.removeEventListener('touchend', rec.touchEnd, { capture: true });
                }
                if (rec && iframe.contentDocument) {
                    iframe.contentDocument.removeEventListener('wheel', rec.wheel, { capture: true });
                    iframe.contentDocument.removeEventListener('touchstart', rec.touchStart, { capture: true });
                    iframe.contentDocument.removeEventListener('touchmove', rec.touchMove, { capture: true });
                    iframe.contentDocument.removeEventListener('touchend', rec.touchEnd, { capture: true });
                }
            } catch {}
        });
        this.iframes.clear();
        this.boundHandlers.clear();
    }
}

window.PageTurn = PageTurn;
console.log('✅ PageTurn 已加载');
