# 快速部署指南

## 问题
当前在 Netlify 上使用切书功能时出现 404 错误，因为后端 API 还没有部署。

## 解决方案
将切书 API 部署到 Vercel，然后在前端配置 API 地址。

## 部署步骤

### 方法1：使用命令行（推荐）

1. **安装 Vercel CLI**（如果还没有）：
```bash
npm install -g vercel
```

2. **登录 Vercel**：
```bash
vercel login
```

3. **在项目根目录部署**：
```bash
cd /Users/apple/看书神器/tobooks
vercel --prod
```

4. **复制部署URL**：
部署完成后，Vercel 会显示一个 URL，例如：`https://tobooks-cutting-api.vercel.app`

5. **更新前端配置**：
有两种方式：

**方式A：通过 Netlify 环境变量（推荐）**
- 在 Netlify 项目设置中添加环境变量：
  - 变量名：`CUTTING_API_URL`
  - 值：你的 Vercel URL（如 `https://tobooks-cutting-api.vercel.app`）
- 然后在 `tobooks-main/index.html` 的 `<head>` 部分添加：
```html
<script>
  window.CUTTING_API_URL = 'https://tobooks-cutting-api.vercel.app';
</script>
```

**方式B：直接修改代码**
- 编辑 `tobooks-main/index.html`，找到第 1050 行：
```javascript
const API_BASE_URL = window.CUTTING_API_URL || 
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                        ? '' 
                        : ''); // 这里填入你的Vercel URL
```
- 将最后的空字符串 `''` 替换为你的 Vercel URL，例如：
```javascript
const API_BASE_URL = window.CUTTING_API_URL || 
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                        ? '' 
                        : 'https://tobooks-cutting-api.vercel.app');
```

6. **提交并推送更改**：
```bash
git add tobooks-main/index.html
git commit -m "配置外部API地址"
git push origin main
```

### 方法2：使用 Vercel 网站

1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 选择你的 GitHub 仓库 `kexin94yyds/tobooks`
5. 配置：
   - Framework Preset: Other
   - Root Directory: `.`（根目录）
   - Build Command: （留空）
   - Output Directory: （留空）
6. 点击 "Deploy"
7. 等待部署完成，复制部署 URL
8. 按照上面的步骤5更新前端配置

## 注意事项

⚠️ **重要**：Vercel 的 serverless 函数环境可能不支持执行 shell 脚本（`切书神技.zsh`）。如果部署后仍然报错，可能需要：

1. **使用 Railway 或 Render**（这些平台支持完整的 Node.js 环境）
2. **或者将切书逻辑改为纯 Node.js 实现**（不使用 shell 脚本）

## 测试

部署完成后：
1. 访问你的 Netlify 网站：https://tobooks.netlify.app/tobooks-main/
2. 点击"切书"按钮开启切书模式
3. 拖入或选择 EPUB 文件
4. 检查是否能正常切书并下载

## 故障排除

如果遇到问题：
1. **检查 API URL**：确保前端配置的 API URL 正确
2. **检查 CORS**：确保服务器允许跨域请求（代码中已添加）
3. **查看 Vercel 日志**：在 Vercel 项目页面查看函数日志
4. **测试 API**：直接在浏览器访问 `https://your-api.vercel.app/upload`，看是否有响应

