/**
 * macOS Books 风格的手势翻页导航 - V2 增强版
 * 支持触控板滑动和触摸滑动，带边缘区域保护
 */

class BooksGestureNavigation {
    constructor(rendition, options = {}) {
        this.rendition = rendition;
        this.options = {
            edgeSafeZoneWidth: options.edgeSafeZoneWidth || 80,
            minSwipeDistance: options.minSwipeDistance || 30,  // 降低阈值
            minSwipeVelocity: options.minSwipeVelocity || 0.2,  // 降低阈值
            enableTrackpad: options.enableTrackpad !== false,
            enableTouch: options.enableTouch !== false,
            showEdgeZones: options.showEdgeZones !== false,
            animationDuration: options.animationDuration || 300
        };
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isSwiping = false;
        this.wheelDeltaX = 0;
        
        this.init();
    }
    
    init() {
        console.log('🔧 初始化手势导航 V2...');
        console.log('⚙️ 配置:', this.options);
        
        const viewerElement = this.rendition.manager.container;
        console.log('📦 ViewerElement:', viewerElement);
        
        if (this.options.enableTouch) {
            this.setupTouchGestures(viewerElement);
            console.log('✅ 触摸手势已设置');
        }
        
        if (this.options.enableTrackpad) {
            this.setupTrackpadGestures(viewerElement);
            console.log('✅ 触控板手势已设置');
        }
        
        if (this.options.showEdgeZones) {
            this.createEdgeZones(viewerElement);
            console.log('✅ 边缘区域已创建');
        }
        
        console.log('📚 macOS Books 风格手势导航 V2 已启用');
    }
    
    setupTouchGestures(element) {
        element.addEventListener('touchstart', (e) => {
            if (!this.isInSafeZone(e.touches[0].clientX)) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
                this.touchStartTime = Date.now();
                this.isSwiping = true;
            }
        }, { passive: true });
        
        element.addEventListener('touchmove', (e) => {
            if (!this.isSwiping) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - this.touchStartX;
            const deltaY = touchY - this.touchStartY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                e.preventDefault();
            }
        }, { passive: false });
        
        element.addEventListener('touchend', (e) => {
            if (!this.isSwiping) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndTime = Date.now();
            
            const deltaX = touchEndX - this.touchStartX;
            const deltaY = touchEndY - this.touchStartY;
            const deltaTime = touchEndTime - this.touchStartTime;
            const velocity = Math.abs(deltaX) / deltaTime;
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && 
                (Math.abs(deltaX) > this.options.minSwipeDistance || velocity > this.options.minSwipeVelocity)) {
                
                if (deltaX > 0) {
                    this.navigateWithAnimation('prev');
                } else {
                    this.navigateWithAnimation('next');
                }
            }
            
            this.isSwiping = false;
        }, { passive: true });
    }
    
    setupTrackpadGestures(element) {
        let wheelTimeout = null;
        let accumulatedDelta = 0;
        
        console.log('🖱️ 设置触控板手势监听...');
        
        const handleWheel = (e) => {
            console.log('🔄 Wheel事件触发:', {
                deltaX: e.deltaX,
                deltaY: e.deltaY,
                clientX: e.clientX
            });
            
            // 只要有任何水平移动就处理
            if (e.deltaX !== 0) {
                console.log('➡️ 检测到水平滚动, deltaX:', e.deltaX);
                
                // 尝试阻止默认行为
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (err) {
                    console.warn('⚠️ 无法阻止默认行为:', err);
                }
                
                // 检查是否在边缘安全区域
                if (this.isInSafeZone(e.clientX)) {
                    console.log('🛡️ 在安全区域内，跳过');
                    return;
                }
                
                accumulatedDelta += e.deltaX;
                console.log('📊 累积滑动距离:', accumulatedDelta);
                
                if (wheelTimeout) {
                    clearTimeout(wheelTimeout);
                }
                
                wheelTimeout = setTimeout(() => {
                    console.log('⏱️ 滑动结束，累积距离:', accumulatedDelta);
                    
                    if (Math.abs(accumulatedDelta) > this.options.minSwipeDistance) {
                        if (accumulatedDelta > 0) {
                            console.log('📖 触发翻页：下一页');
                            this.navigateWithAnimation('next');
                        } else {
                            console.log('📖 触发翻页：上一页');
                            this.navigateWithAnimation('prev');
                        }
                    } else {
                        console.log('⚠️ 滑动距离不足 (' + Math.abs(accumulatedDelta) + ' < ' + this.options.minSwipeDistance + ')');
                    }
                    accumulatedDelta = 0;
                }, 150);
                
                return false;
            }
        };
        
        // 使用 capture 模式在捕获阶段就拦截事件
        document.addEventListener('wheel', handleWheel, { 
            passive: false, 
            capture: true  // 关键：在捕获阶段拦截
        });
        
        console.log('✅ Wheel事件监听器已添加（capture模式）');
    }
    
    isInSafeZone(clientX) {
        const windowWidth = window.innerWidth;
        const leftEdge = this.options.edgeSafeZoneWidth;
        const rightEdge = windowWidth - this.options.edgeSafeZoneWidth;
        const inZone = clientX < leftEdge || clientX > rightEdge;
        
        console.log('🔍 安全区域检查:', {
            clientX,
            windowWidth,
            leftEdge,
            rightEdge,
            inZone
        });
        
        return inZone;
    }
    
    createEdgeZones(viewerElement) {
        const leftZone = document.createElement('div');
        leftZone.id = 'edge-zone-left';
        leftZone.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${this.options.edgeSafeZoneWidth}px;
            height: 100%;
            pointer-events: none;
            background: linear-gradient(to right, rgba(0,0,0,0.02), transparent);
            z-index: 1000;
            transition: opacity 0.3s;
            opacity: 0;
        `;
        
        const rightZone = document.createElement('div');
        rightZone.id = 'edge-zone-right';
        rightZone.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            width: ${this.options.edgeSafeZoneWidth}px;
            height: 100%;
            pointer-events: none;
            background: linear-gradient(to left, rgba(0,0,0,0.02), transparent);
            z-index: 1000;
            transition: opacity 0.3s;
            opacity: 0;
        `;
        
        const container = viewerElement.parentElement;
        if (container) {
            container.style.position = 'relative';
            container.appendChild(leftZone);
            container.appendChild(rightZone);
            
            container.addEventListener('mouseenter', () => {
                leftZone.style.opacity = '1';
                rightZone.style.opacity = '1';
            });
            
            container.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    leftZone.style.opacity = '0';
                    rightZone.style.opacity = '0';
                }, 1000);
            });
        }
    }
    
    navigateWithAnimation(direction) {
        console.log('🎬 开始翻页动画:', direction);
        
        if (!this.rendition) {
            console.error('❌ Rendition 不存在');
            return;
        }
        
        console.log('✅ Rendition 存在，执行翻页');
        
        // 直接翻页，不添加复杂动画
        if (direction === 'next') {
            this.rendition.next();
        } else {
            this.rendition.prev();
        }
        
        console.log('✅ 翻页完成');
    }
    
    destroy() {
        const leftZone = document.getElementById('edge-zone-left');
        const rightZone = document.getElementById('edge-zone-right');
        if (leftZone) leftZone.remove();
        if (rightZone) rightZone.remove();
        
        console.log('📚 手势导航已销毁');
    }
}

window.BooksGestureNavigation = BooksGestureNavigation;
