// Main application entry point
import './style.css'
import { initAuth, register, login, logout, getCurrentUser, getUserDisplayName, isLoggedIn } from './lib/auth.js'
import { initGame, addLetter, removeLetter, submitGuess, getGameState, getKeyboardState, formatTime, getElapsedTime, startTimer, isGameOver, hasWon, getTargetWord, getAttempts, getCurrentGuess, getGuesses, getMaxAttempts } from './lib/game.js'
import { saveGameResult, getDailyLeaderboard, getMonthlyLeaderboard, getPlayerRank, hasPlayedToday, calculatePoints } from './lib/scoring.js'
import { subscribeToLiveScores, unsubscribeFromLiveScores } from './lib/realtime.js'
import { getTodayDateStr } from './data/words.js'

// Turkish keyboard layout
const KEYBOARD_ROWS = [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', '⌫']
]

// App state
let currentMode = 5
let timerInterval = null
let alreadyPlayed = { 5: false, 6: false, 7: false }

// DOM Elements
const authScreen = document.getElementById('auth-screen')
const gameScreen = document.getElementById('game-screen')
const loginForm = document.getElementById('login-form')
const registerForm = document.getElementById('register-form')
const loginError = document.getElementById('login-error')
const registerError = document.getElementById('register-error')
const registerSuccess = document.getElementById('register-success')
const userNameEl = document.getElementById('user-name')
const logoutBtn = document.getElementById('logout-btn')
const gameBoardEl = document.getElementById('game-board')
const keyboardEl = document.getElementById('keyboard')
const timerEl = document.getElementById('timer')
const messageArea = document.getElementById('message-area')
const leaderboardBtn = document.getElementById('leaderboard-btn')
const leaderboardModal = document.getElementById('leaderboard-modal')
const leaderboardContent = document.getElementById('leaderboard-content')
const resultModal = document.getElementById('result-modal')
const liveTickerContent = document.getElementById('live-ticker-content')
const leaderboardDateInput = document.getElementById('leaderboard-date')

// Initialize the application
async function init() {
    // Setup auth tabs
    setupAuthTabs()

    // Setup auth forms
    setupAuthForms()

    // Check for existing session
    const user = await initAuth()

    if (user) {
        showGameScreen()
        await checkPlayedModes()
        startGame(currentMode)
        startRealtimeUpdates()
    } else {
        showAuthScreen()
    }

    // Setup mode selector
    setupModeSelector()

    // Setup logout
    logoutBtn.addEventListener('click', handleLogout)

    // Setup keyboard
    setupKeyboard()

    // Setup physical keyboard
    document.addEventListener('keydown', handleKeyPress)

    // Setup leaderboard
    setupLeaderboard()

    // Setup modals
    setupModals()
}

function startRealtimeUpdates() {
    subscribeToLiveScores((scoreData) => {
        // Only show if won
        if (!scoreData.won) return

        const item = document.createElement('div')
        item.className = 'live-item'
        item.innerHTML = `
            <span class="highlight-user">${scoreData.username}</span> 
            ${scoreData.gameMode} harfliyi 
            <span class="time">${formatTime(scoreData.timeMs)}</span> sürede bildi!
        `

        liveTickerContent.prepend(item)

        // Remove old items if too many
        if (liveTickerContent.children.length > 10) {
            liveTickerContent.lastElementChild.remove()
        }
    })
}

function setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab')
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'))
            tab.classList.add('active')

            const tabName = tab.dataset.tab
            loginForm.classList.toggle('active', tabName === 'login')
            registerForm.classList.toggle('active', tabName === 'register')

            // Clear errors
            loginError.textContent = ''
            registerError.textContent = ''
            registerSuccess.textContent = ''
        })
    })
}

function setupAuthForms() {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        loginError.textContent = ''

        const email = document.getElementById('login-email').value
        const password = document.getElementById('login-password').value

        const { user, error } = await login(email, password)

        if (error) {
            loginError.textContent = translateAuthError(error)
            return
        }

        showGameScreen()
        await checkPlayedModes()
        startGame(currentMode)
        startRealtimeUpdates()
    })

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        registerError.textContent = ''
        registerSuccess.textContent = ''

        const username = document.getElementById('register-name').value
        const email = document.getElementById('register-email').value
        const password = document.getElementById('register-password').value

        const { user, error } = await register(email, password, username)

        if (error) {
            registerError.textContent = translateAuthError(error)
            return
        }

        registerSuccess.textContent = 'Kayıt başarılı! Giriş yapabilirsiniz.'

        // Switch to login tab
        document.querySelector('[data-tab="login"]').click()
    })
}

