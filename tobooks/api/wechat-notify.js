// WeChat Pay notification webhook handler
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const WECHAT_KEY = process.env.WECHAT_KEY || 'demo_key_32_characters_long_string'

// Verify WeChat Pay signature
function verifyWeChatSign(params, signature, key) {
  const sortedKeys = Object.keys(params).filter(k => k !== 'sign').sort()
  const stringA = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
  const stringSignTemp = `${stringA}&key=${key}`
  const calculatedSign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase()
  return calculatedSign === signature
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse WeChat Pay notification (usually XML format)
    const notificationData = req.body
    
    // In real implementation, you would parse XML here
    // For demo purposes, we'll handle JSON format
    const {
      return_code,
      result_code,
      out_trade_no,
      transaction_id,
      total_fee,
      time_end
    } = notificationData

    // Verify signature
    if (!verifyWeChatSign(notificationData, notificationData.sign, WECHAT_KEY)) {
      console.error('WeChat Pay signature verification failed')
      return res.status(400).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Signature verification failed]]></return_msg></xml>')
    }

    // Check if payment is successful
    if (return_code === 'SUCCESS' && result_code === 'SUCCESS') {
      // Update order status in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, users(*)')
        .eq('order_id', out_trade_no)
        .single()

      if (orderError || !order) {
        console.error('Order not found:', out_trade_no)
        return res.status(400).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Order not found]]></return_msg></xml>')
      }

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'success',
          paid_at: new Date().toISOString(),
          wechat_transaction_id: transaction_id
        })
        .eq('order_id', out_trade_no)

      // Update user paid status
      await supabase
        .from('users')
        .update({
          is_paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('id', order.user_id)

      console.log(`Payment successful for order: ${out_trade_no}, user: ${order.users.phone}`)

      // Return success response to WeChat
      return res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>')
    } else {
      console.error('Payment failed:', notificationData)
      return res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>')
    }

  } catch (error) {
    console.error('WeChat Pay notification processing error:', error)
    return res.status(500).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[System error]]></return_msg></xml>')
  }
}