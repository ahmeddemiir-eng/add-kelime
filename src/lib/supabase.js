import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing! Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database initialization - creates tables if they don't exist
export async function initializeDatabase() {
    // Note: In production, these should be created via Supabase Dashboard or migrations
    // This is here for reference of the schema
    console.log('Supabase client initialized')
}
