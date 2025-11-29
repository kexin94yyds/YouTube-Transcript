#!/bin/bash

# 部署切书API到Vercel的脚本

echo "🚀 开始部署切书API到Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "📦 正在安装 Vercel CLI..."
    npm install -g vercel
fi

# 检查是否已登录
echo "🔐 检查登录状态..."
vercel whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  未登录，请先登录..."
    vercel login
fi

# 部署
echo "📤 开始部署..."
vercel --prod

echo ""
echo "✅ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 复制上面显示的部署URL（例如：https://your-project.vercel.app）"
echo "2. 在 Netlify 的环境变量中设置 CUTTING_API_URL，或者"
echo "3. 在 tobooks-main/index.html 中更新 API_BASE_URL 配置"

