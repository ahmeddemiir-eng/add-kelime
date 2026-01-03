import { getDailyWord, isValidWord } from '../data/words.js'

// Game state
let gameState = {
    mode: 5,
    targetWord: '',
    guesses: [],
    currentGuess: '',
    gameOver: false,
    won: false,
    startTime: null,
    endTime: null,
    maxAttempts: 6
}

// Initialize game for a specific mode
export function initGame(mode) {
    gameState = {
        mode: mode,
        targetWord: getDailyWord(mode),
        guesses: [],
        currentGuess: '',
        gameOver: false,
        won: false,
        startTime: null,
        endTime: null,
        maxAttempts: mode + 1 // 6 attempts for 5 letters, 7 for 6, 8 for 7
    }

    return gameState
}

// Start the timer
export function startTimer() {
    if (!gameState.startTime) {
        gameState.startTime = performance.now()
    }
}

// Get elapsed time in milliseconds
export function getElapsedTime() {
    if (!gameState.startTime) return 0
    const endTime = gameState.endTime || performance.now()
    return Math.floor(endTime - gameState.startTime)
}

// Format time for display
export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

// Add letter to current guess
export function addLetter(letter) {
    if (gameState.gameOver) return false
    if (gameState.currentGuess.length >= gameState.mode) return false

    gameState.currentGuess += letter.toUpperCase()
    return true
}

// Remove last letter from current guess
export function removeLetter() {
    if (gameState.gameOver) return false
    if (gameState.currentGuess.length === 0) return false

    gameState.currentGuess = gameState.currentGuess.slice(0, -1)
    return true
}

// Submit current guess
export function submitGuess() {
    if (gameState.gameOver) {
        return { success: false, error: 'Oyun bitti!' }
    }

    if (gameState.currentGuess.length !== gameState.mode) {
        return { success: false, error: `${gameState.mode} harf girmelisiniz!` }
    }

    // Validate word exists in dictionary
    if (!isValidWord(gameState.currentGuess, gameState.mode)) {
        return { success: false, error: 'Bu kelime sözlükte yok!' }
    }

    // Evaluate the guess
    const result = evaluateGuess(gameState.currentGuess, gameState.targetWord)

    gameState.guesses.push({
        word: gameState.currentGuess,
        result: result
    })

    // Check if won
    if (gameState.currentGuess === gameState.targetWord) {
        gameState.won = true
        gameState.gameOver = true
        gameState.endTime = performance.now()
        return {
            success: true,
            won: true,
            result: result,
            attempts: gameState.guesses.length,
            timeMs: getElapsedTime()
        }
    }

    // Check if out of attempts
    if (gameState.guesses.length >= gameState.maxAttempts) {
        gameState.gameOver = true
        gameState.endTime = performance.now()
        return {
            success: true,
            won: false,
            result: result,
            attempts: gameState.guesses.length,
            timeMs: getElapsedTime(),
            correctWord: gameState.targetWord
        }
    }

    // Reset current guess for next attempt
    gameState.currentGuess = ''

    return { success: true, result: result }
}

// Evaluate a guess against the target word
// Returns array of: 'correct' (green), 'present' (yellow), 'absent' (gray)
export function evaluateGuess(guess, target) {
    const result = new Array(guess.length).fill('absent')
    const targetLetters = target.split('')
    const guessLetters = guess.split('')

    // First pass: mark correct positions
    for (let i = 0; i < guessLetters.length; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            result[i] = 'correct'
            targetLetters[i] = null // Mark as used
            guessLetters[i] = null
        }
    }

    // Second pass: mark present letters (wrong position)
    for (let i = 0; i < guessLetters.length; i++) {
        if (guessLetters[i] === null) continue

        const targetIndex = targetLetters.indexOf(guessLetters[i])
        if (targetIndex !== -1) {
            result[i] = 'present'
            targetLetters[targetIndex] = null // Mark as used
        }
    }

    return result
}

// Get current game state
export function getGameState() {
    return { ...gameState }
}

// Get keyboard state (which letters have been used and their status)
export function getKeyboardState() {
    const keyState = {}

    gameState.guesses.forEach(guess => {
        guess.word.split('').forEach((letter, index) => {
            const status = guess.result[index]

            // Priority: correct > present > absent
            if (!keyState[letter] || keyState[letter] === 'absent' ||
                (keyState[letter] === 'present' && status === 'correct')) {
                keyState[letter] = status
            }
        })
    })

    return keyState
}

// Check if game is over
export function isGameOver() {
    return gameState.gameOver
}

// Check if player won
export function hasWon() {
    return gameState.won
}

// Get target word (only after game is over)
export function getTargetWord() {
    return gameState.gameOver ? gameState.targetWord : null
}

// Get number of attempts
export function getAttempts() {
    return gameState.guesses.length
}

// Get max attempts
export function getMaxAttempts() {
    return gameState.maxAttempts
}

// Get current guess
export function getCurrentGuess() {
    return gameState.currentGuess
}

// Get all guesses
export function getGuesses() {
    return gameState.guesses
}
