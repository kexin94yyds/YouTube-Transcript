# Tobooks Troubleshooting Log

本文档用于记录支付相关及其他关键故障的排查过程，便于未来遇到类似问题时快速定位原因与解决方案。每次解决新的典型问题时，请新增一个章节并按时间顺序补充细节。

---

## 2025-10-13 · 支付二维码扫码提示“已过期”

### 现象
- 打开 `https://tobooks.netlify.app` 后点击“立即购买”，浏览器控制台出现 `http://localhost:3003/api/health net::ERR_CONNECTION_REFUSED`。
- 浏览器直接访问 `http://localhost:3003` 或 `/api/health` 显示“无法访问此页面”。
- 即便成功生成二维码，微信扫码仍提示“二维码已过期，请重新生成”。

### 根因
1. **本地支付服务器未运行或以开发模式启动**：
   - `payment.js` 会调用 `http://localhost:3003`。当支付服务未运行时，浏览器连接被拒绝。
   - 开发模式 (`DEV_MODE=true`) 会返回模拟二维码链接（`weixin://wxpay/bizpayurl/up?pr=mock_...`），导致扫码报“已过期”。
2. **系统代理拦截本地回环地址**：
   - 机器启用了全局代理，`localhost` 未加入“直连”列表，浏览器流量被转发到代理端口，因此即使服务正常运行也会出现连接被拒绝。

### 解决步骤
1. **确保支付服务以生产模式运行**
   ```bash
   cd "/Users/apple/Tobooks 付费版/tobooks/nativePaySDK"
   # 停掉旧进程（如有）
   kill <旧的PID>
   # 启动生产模式（真实微信）
   nohup node payment-server.js >> ../payment-server.log 2>&1 &
   ```
   - 日志 `payment-server.log` 中应出现 `📌 运行模式: 生产模式（真实支付）`。
2. **绕过本地代理访问端口 3003**
   - 在代理工具（如 Clash）中，将 `localhost` / `127.0.0.1` 加入直连名单，或暂时关闭代理。
   - 在终端验证：
     ```bash
     curl --noproxy '*' http://127.0.0.1:3003/api/health
     ```
     返回 `success: true` 代表服务可用。
3. **刷新页面重新创建订单**
   - 付款弹窗中的二维码应更新为微信返回的真实链接，扫码不再提示过期。

### 验证
- 浏览器网络面板：`/api/health` 与 `/api/create-payment` 返回 200。
- 终端 `curl --noproxy '*' http://127.0.0.1:3003/api/health` 返回成功。
- 微信扫码可正常进入支付页面。

### 备注 / 预防措施
- 每次重启电脑后需要重新启动支付服务。
- 将 `nohup node payment-server.js...` 命令写入脚本或使用 `pm2` 等进程守护工具，可保证服务长期运行。
- 若部署线上，应将 `PAYMENT_CONFIG.API_URL` 替换为公网地址，并在微信商户平台配置对应的回调 URL。

---

## 2025-10-18 · 手机端无法访问支付功能 + 二维码不显示

### 现象
- **手机端**：打开 `https://tobooks.netlify.app` 点击"立即购买"，弹出"网络连接失败，请检查网络后重试"错误。
- **电脑端**：本地测试正常，支付服务器运行正常，可以生成订单。
- **二维码问题**：支付弹窗能打开，但二维码区域空白，无法显示二维码。

### 根因
1. **手机端无法访问本地服务器**：
   - 前端配置使用 `http://localhost:3003`，手机和电脑不在同一网络环境。
   - 手机浏览器无法访问电脑上的 `localhost` 地址。
   
2. **API 字段命名不一致**：
   - 阿里云 FC API 返回的是 `code_url`（下划线命名）。
   - 前端代码期望的是 `codeUrl`（驼峰命名）。
   - 导致二维码 URL 没有正确传递给二维码生成器。

### 解决步骤
1. **更新 API 地址为公网地址**
   ```javascript
   // payment.js
   const PAYMENT_CONFIG = {
       API_URL: 'https://wechat-y-server-vjfbztievl.cn-shanghai.fcapp.run', // 阿里云FC
       // 之前是：API_URL: 'http://localhost:3003'
   };
   ```

2. **兼容 API 返回的字段命名**
   ```javascript
   // payment.js - createPaymentOrder 函数
   return {
       success: true,
       orderNo: data.orderNo,
       codeUrl: data.codeUrl || data.code_url  // 兼容两种命名方式
   };
   ```

3. **提交并部署到 Netlify**
   ```bash
   git add payment.js
   git commit -m "fix: 更新支付API地址并兼容字段命名"
   git push origin main
   ```

### 验证
- **测试阿里云 FC API**：
  ```bash
  curl -X POST https://wechat-y-server-vjfbztievl.cn-shanghai.fcapp.run/api/create-payment \
    -H "Content-Type: application/json" \
    -d '{"videoId":"tobooks_premium","videoTitle":"Tobooks完整版","amount":19900,"userEmail":"test@example.com","userId":"test123"}'
  ```
  返回包含 `code_url` 的成功响应。

- **手机端测试**：刷新页面，点击"立即购买"，可以正常弹出支付弹窗。
- **二维码显示**：支付弹窗中显示微信支付二维码，可以扫码支付。
- **电脑端测试**：同样正常工作。

### 备注 / 预防措施
- 使用公网 API 地址（阿里云 FC）可以让手机和电脑都能访问。
- API 设计时注意字段命名一致性，或在前端做好兼容处理。
- 本地开发时可以使用 `ngrok` 等工具临时暴露本地服务供手机测试。
- 阿里云 FC 地址：`https://wechat-y-server-vjfbztievl.cn-shanghai.fcapp.run`

---

> **更新说明**：未来若出现新的典型问题，请复制上述结构新增章节，并记录时间、症状、原因、处理步骤与验证方法，以保证该文档持续有效。
