const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Serve static files for the EPUB reader at specific path
app.use('/tobooks-main', express.static(path.join(__dirname, 'tobooks-main')));

// Serve auth-demo static files
app.use('/auth-demo', express.static(path.join(__dirname, 'auth-demo')));

// Serve other static files (but exclude index.html to avoid conflicts)
app.use(express.static(__dirname, { 
  index: false,  // Don't serve index.html from root
  ignore: ['index.html'] // Ignore root index.html
}));

// Redirect root to main index.html (private key system)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the book platform after authentication
app.get('/books', (req, res) => {
  res.sendFile(path.join(__dirname, 'epub-reader.html'));
});

// Store public keys in memory - Load all 10 generated keys
const publicKeys = {};
let loadedKeysCount = 0;

for (let i = 1; i <= 10; i++) {
  try {
    const keyPath = path.join(__dirname, 'keys', `public_${i}.pem`);
    if (fs.existsSync(keyPath)) {
      const publicKey = fs.readFileSync(keyPath, 'utf8');
      publicKeys[`key${i}`] = publicKey;
      loadedKeysCount++;
    }
  } catch (error) {
    console.error(`Error loading public key ${i}:`, error);
  }
}

console.log(`✅ Loaded ${loadedKeysCount} public keys for authentication`);

// Authentication endpoint - Try all keys like the API version
app.post('/api/authenticate', (req, res) => {
  const { message, signature, keyId } = req.body;
  
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' });
  }
  
  // Try to verify against all loaded public keys
  let verified = false;
  let usedKeyId = null;
  
  for (let i = 1; i <= 10; i++) {
    const keyName = `key${i}`;
    const publicKey = publicKeys[keyName];
    
    if (!publicKey) continue;
    
    try {
      // Create verifier with same algorithm as frontend
      const verifier = crypto.createVerify('SHA256');
      verifier.update(message, 'utf8');
      
      // Convert base64 signature back to buffer
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      console.log(`Trying key ${i} with message: "${message}"`);
      console.log(`Signature length: ${signatureBuffer.length} bytes`);
      
      // Verify signature
      const isValid = verifier.verify(publicKey, signatureBuffer);
      
      if (isValid) {
        console.log(`✅ Signature verified successfully with key ${i}`);
        verified = true;
        usedKeyId = keyName;
        break;
      }
    } catch (error) {
      console.log(`Failed to verify with key ${i}:`, error.message);
      continue;
    }
  }
  
  if (verified) {
    return res.status(200).json({
      success: true,
      message: '认证成功',
      keyId: usedKeyId
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
  }
});

// Sample key endpoint for testing
app.get('/api/sample-key', (req, res) => {
  try {
    // Return the custom private key for testing purposes
    const sampleKeyPath = path.join(__dirname, 'keys', 'custom_private.pem');
    if (fs.existsSync(sampleKeyPath)) {
      const sampleKey = fs.readFileSync(sampleKeyPath, 'utf8');
      return res.type('text/plain').send(sampleKey);
    } else {
      // Fallback to the first private key if custom key not found
      const fallbackKeyPath = path.join(__dirname, 'keys', 'private_1.pem');
      if (fs.existsSync(fallbackKeyPath)) {
        const fallbackKey = fs.readFileSync(fallbackKeyPath, 'utf8');
        return res.type('text/plain').send(fallbackKey);
      } else {
        return res.status(404).send('Sample key not found');
      }
    }
  } catch (error) {
    console.error('Error serving sample key:', error);
    return res.status(500).send('Error serving sample key');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the private key authentication system`);
});