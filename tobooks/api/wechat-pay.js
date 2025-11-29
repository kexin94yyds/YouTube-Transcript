// WeChat Pay API - Complete Implementation
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import { wechatPay, paymentConfig, devConfig } from '../config/wechat-pay.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { action, phone, orderId } = req.body || req.query

    if (action === 'create') {
      return await createPaymentOrder(req, res, phone)
    } else if (action === 'check') {
      return await checkPaymentStatus(req, res, orderId)
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

  } catch (error) {
    console.error('WeChat Pay API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// Create payment order
async function createPaymentOrder(req, res, phone) {
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' })
  }

  try {
    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (userError || !user) {
      return res.status(400).json({ error: 'User not found' })
    }

    // Check if user already paid
    if (user.is_paid) {
      return res.status(400).json({ error: 'User already paid' })
    }

    // Generate unique order ID
    const orderId = `EPUB_${Date.now()}_${uuidv4().substring(0, 8)}`

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          order_id: orderId,
          user_id: user.id,
          phone: phone,
          amount: paymentConfig.amount / 100, // Convert to yuan
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (orderError) {
      console.error('Order creation failed:', orderError)
      return res.status(500).json({ error: 'Failed to create order' })
    }

    // Development mode - return demo QR code
    if (process.env.NODE_ENV !== 'production' || devConfig.autoSuccess) {
      const demoQRData = `weixin://wxpay/bizpayurl?pr=${orderId}`
      const qrCodeDataURL = await QRCode.toDataURL(demoQRData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Auto-mark as successful after delay in development
      if (devConfig.autoSuccess) {
        setTimeout(async () => {
          await markOrderAsSuccessful(orderId, user.id)
        }, devConfig.successDelay)
      }

      return res.status(200).json({
        success: true,
        orderId: orderId,
        qrCode: qrCodeDataURL,
        amount: paymentConfig.amount / 100,
        description: paymentConfig.description,
        isDemoMode: true
      })
    }

    // Production mode - create real WeChat Pay order
    if (wechatPay) {
      const wechatOrder = {
        appid: process.env.WECHAT_APP_ID,
        mchid: process.env.WECHAT_MCH_ID,
        description: paymentConfig.description,
        out_trade_no: orderId,
        notify_url: process.env.WECHAT_NOTIFY_URL,
        amount: {
          total: paymentConfig.amount,
          currency: paymentConfig.currency
        }
      }

      const result = await wechatPay.native(wechatOrder)
      
      if (result.code_url) {
        const qrCodeDataURL = await QRCode.toDataURL(result.code_url, {
          width: 256,
          margin: 2
        })

        return res.status(200).json({
          success: true,
          orderId: orderId,
          qrCode: qrCodeDataURL,
          amount: paymentConfig.amount / 100,
          description: paymentConfig.description,
          isDemoMode: false
        })
      } else {
        throw new Error('Failed to create WeChat Pay order')
      }
    } else {
      throw new Error('WeChat Pay not configured')
    }

  } catch (error) {
    console.error('Create payment order error:', error)
    return res.status(500).json({ error: 'Failed to create payment order' })
  }
}

// Check payment status
async function checkPaymentStatus(req, res, orderId) {
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID required' })
  }

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users(*)')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    return res.status(200).json({
      success: true,
      orderId: orderId,
      status: order.status,
      amount: order.amount,
      isPaid: order.status === 'success',
      user: {
        phone: order.users.phone,
        name: order.users.name,
        isPaid: order.users.is_paid
      }
    })

  } catch (error) {
    console.error('Check payment status error:', error)
    return res.status(500).json({ error: 'Failed to check payment status' })
  }
}

// Mark order as successful (helper function)
async function markOrderAsSuccessful(orderId, userId) {
  try {
    // Update order status
    await supabase
      .from('orders')
      .update({
        status: 'success',
        paid_at: new Date().toISOString(),
        wechat_transaction_id: `demo_${Date.now()}`
      })
      .eq('order_id', orderId)

    // Update user paid status
    await supabase
      .from('users')
      .update({
        is_paid: true,
        paid_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log(`Order ${orderId} marked as successful`)
  } catch (error) {
    console.error('Failed to mark order as successful:', error)
  }
}