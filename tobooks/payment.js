// ==================== 微信支付功能 ====================
// EPUB 阅读器专用支付集成

const PAYMENT_CONFIG = {
    API_URL: 'https://wechat-y-server-vjfbztievl.cn-shanghai.fcapp.run', // 阿里云FC支付服务器地址
    PRODUCT_INFO: {
        id: 'tobooks_premium',
        name: 'Tobooks完整版',
        price: 199.00,
        amount: 19900  // 价格（分）
    },
    DEV_MODE: false  // 设为false启用真实支付
};


// ==================== 支付状态管理 ====================

// 检查用户是否为付费用户
async function isPremiumUser() {
    // 首先检查本地存储
    const localPremium = localStorage.getItem('isPremiumUser') === 'true';
    if (localPremium) {
        return true;
    }
    
    // 检查数据库中的付费状态
    try {
        const userData = window.userAuth?.getUserData();
        if (!userData) {
            return false;
        }

        const supabase = window.supabaseClient?.getClient();
        if (!supabase) {
            return false;
        }

        // 查询数据库中的付费状态
        const { data: premiumUser, error } = await supabase
            .from('premium_users')
            .select('is_active, payment_status')
            .eq('email', userData.email)
            .eq('is_active', true)
            .single();

        if (error || !premiumUser) {
            return false;
        }

        // 如果数据库中有付费记录，更新本地存储
        if (premiumUser.is_active && premiumUser.payment_status === 'paid') {
            localStorage.setItem('isPremiumUser', 'true');
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ 检查付费状态失败:', error);
        return false;
    }
}

// 检查白名单状态
async function checkWhitelist(userData = null) {
    const supabase = window.supabaseClient?.getClient();
    if (!supabase) {
        console.log('Supabase 未初始化');
        return false;
    }
    
    try {
        // 优先使用传入的用户数据，否则从 Supabase 获取
        let user = userData;
        
        if (!user) {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session?.user) {
                console.log('用户未登录');
                return false;
            }
            user = session.user;
        }
        
        if (!user || !user.email) {
            console.log('用户数据无效或邮箱为空');
            return false;
        }
        
        console.log('检查白名单状态，用户邮箱:', user.email);
        
        // 硬编码白名单（绕过 Supabase 权限问题）
        const HARDCODED_WHITELIST = [
            'ymx94yyds@gmail.com',
            'kexin94yyds@gmail.com',
            'gdrsdrfgret@gmail.com',
            'sp1314fqn@gmail.com',
            'bertonekyoko@gmail.com',
            'yangwenhui619@gmail.com',
            'jinhui9966@gmail.com',
            'p1127622840@gmail.com'
        ];
        
        if (HARDCODED_WHITELIST.includes(user.email.toLowerCase())) {
            console.log('✅ 用户在硬编码白名单中，自动解锁（白名单用户）');
            localStorage.setItem('isPremiumUser', 'true');
            localStorage.setItem('whitelistUser', 'true');  // 硬编码的是白名单，不是付费
            return true;
        }
        
        // 查询白名单（premium_users 表）
        // 兼容旧项目的 site 值：epub-reader；当前项目使用 tobooks；all 表示全站通用
        const { data: whitelistUser, error: queryError } = await supabase
            .from('premium_users')
            .select('*')
            .eq('email', user.email)
            .eq('is_active', true)
            .or('site.eq.tobooks,site.eq.epub-reader,site.eq.all')  // 支持站点区分
            .single();
        
        if (queryError && queryError.code !== 'PGRST116') {
            console.error('查询白名单失败:', queryError);
            return false;
        }
        
        if (whitelistUser) {
            console.log('✅ 用户在白名单中，自动解锁:', whitelistUser);
            localStorage.setItem('isPremiumUser', 'true');
            
            // 区分付费用户和白名单用户
            if (whitelistUser.payment_status === 'paid') {
                localStorage.setItem('whitelistUser', 'false');
                console.log('💎 付费用户');
            } else {
                localStorage.setItem('whitelistUser', 'true');
                console.log('✨ 白名单用户');
            }
            
            return true;
        }
        
        console.log('用户不在白名单中');
        return false;
        
    } catch (error) {
        console.error('检查白名单异常:', error);
        return false;
    }
}


// ==================== 支付功能 ====================

