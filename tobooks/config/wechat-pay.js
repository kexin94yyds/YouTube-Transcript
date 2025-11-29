// WeChat Pay Configuration
import { Payment } from 'wechatpay-node-v3'

// WeChat Pay configuration
const wechatPayConfig = {
  appid: process.env.WECHAT_APP_ID || 'demo_app_id',
  mchid: process.env.WECHAT_MCH_ID || 'demo_mch_id',
  private_key: process.env.WECHAT_PRIVATE_KEY || '',
  serial_no: process.env.WECHAT_SERIAL_NO || '',
  apiv3_private_key: process.env.WECHAT_APIV3_KEY || process.env.WECHAT_KEY || 'demo_key_32_characters_long_string',
  notify_url: process.env.WECHAT_NOTIFY_URL || 'https://your-domain.vercel.app/api/wechat-notify'
}

// Initialize WeChat Pay client
let wechatPay = null

try {
  if (process.env.NODE_ENV === 'production' && wechatPayConfig.private_key) {
    wechatPay = new Payment(wechatPayConfig)
  }
} catch (error) {
  console.warn('WeChat Pay initialization failed, using demo mode:', error.message)
}

// Payment configuration
export const paymentConfig = {
  amount: parseInt(process.env.PAYMENT_AMOUNT) || 2900, // 29元 = 2900分
  description: process.env.PAYMENT_DESCRIPTION || 'EPUB阅读器-终身会员',
  currency: 'CNY'
}

// Development settings
export const devConfig = {
  autoSuccess: process.env.DEV_AUTO_SUCCESS === 'true',
  successDelay: parseInt(process.env.DEV_SUCCESS_DELAY) || 5000
}

export { wechatPay, wechatPayConfig }
export default wechatPay