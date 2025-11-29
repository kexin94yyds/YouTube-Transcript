# 💳 微信支付功能测试指南

## 🚀 快速开始测试

### 1️⃣ 启动支付服务器

打开终端，执行以下命令：

```bash
cd "/Users/apple/Tobooks 付费版/tobooks/nativePaySDK"
node payment-server.js
```

或使用启动脚本：

```bash
chmod +x nativePaySDK/start-payment-server.sh
./nativePaySDK/start-payment-server.sh
```

你应该看到：
```
支付服务器运行在 http://localhost:3003
注意：请确保已配置正确的微信支付证书和密钥
回调地址: http://localhost:3003/api/payment-notify
```

---

### 2️⃣ 启动前端服务器

打开新的终端窗口，在项目根目录执行：

```bash
cd "/Users/apple/Tobooks 付费版/tobooks"
python -m http.server 8000
```

或：

```bash
npx http-server -p 8000
```

---

### 3️⃣ 测试完整流程

#### 步骤 1：访问网站
在浏览器中打开：`http://localhost:8000`

#### 步骤 2：查看功能介绍
- 你应该能看到右上角的"登录"按钮
- 滚动查看功能介绍
- 看到价格信息和"💳 立即购买（微信支付）"按钮

#### 步骤 3：测试未登录购买
- 点击"立即购买"按钮
- **预期结果**：弹出提示"请先登录再购买哦！"
- 自动跳转到登录页面

#### 步骤 4：登录
- 选择 Google 登录或邮箱登录
- **Google登录配置**：
  - Client ID: `74914972695-8jvht4rv2ucrpb18fd2fdpvanlmhdma8.apps.googleusercontent.com`
  - 已在 Supabase 配置完成
- **邮箱登录**：
  - 输入邮箱（如QQ邮箱）
  - 收取验证邮件并点击链接

#### 步骤 5：登录成功
- 自动返回主页
- 右上角显示用户头像和名字
- 显示"🆓 试用 (30/30)"或"💎 付费用户"

#### 步骤 6：再次点击购买
- 点击"立即购买（微信支付）"按钮
- 按钮变为"⏳ 创建订单中..."
- **预期结果**：弹出支付二维码弹窗

#### 步骤 7：查看支付二维码
弹窗应该显示：
- ✅ 标题："微信扫码支付"
- ✅ 二维码图片
- ✅ 金额："¥99.00"
- ✅ 提示："请使用微信扫描二维码完成支付"
- ✅ 订单号：如 `ORDER1738492345123`

#### 步骤 8：测试支付（开发模式）

**查看支付服务器配置：**

打开 `nativePaySDK/payment-server.js`，查看第28行：
```javascript
const DEV_MODE = process.env.DEV_MODE === 'true' || false;
```

**如果是开发模式（DEV_MODE = true）：**
- 二维码是模拟的
- 5秒后自动标记为支付成功

**如果是生产模式（DEV_MODE = false）：**
- 二维码是真实的微信支付链接
- 需要用微信扫码支付

#### 步骤 9：支付成功
- 支付弹窗自动关闭
- 显示支付成功弹窗："🎉 支付成功！"
- 点击"开始使用"按钮
- 页面刷新
- 用户状态变为"💎 付费用户"

---

## 🔍 调试技巧

### 查看控制台日志

**浏览器控制台**（F12 → Console）：
```
✅ Supabase 客户端初始化成功
✅ 用户已登录: user@example.com
当前状态: 免费用户
试用次数: 0/30
点击立即购买按钮
创建支付订单...
✅ 支付模块加载完成
```

**支付服务器终端**：
```
收到支付请求，请求体: { videoId: 'epub_reader_premium', ... }
✅ 支付二维码生成成功
订单号: ORDER1738492345123
微信返回的二维码URL: weixin://wxpay/bizpayurl?pr=...
```

### 常见问题排查

#### 问题1：点击"立即购买"没有反应
**解决方案**：
1. 打开浏览器控制台查看错误
2. 确认 `payment.js` 已正确加载
3. 确认支付服务器正在运行

#### 问题2：无法生成二维码
**解决方案**：
1. 确认 `qrcode.min.js` 已加载
2. 检查控制台是否有 QRCode 相关错误
3. 查看支付服务器是否返回了 `codeUrl`

#### 问题3：支付服务器启动失败
**解决方案**：
```bash
# 安装依赖
cd nativePaySDK
npm install express crypto fs path cors

# 重新启动
node payment-server.js
```

