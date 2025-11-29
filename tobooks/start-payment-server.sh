#!/bin/bash

# Tobooks 支付服务器启动脚本

echo "🚀 启动 Tobooks 支付服务器..."

# 进入支付SDK目录
cd nativePaySDK

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
fi

# 启动支付服务器
echo "💳 启动支付服务器在端口 3003..."
node payment-server.js