function translateAuthError(error) {
    const errorMap = {
        'Invalid login credentials': 'E-posta veya şifre hatalı!',
        'Email not confirmed': 'E-posta adresinizi doğrulayın!',
        'User already registered': 'Bu e-posta zaten kayıtlı!',
        'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalı!'
    }
    return errorMap[error] || error
}

function showAuthScreen() {
    authScreen.classList.add('active')
    gameScreen.classList.remove('active')
    stopTimer()
    unsubscribeFromLiveScores()
}

function showGameScreen() {
    authScreen.classList.remove('active')
    gameScreen.classList.add('active')
    userNameEl.textContent = getUserDisplayName()
}

async function handleLogout() {
    await logout()
    showAuthScreen()
    stopTimer()
}

function setupModeSelector() {
    const modeButtons = document.querySelectorAll('.mode-btn')
    modeButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = parseInt(btn.dataset.mode)
            if (mode === currentMode) return

            modeButtons.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')

            currentMode = mode
            await checkPlayedModes()
            startGame(mode)
        })
    })
}

async function checkPlayedModes() {
    alreadyPlayed = {
        5: await hasPlayedToday(5),
        6: await hasPlayedToday(6),
        7: await hasPlayedToday(7)
    }

    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const mode = parseInt(btn.dataset.mode)
        if (alreadyPlayed[mode]) {
            btn.style.opacity = '0.6'
        } else {
            btn.style.opacity = '1'
        }
    })
}

function startGame(mode) {
    stopTimer()

    if (alreadyPlayed[mode]) {
        showMessage('Bu modu bugün zaten oynadınız!', 'error')
        renderBoard()
        // Show previous result
        showPreviousResult(mode)
        return
    }

    initGame(mode)
    renderBoard()
    renderKeyboard()
    timerEl.textContent = '00:00.000'
    messageArea.innerHTML = ''
}

async function showPreviousResult(mode) {
    // Get player's previous result and show it
    const rank = await getPlayerRank(mode)
    if (rank) {
        showMessage(`Bugünkü sıralamanız: #${rank}`, 'success')
    }
}

function renderBoard() {
    const state = getGameState()
    gameBoardEl.innerHTML = ''

    const maxRows = state.maxAttempts

    for (let row = 0; row < maxRows; row++) {
        const rowEl = document.createElement('div')
        rowEl.className = 'board-row'

        for (let col = 0; col < state.mode; col++) {
            const tileEl = document.createElement('div')
            tileEl.className = 'tile'
            tileEl.id = `tile-${row}-${col}`

            // Fill in guessed letters
            if (row < state.guesses.length) {
                const guess = state.guesses[row]
                tileEl.textContent = guess.word[col]
                tileEl.classList.add(guess.result[col])
            } else if (row === state.guesses.length) {
                // Current row being typed
                const currentGuess = getCurrentGuess()
                if (col < currentGuess.length) {
                    tileEl.textContent = currentGuess[col]
                    tileEl.classList.add('filled')
                }
            }

            rowEl.appendChild(tileEl)
        }

        gameBoardEl.appendChild(rowEl)
    }
}

function setupKeyboard() {
    renderKeyboard()
}

function renderKeyboard() {
    keyboardEl.innerHTML = ''
    const keyState = getKeyboardState()

    KEYBOARD_ROWS.forEach(row => {
        const rowEl = document.createElement('div')
        rowEl.className = 'keyboard-row'

        row.forEach(key => {
            const keyEl = document.createElement('button')
            keyEl.className = 'key'
            keyEl.textContent = key
            keyEl.dataset.key = key

            if (key === 'ENTER' || key === '⌫') {
                keyEl.classList.add('wide')
            }

            // Apply state coloring
            if (keyState[key]) {
                keyEl.classList.add(keyState[key])
            }

            keyEl.addEventListener('click', () => handleKeyClick(key))
            rowEl.appendChild(keyEl)
        })

        keyboardEl.appendChild(rowEl)
    })
}