// 显示错误提示
function showError(message, type = 'error') {
    // 创建错误提示元素
    const errorDiv = document.createElement('div');
    errorDiv.className = `payment-error ${type}`;
    errorDiv.innerHTML = `
        <div class="error-content">
            <div class="error-icon">${type === 'error' ? '❌' : '⚠️'}</div>
            <div class="error-message">${message}</div>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(errorDiv);
    
    // 自动移除
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// 创建支付订单
async function createPaymentOrder() {
    try {
        // 使用新的用户认证模块获取用户数据
        const userData = window.userAuth?.getUserData();
        if (!userData) {
            throw new Error('请先登录');
        }
        
        console.log('💳 创建支付订单，用户:', userData.email);
        
        // 检查支付服务器连接
        try {
            const healthCheck = await fetch(`${PAYMENT_CONFIG.API_URL}/api/health`, {
                method: 'GET',
                timeout: 5000
            });
        } catch (healthError) {
            throw new Error('支付服务器连接失败，请稍后重试');
        }
        
        const response = await fetch(`${PAYMENT_CONFIG.API_URL}/api/create-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoId: PAYMENT_CONFIG.PRODUCT_INFO.id,  // 保持与服务器端一致
                videoTitle: PAYMENT_CONFIG.PRODUCT_INFO.name,  // 保持与服务器端一致
                amount: PAYMENT_CONFIG.PRODUCT_INFO.amount,
                userEmail: userData.email,
                userId: userData.id
            })
        });
        
        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '创建订单失败');
        }
        
        return {
            success: true,
            orderNo: data.orderNo,
            codeUrl: data.codeUrl || data.code_url  // 兼容两种命名方式
        };
        
    } catch (error) {
        console.error('❌ 创建支付订单失败:', error);
        
        // 显示用户友好的错误提示
        let userMessage = '创建订单失败';
        if (error.message.includes('登录')) {
            userMessage = '请先登录后再购买';
        } else if (error.message.includes('连接失败')) {
            userMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('服务器错误')) {
            userMessage = '服务器暂时不可用，请稍后重试';
        } else if (error.message) {
            userMessage = error.message;
        }
        
        showError(userMessage);
        
        return {
            success: false,
            message: userMessage
        };
    }
}

