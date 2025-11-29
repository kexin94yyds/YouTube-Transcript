#!/bin/bash

echo "🔍 检查手势导航文件..."
if [ -f "tobooks-main/books-gesture-navigation.js" ]; then
    echo "✅ books-gesture-navigation.js 存在于 tobooks-main/"
    ls -lh "tobooks-main/books-gesture-navigation.js"
else
    echo "❌ books-gesture-navigation.js 不在 tobooks-main/"
fi

echo ""
echo "🔍 检查 HTML 引用..."
if grep -q 'src="books-gesture-navigation.js"' tobooks-main/index.html; then
    echo "✅ HTML 正确引用了 books-gesture-navigation.js"
else
    echo "❌ HTML 引用可能有问题"
fi

echo ""
echo "🔍 检查初始化代码..."
if grep -q 'BooksGestureNavigation' tobooks-main/index.html; then
    echo "✅ HTML 包含了初始化代码"
else
    echo "❌ HTML 缺少初始化代码"
fi

echo ""
echo "📝 测试步骤："
echo "1. 在浏览器中打开: http://localhost:3002/tobooks-main/index.html"
echo "2. 按 Cmd + Shift + R 强制刷新页面"
echo "3. 打开浏览器控制台（F12 或 Cmd + Option + I）"
echo "4. 加载一个 EPUB 文件"
echo "5. 查看控制台是否有 '✅ macOS Books 风格手势导航已启用' 消息"
echo "6. 在触控板上双指左右滑动测试翻页"
echo ""
echo "🎉 如果一切正常，你应该可以用触控板滑动翻页了！"
