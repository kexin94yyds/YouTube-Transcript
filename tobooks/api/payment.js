// Vercel Function for payment processing
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 微信支付配置（需要在Vercel环境变量中设置）
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID,
  mchId: process.env.WECHAT_MCH_ID,
  key: process.env.WECHAT_KEY,
  notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://your-domain.vercel.app/api/payment-notify'
}

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
    const { action } = req.body
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权访问' })
    }

    const token = authHeader.split(' ')[1]
    const [phone] = Buffer.from(token, 'base64').toString().split(':')

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (userError || !user) {
      return res.status(401).json({ error: '用户不存在' })
    }

    if (action === 'create-order') {
      // 检查用户是否已付费
      if (user.is_paid) {
        return res.status(400).json({ error: '您已经是付费用户了' })
      }

      // 生成订单号
      const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 创建支付订单记录
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_id: orderId,
            user_id: user.id,
            amount: 29.00,
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (orderError) {
        console.error('创建订单失败:', orderError)
        return res.status(500).json({ error: '创建订单失败' })
      }

      // 这里应该调用微信支付API创建预支付订单
      // 为了演示，我们返回模拟的支付信息
      return res.status(200).json({
        orderId: orderId,
        paymentUrl: `weixin://wxpay/bizpayurl?pr=${orderId}`,
        message: '订单创建成功'
      })

    } else if (action === 'check-payment') {
      const { orderId } = req.body
      
      if (!orderId) {
        return res.status(400).json({ error: '订单号不能为空' })
      }

      // 查询订单状态
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .eq('user_id', user.id)
        .single()

      if (orderError || !order) {
        return res.status(404).json({ error: '订单不存在' })
      }

      // 模拟支付成功（实际项目中应该查询微信支付接口）
      if (order.status === 'pending') {
        // 模拟3秒后支付成功
        const orderAge = Date.now() - new Date(order.created_at).getTime()
        if (orderAge > 3000) {
          // 更新订单状态
          await supabase
            .from('orders')
            .update({ 
              status: 'success',
              paid_at: new Date().toISOString()
            })
            .eq('order_id', orderId)

          // 更新用户付费状态
          await supabase
            .from('users')
            .update({ is_paid: true })
            .eq('id', user.id)

          return res.status(200).json({
            status: 'success',
            message: '支付成功！'
          })
        } else {
          return res.status(200).json({
            status: 'pending',
            message: '支付处理中...'
          })
        }
      }

      return res.status(200).json({
        status: order.status,
        message: order.status === 'success' ? '支付成功！' : '支付处理中...'
      })
    }

    return res.status(400).json({ error: '无效的操作' })

  } catch (error) {
    console.error('支付处理错误:', error)
    return res.status(500).json({ error: '服务器错误，请重试' })
  }
}