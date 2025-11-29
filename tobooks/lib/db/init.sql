-- Database initialization script for EPUB Reader with WeChat Pay
-- Run this script in your Supabase SQL editor

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table for payment tracking
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 29.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    wechat_transaction_id VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create verification_codes table for SMS verification (optional)
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_paid ON users(is_paid);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (true); -- Allow all reads for now, restrict in production

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (true); -- Allow all updates for now, restrict in production

DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data" ON users
    FOR INSERT WITH CHECK (true); -- Allow all inserts for now, restrict in production

-- Create RLS policies for orders table
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (true); -- Allow all reads for now, restrict in production

DROP POLICY IF EXISTS "Orders can be inserted" ON orders;
CREATE POLICY "Orders can be inserted" ON orders
    FOR INSERT WITH CHECK (true); -- Allow all inserts for now, restrict in production

DROP POLICY IF EXISTS "Orders can be updated" ON orders;
CREATE POLICY "Orders can be updated" ON orders
    FOR UPDATE USING (true); -- Allow all updates for now, restrict in production

-- Create RLS policies for verification_codes table
DROP POLICY IF EXISTS "Verification codes can be accessed" ON verification_codes;
CREATE POLICY "Verification codes can be accessed" ON verification_codes
    FOR ALL USING (true); -- Allow all operations for now, restrict in production

-- Insert sample data for testing (optional)
-- Uncomment the following lines if you want sample data

/*
INSERT INTO users (phone, name, is_paid) VALUES 
('13800138000', 'Test User 1', false),
('13800138001', 'Test User 2', true)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO orders (order_id, user_id, phone, amount, status) VALUES 
('EPUB_TEST_001', (SELECT id FROM users WHERE phone = '13800138000'), '13800138000', 29.00, 'pending'),
('EPUB_TEST_002', (SELECT id FROM users WHERE phone = '13800138001'), '13800138001', 29.00, 'success')
ON CONFLICT (order_id) DO NOTHING;
*/

-- Grant necessary permissions (adjust based on your needs)
-- These are broad permissions for development, restrict in production
GRANT ALL ON users TO anon, authenticated;
GRANT ALL ON orders TO anon, authenticated;
GRANT ALL ON verification_codes TO anon, authenticated;

-- Success message
SELECT 'Database initialization completed successfully!' as message;