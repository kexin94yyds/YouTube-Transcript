# Vercel 网站部署步骤

## 步骤1：访问 Vercel 并登录

1. 打开浏览器，访问：https://vercel.com
2. 点击右上角的 **"Sign Up"** 或 **"Log In"**
3. 选择 **"Continue with GitHub"**（推荐，因为你的代码在 GitHub 上）
4. 授权 Vercel 访问你的 GitHub 账号

## 步骤2：创建新项目

1. 登录后，点击右上角的 **"Add New..."** 按钮
2. 选择 **"Project"**
3. 在项目列表中，找到你的仓库：**`kexin94yyds/tobooks`**
4. 如果看不到，点击 **"Import Git Repository"**，然后搜索 `kexin94yyds/tobooks`

## 步骤3：配置项目

在项目配置页面：

1. **Project Name（项目名称）**：
   - 可以改为：`tobooks-cutting-api` 或保持默认

2. **Root Directory（根目录）**：
   - 保持默认：`.`（根目录）

3. **Framework Preset（框架预设）**：
   - 选择：**"Other"** 或 **"Other"**

4. **Build Command（构建命令）**：
   - **留空**（不需要构建）

5. **Output Directory（输出目录）**：
   - **留空**（不需要输出目录）

6. **Install Command（安装命令）**：
   - 保持默认：`npm install` 或 `yarn install`

7. **Environment Variables（环境变量）**：
   - 点击 **"Add"** 添加环境变量：
     - **Name**: `NODE_ENV`
     - **Value**: `production`
   - 点击 **"Add"** 再添加一个：
     - **Name**: `PORT`
     - **Value**: `3001`（可选，Vercel 会自动分配）

## 步骤4：部署

1. 点击页面底部的 **"Deploy"** 按钮
2. 等待部署完成（通常需要 1-3 分钟）
3. 部署完成后，你会看到一个绿色的 **"Success"** 提示

## 步骤5：获取部署 URL

部署完成后：

1. 在项目页面，你会看到一个 **"Visit"** 按钮
2. 点击后会打开你的部署网站
3. **复制浏览器地址栏的 URL**，例如：
   ```
   https://tobooks-cutting-api.vercel.app
   ```
   或者
   ```
   https://tobooks-xxxxx.vercel.app
   ```

## 步骤6：测试 API

在浏览器中访问以下 URL 来测试 API 是否正常工作：

1. **上传端点测试**：
   ```
   https://你的项目名.vercel.app/upload
   ```
   应该返回一个错误（因为没有上传文件），但不会返回 404

2. **下载端点测试**：
   ```
   https://你的项目名.vercel.app/download
   ```
   同样应该返回错误而不是 404

如果返回 404，说明路由配置有问题，需要检查 `vercel.json` 配置。

## 步骤7：更新前端配置

获取到 Vercel URL 后，有两种方式配置前端：

### 方式A：通过 Netlify 环境变量（推荐）

1. 访问你的 Netlify 项目：https://app.netlify.com
2. 找到项目 `tobooks`
3. 进入 **"Site settings"** → **"Environment variables"**
4. 点击 **"Add a variable"**
5. 添加：
   - **Key**: `CUTTING_API_URL`
   - **Value**: 你的 Vercel URL（例如：`https://tobooks-cutting-api.vercel.app`）
6. 点击 **"Save"**
7. 在 `tobooks-main/index.html` 的 `<head>` 部分（大约第 8 行之后）添加：
   ```html
   <script>
     window.CUTTING_API_URL = 'https://你的Vercel项目名.vercel.app';
   </script>
   ```
8. 提交并推送更改：
   ```bash
   git add tobooks-main/index.html
   git commit -m "配置Vercel API地址"
   git push origin main
   ```

### 方式B：直接修改代码

1. 编辑 `tobooks-main/index.html`
2. 找到第 1050 行左右：
   ```javascript
   const API_BASE_URL = window.CUTTING_API_URL || 
                       (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                           ? '' 
                           : ''); // 这里填入你的Vercel URL
   ```
3. 将最后的空字符串 `''` 替换为你的 Vercel URL：
   ```javascript
   const API_BASE_URL = window.CUTTING_API_URL || 
                       (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                           ? '' 
                           : 'https://你的Vercel项目名.vercel.app');
   ```
4. 保存文件，提交并推送：
   ```bash
   git add tobooks-main/index.html
   git commit -m "配置Vercel API地址"
   git push origin main
   ```

## 步骤8：测试

1. 等待 Netlify 自动部署完成（通常 1-2 分钟）
2. 访问你的网站：https://tobooks.netlify.app/tobooks-main/
3. 点击"切书"按钮开启切书模式
4. 拖入或选择 EPUB 文件
5. 检查是否能正常切书并下载

## 故障排除

### 如果部署后仍然报 404：

1. **检查 vercel.json 配置**：
   - 确保 `vercel.json` 文件在项目根目录
   - 检查路由配置是否正确

2. **查看 Vercel 日志**：
   - 在 Vercel 项目页面，点击 **"Deployments"**
   - 点击最新的部署记录
   - 查看 **"Function Logs"** 或 **"Build Logs"**

3. **检查文件路径**：
   - 确保 `book-cutting-server.js` 在项目根目录
   - 确保 `vercel.json` 在项目根目录

### 如果遇到 CORS 错误：

代码中已经添加了 CORS 支持，如果还有问题，检查 `book-cutting-server.js` 中的 CORS 配置。

### 如果遇到 shell 脚本执行错误：

Vercel 的 serverless 环境可能不支持执行 shell 脚本（`切书神技.zsh`）。如果遇到这个问题，可能需要：
1. 使用 Railway 或 Render（支持完整的 Node.js 环境）
2. 或者将切书逻辑改为纯 Node.js 实现

## 完成！

部署完成后，你的切书功能就可以在 Netlify 上正常使用了！

