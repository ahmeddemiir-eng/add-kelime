import { supabase } from './supabase.js'

// Current user state
let currentUser = null

// Get current user
export function getCurrentUser() {
    return currentUser
}

// Check if user is logged in
export function isLoggedIn() {
    return currentUser !== null
}

// Initialize auth - check for existing session
export async function initAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session?.user) {
            currentUser = session.user
            await loadUserProfile()
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user
                await loadUserProfile()
            } else if (event === 'SIGNED_OUT') {
                currentUser = null
            }
        })

        return currentUser
    } catch (error) {
        console.error('Auth initialization error:', error)
        return null
    }
}

// Load user profile data
async function loadUserProfile() {
    if (!currentUser) return

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', currentUser.id)
            .single()

        if (data) {
            currentUser.username = data.username
        } else {
            // Profile doesn't exist, create it
            const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Oyuncu'
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: currentUser.id,
                    username: username,
                    email: currentUser.email
                })

            if (!insertError) {
                currentUser.username = username
            }
        }
    } catch (error) {
        console.log('Profile check/creation error:', error)
    }
}

// Register new user
export async function register(email, password, username) {
    try {
        // Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        })

        if (authError) throw authError

        if (authData.user) {
            // Create profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    username: username,
                    email: email
                })

            if (profileError) {
                // Ignore duplicate key error (code 23505) - implies profile already exists
                if (profileError.code === '23505') {
                    console.log('Profile already exists, skipping creation')
                } else {
                    console.error('Profile creation error:', profileError)
                    // Don't fail registration if profile creation fails, just log it
                    // return { error: 'Database error saving new user' }
                }
            }

            currentUser = authData.user
            currentUser.username = username
        }

        return { user: authData.user, error: null }
    } catch (error) {
        console.error('REGISTRATION EXCEPTION:', error)
        return { user: null, error: 'EXCEPTION: ' + (error.message || 'Unknown') }
    }
}

// Login user
export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error

        if (data.user) {
            currentUser = data.user
            await loadUserProfile()
        }

        return { user: data.user, error: null }
    } catch (error) {
        return { user: null, error: error.message }
    }
}

// Logout user
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error

        currentUser = null
        return { error: null }
    } catch (error) {
        return { error: error.message }
    }
}

// Get user display name
export function getUserDisplayName() {
    if (!currentUser) return 'Misafir'
    return currentUser.username || currentUser.email?.split('@')[0] || 'Oyuncu'
}
