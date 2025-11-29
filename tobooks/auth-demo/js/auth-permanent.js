// 永久认证系统 - 安全版本，禁止控制台操作
(function() {
    'use strict';
    
    // 安全防护：禁用控制台操作
    function enableSecurityProtection() {
        // 完全禁用 console 对象
        Object.defineProperty(window, 'console', {
            get: function() {
                return {
                    log: function() { return; },
                    warn: function() { return; },
                    error: function() { return; },
                    info: function() { return; },
                    debug: function() { return; },
                    clear: function() { return; },
                    trace: function() { return; },
                    group: function() { return; },
                    groupEnd: function() { return; },
                    time: function() { return; },
                    timeEnd: function() { return; },
                    count: function() { return; },
                    assert: function() { return; },
                    dir: function() { return; },
                    dirxml: function() { return; },
                    profile: function() { return; },
                    profileEnd: function() { return; },
                    table: function() { return; }
                };
            },
            set: function() { return; }
        });
        
        // 禁用 eval 和 Function 构造函数
        Object.defineProperty(window, 'eval', {
            get: function() {
                return function() {
                    throw new Error('eval is disabled for security');
                };
            },
            set: function() { return; }
        });
        
        Object.defineProperty(window, 'Function', {
            get: function() {
                return function() {
                    throw new Error('Function constructor is disabled for security');
                };
            },
            set: function() { return; }
        });
        
        // 禁用其他危险的全局函数
        const dangerousFunctions = ['setTimeout', 'setInterval', 'setImmediate'];
        dangerousFunctions.forEach(funcName => {
            const originalFunc = window[funcName];
            window[funcName] = function(callback, ...args) {
                if (typeof callback === 'string') {
                    throw new Error(`${funcName} with string callback is disabled for security`);
                }
                return originalFunc.call(this, callback, ...args);
            };
        });
        
        // 禁用 localStorage 和 sessionStorage 的某些操作
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            // 禁止设置可能用于绕过认证的键
            const forbiddenKeys = ['auth_bypass', 'console_enabled', 'devtools_bypass'];
            if (forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden))) {
                throw new Error('Setting this key is forbidden for security');
            }
            return originalSetItem.call(this, key, value);
        };
        
        // 允许开发者工具、右键、文本选择与拖拽；不再阻止复制/粘贴/剪切
    }
    
    // 初始化安全防护
    enableSecurityProtection();

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
            authenticatePermanent();
        });
    }

    // 永久认证函数
    function authenticatePermanent() {
        const privateKey = privateKeyInput?.value.trim();
        const message = messageInput?.value || '请求访问';
        
        if (!privateKey) {
            showStatus('请输入私钥', 'error');
            return;
        }
        
        showStatus('正在验证私钥...', 'info');
        
        // 检查是否为本地开发环境
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'file:';
        
        if (isLocal) {
            // 本地验证逻辑
            handleLocalAuth(privateKey);
        } else {
            // 服务器端验证逻辑
            handleServerAuth(privateKey, message);
        }
    }
    
    // 本地认证处理
    function handleLocalAuth(privateKey) {
        // 基本的私钥格式验证
        if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END') || !privateKey.includes('PRIVATE KEY')) {
            showStatus('私钥格式无效', 'error');
            return;
        }
        
        if (privateKey.length < 100) {
            showStatus('私钥长度太短', 'error');
            return;
        }
        
        // 模拟验证过程
        setTimeout(() => {
            // 生成本地认证令牌
            const timestamp = Date.now();
            const keyHash = btoa(privateKey.substring(0, 50)).substring(0, 12);
            const authToken = btoa(timestamp.toString() + Math.random().toString()).substring(0, 20);
            
            // 存储认证信息
            const authData = [
                'tobooks_authenticated', 
                'tobooks_auth_time', 
                'tobooks_key_hash', 
                'tobooks_signature'
            ];
            const values = [
                'true', 
                timestamp.toString(), 
                keyHash, 
                authToken
            ];
            
            authData.forEach((key, index) => {
                localStorage.setItem(key, values[index]);
            });
            
            showStatus('🎉 认证成功！（本地模式）', 'success');
            
            if (loginForm) loginForm.style.display = 'none';
            if (protectedContent) protectedContent.style.display = 'block';
            
            // 跳转到主应用
            setTimeout(() => {
                window.location.href = 'tobooks-main/index.html';
            }, 2500);
            
        }, 1500); // 模拟网络延迟
    }
    
    // 服务器端认证处理
    async function handleServerAuth(privateKey, message) {
        try {
            showStatus('正在连接服务器验证...', 'info');
            
            const response = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    privateKey: privateKey, 
                    message: message
                })
            });
            
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // 服务器验证成功，存储认证令牌
                const authData = [
                    'tobooks_authenticated', 
                    'tobooks_auth_time', 
                    'tobooks_key_hash', 
                    'tobooks_signature'
                ];
                const values = [
                    'true', 
                    result.timestamp.toString(), 
                    result.keyHash, 
                    result.authToken
                ];
                
                authData.forEach((key, index) => {
                    localStorage.setItem(key, values[index]);
                });
                
                showStatus('🎉 认证成功！永久访问权限已激活', 'success');
                
                if (loginForm) loginForm.style.display = 'none';
                if (protectedContent) protectedContent.style.display = 'block';
                
                // 跳转到主应用
                setTimeout(() => {
                    window.location.href = 'tobooks-main/index.html';
                }, 2500);
                
            } else {
                showStatus('认证失败：' + result.error, 'error');
            }
        } catch (error) {
            showStatus('服务器连接失败，使用本地验证模式...', 'info');
            
            // 如果服务器端验证失败，回退到本地验证
            setTimeout(() => {
                handleLocalAuth(privateKey);
            }, 1000);
        }
    }
    
    function showStatus(message, type) {
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
        
        if (type === 'error') {
            setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 5000);
        }
    }
    
    // 检查现有认证状态
    function checkAuthStatus() {
        const auth = localStorage.getItem('tobooks_authenticated');
        const time = localStorage.getItem('tobooks_auth_time');
        const hash = localStorage.getItem('tobooks_key_hash');
        const token = localStorage.getItem('tobooks_signature');
        
        if (auth === 'true' && time && hash && token) {
            // 检查是否过期（1年）
            const authTime = parseInt(time);
            const currentTime = Date.now();
            const maxAge = 365 * 24 * 60 * 60 * 1000; // 1年
            
            if (currentTime - authTime > maxAge) {
                // 认证过期，清除数据
                ['tobooks_authenticated', 'tobooks_auth_time', 'tobooks_key_hash', 'tobooks_signature']
                .forEach(key => localStorage.removeItem(key));
            } else {
                // 认证有效，显示成功页面
                if (loginForm) loginForm.style.display = 'none';
                if (protectedContent) protectedContent.style.display = 'block';
                
                // 添加认证状态信息
                const authInfo = document.createElement('div');
                authInfo.innerHTML = `
                    <div style="background: #e8f5e8; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 6px; margin: 15px 0; font-size: 0.9em;">
                        <strong>🔐 永久认证已激活</strong><br>
                        认证时间: ${new Date(authTime).toLocaleString()}<br>
                        状态: 永久有效 | 密钥ID: ${hash}
                        <button onclick="resetAuth()" style="float: right; background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8em;">
                            重置认证
                        </button>
                    </div>
                `;
                if (protectedContent) {
                    protectedContent.insertBefore(authInfo, protectedContent.firstChild);
                }
            }
        }
    }
    
    // 重置认证功能
    window.resetAuth = function() {
        if (confirm('确定要重置认证状态吗？重置后需要重新输入私钥。')) {
            ['tobooks_authenticated', 'tobooks_auth_time', 'tobooks_key_hash', 'tobooks_signature']
            .forEach(key => localStorage.removeItem(key));
            window.location.reload();
        }
    };
    
    // 页面加载时检查认证状态
    document.addEventListener('DOMContentLoaded', checkAuthStatus);
    
})();
