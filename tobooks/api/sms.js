// Vercel Function for SMS verification
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// SMS service configuration (using Alibaba Cloud SMS as example)
const SMS_CONFIG = {
  accessKeyId: process.env.SMS_ACCESS_KEY_ID,
  accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
  signName: process.env.SMS_SIGN_NAME || 'EPUB阅读器',
  templateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_123456789'
}

// Generate random 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Simple rate limiting - store in memory (in production, use Redis)
const rateLimitStore = new Map()

function checkRateLimit(phone) {
  const key = `sms_${phone}`
  const now = Date.now()
  const lastSent = rateLimitStore.get(key)
  
  if (lastSent && now - lastSent < 60000) { // 1 minute limit
    return false
  }
  
  rateLimitStore.set(key, now)
  return true
}

// Mock SMS sending function (replace with real SMS service)
async function sendSMS(phone, code) {
  // In production, integrate with real SMS service like:
  // - Alibaba Cloud SMS
  // - Tencent Cloud SMS
  // - Twilio
  // - AWS SNS
  
  console.log(`[SMS Mock] Sending code ${code} to ${phone}`)
  
  // For demo purposes, we'll just log the code
  // In real implementation, you would call the SMS API here
  
  return {
    success: true,
    messageId: `msg_${Date.now()}`
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { phone } = req.body

    // Validate phone number
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }

    // Check rate limit
    if (!checkRateLimit(phone)) {
      return res.status(429).json({ error: '发送过于频繁，请稍后再试' })
    }

    // Generate verification code
    const code = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry

    // Store verification code in database
    const { error: insertError } = await supabase
      .from('verification_codes')
      .upsert([
        {
          phone: phone,
          code: code,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        }
      ], {
        onConflict: 'phone'
      })

    if (insertError) {
      console.error('Failed to store verification code:', insertError)
      return res.status(500).json({ error: '验证码生成失败，请重试' })
    }

    // Send SMS
    try {
      const smsResult = await sendSMS(phone, code)
      
      if (!smsResult.success) {
        throw new Error('SMS sending failed')
      }

      return res.status(200).json({
        message: '验证码已发送，请查收短信',
        expiresIn: 300 // 5 minutes in seconds
      })

    } catch (smsError) {
      console.error('SMS sending error:', smsError)
      
      // For demo purposes, still return success but log the code
      console.log(`[DEMO] Verification code for ${phone}: ${code}`)
      
      return res.status(200).json({
        message: '验证码已发送（演示模式：请查看控制台日志）',
        expiresIn: 300,
        demoCode: code // Only for demo - remove in production
      })
    }

  } catch (error) {
    console.error('SMS API error:', error)
    return res.status(500).json({ error: '服务器错误，请重试' })
  }
}