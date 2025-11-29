// ==================== 用户认证管理 - 重新编写 ====================
// 简洁清晰的登录状态管理

console.log('🔐 用户认证模块加载中...');

// ==================== 核心功能 ====================

// 1. 保存用户数据到本地存储
function saveUserData(user) {
    const userData = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('userData', JSON.stringify(userData));
    console.log('✅ 用户数据已保存:', userData.email);
    
    return userData;
}

// 2. 从本地存储获取用户数据
function getUserData() {
    try {
        const userDataStr = localStorage.getItem('userData');
        if (!userDataStr) {
            console.log('❌ 本地没有用户数据');
            return null;
        }
        
        const userData = JSON.parse(userDataStr);
        
        // 检查是否过期（24小时）
        const loginTime = new Date(userData.loginTime);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
            console.log('⏰ 登录状态已过期，清除数据');
            localStorage.removeItem('userData');
            return null;
        }
        
        console.log('✅ 从本地获取用户数据:', userData.email);
        return userData;
        
    } catch (error) {
        console.error('❌ 获取用户数据失败:', error);
        localStorage.removeItem('userData');
        return null;
    }
}

// 3. 显示用户信息
function showUserInfo(userData) {
    console.log('🎨 开始显示用户信息:', userData);
    
    const loginBtn = document.getElementById('login-btn');
    const userContainer = document.getElementById('user-avatar-container');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userStatus = document.getElementById('user-status');
    
    console.log('🔍 DOM 元素状态:', {
        loginBtn: !!loginBtn,
        userContainer: !!userContainer,
        userAvatar: !!userAvatar,
        userName: !!userName,
        userStatus: !!userStatus
    });
    
    // 隐藏登录按钮，显示用户信息
    if (loginBtn) {
        loginBtn.style.display = 'none';
        console.log('✅ 隐藏登录按钮');
    }
    if (userContainer) {
        userContainer.style.display = 'flex';
        userContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        console.log('✅ 显示用户容器');
    }
    
    // 设置头像（支持 Google 头像）
    if (userAvatar) {
        const avatarUrl = getGoogleAvatarUrl(userData);
        const displayName = getUserDisplayName(userData);
        
        if (avatarUrl) {
            // 使用 Google 头像
            userAvatar.src = avatarUrl;
            userAvatar.alt = 'Google 头像';
            console.log('✅ 使用 Google 头像:', avatarUrl);
            
            // 添加错误处理：如果头像加载失败，使用默认头像
            userAvatar.onerror = function() {
                console.warn('⚠️ Google 头像加载失败，使用默认头像');
                this.src = generateDefaultAvatar(displayName);
                this.onerror = null; // 防止无限循环
            };
        } else {
            // 使用默认头像
            userAvatar.src = generateDefaultAvatar(displayName);
            userAvatar.alt = '默认头像';
            console.log('ℹ️ 使用默认头像');
        }
        
        userAvatar.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
    }
    
    // 设置用户名（优化版）
    if (userName) {
        const displayName = getUserDisplayName(userData);
        userName.textContent = displayName;
        userName.style.cssText = `
            font-size: 14px;
            color: #333;
            font-weight: 600;
            margin: 0;
        `;
        console.log('✅ 用户显示名称:', displayName);
    }
    
    // 设置状态标签
    if (userStatus) {
        const isPremium = localStorage.getItem('isPremiumUser') === 'true';
        const isWhitelisted = localStorage.getItem('whitelistUser') === 'true';
        
        console.log('🔍 用户状态检查:', {
            isPremium,
            isWhitelisted,
            premiumValue: localStorage.getItem('isPremiumUser'),
            whitelistValue: localStorage.getItem('whitelistUser')
        });
        
        if (isPremium || isWhitelisted) {
            userStatus.textContent = isWhitelisted ? '✨ 白名单用户' : '💎 付费用户';
            userStatus.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-size: 12px;
                padding: 4px 10px;
                border-radius: 12px;
                font-weight: 500;
            `;
        } else {
            userStatus.textContent = `🔒 免费用户`;
            userStatus.style.cssText = `
                background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                color: white;
                font-size: 12px;
                padding: 4px 10px;
                border-radius: 12px;
                font-weight: 500;
                box-shadow: 0 2px 6px rgba(244, 67, 54, 0.3);
            `;
        }
    }
    
    console.log('✅ 用户信息已显示:', userData.email);
}

// 4. 显示登录按钮
function showLoginButton() {
    const loginBtn = document.getElementById('login-btn');
    const userContainer = document.getElementById('user-avatar-container');
    
    if (loginBtn) loginBtn.style.display = 'block';
    if (userContainer) userContainer.style.display = 'none';
    
    console.log('🔑 显示登录按钮');
}

// 5. 生成默认头像（优化版）
function generateDefaultAvatar(name) {
    const firstChar = (name || 'U').charAt(0).toUpperCase();
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const colorIndex = firstChar.charCodeAt(0) % colors.length;
    const bgColor = colors[colorIndex];
    
    const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="${bgColor}"/>
        <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial, sans-serif">${firstChar}</text>
    </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// 6. 获取用户显示名称
function getUserDisplayName(userData) {
    return userData?.name || 
           userData?.email?.split('@')[0] || 
           '用户';
}

// 7. 获取 Google 头像 URL
function getGoogleAvatarUrl(userData) {
    return userData?.avatar || null;
}

// 8. 检查 Supabase 登录状态
async function checkSupabaseAuth() {
    const supabase = window.supabaseClient?.getClient();
    if (!supabase) {
        console.log('❌ Supabase 未初始化');
        return null;
    }
    
    try {
        // 使用 getSession() 而不是 getUser()，避免 AuthSessionMissingError
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session?.user) {
            console.log('❌ Supabase 用户未登录');
            return null;
        }
        
        console.log('✅ Supabase 用户已登录:', session.user.email);
        return session.user;
        
    } catch (error) {
        console.error('❌ Supabase 认证检查失败:', error);
        return null;
    }
}

// 7. 退出登录
async function logout() {
    const confirmLogout = confirm('确定要退出登录吗？');
    if (!confirmLogout) return;
    
    try {
        // 清除本地用户数据
        localStorage.removeItem('userData');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('userAvatar');
        
        // 尝试从 Supabase 退出
        const supabase = window.supabaseClient?.getClient();
        if (supabase) {
            await supabase.auth.signOut();
        }
        
        console.log('✅ 退出登录成功');
        
        // 刷新页面
        location.reload();
        
    } catch (error) {
        console.error('❌ 退出登录失败:', error);
        // 即使失败也刷新页面
        location.reload();
    }
}

// ==================== 事件绑定 ====================

// 绑定登录按钮
function setupLoginButton() {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            console.log('🔑 点击登录按钮');
            window.location.href = 'login.html';
        });
    }
}

// 绑定用户头像点击事件
function setupUserMenu() {
    const userContainer = document.getElementById('user-avatar-container');
    if (userContainer) {
        userContainer.style.cursor = 'pointer';
        userContainer.addEventListener('click', showUserMenu);
        
        // 添加悬停效果
        userContainer.addEventListener('mouseenter', () => {
            userContainer.style.transform = 'translateY(-2px)';
            userContainer.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
        });
        
        userContainer.addEventListener('mouseleave', () => {
            userContainer.style.transform = 'translateY(0)';
            userContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        });
    }
}

// 显示用户菜单
function showUserMenu() {
    // 移除旧菜单
    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 8px;
        z-index: 10000;
        min-width: 200px;
        animation: fadeIn 0.2s ease;
    `;
    
    const isPremium = localStorage.getItem('isPremiumUser') === 'true';
    
    menu.innerHTML = `
        <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; margin-bottom: 8px;">
            <div style="font-size: 14px; color: #333; font-weight: 500;">我的账户</div>
            <div style="font-size: 12px; color: #999; margin-top: 4px;">
                ${isPremium ? '💎 付费用户' : '🔒 免费用户'}
            </div>
        </div>
        ${!isPremium ? `
            <div class="menu-item" style="padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #333; transition: all 0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'" onclick="window.premiumControl?.showPrompt()">
                💳 购买完整版
            </div>
        ` : ''}
        <div class="menu-item" style="padding: 10px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #f44336; transition: all 0.2s;" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='transparent'" onclick="logout()">
            🚪 退出登录
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // 点击外部关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !document.getElementById('user-avatar-container').contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// ==================== 初始化 ====================

// 主初始化函数
async function initUserAuth() {
    console.log('🚀 开始初始化用户认证...');
    
    // 检查 Supabase 客户端是否可用
    const supabase = window.supabaseClient?.getClient();
    console.log('🔍 Supabase 客户端状态:', supabase ? '已初始化' : '未初始化');
    
    // 1. 先检查本地存储
    const localUserData = getUserData();
    
    if (localUserData) {
        // 有本地数据，直接显示用户信息
        console.log('✅ 使用本地用户数据');
        showUserInfo(localUserData);
        
        // 检查白名单状态
        if (window.paymentModule) {
            try {
                await window.paymentModule.checkWhitelist(localUserData);
            } catch (error) {
                console.error('白名单检查失败:', error);
            }
        }
        
    } else {
        // 没有本地数据，检查 Supabase
        console.log('🔍 检查 Supabase 登录状态...');
        const supabaseUser = await checkSupabaseAuth();
        
        if (supabaseUser) {
            // Supabase 有用户，保存到本地
            console.log('✅ 从 Supabase 获取用户数据');
            const userData = saveUserData(supabaseUser);
            showUserInfo(userData);
            
            // 检查白名单状态
            if (window.paymentModule) {
                try {
                    await window.paymentModule.checkWhitelist(userData);
                } catch (error) {
                    console.error('白名单检查失败:', error);
                }
            }
            
        } else {
            // 都没有，显示登录按钮
            console.log('❌ 用户未登录，显示登录按钮');
            showLoginButton();
        }
    }
    
    // 2. 设置事件绑定
    setupLoginButton();
    setupUserMenu();
    
    console.log('✅ 用户认证初始化完成');
}

// ==================== 页面加载时执行 ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 页面加载完成，开始用户认证...');
    
    // 等待其他模块初始化
    setTimeout(() => {
        initUserAuth();
        setupAuthStateListener();
    }, 500);
});

// ==================== 认证状态监听 ====================

// 设置认证状态监听器
function setupAuthStateListener() {
    const supabase = window.supabaseClient?.getClient();
    if (!supabase) {
        console.log('⚠️ Supabase 未初始化，无法设置认证监听');
        return;
    }
    
    // 监听认证状态变化
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔄 认证状态变化:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
            console.log('🎉 用户登录成功，更新头像');
            // 延迟更新，确保用户数据已保存
            setTimeout(() => {
                updateUserAvatar();
            }, 1000);
        } else if (event === 'SIGNED_OUT') {
            console.log('👋 用户登出，显示默认头像');
            showDefaultUser(
                document.getElementById('user-avatar'),
                document.getElementById('user-name')
            );
        }
    });
}

// 更新用户头像和姓名（供外部调用）
async function updateUserAvatar() {
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    if (!userAvatar || !userName) {
        console.warn('用户头像或姓名元素未找到');
        return;
    }
    
    try {
        // 获取当前用户数据
        const userData = getUserData();
        
        if (!userData) {
            console.log('⚠️ 用户未登录，显示默认用户');
            showDefaultUser(userAvatar, userName);
            return;
        }
        
        console.log('🔄 更新用户头像和姓名');
        
        // 获取 Google 头像 URL
        const googleAvatarUrl = getGoogleAvatarUrl(userData);
        const displayName = getUserDisplayName(userData);
        
        if (googleAvatarUrl) {
            // 使用 Google 头像
            userAvatar.src = googleAvatarUrl;
            userAvatar.alt = 'Google 头像';
            console.log('✅ 使用 Google 头像:', googleAvatarUrl);
            
            // 添加错误处理
            userAvatar.onerror = function() {
                console.warn('⚠️ Google 头像加载失败，使用默认头像');
                this.src = generateDefaultAvatar(displayName);
                this.onerror = null;
            };
        } else {
            // 使用默认头像
            userAvatar.src = generateDefaultAvatar(displayName);
            userAvatar.alt = '默认头像';
            console.log('ℹ️ 使用默认头像');
        }
        
        // 设置用户姓名
        userName.textContent = displayName;
        
        console.log('✅ 用户信息已更新 - 姓名:', displayName);
        
    } catch (error) {
        console.error('❌ 更新用户头像异常:', error);
        showDefaultUser(userAvatar, userName);
    }
}

// 显示默认用户信息
function showDefaultUser(userAvatar, userName) {
    if (userAvatar) {
        userAvatar.src = generateDefaultAvatar('用户');
        userAvatar.alt = '默认头像';
    }
    if (userName) {
        userName.textContent = '用户';
    }
}

// ==================== 导出函数 ====================

// 临时功能：手动设置用户状态（用于测试）
function setUserStatus(status) {
    switch(status) {
        case 'free':
            localStorage.setItem('isPremiumUser', 'false');
            localStorage.setItem('whitelistUser', 'false');
            break;
        case 'premium':
            localStorage.setItem('isPremiumUser', 'true');
            localStorage.setItem('whitelistUser', 'false');
            break;
        case 'whitelist':
            localStorage.setItem('isPremiumUser', 'true');
            localStorage.setItem('whitelistUser', 'true');
            break;
    }
    
    // 刷新用户信息显示
    const userData = getUserData();
    if (userData) {
        showUserInfo(userData);
    }
    
    console.log(`✅ 用户状态已设置为: ${status}`);
}

window.userAuth = {
    saveUserData: saveUserData,
    getUserData: getUserData,
    showUserInfo: showUserInfo,
    showLoginButton: showLoginButton,
    logout: logout,
    init: initUserAuth,
    setUserStatus: setUserStatus,  // 临时测试功能
    updateUserAvatar: updateUserAvatar,  // 更新头像
    getUserDisplayName: getUserDisplayName,  // 获取显示名称
    getGoogleAvatarUrl: getGoogleAvatarUrl  // 获取 Google 头像
};

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ 用户认证模块加载完成');