function handleKeyClick(key) {
    if (isGameOver() || alreadyPlayed[currentMode]) return

    // Start timer on first input
    if (getGuesses().length === 0 && getCurrentGuess().length === 0) {
        startTimer()
        startTimerDisplay()
    }

    if (key === 'ENTER') {
        handleSubmit()
    } else if (key === '⌫') {
        if (removeLetter()) {
            renderBoard()
        }
    } else {
        if (addLetter(key)) {
            renderBoard()
        }
    }
}

function handleKeyPress(e) {
    if (document.activeElement.tagName === 'INPUT') return
    if (isGameOver() || alreadyPlayed[currentMode]) return

    const key = e.key.toLocaleUpperCase('tr-TR')
    console.log('Key pressed:', e.key, 'Mapped:', key, 'ActiveElement:', document.activeElement.tagName)

    // Map Turkish keyboard variations
    const keyMap = {
        'Ğ': 'Ğ',
        'Ü': 'Ü',
        'Ş': 'Ş',
        'İ': 'İ',
        'Ö': 'Ö',
        'Ç': 'Ç'
    }

    // Start timer on first input
    if (getGuesses().length === 0 && getCurrentGuess().length === 0 && key.match(/^[A-ZĞÜŞİÖÇ]$/)) {
        startTimer()
        startTimerDisplay()
    }

    if (e.key === 'Enter') {
        handleSubmit()
    } else if (e.key === 'Backspace') {
        if (removeLetter()) {
            renderBoard()
        }
    } else if (key.match(/^[A-ZĞÜŞİÖÇ]$/)) {
        const mappedKey = keyMap[key] || key
        if (addLetter(mappedKey)) {
            renderBoard()
        }
    }
}

async function handleSubmit() {
    const result = submitGuess()

    if (!result.success) {
        showMessage(result.error, 'error')
        shakeCurrentRow()
        return
    }

    // Animate the tiles
    await animateGuess(result.result)

    renderBoard()
    renderKeyboard()

    if (result.won !== undefined) {
        // Game over
        stopTimer()

        // Save result to database
        const saveResult = await saveGameResult(
            currentMode,
            result.won,
            result.attempts,
            result.timeMs
        )

        if (saveResult.error && !saveResult.error.includes('zaten')) {
            console.error('Save error:', saveResult.error)
        }

        // Get rank
        const rank = await getPlayerRank(currentMode)
        const points = rank ? calculatePoints(rank, currentMode, result.won) : 0

        // Show result modal
        showResultModal(result.won, result.attempts, result.timeMs, rank, points, result.correctWord)

        alreadyPlayed[currentMode] = true
        await checkPlayedModes()
    }
}

function shakeCurrentRow() {
    const state = getGameState()
    const rowIndex = state.guesses.length
    const tiles = document.querySelectorAll(`#tile-${rowIndex}-0`).parentElement?.children

    if (tiles) {
        Array.from(tiles).forEach(tile => {
            tile.classList.add('shake')
            setTimeout(() => tile.classList.remove('shake'), 500)
        })
    } else {
        // Fallback: shake the current row
        const rows = gameBoardEl.querySelectorAll('.board-row')
        if (rows[rowIndex]) {
            rows[rowIndex].classList.add('shake')
            setTimeout(() => rows[rowIndex].classList.remove('shake'), 500)
        }
    }
}

async function animateGuess(result) {
    const state = getGameState()
    const rowIndex = state.guesses.length - 1
    const row = gameBoardEl.querySelectorAll('.board-row')[rowIndex]

    if (!row) return

    const tiles = row.querySelectorAll('.tile')

    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]

        await new Promise(resolve => setTimeout(resolve, 150))

        tile.classList.add('flip')

        setTimeout(() => {
            tile.classList.add(result[i])
            tile.classList.remove('filled')
        }, 250)

        await new Promise(resolve => setTimeout(resolve, 150))
    }

    // Bounce animation if won
    if (hasWon()) {
        tiles.forEach((tile, i) => {
            setTimeout(() => tile.classList.add('bounce'), i * 100)
        })
    }
}

function showMessage(text, type = 'info') {
    messageArea.innerHTML = `<div class="message ${type}">${text}</div>`

    setTimeout(() => {
        if (messageArea.firstChild?.textContent === text) {
            messageArea.innerHTML = ''
        }
    }, 3000)
}

function startTimerDisplay() {
    if (timerInterval) return

    timerInterval = setInterval(() => {
        timerEl.textContent = formatTime(getElapsedTime())
    }, 10)
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
}

