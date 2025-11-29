// ==================== Supabase 客户端配置 ====================
// 本文件可以在多个项目中复用，无需修改

(function() {
    'use strict';
    
    // Supabase 配置（与 Google Cloud 配置匹配）
    const SUPABASE_URL = 'https://yfdxhutspgrwxydqeqdl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZHhodXRzcGdyd3h5ZHFlcWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNzYwMTYsImV4cCI6MjA3NDk1MjAxNn0.8MM-wlTHR3k2uBSEbgLMEcm_Bdy9714zJDra_kp1b7M';
    
    let supabaseClient = null;
    
    // 初始化 Supabase 客户端
    function initSupabase() {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase library not loaded. Please include: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
            return null;
        }
        
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase 客户端初始化成功');
            return supabaseClient;
        } catch (error) {
            console.error('❌ Supabase 初始化失败:', error);
            return null;
        }
    }
    
    // 获取 Supabase 客户端实例
    function getClient() {
        if (!supabaseClient) {
            return initSupabase();
        }
        return supabaseClient;
    }
    
    // 检查用户登录状态
    async function checkAuth() {
        const client = getClient();
        if (!client) return { user: null, session: null };
        
        try {
            // 使用 getSession() 而不是 getUser()，避免 AuthSessionMissingError
            const { data: { session }, error } = await client.auth.getSession();
            if (error) throw error;
            
            return { 
                user: session?.user || null, 
                session: session 
            };
        } catch (error) {
            // 静默处理认证检查错误，这是正常的（用户未登录）
            console.log('用户未登录或会话已过期');
            return { user: null, session: null };
        }
    }
    
    // Google 登录
    async function signInWithGoogle(redirectUrl) {
        const client = getClient();
        if (!client) return { error: 'Supabase client not initialized' };
        
        try {
            const { data, error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl || window.location.origin + '/index.html'
                }
            });
            return { data, error };
        } catch (error) {
            console.error('Google 登录失败:', error);
            return { error };
        }
    }
    
    // 邮箱登录（QQ邮箱等）
    async function signInWithEmail(email, redirectUrl) {
        const client = getClient();
        if (!client) return { error: 'Supabase client not initialized' };
        
        try {
            const { data, error } = await client.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: redirectUrl || window.location.origin + '/index.html'
                }
            });
            
            if (error) throw error;
            
            return { 
                data, 
                error: null,
                message: '验证邮件已发送到您的邮箱，请查收并点击链接完成登录'
            };
        } catch (error) {
            console.error('邮箱登录失败:', error);
            return { error };
        }
    }
    
    // 退出登录
    async function signOut() {
        const client = getClient();
        if (!client) return { error: 'Supabase client not initialized' };
        
        try {
            const { error } = await client.auth.signOut();
            return { error };
        } catch (error) {
            console.error('退出登录失败:', error);
            return { error };
        }
    }
    
    // 导出到全局对象
    window.supabaseClient = {
        init: initSupabase,
        getClient: getClient,
        checkAuth: checkAuth,
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signOut: signOut
    };
    
    // 页面加载时自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
    
})();

