// Clean authentication API - completely rewritten
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, phone, name, code } = req.body

    // Basic phone validation
    if (!phone || phone.length < 3) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }

    // Demo verification code validation
    if (code !== '1234') {
      return res.status(400).json({ error: '验证码错误，演示请输入：1234' })
    }

    if (action === 'register') {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: '请输入姓名' })
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single()

      if (existingUser) {
        return res.status(400).json({ error: '用户已存在，请直接登录' })
      }

      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([
          {
            phone: phone,
            name: name.trim(),
            is_paid: false,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('User creation failed:', error)
        return res.status(500).json({ error: '注册失败，请重试' })
      }

      // Generate token
      const token = Buffer.from(`${phone}:${Date.now()}`).toString('base64')

      return res.status(200).json({
        success: true,
        message: '注册成功',
        token: token,
        user: {
          id: newUser.id,
          phone: newUser.phone,
          name: newUser.name,
          isPaid: newUser.is_paid
        }
      })

    } else if (action === 'login') {
      // Find user
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single()

      if (error || !user) {
        return res.status(400).json({ error: '用户不存在，请先注册' })
      }

      // Generate token
      const token = Buffer.from(`${phone}:${Date.now()}`).toString('base64')

      return res.status(200).json({
        success: true,
        message: '登录成功',
        token: token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          isPaid: user.is_paid
        }
      })
    }

    return res.status(400).json({ error: '无效的操作' })

  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({ error: '服务器错误，请重试' })
  }
}