#### 问题4：支付成功但没有解锁
**解决方案**：
1. 检查支付服务器的轮询日志
2. 查看 `localStorage.getItem('isPremiumUser')`
3. 手动设置：`localStorage.setItem('isPremiumUser', 'true')`
4. 刷新页面

---

## 🧪 手动测试支付API

### 测试1：创建支付订单

```bash
curl -X POST http://localhost:3003/api/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "epub_reader_premium",
    "videoTitle": "EPUB阅读器完整版",
    "amount": 9900
  }'
```

**预期返回**：
```json
{
  "success": true,
  "orderNo": "ORDER1738492345123",
  "codeUrl": "weixin://wxpay/bizpayurl?pr=...",
  "message": "支付二维码生成成功"
}
```

### 测试2：查询支付状态

```bash
curl http://localhost:3003/api/payment-status/ORDER1738492345123
```

**预期返回**：
```json
{
  "success": true,
  "orderNo": "ORDER1738492345123",
  "status": "pending",
  "downloadUrl": "...",
  "videoTitle": "EPUB阅读器完整版",
  "message": "支付状态查询成功"
}
```

### 测试3：模拟支付成功（开发模式）

```bash
curl -X POST http://localhost:3003/api/mock-payment/ORDER1738492345123
```

---

## 📊 验收测试清单

### ✅ 登录功能
- [ ] 未登录时显示"登录"按钮
- [ ] Google 登录正常
- [ ] 邮箱登录正常
- [ ] 登录后显示用户信息
- [ ] 用户菜单正常显示
- [ ] 退出登录正常

### ✅ 支付功能
- [ ] 未登录点击购买会提示登录
- [ ] 登录后点击购买显示二维码
- [ ] 二维码正确生成
- [ ] 订单号正确显示
- [ ] 支付金额正确显示
- [ ] 支付成功后显示成功弹窗
- [ ] 支付成功后用户状态更新为"付费用户"

### ✅ 功能锁定
- [ ] 未付费用户显示试用次数
- [ ] 试用次数正确计数
- [ ] 试用结束后锁定功能
- [ ] 付费后所有功能解锁
- [ ] 刷新页面后状态保持

### ✅ 白名单功能
- [ ] 在 Supabase 添加白名单用户
- [ ] 白名单用户登录后自动解锁
- [ ] 显示"✨ 白名单用户"标识

---

## 🎯 生产环境配置

当测试通过后，准备上线：

### 1. 修改 `login.html` 重定向URL

在 `login.html` 第130行左右：
```javascript
'https://你的实际域名.netlify.app/index.html'
```

### 2. 配置 Supabase

在 Supabase Dashboard：
- **Authentication** → **URL Configuration**
- **Site URL**: `https://你的域名.netlify.app`
- **Redirect URLs**: `https://你的域名.netlify.app/**`

### 3. 部署到 Netlify

```bash
# 推送到 GitHub
git add .
git commit -m "feat: 集成微信支付功能"
git push

# 或使用 Netlify CLI
netlify deploy --prod
```

### 4. 配置支付回调地址

在 `payment-server.js` 中修改：
```javascript
notify_url: `https://你的域名/api/payment-notify`
```

同时在微信商户平台配置相同的回调地址。

---

## 💡 提示

### 开发模式 vs 生产模式

**开发模式**（`DEV_MODE = true`）：
- ✅ 生成模拟二维码
- ✅ 5秒后自动支付成功
- ✅ 快速测试流程
- ❌ 不调用真实微信支付API

**生产模式**（`DEV_MODE = false`）：
- ✅ 生成真实微信支付二维码
- ✅ 需要真实扫码支付
- ✅ 接收微信支付回调
- ⚠️ 需要配置微信商户号和证书

### 价格配置

当前配置：
- **三个月**: ¥99
- **一年**: ¥260

修改位置：
1. `index.html` - 显示价格
2. `payment.js` - `PAYMENT_CONFIG.PRODUCT_INFO.amount`

---

## 🎉 测试成功标志

当你看到以下现象，说明集成成功：

1. ✅ 点击"立即购买"显示二维码
2. ✅ 二维码清晰可见
3. ✅ 支付成功后显示"🎉 支付成功！"
4. ✅ 用户状态变为"💎 付费用户"
5. ✅ 刷新页面后状态保持

**恭喜！你的微信支付功能已经成功集成！** 🎊

---

需要帮助？查看：
- `README_微信支付集成.md` - 详细集成文档
- `UPGRADE_GUIDE.md` - 升级指南
- 浏览器控制台 - 查看错误日志
- 支付服务器终端 - 查看API调用日志

