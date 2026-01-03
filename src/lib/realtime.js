import { supabase } from './supabase.js'

let subscription = null

export function subscribeToLiveScores(onNewScore) {
    // Unsubscribe if already subscribed
    if (subscription) {
        supabase.removeChannel(subscription)
    }

    // Create a new subscription
    subscription = supabase
        .channel('game_results_inserts')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'game_results'
            },
            async (payload) => {
                const newResult = payload.new

                // Fetch username for the new result
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', newResult.user_id)
                    .single()

                const username = profile ? profile.username : 'Anonim'

                // Format the score data
                const scoreData = {
                    username: username,
                    gameMode: newResult.game_mode,
                    timeMs: newResult.time_ms,
                    won: newResult.won
                }

                onNewScore(scoreData)
            }
        )
        .subscribe()

    return subscription
}

export function unsubscribeFromLiveScores() {
    if (subscription) {
        supabase.removeChannel(subscription)
        subscription = null
    }
}
