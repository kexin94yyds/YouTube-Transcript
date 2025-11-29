// ==================== 高级功能控制 ====================
// 用于控制功能的锁定和解锁

// 检查用户是否为付费用户
function isPremiumUser() {
    return localStorage.getItem('isPremiumUser') === 'true';
}

// 锁定高级功能
function lockPremiumFeatures() {
    console.log('🔒 锁定高级功能');
    
    // 获取所有需要付费的功能
    const premiumFeatures = document.querySelectorAll('.premium-feature');
    
    premiumFeatures.forEach(feature => {
        if (!isPremiumUser() && !checkTrialUsage()) {
            // 添加锁定样式
            feature.classList.add('premium-locked');
            
            // 添加锁定图标
            if (!feature.querySelector('.lock-icon')) {
                const lockIcon = document.createElement('div');
                lockIcon.className = 'lock-icon';
                lockIcon.innerHTML = '🔒';
                lockIcon.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    font-size: 24px;
                    z-index: 20;
                `;
                feature.style.position = 'relative';
                feature.appendChild(lockIcon);
            }
            
            // 添加点击事件，显示购买提示
            feature.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showPremiumPrompt();
            }, true);
        }
    });
}

// 解锁高级功能
function unlockPremiumFeatures() {
    console.log('🔓 解锁高级功能');
    
    const premiumFeatures = document.querySelectorAll('.premium-feature');
    
    premiumFeatures.forEach(feature => {
        feature.classList.remove('premium-locked');
        
        // 移除锁定图标
        const lockIcon = feature.querySelector('.lock-icon');
        if (lockIcon) {
            lockIcon.remove();
        }
    });
}

// 显示购买提示
function showPremiumPrompt() {
    const lockMessage = document.getElementById('premium-lock-message');
    if (lockMessage) {
        lockMessage.style.display = 'block';
        
        // 添加点击背景关闭功能
        lockMessage.addEventListener('click', (e) => {
            if (e.target === lockMessage) {
                hidePremiumPrompt();
            }
        });
    }
}

// 隐藏购买提示
function hidePremiumPrompt() {
    const lockMessage = document.getElementById('premium-lock-message');
    if (lockMessage) {
        lockMessage.style.display = 'none';
    }
}

// 检查用户权限（当用户使用高级功能时调用）
function usePremiumFeature() {
    if (isPremiumUser()) {
        return true; // 付费用户无限制使用
    } else {
        // 未付费用户，显示购买提示
        showPremiumPrompt();
        return false;
    }
}



// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Premium Control 初始化');
    
    // 等待 payment.js 初始化完成
    setTimeout(() => {
        const isPremium = isPremiumUser();
        
        console.log(`付费状态: ${isPremium ? '已付费' : '未付费'}`);
        
        if (!isPremium) {
            // 未付费用户，锁定功能
            lockPremiumFeatures();
        } else {
            // 付费用户，解锁所有功能
            unlockPremiumFeatures();
        }
    }, 1000);
});

// 导出函数供外部使用
window.premiumControl = {
    isPremium: isPremiumUser,
    useFeature: usePremiumFeature,
    lock: lockPremiumFeatures,
    unlock: unlockPremiumFeatures,
    showPrompt: showPremiumPrompt,
    hidePrompt: hidePremiumPrompt
};

