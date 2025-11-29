#!/bin/bash

# 启动切书服务器
echo "正在启动切书服务器..."
echo "服务器将运行在 http://localhost:3001"
echo "请访问 http://localhost:3001/book-cutting.html"

# 确保切书脚本有执行权限
chmod +x "切书神技.zsh"

# 启动服务器
node book-cutting-server.js
