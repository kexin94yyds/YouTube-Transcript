# 📚 切书功能集成说明

## 功能简介

已成功将切书功能集成到EPUB阅读器中！现在你可以在阅读器的左侧看到一个紫色的切书按钮（📚），点击即可打开切书功能。

## 使用方法

### 1. 启动切书服务器

首先需要安装依赖并启动切书服务器：

```bash
# 安装依赖（首次使用）
npm install express multer archiver

# 启动切书服务器
./start-book-cutting-server.sh
```

或者手动启动：

```bash
node book-cutting-server.js
```

切书服务器将运行在 `http://localhost:3001`

### 2. 使用切书功能

1. 在EPUB阅读器页面（epub-reader.html）的左侧，你会看到一个固定的紫色按钮（📚）
2. 点击这个按钮会在新标签页打开切书功能页面
3. 在切书页面中：
   - 拖拽或点击上传EPUB文件
   - 等待处理完成
   - 下载切分后的章节文件（支持TXT、Markdown、HTML格式）

## 系统要求

确保已安装以下工具：

- **pandoc** - 文档转换工具
  ```bash
  brew install pandoc
  ```

- **Node.js** - 运行服务器
- **unzip** - ZIP解压工具（通常已预装）

## 切书功能特性

- ✅ 拖拽上传EPUB文件
- ✅ 自动按章节智能切分
- ✅ 支持多种输出格式（TXT、Markdown、HTML）
- ✅ 一键下载所有章节ZIP包
- ✅ 保存处理历史记录
- ✅ 美观的现代化界面

## 文件说明

- `book-cutting.html` - 切书功能页面
- `book-cutting-server.js` - 切书服务器（端口3001）
- `切书神技.zsh` - 切书处理脚本
- `start-book-cutting-server.sh` - 启动脚本

## 注意事项

1. 切书服务器使用端口 **3001**，与主服务器（通常8080或3000）分离
2. 处理大文件时请耐心等待
3. 切分后的文件会保存在项目目录下
4. 首次使用时，脚本会自动设置执行权限

## 故障排除

如果遇到问题：

1. 确保pandoc已安装：`pandoc --version`
2. 确保切书脚本有执行权限：`chmod +x 切书神技.zsh`
3. 检查Node.js依赖是否安装：`npm install`
4. 查看服务器日志中的错误信息

---

享受切书功能！ 📚✨
