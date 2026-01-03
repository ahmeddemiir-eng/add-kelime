import { supabase } from './supabase.js'
import { getCurrentUser } from './auth.js'
import { getTodayDateStr, getCurrentMonthStr } from '../data/words.js'

// Calculate points based on rank and game mode
export function calculatePoints(rank, gameMode, won) {
    if (!won) {
        // Even if they didn't win, they get points based on completion order
        // This is handled by the position, not won status
    }

    const maxPoints = gameMode // 5, 6, or 7 points for 1st place
    const points = Math.max(0, maxPoints - rank + 1)
    return points
}

// Save game result to Supabase
export async function saveGameResult(gameMode, won, attempts, timeMs) {
    const user = getCurrentUser()
    if (!user) return { error: 'User not logged in' }

    const today = getTodayDateStr()

    try {
        // Check if already played today for this mode
        const { data: existing } = await supabase
            .from('game_results')
            .select('id')
            .eq('user_id', user.id)
            .eq('game_mode', gameMode)
            .eq('game_date', today)
            .single()

        if (existing) {
            return { error: 'Bugün bu modu zaten oynadınız!' }
        }

        // Insert new result
        const { data, error } = await supabase
            .from('game_results')
            .insert({
                user_id: user.id,
                game_mode: gameMode,
                game_date: today,
                completed: true,
                attempts: attempts,
                time_ms: timeMs,
                won: won
            })
            .select()
            .single()

        if (error) throw error

        return { data, error: null }
    } catch (error) {
        console.error('Error saving game result:', error)
        return { error: error.message }
    }
}

// Get player's rank for today
export async function getPlayerRank(gameMode) {
    const user = getCurrentUser()
    if (!user) return null

    const today = getTodayDateStr()

    try {
        // Get all results for today, ordered by won DESC, time ASC
        const { data: results, error } = await supabase
            .from('game_results')
            .select('user_id, won, time_ms')
            .eq('game_mode', gameMode)
            .eq('game_date', today)
            .order('won', { ascending: false })
            .order('time_ms', { ascending: true })

        if (error) throw error

        // Find player's position
        const playerIndex = results.findIndex(r => r.user_id === user.id)
        if (playerIndex === -1) return null

        return playerIndex + 1
    } catch (error) {
        console.error('Error getting player rank:', error)
        return null
    }
}

// Get daily leaderboard
export async function getDailyLeaderboard(gameMode, limit = 10, dateStr = null) {
    const today = dateStr || getTodayDateStr()

    try {
        const { data, error } = await supabase
            .from('game_results')
            .select(`
        user_id,
        won,
        attempts,
        time_ms,
        profiles!inner(username)
      `)
            .eq('game_mode', gameMode)
            .eq('game_date', today)
            .order('won', { ascending: false })
            .order('time_ms', { ascending: true })
            .limit(limit)

        if (error) throw error

        // Calculate points for each player
        return data.map((result, index) => ({
            rank: index + 1,
            userId: result.user_id,
            username: result.profiles?.username || 'Anonim',
            won: result.won,
            attempts: result.attempts,
            timeMs: result.time_ms,
            points: calculatePoints(index + 1, gameMode, result.won)
        }))
    } catch (error) {
        console.error('Error getting daily leaderboard:', error)
        return []
    }
}

// Get monthly leaderboard (aggregated points)
export async function getMonthlyLeaderboard(gameMode, limit = 10) {
    const monthStr = getCurrentMonthStr()
    const startDate = `${monthStr}-01`
    const endDate = `${monthStr}-31` // Approximate end of month

    try {
        // Get all results for the month
        const { data: monthResults, error } = await supabase
            .from('game_results')
            .select(`
        user_id,
        won,
        time_ms,
        game_date,
        profiles!inner(username)
      `)
            .eq('game_mode', gameMode)
            .gte('game_date', startDate)
            .lte('game_date', endDate)
            .order('game_date')
            .order('won', { ascending: false })
            .order('time_ms', { ascending: true })

        if (error) throw error

        // Group by date and calculate daily ranks
        const dailyResults = {}
        monthResults.forEach(result => {
            if (!dailyResults[result.game_date]) {
                dailyResults[result.game_date] = []
            }
            dailyResults[result.game_date].push(result)
        })

        // Calculate total points per user
        const userPoints = {}
        const usernames = {}

        Object.entries(dailyResults).forEach(([date, results]) => {
            results.forEach((result, index) => {
                const points = calculatePoints(index + 1, gameMode, result.won)
                if (!userPoints[result.user_id]) {
                    userPoints[result.user_id] = 0
                    usernames[result.user_id] = result.profiles?.username || 'Anonim'
                }
                userPoints[result.user_id] += points
            })
        })

        // Sort by total points
        const sortedUsers = Object.entries(userPoints)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([userId, points], index) => ({
                rank: index + 1,
                userId,
                username: usernames[userId],
                totalPoints: points
            }))

        return sortedUsers
    } catch (error) {
        console.error('Error getting monthly leaderboard:', error)
        return []
    }
}

// Get all-time leaderboard (aggregated points)
export async function getAllTimeLeaderboard(gameMode, limit = 10) {
    try {
        // Get all results ever
        const { data: allResults, error } = await supabase
            .from('game_results')
            .select(`
        user_id,
        won,
        time_ms,
        game_date,
        profiles!inner(username)
      `)
            .eq('game_mode', gameMode)
            .order('game_date')
            .order('won', { ascending: false })
            .order('time_ms', { ascending: true })

        if (error) throw error

        // Group by date and calculate daily ranks
        const dailyResults = {}
        allResults.forEach(result => {
            if (!dailyResults[result.game_date]) {
                dailyResults[result.game_date] = []
            }
            dailyResults[result.game_date].push(result)
        })

        // Calculate total points per user
        const userPoints = {}
        const usernames = {}

        Object.entries(dailyResults).forEach(([date, results]) => {
            results.forEach((result, index) => {
                const points = calculatePoints(index + 1, gameMode, result.won)
                if (!userPoints[result.user_id]) {
                    userPoints[result.user_id] = 0
                    usernames[result.user_id] = result.profiles?.username || 'Anonim'
                }
                userPoints[result.user_id] += points
            })
        })

        // Sort by total points
        const sortedUsers = Object.entries(userPoints)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([userId, points], index) => ({
                rank: index + 1,
                userId,
                username: usernames[userId],
                totalPoints: points
            }))

        return sortedUsers
    } catch (error) {
        console.error('Error getting all-time leaderboard:', error)
        return []
    }
}

// Check if player has played today
export async function hasPlayedToday(gameMode) {
    const user = getCurrentUser()
    if (!user) return false

    const today = getTodayDateStr()

    try {
        const { data, error } = await supabase
            .from('game_results')
            .select('id')
            .eq('user_id', user.id)
            .eq('game_mode', gameMode)
            .eq('game_date', today)
            .single()

        return !!data
    } catch (error) {
        return false
    }
}

// Get player's result for today
export async function getTodayResult(gameMode) {
    const user = getCurrentUser()
    if (!user) return null

    const today = getTodayDateStr()

    try {
        const { data, error } = await supabase
            .from('game_results')
            .select('*')
            .eq('user_id', user.id)
            .eq('game_mode', gameMode)
            .eq('game_date', today)
            .single()

        return data
    } catch (error) {
        return null
    }
}
