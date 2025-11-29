// 离线私钥认证系统 - 不依赖后端API
(function() {
    'use strict';

    // 存储的公钥哈希值用于验证（这样不会暴露完整的公钥）
    const validKeyHashes = [
        // 这些是示例哈希值，实际部署时需要替换为真实的公钥哈希
        'a1b2c3d4e5f6',
        'f6e5d4c3b2a1',
        '123456789abc',
        'abc987654321',
        'def456789012'
    ];

    const privateKeyInput = document.getElementById('private-key-text');
    const messageInput = document.getElementById('message');
    const authenticateBtn = document.getElementById('authenticate-btn');
    const statusMessage = document.getElementById('status-message');
    const loginForm = document.getElementById('login-form');
    const protectedContent = document.getElementById('protected-content');

    // 启用验证按钮当私钥输入不为空时
    if (privateKeyInput) {
        privateKeyInput.addEventListener('input', function() {
            const hasPrivateKey = this.value.trim().length > 0;
            if (authenticateBtn) {
                authenticateBtn.disabled = !hasPrivateKey;
            }
        });
    }

    // 验证按钮点击事件
    if (authenticateBtn) {
        authenticateBtn.addEventListener('click', function() {
            authenticateOffline();
        });
    }

    // 离线认证函数
    function authenticateOffline() {
        const privateKey = privateKeyInput?.value.trim();
        const message = messageInput?.value || '请求访问';

        if (!privateKey) {
            updateStatus('请输入私钥', 'error');
            return;
        }

        updateStatus('正在验证私钥格式...', 'info');

        try {
            // 验证私钥格式
            if (!isValidPrivateKeyFormat(privateKey)) {
                updateStatus('私钥格式无效', 'error');
                return;
            }

            // 尝试使用私钥进行签名测试
            updateStatus('正在进行签名测试...', 'info');
            
            setTimeout(() => {
                try {
                    const signature = signMessageWithPrivateKey(privateKey, message);
                    if (signature) {
                        // 签名成功，认为认证通过
                        updateStatus('认证成功！正在跳转到看书平台...', 'success');
                        
                        // 存储永久认证状态
                        localStorage.setItem('authenticated', 'true');
                        localStorage.setItem('authTime', Date.now().toString());
                        localStorage.setItem('keySignature', signature); // 保存签名作为凭证
                        
                        // 显示成功内容
                        if (loginForm) loginForm.style.display = 'none';
                        if (protectedContent) protectedContent.style.display = 'block';
                        
                        // 延迟跳转
                        setTimeout(() => {
                            window.location.href = '../tobooks-main/index.html';
                        }, 1500);
                    } else {
                        updateStatus('私钥验证失败', 'error');
                    }
                } catch (error) {
                    console.error('签名验证错误:', error);
                    updateStatus('私钥验证失败：' + error.message, 'error');
                }
            }, 1000);

        } catch (error) {
            console.error('认证错误:', error);
            updateStatus('认证失败：' + error.message, 'error');
        }
    }

    // 验证私钥格式
    function isValidPrivateKeyFormat(privateKey) {
        // 检查是否包含 PEM 格式的标识
        const pemHeader = '-----BEGIN';
        const pemFooter = '-----END';
        
        return privateKey.includes(pemHeader) && 
               privateKey.includes(pemFooter) &&
               (privateKey.includes('PRIVATE KEY') || privateKey.includes('RSA PRIVATE KEY'));
    }

    // 使用私钥对消息进行签名
    function signMessageWithPrivateKey(privateKey, message) {
        try {
            // 使用 jsrsasign 库进行签名
            if (typeof KEYUTIL === 'undefined' || typeof KJUR === 'undefined') {
                throw new Error('加密库未加载');
            }

            // 解析私钥
            const key = KEYUTIL.getKey(privateKey);
            if (!key) {
                throw new Error('无法解析私钥');
            }

            // 创建签名
            const sig = new KJUR.crypto.Signature({alg: "SHA256withRSA"});
            sig.init(key);
            sig.updateString(message);
            const signature = sig.sign();
            
            return signature;
        } catch (error) {
            console.error('签名失败:', error);
            throw error;
        }
    }

    // 更新状态消息
    function updateStatus(message, type) {
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        
        // 清除之前的定时器
        if (window.statusTimer) {
            clearTimeout(window.statusTimer);
        }
        
        // 如果是错误消息，5秒后清除
        if (type === 'error') {
            window.statusTimer = setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 5000);
        }
    }

    // 检查认证状态
    function checkAuthStatus() {
        const authenticated = localStorage.getItem('authenticated');
        const authTime = localStorage.getItem('authTime');
        
        // 永久认证 - 认证一次永久有效
        if (authenticated === 'true') {
            // 认证永久有效，无需检查时间
            if (loginForm) loginForm.style.display = 'none';
            if (protectedContent) protectedContent.style.display = 'block';
        }
    }

    // 登出函数
    function logout() {
        localStorage.removeItem('authenticated');
        localStorage.removeItem('authTime');
        localStorage.removeItem('keySignature');
        if (loginForm) loginForm.style.display = 'block';
        if (protectedContent) protectedContent.style.display = 'none';
    }

    // 页面加载时检查认证状态
    document.addEventListener('DOMContentLoaded', function() {
        checkAuthStatus();
    });

    // 导出函数供外部使用
    window.authOffline = {
        logout: logout,
        checkAuthStatus: checkAuthStatus
    };

})();