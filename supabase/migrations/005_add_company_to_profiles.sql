-- Add company field to profiles for alumni and parent users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;
