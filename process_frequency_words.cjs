const fs = require('fs');
const https = require('https');

const URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/tr/tr_50k.txt';
const OUTPUT_FILE = 'src/data/words.js';

// Turkish character mapping for uppercase
const turkishToUpper = (str) => {
    return str.replace(/ğ/g, 'Ğ')
        .replace(/ü/g, 'Ü')
        .replace(/ş/g, 'Ş')
        .replace(/i/g, 'İ')
        .replace(/ö/g, 'Ö')
        .replace(/ç/g, 'Ç')
        .replace(/ı/g, 'I')
        .toUpperCase();
};

const downloadFile = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
};

const processWords = async () => {
    console.log('Downloading word list...');
    try {
        const data = await downloadFile(URL);
        const lines = data.split('\n');

        const words5 = new Set();
        const words6 = new Set();
        const words7 = new Set();

        console.log(`Processing ${lines.length} lines...`);

        // Regex to match only valid Turkish letters
        const validWordRegex = /^[a-zA-ZçÇğĞıIİöÖşŞüÜ]+$/;

        let count = 0;
        for (const line of lines) {
            const parts = line.trim().split(' ');
            if (parts.length < 2) continue;

            const word = parts[0];
            const freq = parseInt(parts[1]);

            // Skip if not a valid word (contains numbers or symbols)
            if (!validWordRegex.test(word)) continue;

            // Skip single letters or very short words (though we filter by length anyway)

            const upperWord = turkishToUpper(word);

            if (word.length === 5) words5.add(upperWord);
            else if (word.length === 6) words6.add(upperWord);
            else if (word.length === 7) words7.add(upperWord);

            count++;
        }

        console.log(`Processed ${count} valid words.`);
        console.log(`5-letter: ${words5.size}`);
        console.log(`6-letter: ${words6.size}`);
        console.log(`7-letter: ${words7.size}`);

        const content = `// Turkish Word List (Frequency-based)
// Source: hermitdave/FrequencyWords (2018)

export const WORDS_5 = ${JSON.stringify([...words5].sort())}

export const WORDS_6 = ${JSON.stringify([...words6].sort())}

export const WORDS_7 = ${JSON.stringify([...words7].sort())}

// Valid word sets for O(1) lookup
const VALID_WORDS_5 = new Set(WORDS_5)
const VALID_WORDS_6 = new Set(WORDS_6)
const VALID_WORDS_7 = new Set(WORDS_7)

export function getWordList(mode) {
    if (mode === 5) return WORDS_5
    if (mode === 6) return WORDS_6
    if (mode === 7) return WORDS_7
    return WORDS_5
}

export function isValidWord(word) {
    const len = word.length
    if (len === 5) return VALID_WORDS_5.has(word)
    if (len === 6) return VALID_WORDS_6.has(word)
    if (len === 7) return VALID_WORDS_7.has(word)
    return false
}

export function getRandomWord(mode) {
    const words = getWordList(mode)
    const index = Math.floor(Math.random() * words.length)
    return words[index]
}

// Get today's date string (Resets at 10:00 AM)
export function getTodayDateStr() {
    const now = new Date()
    // If it's before 10:00 AM, use yesterday's date
    if (now.getHours() < 10) {
        now.setDate(now.getDate() - 1)
    }
    return now.toISOString().split('T')[0]
}

// Get current month string
export function getCurrentMonthStr() {
    return getTodayDateStr().substring(0, 7) // YYYY-MM
}

export function getDailyWord(mode, dateStr = null) {
    const words = getWordList(mode)
    const date = dateStr || getTodayDateStr()
    
    // Simple hash function for consistent daily word
    let hash = 0
    const seedStr = \`\${date}-mode\${mode}-addkelime2024\`
    
    for (let i = 0; i < seedStr.length; i++) {
        const char = seedStr.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    
    // Use absolute value and mod to get index
    const index = Math.abs(hash) % words.length
    return words[index]
}
`;

        fs.writeFileSync(OUTPUT_FILE, content);
        console.log(`Successfully wrote to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error:', error);
    }
};

processWords();
