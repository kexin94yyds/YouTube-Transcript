/**
 * macOS Books 风格的手势翻页导航
 * 支持触控板滑动和触摸滑动，带边缘区域保护
 */

class BooksGestureNavigation {
    constructor(rendition, options = {}) {
        this.rendition = rendition;
        this.options = {
            // 边缘安全区域宽度（像素）
            edgeSafeZoneWidth: options.edgeSafeZoneWidth || 80,
            // 最小滑动距离触发翻页（像素）
            minSwipeDistance: options.minSwipeDistance || 50,
            // 滑动速度阈值（像素/毫秒）
            minSwipeVelocity: options.minSwipeVelocity || 0.3,
            // 是否启用触控板手势
            enableTrackpad: options.enableTrackpad !== false,
            // 是否启用触摸手势
            enableTouch: options.enableTouch !== false,
            // 是否显示边缘区域视觉提示
            showEdgeZones: options.showEdgeZones !== false,
            // 翻页动画持续时间（毫秒）
            animationDuration: options.animationDuration || 400
        };
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isSwiping = false;
        this.wheelDeltaX = 0;
        this.isNavigating = false; // 防止重复翻页
        
        this.init();
    }
    
    init() {
        const viewerElement = this.rendition.manager.container;
        
        console.log('🔧 初始化手势导航...');
        console.log('📦 ViewerElement:', viewerElement);
        console.log('⚙️ 配置:', this.options);
        
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
        
        console.log('📚 macOS Books 风格手势导航已启用');
    }
    
    /**
     * 设置触摸手势
     */
    setupTouchGestures(element) {
        element.addEventListener('touchstart', (e) => {
            // 检查是否在边缘安全区域内
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
            
            // 判断是否为水平滑动（而不是垂直滚动）
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
            
            // 判断是否为有效的水平滑动
            if (Math.abs(deltaX) > Math.abs(deltaY) && 
                (Math.abs(deltaX) > this.options.minSwipeDistance || velocity > this.options.minSwipeVelocity)) {
                
                if (deltaX > 0) {
                    // 右滑 - 上一页
                    this.navigateWithAnimation('prev');
                } else {
                    // 左滑 - 下一页
                    this.navigateWithAnimation('next');
                }
            }
            
            this.isSwiping = false;
        }, { passive: true });
    }
    
    /**
     * 设置触控板手势
     */
    setupTrackpadGestures(element) {
        let wheelTimeout = null;
        let accumulatedDelta = 0;
        let lastWheelTime = 0;
        let hasTriggered = false; // 防止一次手势多次触发
        
        console.log('🖱️ 设置触控板手势监听');
        
        const target = document;
        
        target.addEventListener('wheel', (e) => {
            // 检测水平滚动（触控板双指滑动）
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                
                // 如果正在翻页，忽略所有手势
                if (this.isNavigating) {
                    console.log('🚫 翻页中，忽略手势');
                    return;
                }
                
                // 检查是否在边缘安全区域
                if (this.isInSafeZone(e.clientX)) {
                    return;
                }
                
                const currentTime = Date.now();
                
                // 检查是否是新的手势（距离上次滚动超过300ms）
                if (currentTime - lastWheelTime > 300) {
                    accumulatedDelta = 0;
                    hasTriggered = false;
                    console.log('🆕 新手势开始');
                }
                lastWheelTime = currentTime;
                
                // 如果这次手势已经触发过翻页，忽略后续滚动
                if (hasTriggered) {
                    console.log('⏸️ 已触发，忽略');
                    return;
                }
                
                accumulatedDelta += e.deltaX;
                console.log('📊 累积:', accumulatedDelta.toFixed(1));
                
                // 清除之前的超时
                if (wheelTimeout) {
                    clearTimeout(wheelTimeout);
                }
                
                // 检查是否达到阈值
                if (Math.abs(accumulatedDelta) > this.options.minSwipeDistance) {
                    hasTriggered = true; // 标记为已触发
                    
                    if (accumulatedDelta > 0) {
                        console.log('➡️ 翻页: 下一页');
                        this.navigateWithAnimation('next');
                    } else {
                        console.log('⬅️ 翻页: 上一页');
                        this.navigateWithAnimation('prev');
                    }
                    
                    // 重置累积值
                    accumulatedDelta = 0;
                    
                    // 设置超时重置 hasTriggered
                    setTimeout(() => {
                        hasTriggered = false;
                    }, 500);
                } else {
                    // 设置超时，如果没有达到阈值就重置
                    wheelTimeout = setTimeout(() => {
                        console.log('⏱️ 手势结束，未达阈值');
                        accumulatedDelta = 0;
                        hasTriggered = false;
                    }, 150);
                }
            }
        }, { passive: false });
        
        console.log('✅ 触控板手势已启用');
    }
    
    /**
     * 检查点击位置是否在边缘安全区域内
     */
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
    
    /**
     * 创建边缘区域视觉提示
     */
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
        
        // 设置 viewer 容器为相对定位
        const container = viewerElement.parentElement;
        if (container) {
            container.style.position = 'relative';
            container.appendChild(leftZone);
            container.appendChild(rightZone);
            
            // 添加悬停效果来显示边缘区域
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
    
    /**
     * 带动画的翻页导航 - 极简流畅版
     */
    navigateWithAnimation(direction) {
        console.log('🎬 翻页:', direction);
        
        if (!this.rendition) {
            console.error('❌ Rendition 不存在');
            return;
        }
        
        // 严格的防抖：正在翻页中直接返回
        if (this.isNavigating) {
            console.log('⏸️ 正在翻页中，忽略');
            return;
        }
        
        // 立即锁定
        this.isNavigating = true;
        
        const container = this.rendition.manager.container;
        
        // 简单高效的淡入淡出动画
        container.style.transition = `opacity 200ms ease-in-out`;
        container.style.opacity = '0.3';
        
        // 等待淡出完成后翻页
        setTimeout(() => {
            // 执行翻页
            if (direction === 'next') {
                this.rendition.next();
            } else {
                this.rendition.prev();
            }
            
            // 立即开始淡入
            setTimeout(() => {
                container.style.opacity = '1';
                
                // 动画结束后解锁并清理
                setTimeout(() => {
                    container.style.transition = '';
                    this.isNavigating = false;
                    console.log('✅ 翻页完成');
                }, 200);
            }, 20);
        }, 200);
    }
    
    /**
     * 销毁手势导航
     */
    destroy() {
        // 移除边缘区域
        const leftZone = document.getElementById('edge-zone-left');
        const rightZone = document.getElementById('edge-zone-right');
        if (leftZone) leftZone.remove();
        if (rightZone) rightZone.remove();
        
        console.log('📚 手势导航已销毁');
    }
}

// 导出到全局作用域
window.BooksGestureNavigation = BooksGestureNavigation;
