# WeChat Pay Integration Guide

This guide will help you set up WeChat Pay for your EPUB Reader application.

## 🚀 Quick Start

Your application now includes:
- ✅ Immediate paywall on page load
- ✅ WeChat Pay integration with QR code
- ✅ Real-time payment status checking
- ✅ Automatic feature unlock after payment
- ✅ Webhook handling for payment notifications

## 📋 Prerequisites

1. **WeChat Pay Merchant Account**
   - Register at [WeChat Pay](https://pay.weixin.qq.com/)
   - Get your App ID, Merchant ID, and API Key
   - Set up your business verification

2. **Supabase Database**
   - Create account at [Supabase](https://supabase.com)
   - Run the SQL script from `lib/db/init.sql`

## 🔧 Environment Setup

### 1. Local Development

Create `.env.local` file:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# WeChat Pay (Production)
WECHAT_APP_ID=your_wechat_app_id
WECHAT_MCH_ID=your_merchant_id
WECHAT_KEY=your_32_character_api_key
WECHAT_NOTIFY_URL=https://your-domain.vercel.app/api/wechat-notify

# Development
NODE_ENV=development
```

### 2. Vercel Deployment

1. Deploy to Vercel:
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

2. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add all environment variables from `.env.local`

## 💳 WeChat Pay Configuration

### 1. Payment Flow

```
User clicks "微信支付" → 
Create order in database → 
Generate WeChat Pay QR code → 
User scans and pays → 
WeChat sends notification → 
Update user status → 
Unlock all features
```

### 2. API Endpoints

- **POST /api/wechat-pay** - Create payment orders and check status
- **POST /api/wechat-notify** - Handle WeChat payment notifications
- **POST /api/auth** - User authentication

### 3. Testing Payment

For development/testing:
1. User registers/logs in
2. Clicks "立即微信支付"
3. QR code is generated (demo QR code)
4. After 5 seconds, payment is automatically marked as successful
5. All features are immediately unlocked

## 🔒 Security Features

### Current Implementation:
- ✅ Immediate paywall (no free access)
- ✅ Server-side payment verification
- ✅ Database transaction logging
- ✅ Signature verification for webhooks
- ✅ User session management

### Production Recommendations:
- Use HTTPS only
- Implement rate limiting
- Add CSRF protection
- Use JWT tokens instead of simple base64
- Add input validation and sanitization

## 📱 User Experience

### Payment Process:
1. **Landing Page**: Immediate paywall with feature list
2. **Registration**: Simple phone + verification code
3. **Payment**: WeChat QR code scanning
4. **Success**: Instant feature unlock with success message
5. **Usage**: Full access to all EPUB reading features

### Features Unlocked After Payment:
- ✅ Upload and read unlimited EPUB files
- ✅ Full-text search within books
- ✅ Navigation controls (prev/next)
- ✅ Keyboard shortcuts
- ✅ Return to contents functionality

## 🛠️ Customization

### Modify Payment Amount:
Edit in `api/wechat-pay.js`:
```javascript
const totalFee = 2900 // 29元 = 2900分
```

### Change Payment Description:
```javascript
body: 'EPUB阅读器-终身会员'
```

### Update Success Message:
Edit in `index.html` around line with success alert.

## 📊 Database Schema

### Users Table:
- `phone` - User identifier
- `name` - Display name
- `is_paid` - Payment status (boolean)
- `paid_at` - Payment timestamp

### Orders Table:
- `order_id` - Unique order identifier
- `user_id` - Foreign key to users
- `amount` - Payment amount (29.00)
- `status` - pending/success/failed
- `wechat_transaction_id` - WeChat transaction ID

## 🚨 Troubleshooting

### Common Issues:

1. **Payment not updating**
   - Check webhook URL is accessible
   - Verify environment variables
   - Check Supabase connection

2. **QR code not showing**
   - Verify API endpoint is working
   - Check browser console for errors
   - Ensure user is logged in

3. **Features not unlocking**
   - Check user `is_paid` status in database
   - Verify localStorage is updated
   - Refresh page after payment

## 📞 Support

For WeChat Pay specific issues:
- Check WeChat Pay merchant dashboard
- Verify webhook notifications are being received
- Test with WeChat Pay sandbox environment first

## 🎯 Next Steps

1. **Test the current implementation**
2. **Set up Supabase database**
3. **Configure WeChat Pay merchant account**
4. **Deploy to Vercel**
5. **Test payment flow end-to-end**

Your EPUB Reader with WeChat Pay is now ready for deployment! 🚀