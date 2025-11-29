const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 批量生成私钥系统 - 支持多设备使用
function generateBatchKeys() {
    console.log('🔑 开始生成批量私钥系统...\n');
    
    // 确保目录存在
    const keysDir = path.join(__dirname, 'keys');
    const batchDir = path.join(__dirname, 'batch_keys');
    
    [keysDir, batchDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // 生成多个用户组，每组支持多个设备
    const userGroups = [
        { name: 'premium_users', count: 20 },    // 高级用户 - 20个私钥
        { name: 'standard_users', count: 50 },   // 标准用户 - 50个私钥
        { name: 'trial_users', count: 100 }      // 试用用户 - 100个私钥
    ];

    let totalGenerated = 0;

    userGroups.forEach(group => {
        console.log(`📦 生成 ${group.name} 组密钥 (${group.count} 个)...`);
        
        const groupDir = path.join(batchDir, group.name);
        if (!fs.existsSync(groupDir)) {
            fs.mkdirSync(groupDir, { recursive: true });
        }

        for (let i = 1; i <= group.count; i++) {
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

                const keyId = `${group.name}_${i}`;
                
                // 保存私钥到批量目录
                const privateKeyPath = path.join(groupDir, `private_${i}.pem`);
                fs.writeFileSync(privateKeyPath, privateKey);

                // 保存公钥到主keys目录（服务器使用）
                const publicKeyPath = path.join(keysDir, `public_${keyId}.pem`);
                fs.writeFileSync(publicKeyPath, publicKey);

                // 创建使用说明
                createKeyInstructions(groupDir, i, group.name);

                totalGenerated++;
                
                if (i % 10 === 0) {
                    console.log(`   ✅ ${group.name}: ${i}/${group.count} 完成`);
                }

            } catch (error) {
                console.error(`❌ 生成 ${keyId} 失败:`, error.message);
            }
        }
        
        console.log(`✅ ${group.name} 组完成 (${group.count} 个密钥)\n`);
    });

    // 创建分发包
    createDistributionPackages(userGroups);
    
    console.log(`🎉 批量密钥生成完成！`);
    console.log(`📊 总计生成: ${totalGenerated} 个密钥对`);
    console.log(`📁 私钥位置: batch_keys/`);
    console.log(`📁 公钥位置: keys/`);
}

// 创建密钥使用说明
function createKeyInstructions(keyDir, keyIndex, groupName) {
    const instructions = `# 私钥使用说明 - ${groupName.toUpperCase()}

## 🔐 您的专属访问密钥 #${keyIndex}

这是您的专属私钥，可以在以下情况使用：
- ✅ 多个设备同时使用（手机、电脑、平板）
- ✅ 多个浏览器同时登录
- ✅ 分享给信任的家人朋友
- ✅ 永久有效，无需续费

## 📱 支持的使用场景

1. **个人多设备**: 在家用电脑、办公电脑、手机上同时使用
2. **家庭共享**: 与家人分享，全家都能使用
3. **备份存储**: 保存到云盘，随时随地访问
4. **离线使用**: 私钥验证在本地进行，无需网络

## 🚀 使用方法

1. 访问: https://tobooks.netlify.app
2. 复制 private_${keyIndex}.pem 文件内容
3. 粘贴到私钥输入框
4. 点击"验证身份"
5. 认证成功后即可使用所有功能

## ⚠️ 安全提示

- 请妥善保管此私钥文件
- 不要在不信任的网站使用
- 建议保存多个备份
- 如有问题，请联系技术支持

---
生成时间: ${new Date().toLocaleString()}
密钥类型: RSA-2048
适用范围: ${groupName}
`;

    fs.writeFileSync(path.join(keyDir, `使用说明_${keyIndex}.md`), instructions);
}

// 创建分发包
function createDistributionPackages(userGroups) {
    console.log('📦 创建分发包...');
    
    const distDir = path.join(__dirname, 'distribution');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    userGroups.forEach(group => {
        const groupDistDir = path.join(distDir, group.name);
        if (!fs.existsSync(groupDistDir)) {
            fs.mkdirSync(groupDistDir, { recursive: true });
        }

        // 创建组说明文件
        const groupReadme = `# ${group.name.toUpperCase()} 密钥包

## 📊 包含内容
- 私钥数量: ${group.count} 个
- 每个私钥支持: 无限设备使用
- 有效期: 永久
- 功能权限: 完整 EPUB 阅读器功能

## 🔄 分发建议
1. 每个用户分配 1-3 个私钥（作为备份）
2. 可以按需分配给不同用户群体
3. 建议为重要用户预留额外私钥

## 📁 文件结构
- private_X.pem: 私钥文件
- 使用说明_X.md: 详细使用指南
`;
        
        fs.writeFileSync(path.join(groupDistDir, 'README.md'), groupReadme);
        
        console.log(`   ✅ ${group.name} 分发包创建完成`);
    });
}

// 执行生成
if (require.main === module) {
    generateBatchKeys();
}

module.exports = { generateBatchKeys };
