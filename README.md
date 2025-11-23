# 🚀 Tradovate Multi-Account Control System

## מערכת שליטה מרכזית ב-20+ חשבונות Tradovate

### ✨ יכולות המערכת:
- ✅ ניהול 20+ חשבונות במקביל
- ✅ שליטה מרחוק דרך הטלפון
- ✅ פקודות מרכזיות: Buy All / Sell All / Close All
- ✅ ממשק ווב מותאם למובייל
- ✅ עדכונים בזמן אמת
- ✅ ללא צורך ב-API (עובד דרך Playwright)

### 📁 מבנה הפרויקט:
```
tradovate-multi-account/
├── server.js                 # שרת Node.js ראשי
├── playwright-manager.js      # מנהל חשבונות Playwright
├── account-controller.js      # בקר לוגיקת חשבונות
├── websocket-handler.js       # WebSocket לעדכונים בזמן אמת
├── config/
│   ├── accounts.json         # רשימת חשבונות
│   └── settings.json         # הגדרות מערכת
├── public/
│   ├── index.html           # ממשק ווב ראשי
│   ├── dashboard.js         # לוגיקת Dashboard
│   └── style.css           # עיצוב מותאם מובייל
└── sessions/               # שמירת sessions של החשבונות
```

### 🔧 דרישות:
- Node.js 18+
- Playwright
- Express.js
- Socket.io

### 🚀 התקנה מהירה:
```bash
npm install
npm run setup
npm start
```

### 📱 גישה מהטלפון:
http://your-server-ip:3000