// 查询支付状态
async function checkPaymentStatus(orderNo) {
    try {
        const response = await fetch(`${PAYMENT_CONFIG.API_URL}/api/payment-status/${orderNo}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '查询失败');
        }
        
        return {
            success: true,
            status: data.status,
            isPaid: data.status === 'success'
        };
        
    } catch (error) {
        console.error('查询支付状态失败:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// 显示支付二维码
function showPaymentModal(orderNo, codeUrl) {
    const modal = document.getElementById('payment-modal');
    const qrcodeContainer = document.getElementById('payment-qrcode');
    const orderNoSpan = document.getElementById('payment-order-no');
    const statusText = document.getElementById('payment-status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (!modal || !qrcodeContainer) {
        console.error('支付模态框元素不存在');
        return;
    }
    
    // 清空之前的二维码
    qrcodeContainer.innerHTML = '';
    
    // 生成二维码
    if (window.QRCode) {
        new QRCode(qrcodeContainer, {
            text: codeUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrcodeContainer.innerHTML = `<p style="color: red;">二维码生成库未加载</p>`;
    }
    
    // 设置订单号
    if (orderNoSpan) {
        orderNoSpan.textContent = orderNo;
    }
    
    // 重置状态
    if (statusText) {
        statusText.textContent = '等待支付中...';
    }
    if (statusDot) {
        statusDot.className = 'status-dot';
    }
    
    // 显示模态框
    modal.classList.add('active');
    
    // 启动倒计时
    startPaymentCountdown();
    
    // 开始轮询支付状态
    startPaymentPolling(orderNo);
}

// 倒计时管理
let countdownInterval = null;
let remainingTime = 30 * 60; // 30分钟

function startPaymentCountdown() {
    remainingTime = 30 * 60; // 重置为30分钟
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        remainingTime--;
        updateCountdownDisplay();
        
        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            handlePaymentTimeout();
        }
    }, 1000);
}

function updateCountdownDisplay() {
    const countdownElement = document.getElementById('payment-countdown');
    if (!countdownElement) return;
    
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    countdownElement.textContent = timeString;
    
    // 根据剩余时间改变颜色
    countdownElement.className = 'countdown-timer';
    if (remainingTime <= 5 * 60) { // 最后5分钟
        countdownElement.classList.add('warning');
    }
    if (remainingTime <= 60) { // 最后1分钟
        countdownElement.classList.add('danger');
    }
}

function handlePaymentTimeout() {
    const statusText = document.getElementById('payment-status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (statusText) {
        statusText.textContent = '支付超时，请重新下单';
    }
    if (statusDot) {
        statusDot.className = 'status-dot error';
    }
    
    // 停止轮询
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    
    // 3秒后自动关闭
    setTimeout(() => {
        closePaymentModal();
    }, 3000);
}

// 轮询支付状态
let paymentPollingInterval = null;

function startPaymentPolling(orderNo) {
    // 清除之前的轮询
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    
    let attemptCount = 0;
    const maxAttempts = 60; // 最多轮询5分钟（60次 * 5秒）
    
    paymentPollingInterval = setInterval(async () => {
        attemptCount++;
        
        const result = await checkPaymentStatus(orderNo);
        
        if (result.success && result.isPaid) {
            // 支付成功
            clearInterval(paymentPollingInterval);
            clearInterval(countdownInterval);
            handlePaymentSuccess();
        } else if (attemptCount >= maxAttempts) {
            // 轮询超时
            clearInterval(paymentPollingInterval);
            handlePaymentTimeout();
        } else if (result.success && result.status === 'pending') {
            // 更新状态显示
            updatePaymentStatus('等待支付中...', 'pending');
        }
        
    }, 5000); // 每5秒查询一次
}

function updatePaymentStatus(text, status) {
    const statusText = document.getElementById('payment-status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (statusText) {
        statusText.textContent = text;
    }
    
    if (statusDot) {
        statusDot.className = 'status-dot';
        if (status === 'success') {
            statusDot.classList.add('success');
        } else if (status === 'error') {
            statusDot.classList.add('error');
        }
    }
}

// 处理支付成功
async function handlePaymentSuccess() {
    // 更新状态显示
    updatePaymentStatus('支付成功！', 'success');
    
    // 停止所有定时器
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // 标记为付费用户
    localStorage.setItem('isPremiumUser', 'true');
    // 标记需要与后端同步（失败可重试）
    localStorage.setItem('pendingPremiumSync', 'true');
    
    // 保存付费状态到后端数据库
    const saved = await savePremiumStatusToDatabase();
    if (saved) {
        localStorage.removeItem('pendingPremiumSync');
    }
    
    // 延迟关闭支付模态框并跳转到付费用户页面
    setTimeout(() => {
        closePaymentModal();
        
        // 显示成功提示
        const successModal = document.getElementById('payment-success-modal');
        if (successModal) {
            successModal.classList.add('active');
        }
        
        console.log('🎉 支付成功！用户已解锁完整版');
        
        // 显示私钥并自动复制
        showPrivateKeyAfterPayment();
        
        // 3秒后自动跳转到付费用户页面
        setTimeout(() => {
            // 显示付费用户内容
            const authContainer = document.getElementById('auth-container');
            const protectedContent = document.getElementById('protected-content');
            
            if (authContainer && protectedContent) {
                authContainer.style.display = 'none';
                protectedContent.style.display = 'block';
            }
            
            // 关闭成功弹窗
            if (successModal) {
                successModal.classList.remove('active');
            }
            
            console.log('✅ 已跳转到付费用户页面');
        }, 3000);
        
        // 更新购买按钮为查看教程按钮
        updateBuyButtonAfterPayment();
        
    }, 1500);
}

// 更新购买按钮为查看教程按钮
function updateBuyButtonAfterPayment() {
    const buyNowBtn = document.getElementById('buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.innerHTML = '✅ 已购买';
        buyNowBtn.style.background = '#30a46c';
        buyNowBtn.style.color = 'white';
        buyNowBtn.style.cursor = 'default';
        buyNowBtn.disabled = true;
        // 防止悬停动画误导
        buyNowBtn.onmouseover = null;
        buyNowBtn.onmouseout = null;
        buyNowBtn.onclick = null;
        console.log('✅ 购买按钮已更新为“已购买”');
    }
}

// 重置购买按钮为立即购买
function resetBuyButtonToPurchase() {
    const buyNowBtn = document.getElementById('buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.innerHTML = '💳 立即购买（微信支付）';
        buyNowBtn.style.background = '#ffeb3b';
        buyNowBtn.style.color = '#333';
        buyNowBtn.disabled = false;
        buyNowBtn.style.cursor = 'pointer';
        // 移除自定义onclick，使用addEventListener
        buyNowBtn.onclick = null;
        console.log('✅ 购买按钮已重置为立即购买');
    }
}

// 防止重复点击的标志
let isOpeningTutorial = false;

// 保存付费状态到数据库
async function savePremiumStatusToDatabase() {
    try {
        const userData = window.userAuth?.getUserData();
        if (!userData) {
            console.warn('⚠️ 未登录，暂存为待同步');
            return false;
        }

        const supabase = window.supabaseClient?.getClient();
        if (!supabase) {
            console.error('❌ Supabase 客户端未初始化');
            return false;
        }

        // 检查用户是否已经在数据库中
        const { data: existingUser, error: queryError } = await supabase
            .from('premium_users')
            .select('*')
            .eq('email', userData.email)
            .single();

        if (queryError && queryError.code !== 'PGRST116') {
            console.error('❌ 查询用户失败:', queryError);
            return false;
        }

        if (existingUser) {
            // 用户已存在，更新状态
            const { error: updateError } = await supabase
                .from('premium_users')
                .update({
                    is_active: true,
                    payment_status: 'paid',
                    updated_at: new Date().toISOString(),
                    notes: '通过微信支付购买'
                })
                .eq('email', userData.email);

            if (updateError) {
                console.error('❌ 更新用户付费状态失败:', updateError);
                return false;
            }
            console.log('✅ 用户付费状态已更新到数据库');
            return true;
        } else {
            // 用户不存在，插入新记录
            const { error: insertError } = await supabase
                .from('premium_users')
                .insert({
                    email: userData.email,
                    display_name: userData.display_name || userData.email,
                    is_active: true,
                    payment_status: 'paid',
                    site: 'tobooks',
                    notes: '通过微信支付购买',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) {
                console.error('❌ 保存用户付费状态失败:', insertError);
                return false;
            }
            console.log('✅ 用户付费状态已保存到数据库');
            return true;
        }
    } catch (error) {
        console.error('❌ 保存付费状态异常:', error);
        return false;
    }
}

// 支付成功后显示私钥
function showPrivateKeyAfterPayment() {
    const privateKey = 'kx94yyds';
    
    // 自动复制私钥到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(privateKey).then(() => {
            // 显示成功提示
            showMessage(`🔑 私钥已复制到剪贴板：${privateKey}`, 'success');
        }).catch(() => {
            // 复制失败，显示私钥
            showMessage(`🔑 私钥：${privateKey}`, 'info');
        });
    } else {
        // 不支持剪贴板API，显示私钥
        showMessage(`🔑 私钥：${privateKey}`, 'info');
    }
}

// 打开教程并自动输入密码
function openTutorialWithPassword() {
    // 防止重复点击
    if (isOpeningTutorial) {
        return;
    }
    
    isOpeningTutorial = true;
    const tutorialUrl = 'https://n0w4rb9qg8z.feishu.cn/wiki/OLEcweXr3i4q9zkgj1pccBLknoe';
    const password = 'kx94yyds';
    
    // 显示密码提示
    showMessage(`🔑 正在打开教程，密码：${password}`, 'info');
    
    // 打开新窗口
    const newWindow = window.open(tutorialUrl, '_blank');
    
    // 由于跨域限制，无法直接操作飞书页面，所以显示密码供用户手动输入
    setTimeout(() => {
        // 显示密码复制提示
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(password).then(() => {
                showMessage(`🔑 密码已复制到剪贴板：${password}`, 'success');
            }).catch(() => {
                showMessage(`🔑 请手动输入密码：${password}`, 'info');
            });
        } else {
            showMessage(`🔑 请手动输入密码：${password}`, 'info');
        }
        
        // 重置标志，允许再次点击
        setTimeout(() => {
            isOpeningTutorial = false;
        }, 2000);
    }, 1000);
}

// 关闭支付模态框
function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // 停止所有定时器
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
}

// ==================== 初始化和事件监听 ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('支付模块加载中...');
    
    // 等待 Supabase 初始化
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查白名单
    const isWhitelisted = await checkWhitelist();
    if (isWhitelisted) {
        console.log('✅ 白名单用户，自动解锁');
        
        // 触发UI更新
        if (window.premiumControl) {
            window.premiumControl.unlock();
        }
    }
    
    // 如果之前支付成功但未能写库，且现在已登录，重试一次
    try {
        const pending = localStorage.getItem('pendingPremiumSync') === 'true';
        const userData = window.userAuth?.getUserData();
        if (pending && userData) {
            const saved = await savePremiumStatusToDatabase();
            if (saved) localStorage.removeItem('pendingPremiumSync');
        }
    } catch (e) { console.warn('sync retry skip', e); }

    // 统一根据当前付费状态刷新按钮（不再强制要求已登录）
    async function refreshBuyButtonState() {
        const premium = await isPremiumUser();
        console.log(`当前状态: ${premium ? '付费用户' : '免费用户'}`);
        if (premium) {
            updateBuyButtonAfterPayment();
        } else {
            resetBuyButtonToPurchase();
        }
    }
    await refreshBuyButtonState();
    
    // 监听登录状态变化，自动刷新按钮
    try {
        const supa = window.supabaseClient?.getClient();
        if (supa && supa.auth && supa.auth.onAuthStateChange) {
            supa.auth.onAuthStateChange(async () => {
                await refreshBuyButtonState();
            });
        }
    } catch (e) { /* 忽略监听错误 */ }
    
    // 绑定功能展示页面的"立即购买"按钮
    const buyNowBtn = document.getElementById('buy-now-btn');
    if (buyNowBtn) {
        // 添加悬停效果
        buyNowBtn.onmouseover = () => {
            buyNowBtn.style.transform = 'translateY(-2px)';
            buyNowBtn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        };
        buyNowBtn.onmouseout = () => {
            buyNowBtn.style.transform = 'translateY(0)';
            buyNowBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };
        
        buyNowBtn.addEventListener('click', async () => {
            // 检查是否为付费用户
            const currentPremiumStatus = await isPremiumUser();
            if (currentPremiumStatus) {
                console.log('📖 付费用户点击查看教程');
                openTutorialWithPassword();
                return;
            }
            
            console.log('💳 点击立即购买按钮');
            
            // 使用新的用户认证模块检查用户状态
            const userData = window.userAuth?.getUserData();
            
            if (!userData) {
                alert('请先登录再购买哦！');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('✅ 使用用户数据:', userData.email);
            
            // 创建支付订单
            buyNowBtn.disabled = true;
            buyNowBtn.textContent = '⏳ 创建订单中...';
            
            const result = await createPaymentOrder();
            
            buyNowBtn.disabled = false;
            buyNowBtn.textContent = '💳 立即购买（微信支付）';
            
            if (result.success) {
                showPaymentModal(result.orderNo, result.codeUrl);
            } else {
                alert('创建订单失败: ' + result.message);
            }
        });
    }
    
    // 绑定购买按钮事件（锁定提示中的按钮）
    const buyBtn = document.getElementById('premium-buy-btn');
    if (buyBtn) {
        buyBtn.addEventListener('click', async () => {
            console.log('点击购买按钮');
            
            // 检查登录状态
            const supabase = window.supabaseClient?.getClient();
            const { data: { user } } = await supabase?.auth.getUser();
            
            if (!user) {
                alert('请先登录');
                window.location.href = 'login.html';
                return;
            }
            
            // 创建支付订单
            buyBtn.disabled = true;
            buyBtn.textContent = '创建订单中...';
            
            const result = await createPaymentOrder();
            
            buyBtn.disabled = false;
            buyBtn.textContent = '立即购买 ¥199.00';
            
            if (result.success) {
                showPaymentModal(result.orderNo, result.codeUrl);
            } else {
                alert('创建订单失败: ' + result.message);
            }
        });
    }
    
    // 关闭支付模态框
    const closePaymentBtn = document.getElementById('payment-close-btn');
    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', () => {
            closePaymentModal();
        });
    }
    
    // 点击模态框背景关闭
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                closePaymentModal();
            }
        });
    }
    
    // 关闭支付成功模态框
    const successCloseBtn = document.getElementById('payment-success-close-btn');
    if (successCloseBtn) {
        successCloseBtn.addEventListener('click', () => {
            const modal = document.getElementById('payment-success-modal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // 显示付费用户内容
            const authContainer = document.getElementById('auth-container');
            const protectedContent = document.getElementById('protected-content');
            
            if (authContainer && protectedContent) {
                authContainer.style.display = 'none';
                protectedContent.style.display = 'block';
            }
            
            console.log('✅ 用户点击开始使用，已跳转到付费用户页面');
        });
    }
    
    console.log('✅ 支付模块加载完成');
});

// 导出函数供外部使用
window.paymentModule = {
    isPremium: isPremiumUser,
    checkWhitelist: checkWhitelist,
    createPaymentOrder: createPaymentOrder,
    checkPaymentStatus: checkPaymentStatus,
    openTutorial: openTutorialWithPassword,
    savePremiumStatus: savePremiumStatusToDatabase
};

// 将函数暴露到全局作用域供HTML调用
window.openTutorialWithPassword = openTutorialWithPassword;

