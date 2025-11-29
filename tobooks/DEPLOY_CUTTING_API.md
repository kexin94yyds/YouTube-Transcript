# 切书API部署指南

本指南将帮助你将切书功能部署到外部服务器（如 Vercel、Railway 等），以便在 Netlify 上使用时也能调用切书功能。

## 方案说明

由于 Netlify 是静态网站托管，无法运行 Node.js 服务器，因此需要将切书服务部署到支持 Node.js 的平台。

## 部署选项

### 选项1：Vercel（推荐）

Vercel 支持 Node.js 服务器，并且可以执行 shell 脚本（需要配置）。

#### 部署步骤：

1. **安装 Vercel CLI**（如果还没有）：
```bash
npm i -g vercel
```

2. **登录 Vercel**：
```bash
vercel login
```

3. **在项目根目录部署**：
```bash
vercel
```

4. **配置环境变量**（如果需要）：
   - 在 Vercel 项目设置中添加环境变量
   - 确保 `NODE_ENV=production`

5. **获取部署URL**：
   - 部署完成后，Vercel 会提供一个 URL，例如：`https://your-cutting-api.vercel.app`

6. **更新前端代码**：
   - 在 `tobooks-main/index.html` 中，找到 `API_BASE_URL` 配置
   - 将 `'https://your-cutting-api.vercel.app'` 替换为你的实际 Vercel URL

### 选项2：Railway

Railway 是一个支持多种运行时的平台，可以运行 Node.js 应用。

#### 部署步骤：

1. **访问 Railway**：https://railway.app
2. **创建新项目**，选择 "Deploy from GitHub repo"
3. **选择你的仓库**
4. **配置启动命令**：`node book-cutting-server.js`
5. **设置端口**：Railway 会自动分配端口，使用 `PORT` 环境变量
6. **获取部署URL**：Railway 会提供一个 URL
7. **更新前端代码**：将 URL 配置到前端

### 选项3：Render

Render 也支持 Node.js 应用。

#### 部署步骤：

1. **访问 Render**：https://render.com
2. **创建新的 Web Service**
3. **连接 GitHub 仓库**
4. **配置**：
   - Build Command: `npm install`
   - Start Command: `node book-cutting-server.js`
5. **获取部署URL**并更新前端代码

## 修改 book-cutting-server.js 以支持平台

如果部署到 Vercel 或其他平台，可能需要修改端口配置：

```javascript
const port = process.env.PORT || 3001;
```

## 前端配置

在前端代码中，有两种方式配置外部API：

### 方式1：通过环境变量（推荐）

在 Netlify 的环境变量中设置：
- 变量名：`CUTTING_API_URL`
- 值：你的外部API地址（如 `https://your-cutting-api.vercel.app`）

然后在 HTML 中添加：
```html
<script>
  window.CUTTING_API_URL = 'https://your-cutting-api.vercel.app';
</script>
```

### 方式2：直接修改代码

在 `tobooks-main/index.html` 中，找到：
```javascript
const API_BASE_URL = window.CUTTING_API_URL || 
                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                        ? '' 
                        : 'https://your-cutting-api.vercel.app');
```

将 `'https://your-cutting-api.vercel.app'` 替换为你的实际API地址。

## 注意事项

1. **文件大小限制**：
   - Vercel：上传文件大小限制为 4.5MB（免费版）
   - Railway：通常有更大的限制
   - 如果文件较大，可能需要使用流式上传

2. **执行时间限制**：
   - Vercel：免费版函数执行时间限制为 10 秒（Hobby）或 60 秒（Pro）
   - Railway：通常没有严格的时间限制
   - 如果处理时间较长，可能需要使用异步处理

3. **系统依赖**：
   - 确保部署平台支持执行 shell 脚本
   - 确保 pandoc 等工具可用（可能需要使用 Docker 镜像）

4. **CORS 配置**：
   - 如果遇到跨域问题，需要在服务器端添加 CORS 头：
   ```javascript
   app.use((req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
     res.header('Access-Control-Allow-Headers', 'Content-Type');
     next();
   });
   ```

## 测试

部署完成后，测试步骤：

1. 访问你的 Netlify 网站
2. 点击"切书"按钮开启切书模式
3. 拖入或选择 EPUB 文件
4. 检查是否能正常切书并下载

## 故障排除

如果遇到问题：

1. **检查 API URL**：确保前端配置的 API URL 正确
2. **检查 CORS**：确保服务器允许跨域请求
3. **检查日志**：查看部署平台的日志，找出错误原因
4. **测试 API**：直接访问 API 端点，确认服务正常运行

