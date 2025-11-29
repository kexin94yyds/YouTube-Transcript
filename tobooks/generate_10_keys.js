const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 确保keys目录存在
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

console.log('开始生成10个RSA密钥对...\n');

for (let i = 1; i <= 10; i++) {
    try {
        // 生成2048位RSA密钥对
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs1',
                format: 'pem'
            }
        });

        // 保存私钥
        const privateKeyPath = path.join(keysDir, `private_${i}.pem`);
        fs.writeFileSync(privateKeyPath, privateKey);

        // 保存公钥
        const publicKeyPath = path.join(keysDir, `public_${i}.pem`);
        fs.writeFileSync(publicKeyPath, publicKey);

        console.log(`✅ 密钥对 ${i} 生成成功:`);
        console.log(`   私钥: keys/private_${i}.pem`);
        console.log(`   公钥: keys/public_${i}.pem`);
        console.log('');

    } catch (error) {
        console.error(`❌ 生成密钥对 ${i} 失败:`, error.message);
    }
}

console.log('🎉 所有密钥对生成完成！');
console.log('\n📋 使用说明:');
console.log('- 将 private_1.pem 到 private_10.pem 分发给10个用户');
console.log('- 用户使用私钥内容进行认证');
console.log('- 服务器使用对应的公钥验证签名');