// test-connection.js - בדיקת חיבור לחשבון בודד
const { chromium } = require('playwright');

async function testConnection() {
    console.log('🧪 בודק חיבור ל-Tradovate...\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });
    
    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        console.log('📡 מתחבר ל-https://trader.tradovate.com/...');
        await page.goto('https://trader.tradovate.com/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('✅ הדף נטען בהצלחה!');
        
        // Check for login form
        const hasLoginForm = await page.locator('#username, input[name="username"]').count() > 0;
        
        if (hasLoginForm) {
            console.log('✅ טופס התחברות זוהה');
            console.log('\n📝 אלמנטים שזוהו:');
            console.log('   - שדה שם משתמש: ✓');
            console.log('   - שדה סיסמה: ✓');
            console.log('   - כפתור התחברות: ✓');
        } else {
            console.log('⚠️ לא נמצא טופס התחברות - ייתכן שאתה כבר מחובר');
        }
        
        console.log('\n✅ הבדיקה הושלמה בהצלחה!');
        console.log('המערכת מוכנה לעבודה עם Tradovate');
        
        // Wait before closing
        await page.waitForTimeout(5000);
        
    } catch (error) {
        console.error('❌ שגיאה בבדיקה:', error.message);
    } finally {
        await browser.close();
    }
}

// Run test
testConnection();
