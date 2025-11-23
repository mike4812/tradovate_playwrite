# 📖 מדריך הוספת משתמשים

## 🎯 3 דרכים להוסיף משתמש חדש:

---

## 1️⃣ דרך הממשק הגרפי (הכי קל!)

1. פתח את הדפדפן: `http://localhost:3000`
2. לחץ על הכפתור **"הוסף חשבון חדש"** 🟢
3. מלא את הפרטים:
   - **שם משתמש** - השם שלך ב-Tradovate
   - **סיסמה** - הסיסמה שלך
   - **תיאור** - שם נוח לזיהוי (למשל: "חשבון ראשי")
   - **התחבר אוטומטית** - סמן ✅ אם אתה רוצה שהמערכת תתחבר אוטומטית
4. לחץ **"הוסף חשבון"** ✅
5. המערכת תתחבר אוטומטית!

---

## 2️⃣ עריכת הקובץ ידנית

**ערוך את הקובץ:** `config/accounts.json`

```json
[
    {
        "username": "המשתמש הראשון שלך",
        "password": "הסיסמה הראשונה",
        "accountId": "account_1",
        "autoConnect": true,
        "description": "חשבון ראשי"
    },
    {
        "username": "המשתמש השני שלך",
        "password": "הסיסמה השנייה", 
        "accountId": "account_2",
        "autoConnect": true,
        "description": "חשבון משני"
    }
]
```

**הסבר על השדות:**
- `username` - שם המשתמש ב-Tradovate
- `password` - הסיסמה (נשמרת מקומית בלבד!)
- `accountId` - מזהה ייחודי (יכול להיות כל דבר)
- `autoConnect` - `true` = התחברות אוטומטית, `false` = ידני
- `description` - תיאור לזיהוי

---

## 3️⃣ דרך API

```bash
curl -X POST http://localhost:3000/api/accounts/add \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "mypassword",
    "description": "My Account",
    "autoConnect": true
  }'
```

---

## 🗑️ מחיקת חשבון

### דרך הממשק:
1. לחץ על כפתור 🗑️ ליד שם החשבון
2. אשר את המחיקה

### דרך עריכת הקובץ:
מחק את הבלוק של החשבון מ-`config/accounts.json`

---

## 📝 דוגמה מלאה

```json
[
    {
        "username": "alex@tradovate.com",
        "password": "MySecurePass123!",
        "accountId": "account_alex",
        "autoConnect": true,
        "description": "חשבון אלכס - ראשי"
    },
    {
        "username": "demo@tradovate.com",
        "password": "DemoPass456!",
        "accountId": "account_demo",
        "autoConnect": false,
        "description": "חשבון בדיקה - לא להתחבר אוטומטית"
    },
    {
        "username": "trader1@tradovate.com",
        "password": "TraderPass789!",
        "accountId": "account_trader1",
        "autoConnect": true,
        "description": "סוחר 1"
    }
]
```

---

## 🔒 אבטחה

- **הסיסמאות נשמרות מקומית** בקובץ על המחשב שלך בלבד
- **אין שליחה לשרת חיצוני** - הכל נשאר אצלך
- **מומלץ:** שמור את `config/accounts.json` במקום מאובטח
- **אל תשתף** את הקובץ עם אחרים!

---

## ⚡ טיפים

1. **שמור גיבוי** של `config/accounts.json` לפני עריכה
2. **בדוק JSON** - השתמש ב-validator אונליין אם יש שגיאה
3. **אתחל מחדש** את השרת אחרי עריכה ידנית:
   ```bash
   # Stop: Ctrl+C
   npm start
   ```
4. **עד 25 חשבונות** יכולים לרוץ במקביל

---

## 🐛 פתרון בעיות

**שגיאה: "Username already exists"**
- החשבון כבר קיים - בחר שם משתמש אחר או מחק את הקיים

**שגיאה: "Username and password required"**
- מלא את כל השדות החובה

**החשבון לא מתחבר:**
1. בדוק שם משתמש וסיסמה
2. וודא שיש אינטרנט
3. בדוק שהדפדפן פתוח
4. ראה את הלוגים בטרמינל

---

## 📞 עזרה נוספת

צפה בלוגים בטרמינל:
```
✅ System ready!
🔐 Logging in to account...
✅ Page loaded successfully
```

אם יש שגיאה - העתק את השגיאה וחפש בגוגל או שאל AI 🤖
