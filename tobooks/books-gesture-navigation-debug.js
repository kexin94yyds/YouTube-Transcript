/**
 * macOS Books 风格的手势翻页导航 - 调试版
 * 专门用于排查问题
 */

class BooksGestureNavigation {
    constructor(rendition, options = {}) {
        this.rendition = rendition;
        this.options = {
            edgeSafeZoneWidth: options.edgeSafeZoneWidth || 80,
            minSwipeDistance: options.minSwipeDistance || 30,
            minSwipeVelocity: options.minSwipeVelocity || 0.2,
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
        this.eventCount = 0;
        
        this.init();
    }
    
    init() {
        console.log('%c========== 手势导航调试版 V3 ==========', 'color: #00ff00; font-weight: bold; font-size: 16px;');
        console.log('⚙️ 配置:', this.options);
        
        const viewerElement = this.rendition.manager.container;
        console.log('📦 ViewerElement:', viewerElement);
        
        if (this.options.enableTrackpad) {
            this.setupTrackpadGestures(viewerElement);
        }
        
        console.log('%c========== 初始化完成，开始监听 ==========', 'color: #00ff00; font-weight: bold;');
    }
    
    setupTrackpadGestures(element) {
        let wheelTimeout = null;
        let accumulatedDelta = 0;
        let lastLogTime = 0;
        
        console.log('🖱️ 设置触控板手势监听...');
        
        const handleWheel = (e) => {
            this.eventCount++;
            const now = Date.now();
            
            // 只每隔100ms记录一次，避免日志过多
            if (now - lastLogTime > 100) {
                console.log(`%c[事件 ${this.eventCount}] Wheel 事件`, 'color: #0066ff; font-weight: bold;', {
                    deltaX: e.deltaX.toFixed(2),
                    deltaY: e.deltaY.toFixed(2),
                    clientX: e.clientX,
                    target: e.target.tagName
                });
                lastLogTime = now;
            }
            
            // ============ 关键检查点 1: deltaX 是否为0 ============
            if (e.deltaX === 0) {
                console.log('%c✖️ deltaX = 0，跳过', 'color: #ff6600;');
                return;
            }
            
            console.log(`%c✔️ deltaX = ${e.deltaX}，继续处理`, 'color: #00cc00;');
            
            // ============ 关键检查点 2: 阻止默认行为 ============
            try {
                e.preventDefault();
                e.stopPropagation();
                console.log('%c✔️ 已阻止默认行为', 'color: #00cc00;');
            } catch (err) {
                console.log('%c✖️ 无法阻止默认行为:', 'color: #ff0000;', err);
            }
            
            // ============ 关键检查点 3: 安全区域检查 ============
            const inSafeZone = this.isInSafeZone(e.clientX);
            if (inSafeZone) {
                console.log('%c✖️ 在安全区域内，跳过', 'color: #ff6600;');
                return;
            }
            console.log('%c✔️ 不在安全区域，继续', 'color: #00cc00;');
            
            // ============ 关键检查点 4: 累积距离 ============
            accumulatedDelta += e.deltaX;
            console.log(`%c📊 累积距离: ${accumulatedDelta.toFixed(2)} (需要 ${this.options.minSwipeDistance})`, 
                        accumulatedDelta > 0 ? 'color: #ff9900;' : 'color: #9900ff;');
            
            if (wheelTimeout) {
                clearTimeout(wheelTimeout);
            }
            
            // ============ 关键检查点 5: 触发翻页 ============
            wheelTimeout = setTimeout(() => {
                console.log('%c⏰ 滑动停止，准备判断...', 'color: #ffcc00; font-weight: bold;');
                console.log(`累积距离: ${accumulatedDelta.toFixed(2)}`);
                console.log(`阈值: ${this.options.minSwipeDistance}`);
                console.log(`是否超过阈值: ${Math.abs(accumulatedDelta) > this.options.minSwipeDistance}`);
                
                if (Math.abs(accumulatedDelta) > this.options.minSwipeDistance) {
                    const direction = accumulatedDelta > 0 ? 'next' : 'prev';
                    console.log(`%c✅ 触发翻页: ${direction}`, 'color: #00ff00; font-weight: bold; font-size: 14px;');
                    
                    // ============ 关键检查点 6: 执行翻页 ============
                    this.navigateWithAnimation(direction);
                } else {
                    console.log(`%c✖️ 距离不足，未翻页 (${Math.abs(accumulatedDelta).toFixed(2)} < ${this.options.minSwipeDistance})`, 
                               'color: #ff0000; font-weight: bold;');
                }
                accumulatedDelta = 0;
            }, 150);
        };
        
        // 使用 capture 模式
        document.addEventListener('wheel', handleWheel, { 
            passive: false, 
            capture: true
        });
        
        console.log('%c✅ Wheel 监听器已添加（capture 模式）', 'color: #00ff00; font-weight: bold;');
    }
    
    isInSafeZone(clientX) {
        const windowWidth = window.innerWidth;
        const leftEdge = this.options.edgeSafeZoneWidth;
        const rightEdge = windowWidth - this.options.edgeSafeZoneWidth;
        const inZone = clientX < leftEdge || clientX > rightEdge;
        
        if (inZone) {
            console.log(`🛡️ 安全区域: clientX=${clientX}, 左边缘=${leftEdge}, 右边缘=${rightEdge}`);
        }
        
        return inZone;
    }
    
    navigateWithAnimation(direction) {
        console.log(`%c🎬 开始翻页: ${direction}`, 'color: #ff00ff; font-weight: bold; font-size: 16px;');
        
        // ============ 关键检查点 7: rendition 是否存在 ============
        if (!this.rendition) {
            console.log('%c✖️ 错误：rendition 不存在！', 'color: #ff0000; font-weight: bold;');
            return;
        }
        console.log('%c✔️ rendition 存在', 'color: #00cc00;');
        
        // ============ 关键检查点 8: 执行翻页方法 ============
        try {
            if (direction === 'next') {
                console.log('调用 rendition.next()...');
                this.rendition.next();
            } else {
                console.log('调用 rendition.prev()...');
                this.rendition.prev();
            }
            console.log('%c✅ 翻页命令已执行', 'color: #00ff00; font-weight: bold;');
        } catch (err) {
            console.log('%c✖️ 翻页失败:', 'color: #ff0000; font-weight: bold;', err);
        }
    }
    
    createEdgeZones(viewerElement) {
        // 简化版，不创建视觉提示
    }
    
    setupTouchGestures(element) {
        // 暂时禁用触摸手势，专注于触控板
    }
    
    destroy() {
        console.log('📚 手势导航已销毁');
    }
}

window.BooksGestureNavigation = BooksGestureNavigation;
console.log('%c✅ 调试版手势导航类已加载', 'color: #00ff00; font-weight: bold;');
