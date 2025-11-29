# Netlify 部署指南

## 问题说明
当前 Netlify 部署显示的是付费版 EPUB 阅读器页面，而不是私钥认证系统。

## 解决方案

### 1. 文件结构说明
- `index.html` - 私钥认证系统首页 ✅ (这是我们想要的首页)
- `auth-demo/index.html` - 认证系统演示页面
- `tobooks-main/index.html` - 免费的 EPUB 阅读器 ✅ (认证成功后跳转)
- `epub-reader.html` - 付费版 EPUB 阅读器 ❌ (不应该作为首页)

### 2. 已创建的配置文件
- `netlify.toml` - Netlify 构建和部署配置
- `_redirects` - 重定向规则，确保根路径指向正确的首页

### 3. 修改的文件
- `index.html` - 修改认证成功后跳转到 `tobooks-main/index.html`
- `auth-demo/js/auth.js` - 修改跳转路径

### 4. 部署步骤
1. 提交所有更改到 GitHub
2. 在 Netlify 中重新部署
3. 访问 https://tobooks.netlify.app 应该显示私钥认证系统

### 5. 认证流程
1. 访问网站 → 显示私钥认证界面
2. 输入私钥 → 验证身份
3. 认证成功 → 跳转到免费的 EPUB 阅读器

### 6. 如果问题仍然存在
检查 Netlify 部署设置：
- 确保 "Publish directory" 设置为 "." (根目录)
- 确保没有自定义的构建命令覆盖默认行为
- 检查部署日志中是否有错误信息