function showResultModal(won, attempts, timeMs, rank, points, correctWord) {
    const iconEl = document.getElementById('result-icon')
    const titleEl = document.getElementById('result-title')
    const wordEl = document.getElementById('result-word')
    const attemptsEl = document.getElementById('result-attempts')
    const timeEl = document.getElementById('result-time')
    const rankEl = document.getElementById('result-rank')
    const pointsEl = document.getElementById('result-points')

    if (won) {
        iconEl.textContent = '🎉'
        titleEl.textContent = 'Tebrikler!'
        wordEl.textContent = getTargetWord()
    } else {
        iconEl.textContent = '😔'
        titleEl.textContent = 'Bir dahaki sefere!'
        wordEl.textContent = correctWord
    }

    attemptsEl.textContent = attempts
    timeEl.textContent = formatTime(timeMs)
    rankEl.textContent = rank ? `#${rank}` : '-'
    pointsEl.textContent = points ? `+${points}` : '0'

    resultModal.classList.add('active')
}

function setupLeaderboard() {
    // Set default date to today
    leaderboardDateInput.value = getTodayDateStr()

    leaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.add('active')
        const activeMode = parseInt(document.querySelector('.lb-mode-tab.active').dataset.mode)
        const activePeriod = document.querySelector('.lb-tab.active').dataset.period
        loadLeaderboard(activePeriod, activeMode, leaderboardDateInput.value)
    })

    // Date picker change
    leaderboardDateInput.addEventListener('change', () => {
        const activeMode = parseInt(document.querySelector('.lb-mode-tab.active').dataset.mode)
        const activePeriod = document.querySelector('.lb-tab.active').dataset.period
        // Only reload if daily tab is active, as monthly ignores date picker
        if (activePeriod === 'daily') {
            loadLeaderboard(activePeriod, activeMode, leaderboardDateInput.value)
        }
    })

    // Period tabs
    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            const period = tab.dataset.period
            const activeMode = parseInt(document.querySelector('.lb-mode-tab.active').dataset.mode)

            // Show/Hide date picker based on period
            if (period === 'monthly') {
                leaderboardDateInput.style.display = 'none'
            } else {
                leaderboardDateInput.style.display = 'block'
            }

            loadLeaderboard(period, activeMode, leaderboardDateInput.value)
        })
    })

    // Mode tabs
    document.querySelectorAll('.lb-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-mode-tab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            const mode = parseInt(tab.dataset.mode)
            const activePeriod = document.querySelector('.lb-tab.active').dataset.period
            loadLeaderboard(activePeriod, mode, leaderboardDateInput.value)
        })
    })
}

async function loadLeaderboard(period, mode, dateStr = null) {
    leaderboardContent.innerHTML = '<div class="leaderboard-empty">Yükleniyor...</div>'

    let data
    if (period === 'daily') {
        data = await getDailyLeaderboard(mode, 10, dateStr)
    } else {
        data = await getMonthlyLeaderboard(mode)
    }

    if (data.length === 0) {
        leaderboardContent.innerHTML = '<div class="leaderboard-empty">Henüz sonuç yok</div>'
        return
    }

    const currentUser = getCurrentUser()

    const html = `
    <div class="leaderboard-list">
      ${data.map((item, index) => {
        const isSelf = currentUser && item.userId === currentUser.id
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''

        return `
          <div class="leaderboard-item ${isSelf ? 'self' : ''}">
            <div class="leaderboard-rank ${rankClass}">${item.rank}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${item.username}</div>
              ${period === 'daily' ? `
                <div class="leaderboard-stats">
                  ${item.won ? `${formatTime(item.timeMs)} · ${item.attempts} deneme` : 'Bilemedi'}
                </div>
              ` : ''}
            </div>
            <div class="leaderboard-points">${period === 'daily' ? item.points : item.totalPoints} puan</div>
          </div>
        `
    }).join('')}
    </div>
  `

    leaderboardContent.innerHTML = html
}

function setupModals() {
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.closest('.modal').classList.remove('active')
        })
    })

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active')
        })
    })

    // Result modal close
    document.getElementById('result-close')?.addEventListener('click', () => {
        resultModal.classList.remove('active')
    })
}

// Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container')
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.textContent = message
    container.appendChild(toast)

    setTimeout(() => toast.remove(), 3000)
}

// Start the app
init()
