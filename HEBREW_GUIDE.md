# 🚀 מערכת שליטה מרכזית ב-Tradovate - מדריך מלא

## 📋 תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [התקנה מהירה](#התקנה-מהירה)
3. [הגדרת חשבונות](#הגדרת-חשבונות)
4. [הפעלת המערכת](#הפעלת-המערכת)
5. [שליטה מהטלפון](#שליטה-מהטלפון)
6. [פקודות מסחר](#פקודות-מסחר)
7. [פתרון בעיות](#פתרון-בעיות)

## סקירה כללית

המערכת מאפשרת שליטה מרכזית ב-20+ חשבונות Tradovate במקביל דרך Playwright (ללא API).

### יתרונות המערכת:
✅ **ללא צורך ב-API** - עובד ישירות דרך הדפדפן  
✅ **שליטה מהטלפון** - ממשק ווב מותאם למובייל  
✅ **פקודות מרכזיות** - Buy All / Sell All / Close All בלחיצה אחת  
✅ **עדכונים בזמן אמת** - מעקב אחרי כל החשבונות  
✅ **יציבות מקסימלית** - שמירת sessions ו-reconnect אוטומטי  

## התקנה מהירה

### דרישות מקדימות:
- Node.js 18 ומעלה
- 4GB RAM מינימום
- Windows/Mac/Linux

### שלבי התקנה:

```bash
# 1. שכפול/הורדת הפרויקט
cd tradovate-multi-account

# 2. התקנת תלויות
npm install

# 3. הרצת אשף ההתקנה
npm run setup

# 4. הפעלת המערכת
npm start
```

## הגדרת חשבונות

### אפשרות 1: דרך אשף ההתקנה
```bash
npm run setup
```
האשף ידריך אותך שלב אחר שלב להוספת החשבונות.

### אפשרות 2: עריכת קובץ accounts.json
ערוך את `config/accounts.json`:
```json
[
    {
        "username": "your-email@example.com",
        "password": "your-password",
        "accountId": "account_001",
        "autoConnect": true,
        "description": "חשבון ראשי"
    }
]
```

### אפשרות 3: הוספה דרך הממשק
1. פתח את הדפדפן ב-http://localhost:3000
2. לחץ על כפתור ה-+ (למטה משמאל)
3. הזן פרטי חשבון

## הפעלת המערכת

### הפעלה רגילה:
```bash
npm start
```

### הפעלה במצב פיתוח:
```bash
npm run dev
```

### הפעלה עם Docker:
```bash
docker-compose up -d
```

## שליטה מהטלפון

### שלב 1: מציאת כתובת ה-IP של המחשב

**Windows:**
```cmd
ipconfig
```
חפש את "IPv4 Address"

**Mac/Linux:**
```bash
ifconfig
```
חפש את "inet"

### שלב 2: גישה מהטלפון
1. וודא שהטלפון והמחשב באותה רשת WiFi
2. פתח בדפדפן הטלפון:
   ```
   http://[IP-ADDRESS]:3000
   ```
   לדוגמה: `http://192.168.1.100:3000`

### שלב 3: שמירה כאפליקציה
**אייפון:**
1. פתח בסאפארי
2. לחץ על כפתור השיתוף
3. בחר "Add to Home Screen"

**אנדרואיד:**
1. פתח בכרום
2. תפריט (3 נקודות)
3. "Add to Home Screen"

## פקודות מסחר

### BUY ALL - פתיחת Long בכל החשבונות
1. הגדר סימול (MNQ, ES, NQ וכו')
2. הגדר כמות
3. לחץ על **BUY ALL** (ירוק)

### SELL ALL - פתיחת Short בכל החשבונות
1. הגדר סימול וכמות
2. לחץ על **SELL ALL** (אדום)

### CLOSE ALL - סגירת כל הפוזיציות
1. לחץ על **CLOSE ALL** (אפור)
2. אשר בחלון הקופץ

### קיצורי מקלדת:
- `Ctrl+B` - Buy All
- `Ctrl+S` - Sell All
- `Ctrl+X` - Close All

## מבנה הממשק

### 1. סרגל עליון
- לוגו המערכת
- סטטוס חיבור (ירוק = מחובר, אדום = מנותק)

### 2. פאנל פקודות מהירות
- כפתורי BUY ALL / SELL ALL / CLOSE ALL

### 3. הגדרות מסחר
- סימול (ברירת מחדל: MNQ)
- כמות (ברירת מחדל: 1)

### 4. רשימת חשבונות
- כרטיס לכל חשבון עם:
  - שם משתמש
  - סטטוס חיבור
  - מאזן
  - פוזיציות פתוחות
  - רווח/הפסד

### 5. לוג פעילות
- היסטוריה של כל הפעולות

## API Endpoints (לשימוש מתקדם)

### בדיקת בריאות:
```http
GET http://localhost:3000/api/health
```

### קבלת סטטוס חשבונות:
```http
GET http://localhost:3000/api/accounts
```

### ביצוע Buy All:
```http
POST http://localhost:3000/api/trade/buy-all
Content-Type: application/json

{
    "symbol": "MNQ",
    "quantity": 1,
    "orderType": "MARKET"
}
```

### ביצוע Sell All:
```http
POST http://localhost:3000/api/trade/sell-all
Content-Type: application/json

{
    "symbol": "MNQ",
    "quantity": 1,
    "orderType": "MARKET"
}
```

### סגירת כל הפוזיציות:
```http
POST http://localhost:3000/api/trade/close-all
```

## WebSocket Events

### מהלקוח לשרת:
```javascript
socket.emit('execute-command', {
    action: 'BUY_ALL', // או SELL_ALL, CLOSE_ALL
    params: {
        symbol: 'MNQ',
        quantity: 1
    }
});
```

### מהשרת ללקוח:
```javascript
socket.on('accounts-update', (accounts) => {
    // עדכון רשימת חשבונות
});

socket.on('command-result', (result) => {
    // תוצאת פקודה
});
```

## פתרון בעיות

### בעיה: המערכת לא מצליחה להתחבר לחשבונות
**פתרון:**
```bash
# הרץ בדיקת חיבור
npm run test

# אם הבדיקה נכשלת, בדוק:
1. חיבור אינטרנט
2. פרטי חשבון נכונים
3. Tradovate לא חסום בפיירוול
```

### בעיה: לא מצליח להתחבר מהטלפון
**פתרון:**
1. וודא שהטלפון והמחשב באותה רשת
2. בדוק שהפיירוול לא חוסם את פורט 3000:
   ```bash
   # Windows - פתיחת פורט
   netsh advfirewall firewall add rule name="Tradovate Control" dir=in action=allow protocol=TCP localport=3000
   ```

### בעיה: החיבור לחשבון נכשל לאחר זמן
**פתרון:**
```bash
# מחק את קבצי ה-session
rm -rf sessions/*

# התחבר מחדש
npm start
```

### בעיה: שגיאת "Cannot find module"
**פתרון:**
```bash
# התקן מחדש את התלויות
rm -rf node_modules
npm install
```

## הגדרות מתקדמות

### שינוי פורט השרת:
ערוך את `.env`:
```env
PORT=5000
```

### הפעלה במצב Headless (ללא חלון דפדפן):
ערוך את `config/settings.json`:
```json
{
    "playwright": {
        "headless": true
    }
}
```

### הגבלת מספר חשבונות מקבילי:
ערוך את `playwright-manager.js`:
```javascript
this.maxConcurrent = 10; // במקום 25
```

## אבטחה

### 1. הצפנת סיסמאות:
הסיסמאות נשמרות מוצפנות ב-sessions

### 2. הגבלת גישה:
הוסף אימות ב-`server.js`:
```javascript
app.use(basicAuth({
    users: { 'admin': 'password' }
}));
```

### 3. HTTPS:
השתמש ב-nginx או cloudflare לתעבורה מוצפנת

## תמיכה

### לוגים:
בדוק את תיקיית `logs/` לאיתור שגיאות

### גיבוי:
גבה את:
- `config/accounts.json`
- `sessions/`

### עדכונים:
```bash
git pull
npm update
```

## רישיון
MIT License - ניתן לשימוש חופשי

---

💡 **טיפ:** שמור את המדריך הזה בסימניות לעיון מהיר!

📧 **תמיכה:** צור קשר בטלגרם או WhatsApp לעזרה נוספת
