const fs = require('fs');
const crypto = require('crypto');

// Create keys directory if it doesn't exist
if (!fs.existsSync('keys')) {
  fs.mkdirSync('keys');
}

// Generate 10 key pairs
for (let i = 1; i <= 10; i++) {
  console.log(`Generating key pair ${i}...`);
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  fs.writeFileSync(`keys/private_${i}.pem`, privateKey.export({ 
    type: 'pkcs1', 
    format: 'pem' 
  }));
  
  fs.writeFileSync(`keys/public_${i}.pem`, publicKey.export({ 
    type: 'pkcs1', 
    format: 'pem' 
  }));
}

console.log('All key pairs generated successfully!');