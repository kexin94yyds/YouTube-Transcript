document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const privateKeyInput = document.getElementById('private-key-text');
    const authenticateBtn = document.getElementById('authenticate-btn');
    const statusMessage = document.getElementById('status-message');
    const loginForm = document.getElementById('login-form');
    const protectedContent = document.getElementById('protected-content');
    const logoutBtn = document.getElementById('logout-btn');
    const messageInput = document.getElementById('message');

    // Check if user is already authenticated
    checkAuthStatus();

    // Event listeners
    if (privateKeyInput) {
        privateKeyInput.addEventListener('input', handlePrivateKeyInput);
    }
    if (authenticateBtn) {
        authenticateBtn.addEventListener('click', authenticate);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    

    // Handle private key text input
    function handlePrivateKeyInput(event) {
        try {
            const keyContent = event.target.value.trim();
            
            // Check if it's a public key (which is wrong)
            if (keyContent.includes('BEGIN PUBLIC KEY') || keyContent.includes('END PUBLIC KEY')) {
                if (authenticateBtn) {
                    authenticateBtn.disabled = true;
                }
                updateStatus('请输入私钥，不是公钥！私钥应该以 "BEGIN RSA PRIVATE KEY" 开头', 'error');
                return;
            }
            
            if (keyContent.length > 0 && 
                keyContent.includes('BEGIN RSA PRIVATE KEY') && 
                keyContent.includes('END RSA PRIVATE KEY')) {
                // Enable authenticate button if we have a valid-looking private key
                if (authenticateBtn) {
                    authenticateBtn.disabled = false;
                }
                updateStatus('私钥已输入，请点击验证按钮进行身份验证', 'info');
            } else {
                if (authenticateBtn) {
                    authenticateBtn.disabled = true;
                }
                if (keyContent.length > 0) {
                    updateStatus('请输入有效的RSA私钥（以 "-----BEGIN RSA PRIVATE KEY-----" 开头）', 'error');
                } else {
                    updateStatus('', '');
                }
            }
        } catch (error) {
            console.error('Error processing private key:', error);
            updateStatus('无法处理私钥，请确保格式正确', 'error');
            if (authenticateBtn) {
                authenticateBtn.disabled = true;
            }
        }
    }

    // Authenticate using the private key
    function authenticate() {
        if (!privateKeyInput) {
            console.error('Private key input element not found');
            return;
        }
        
        const privateKeyContent = privateKeyInput.value.trim();
        if (!privateKeyContent) {
            updateStatus('请先输入私钥', 'error');
            return;
        }

        try {
            // Get the message to sign - ensure UTF-8 encoding for Chinese characters
            const message = messageInput ? messageInput.value : '请求访问';
            console.log('Message to sign:', message);
            
            // Sign the message with the private key using the same method as OpenSSL
            const sig = new KJUR.crypto.Signature({"alg": "SHA256withRSA"});
            sig.init(privateKeyContent);
            
            // Ensure consistent UTF-8 encoding like OpenSSL does
            sig.updateString(message, 'utf8');
            const signature = sig.sign();
            
            // Convert signature to base64 for transmission (same as OpenSSL output)
            const signatureBase64 = hextob64(signature);
            console.log('Message being signed:', message);
            console.log('Generated signature (hex):', signature);
            console.log('Generated signature (base64):', signatureBase64);
            
            // Don't try to guess the key ID - let the server try all keys
            const keyId = 'unknown';
            
            console.log('Sending authentication request...');
            
            // Send to server for verification
            sendAuthRequest(message, signatureBase64, keyId);
        } catch (error) {
            console.error('Authentication error:', error);
            updateStatus('认证失败：' + error.message, 'error');
        }
    }

    // Send authentication request to server
    function sendAuthRequest(message, signature, keyId) {
        updateStatus('正在验证...', 'info');
        
        fetch('/api/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                signature,
                keyId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Store authentication in session storage
                sessionStorage.setItem('authenticated', 'true');
                
                // Show success message
                updateStatus('认证成功！正在跳转到看书平台...', 'success');
                
                // Redirect to book platform after successful authentication
                setTimeout(() => {
                    window.location.href = 'tobooks-main/index.html';
                }, 1000);
            } else {
                updateStatus('认证失败：' + (data.error || '签名验证不通过'), 'error');
            }
        })
        .catch(error => {
            console.error('Server verification error:', error);
            updateStatus('服务器验证错误：' + error.message, 'error');
        });
    }

    // Check if user is already authenticated
    function checkAuthStatus() {
        if (sessionStorage.getItem('authenticated') === 'true') {
            if (loginForm) {
                loginForm.style.display = 'none';
            }
            if (protectedContent) {
                protectedContent.style.display = 'block';
            }
        }
    }

    // Logout function
    function logout() {
        sessionStorage.removeItem('authenticated');
        if (protectedContent) {
            protectedContent.style.display = 'none';
        }
        if (loginForm) {
            loginForm.style.display = 'block';
        }
        if (privateKeyInput) {
            privateKeyInput.value = '';
        }
        if (authenticateBtn) {
            authenticateBtn.disabled = true;
        }
        updateStatus('', '');
    }

    // Update status message
    function updateStatus(message, type) {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = '';
            if (type) {
                statusMessage.classList.add(type);
            }
        }
    }
});