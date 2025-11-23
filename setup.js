// setup.js - סקריפט התקנה והגדרה ראשונית
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
    console.log(`
╔══════════════════════════════════════════════╗
║   TRADOVATE MULTI-ACCOUNT SETUP WIZARD      ║
╚══════════════════════════════════════════════╝
`);

    try {
        // Create necessary directories
        const dirs = ['sessions', 'config', 'public', 'logs'];
        for (const dir of dirs) {
            await fs.mkdir(path.join(__dirname, dir), { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }

        // Setup accounts configuration
        console.log('\n📋 הגדרת חשבונות:');
        const setupAccounts = await question('האם תרצה להגדיר חשבונות עכשיו? (y/n): ');
        
        if (setupAccounts.toLowerCase() === 'y') {
            const accounts = [];
            let addMore = true;
            
            while (addMore) {
                console.log('\n--- חשבון חדש ---');
                const username = await question('שם משתמש: ');
                const password = await question('סיסמה: ');
                const description = await question('תיאור (אופציונלי): ');
                
                accounts.push({
                    username,
                    password,
                    accountId: `account_${Date.now()}`,
                    autoConnect: true,
                    description: description || `Account ${accounts.length + 1}`
                });
                
                const more = await question('\nלהוסיף עוד חשבון? (y/n): ');
                addMore = more.toLowerCase() === 'y';
            }
            
            // Save accounts configuration
            await fs.writeFile(
                path.join(__dirname, 'config', 'accounts.json'),
                JSON.stringify(accounts, null, 4)
            );
            console.log(`\n✅ נשמרו ${accounts.length} חשבונות`);
        }

        // Create .env file
        console.log('\n⚙️ הגדרות סביבה:');
        const port = await question('פורט לשרת (ברירת מחדל 3000): ') || '3000';
        
        const envContent = `
# Server Configuration
PORT=${port}
NODE_ENV=production

# Playwright Configuration
HEADLESS=false
TIMEOUT=30000

# Security
SESSION_SECRET=${generateSecret()}

# Features
AUTO_RECONNECT=true
MAX_RETRIES=3
`;
        
        await fs.writeFile(path.join(__dirname, '.env'), envContent.trim());
        console.log('✅ קובץ .env נוצר');

        // Create settings.json
        const settings = {
            server: {
                port: parseInt(port),
                host: '0.0.0.0'
            },
            playwright: {
                headless: false,
                timeout: 30000,
                viewport: {
                    width: 1920,
                    height: 1080
                }
            },
            trading: {
                defaultSymbol: 'MNQ',
                defaultQuantity: 1,
                defaultOrderType: 'MARKET'
            },
            monitoring: {
                updateInterval: 5000,
                reconnectDelay: 10000
            }
        };
        
        await fs.writeFile(
            path.join(__dirname, 'config', 'settings.json'),
            JSON.stringify(settings, null, 4)
        );
        console.log('✅ קובץ settings.json נוצר');

        console.log(`
╔══════════════════════════════════════════════╗
║   ✅ ההתקנה הושלמה בהצלחה!                  ║
╠══════════════════════════════════════════════╣
║   להפעלת המערכת:                            ║
║   npm start                                  ║
║                                              ║
║   גישה מהדפדפן:                             ║
║   http://localhost:${port}                     ║
╚══════════════════════════════════════════════╝
`);

    } catch (error) {
        console.error('❌ שגיאה בהתקנה:', error);
    } finally {
        rl.close();
    }
}

function generateSecret() {
    return require('crypto').randomBytes(32).toString('hex');
}

// Run setup
setup();
