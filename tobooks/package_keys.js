const fs = require('fs');
const path = require('path');

// Create distribution packages for each key
function packageKeys() {
  console.log('Creating distribution packages for private keys...');
  
  // Create distribution directory if it doesn't exist
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  
  // Package each key
  for (let i = 1; i <= 10; i++) {
    const keyDir = path.join(distDir, `key_package_${i}`);
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir);
    }
    
    // Copy private key
    const privateKeyPath = path.join(__dirname, 'keys', `private_${i}.pem`);
    if (fs.existsSync(privateKeyPath)) {
      fs.copyFileSync(
        privateKeyPath, 
        path.join(keyDir, `private_key.pem`)
      );
      
      // Create instructions file
      createInstructionsFile(keyDir, i);
      
      console.log(`✅ Created package for key ${i}`);
    } else {
      console.error(`❌ Private key ${i} not found`);
    }
  }
  
  console.log('\nAll packages created in the "dist" directory');
  console.log('You can now distribute these packages to your users');
}

// Create instructions file
function createInstructionsFile(keyDir, keyId) {
  const instructions = `# 私钥访问说明

感谢您使用我们的服务！这是您的专属私钥文件，用于访问受保护的网站内容。

## 使用方法

1. 访问我们的网站: http://example.com
2. 点击"上传私钥"按钮
3. 选择此文件夹中的 \`private_key.pem\` 文件
4. 点击"验证身份"按钮

## 安全提示

- 请妥善保管您的私钥文件，不要与他人共享
- 私钥代表您的身份，任何持有此文件的人都可以以您的名义访问系统
- 如果您怀疑私钥已泄露，请立即联系管理员更换

## 技术支持

如有任何问题，请联系技术支持：support@example.com

私钥ID: ${keyId}
`;

  fs.writeFileSync(path.join(keyDir, 'README.md'), instructions);
}

// Run the packaging function
packageKeys();