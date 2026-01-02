-- AdD KELİME Database Schema
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET timezone TO 'Europe/Istanbul';

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game results table
CREATE TABLE IF NOT EXISTS game_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_mode INTEGER NOT NULL CHECK (game_mode IN (5, 6, 7)),
  game_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT TRUE,
  attempts INTEGER NOT NULL CHECK (attempts >= 1 AND attempts <= 8),
  time_ms BIGINT NOT NULL CHECK (time_ms >= 0),
  won BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one entry per user per mode per day
  UNIQUE(user_id, game_mode, game_date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_game_results_date ON game_results(game_date);
CREATE INDEX IF NOT EXISTS idx_game_results_mode ON game_results(game_mode);
CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_leaderboard ON game_results(game_date, game_mode, won DESC, time_ms ASC);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Enable RLS on game_results
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Game results policies
CREATE POLICY "Game results are viewable by everyone (for leaderboard)" 
  ON game_results FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own game results" 
  ON game_results FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- No update or delete allowed on game results (prevent cheating)
-- Results are immutable once created

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- View for daily leaderboard (convenient for queries)
CREATE OR REPLACE VIEW daily_leaderboard AS
SELECT 
  gr.user_id,
  p.username,
  gr.game_mode,
  gr.game_date,
  gr.won,
  gr.attempts,
  gr.time_ms,
  ROW_NUMBER() OVER (
    PARTITION BY gr.game_date, gr.game_mode 
    ORDER BY gr.won DESC, gr.time_ms ASC
  ) as rank
FROM game_results gr
JOIN profiles p ON gr.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON daily_leaderboard TO authenticated;
GRANT SELECT ON daily_leaderboard TO anon;
