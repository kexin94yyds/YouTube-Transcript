import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, signature, keyId } = req.body;

    if (!message || !signature) {
      return res.status(400).json({ success: false, error: 'Missing message or signature' });
    }

    // Try to verify against all 10 public keys if keyId is not reliable
    const publicKeysDir = path.join(process.cwd(), 'keys');
    let verified = false;
    let usedKeyId = null;

    // Try keys 1-10
    for (let i = 1; i <= 10; i++) {
      try {
        const publicKeyPath = path.join(publicKeysDir, `public_${i}.pem`);
        
        if (!fs.existsSync(publicKeyPath)) {
          continue;
        }

        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        
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
        }
        
        if (isValid) {
          verified = true;
          usedKeyId = `key${i}`;
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

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
}