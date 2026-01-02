// Consolidated word module
import { WORDS_5 } from './words-5.js'
import { WORDS_6 } from './words-6.js'
import { WORDS_7 } from './words-7.js'

// Convert arrays to Sets for faster lookup
const sets = {
    5: new Set(WORDS_5),
    6: new Set(WORDS_6),
    7: new Set(WORDS_7)
}

// Get word list by mode
export function getWordList(mode) {
    switch (mode) {
        case 5: return WORDS_5
        case 6: return WORDS_6
        case 7: return WORDS_7
        default: return WORDS_5
    }
}

// Check if word is valid for given mode
export function isValidWord(word, mode) {
    if (!word) return false
    const upper = word.toLocaleUpperCase('tr-TR')
    const set = sets[mode]
    return set ? set.has(upper) : false
}

// Get daily word based on date and mode using hash
export function getDailyWord(mode, dateStr = null) {
    const words = getWordList(mode)
    const date = dateStr || new Date().toISOString().split('T')[0]

    // Simple hash function for consistent daily word
    let hash = 0
    const seedStr = `${date}-mode${mode}-addkelime2024`

    for (let i = 0; i < seedStr.length; i++) {
        const char = seedStr.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }

    // Use absolute value and mod to get index
    const index = Math.abs(hash) % words.length
    return words[index] // Words are already uppercase in the file
}

// Get today's date string
export function getTodayDateStr() {
    return new Date().toISOString().split('T')[0]
}

// Get current month string
export function getCurrentMonthStr() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
