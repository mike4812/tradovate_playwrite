// server.js - השרת הראשי עם API וממשק ווב
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const PlaywrightManager = require('./playwright-manager');
const RiskManager = require('./risk-manager');

// Setup log directory and file
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFileName = `server-${new Date().toISOString().split('T')[0]}.log`;
const logFilePath = path.join(logDir, logFileName);

// Logging utility with timestamps
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
    const prefix = `[${timestamp}]`;
    
    let logMessage = '';
    let consoleMessage = '';
    
    if (type === 'error') {
        logMessage = `${prefix} [ERROR] ${message}`;
        consoleMessage = `${prefix} ❌ ${message}`;
        console.error(consoleMessage);
    } else if (type === 'success') {
        logMessage = `${prefix} [SUCCESS] ${message}`;
        consoleMessage = `${prefix} ✅ ${message}`;
        console.log(consoleMessage);
    } else if (type === 'warning') {
        logMessage = `${prefix} [WARNING] ${message}`;
        consoleMessage = `${prefix} ⚠️  ${message}`;
        console.warn(consoleMessage);
    } else {
        logMessage = `${prefix} [INFO] ${message}`;
        consoleMessage = `${prefix} ${message}`;
        console.log(consoleMessage);
    }
    
    // Write to file (async, non-blocking)
    fs.appendFile(logFilePath, logMessage + '\n', (err) => {
        if (err) console.error('Failed to write to log file:', err);
    });
}

// יצירת האפליקציה
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Simple authentication
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'tradovate-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/login.html');
}

// Middleware to protect static files
app.use((req, res, next) => {
    // Allow only login.html without authentication
    if (req.path === '/login.html') {
        return next();
    }
    
    // All other files require authentication
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login.html');
    }
    
    next();
});

// Serve static files (now protected by middleware above)
app.use(express.static('public'));

// Root redirect
app.get('/', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.sendFile(__dirname + '/public/index.html');
    } else {
        res.redirect('/login.html');
    }
});

// יצירת מנהל Playwright ומנהל סיכונים
const manager = new PlaywrightManager();
const riskManager = new RiskManager(manager);

// משתנים גלובליים
let isSystemReady = false;
const connectedClients = new Set();

// =========================
// System Initialization
// =========================
async function initializeSystem() {
    try {
        log('🚀 Starting system initialization...');
        await manager.initialize();
        
        // Start Risk Manager
        riskManager.startMonitoring();
        log('📊 Risk Manager activated', 'success');
        
        isSystemReady = true;
        log('✅ System ready!', 'success');
        
        // Auto-load accounts
        await loadAccountsFromConfig();
        
    } catch (error) {
        log('System initialization error: ' + error.message, 'error');
        process.exit(1);
    }
}

// Load accounts from config file
async function loadAccountsFromConfig() {
    try {
        const accounts = require('./config/accounts.json');
        log(`📋 Found ${accounts.length} accounts to load`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const account of accounts) {
            if (account.autoConnect) {
                log(`\n🔄 Connecting account ${account.username}...`);
                try {
                    const result = await manager.loginAccount(account);
                    if (result.success) {
                        successCount++;
                        log(`✅ [${successCount}/${accounts.length}] ${account.username} connected`, 'success');
                    } else {
                        failCount++;
                        log(`❌ [${successCount}/${accounts.length}] ${account.username} failed: ${result.error}`, 'error');
                    }
                    
                    // Add delay between accounts to avoid rate limiting
                    if (accounts.indexOf(account) < accounts.length - 1) {
                        log(`⏳ Waiting 3 seconds before next account...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (error) {
                    failCount++;
                    log(`❌ [${successCount}/${accounts.length}] ${account.username} error: ${error.message}`, 'error');
                }
            }
        }
        
        log(`\n📊 Summary: ${successCount} connected, ${failCount} failed`);
    } catch (error) {
        log('No accounts file found or error loading: ' + error.message, 'warning');
    }
}

// Helper function to get all accounts (connected + disconnected)
async function getAllAccountsWithStatus() {
    try {
        // Get connected accounts from manager
        const connectedAccounts = manager.getAllAccountsStatus();
        
        // Read all accounts from config file
        const accountsData = await fs.promises.readFile('./config/accounts.json', 'utf8');
        const configAccounts = JSON.parse(accountsData);
        
        // Merge: Show all accounts from config, update status if connected
        const allAccounts = configAccounts.map(configAccount => {
            const connectedAccount = connectedAccounts.find(
                acc => acc.accountId === configAccount.accountId
            );
            
            if (connectedAccount) {
                // Account is connected - merge data
                return {
                    ...connectedAccount,
                    autoConnect: configAccount.autoConnect,
                    description: configAccount.description
                };
            } else {
                // Account is not connected - show from config
                return {
                    accountId: configAccount.accountId,
                    username: configAccount.username,
                    accountName: configAccount.description || configAccount.username,
                    status: 'disconnected',
                    balance: 0,
                    equity: 0,
                    pnl: 0,
                    positions: [],
                    autoConnect: configAccount.autoConnect,
                    description: configAccount.description,
                    lastUpdate: null
                };
            }
        });
        
        return allAccounts;
    } catch (error) {
        log('Error getting all accounts: ' + error.message, 'error');
        return manager.getAllAccountsStatus();
    }
}

// =========================
// Risk Manager Events
// =========================
riskManager.on('sl-tp-added', (data) => {
    io.emit('risk-event', {
        type: 'sl-tp-added',
        data
    });
});

riskManager.on('breakeven-moved', (data) => {
    io.emit('risk-event', {
        type: 'breakeven-moved',
        data
    });
});

riskManager.on('max-daily-loss-reached', (loss) => {
    io.emit('risk-event', {
        type: 'max-daily-loss',
        loss
    });
});

riskManager.on('max-daily-profit-reached', (profit) => {
    io.emit('risk-event', {
        type: 'max-daily-profit',
        profit
    });
});

// =========================
// WebSocket Handlers
// =========================
io.on('connection', async (socket) => {
    log('👤 New client connected: ' + socket.id);
    connectedClients.add(socket.id);
    
    // שליחת סטטוס ראשוני
    const initialAccounts = await getAllAccountsWithStatus();
    socket.emit('system-status', {
        ready: isSystemReady,
        accounts: initialAccounts
    });
    
    // עדכון סטטוס בזמן אמת
    const statusInterval = setInterval(async () => {
        if (isSystemReady) {
            const accounts = await getAllAccountsWithStatus();
            socket.emit('accounts-update', accounts);
        }
    }, 2000);
    
    // ניתוק
    socket.on('disconnect', () => {
        log('👤 Client disconnected: ' + socket.id);
        connectedClients.delete(socket.id);
        clearInterval(statusInterval);
    });
    
    // פקודות מסחר
    socket.on('execute-command', async (command) => {
        log('📨 Command received: ' + JSON.stringify(command));
        await handleTradeCommand(socket, command);
    });
    
    // פקודות Risk Manager
    socket.on('risk-settings', (settings) => {
        log('⚙️ Risk Manager settings updated: ' + JSON.stringify(settings));
        riskManager.updateSettings(settings);
        socket.emit('risk-settings-updated', riskManager.settings);
    });
    
    socket.on('risk-monitoring', (action) => {
        if (action === 'start') {
            riskManager.startMonitoring();
        } else if (action === 'stop') {
            riskManager.stopMonitoring();
        }
        socket.emit('risk-monitoring-status', {
            monitoring: riskManager.monitoring
        });
    });
});

// טיפול בפקודות מסחר
async function handleTradeCommand(socket, command) {
    const { action, params = {} } = command;
    
    try {
        let result;
        
        switch (action) {
            case 'BUY_ALL':
                result = await manager.buyAll(params.symbol, params.quantity, params.orderType);
                break;
                
            case 'SELL_ALL':
                result = await manager.sellAll(params.symbol, params.quantity, params.orderType);
                break;
                
            case 'CLOSE_ALL':
                result = await manager.closeAll();
                break;
                
            case 'CONNECT_ACCOUNT':
                result = await manager.loginAccount(params);
                break;
                
            case 'DISCONNECT_ACCOUNT':
                result = await manager.disconnectAccount(params.accountId);
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // שליחת תוצאה ללקוח
        socket.emit('command-result', {
            success: true,
            action,
            result
        });
        
        // עדכון כל הלקוחות
        io.emit('accounts-update', manager.getAllAccountsStatus());
        
    } catch (error) {
        socket.emit('command-result', {
            success: false,
            action,
            error: error.message
        });
    }
}

// =========================
// Authentication API
// =========================

// Login endpoint
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const correctPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Change this!
    
    if (password === correctPassword) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// =========================
// REST API Endpoints (Protected)
// =========================

// Protect all API endpoints except auth
app.use('/api/accounts', requireAuth);
app.use('/api/trade', requireAuth);
app.use('/api/risk', requireAuth);

// בדיקת בריאות
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        ready: isSystemReady,
        accounts: manager.accounts.size,
        clients: connectedClients.size
    });
});

// קבלת סטטוס חשבונות
app.get('/api/accounts', async (req, res) => {
    try {
        const allAccounts = await getAllAccountsWithStatus();
        log(`📊 Returning ${allAccounts.length} accounts`);
        
        res.json({
            success: true,
            accounts: allAccounts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// התחברות לחשבון חדש
app.post('/api/accounts/connect', async (req, res) => {
    try {
        const result = await manager.loginAccount(req.body);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new account to config file
app.post('/api/accounts/add', async (req, res) => {
    try {
        const { username, password, description, autoConnect = true } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }
        
        const accountId = `account_${Date.now()}`;
        const newAccount = {
            username,
            password,
            accountId,
            autoConnect,
            description: description || username
        };
        
        // Read current accounts
        const fs = require('fs').promises;
        const accountsPath = './config/accounts.json';
        const accountsData = await fs.readFile(accountsPath, 'utf8');
        const accounts = JSON.parse(accountsData);
        
        // Check if accountId already exists (allow same username/password with different accountId)
        if (accounts.some(acc => acc.accountId === accountId)) {
            return res.status(400).json({ success: false, error: 'Account ID conflict, please try again' });
        }
        
        // Add new account (same username/password allowed for multiple trading accounts)
        accounts.push(newAccount);
        
        log(`➕ Adding account: ${username} (${accountId})`);
        
        // Save back to file
        await fs.writeFile(accountsPath, JSON.stringify(accounts, null, 4));
        
        // Auto-connect if requested
        if (autoConnect) {
            await manager.loginAccount(newAccount);
        }
        
        res.json({ success: true, account: newAccount });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove account from config
app.post('/api/accounts/remove/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        
        // Read current accounts
        const fs = require('fs').promises;
        const accountsPath = './config/accounts.json';
        const accountsData = await fs.readFile(accountsPath, 'utf8');
        let accounts = JSON.parse(accountsData);
        
        // Remove account
        accounts = accounts.filter(acc => acc.accountId !== accountId);
        
        // Save back to file
        await fs.writeFile(accountsPath, JSON.stringify(accounts, null, 4));
        
        // Disconnect if connected
        await manager.disconnectAccount(accountId);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ביצוע פקודת BUY ALL
app.post('/api/trade/buy-all', async (req, res) => {
    try {
        const { symbol = 'NQ', quantity = 1, orderType = 'MARKET' } = req.body;
        const result = await manager.buyAll(symbol, quantity, orderType);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ביצוע פקודת SELL ALL
app.post('/api/trade/sell-all', async (req, res) => {
    try {
        const { symbol = 'NQ', quantity = 1, orderType = 'MARKET' } = req.body;
        const result = await manager.sellAll(symbol, quantity, orderType);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ביצוע פקודת CLOSE ALL
app.post('/api/trade/close-all', async (req, res) => {
    try {
        const result = await manager.closeAll();
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ניתוק חשבון
app.post('/api/accounts/:accountId/disconnect', async (req, res) => {
    try {
        await manager.disconnectAccount(req.params.accountId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get quantity from Tradovate page
app.get('/api/accounts/:accountId/quantity', async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = manager.accounts.get(accountId);
        
        if (!account || account.status !== 'connected') {
            return res.status(404).json({ success: false, error: 'Account not connected' });
        }
        
        const quantity = await manager.getQuantity(account.page);
        res.json({ success: true, quantity });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Change quantity on Tradovate page (up/down)
app.post('/api/accounts/:accountId/change-quantity', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { delta } = req.body;
        
        const result = await manager.changeQuantity(accountId, delta);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle autoConnect for account
app.post('/api/accounts/:accountId/toggle-autoconnect', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { autoConnect } = req.body;
        
        // Read current accounts
        const fs = require('fs').promises;
        const accountsPath = './config/accounts.json';
        const accountsData = await fs.readFile(accountsPath, 'utf8');
        const accounts = JSON.parse(accountsData);
        
        // Find and update the account
        const accountIndex = accounts.findIndex(acc => acc.accountId === accountId);
        if (accountIndex === -1) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }
        
        accounts[accountIndex].autoConnect = autoConnect;
        
        // Save back to file
        await fs.writeFile(accountsPath, JSON.stringify(accounts, null, 4));
        
        log(`🔄 ${accounts[accountIndex].username} autoConnect ${autoConnect ? 'enabled' : 'disabled'}`);
        
        // Connect or disconnect based on the new state
        if (autoConnect) {
            // Connect the account
            const result = await manager.loginAccount(accounts[accountIndex]);
            res.json({ success: true, autoConnect, connected: result.success });
        } else {
            // Disconnect the account
            await manager.disconnectAccount(accountId);
            res.json({ success: true, autoConnect, connected: false });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute command on single account
app.post('/api/accounts/:accountId/execute', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { action, symbol = 'NQ' } = req.body;
        
        const account = manager.accounts.get(accountId);
        if (!account || account.status !== 'connected') {
            return res.status(404).json({ success: false, error: 'Account not connected' });
        }
        
        let result;
        const quantity = await manager.getQuantity(account.page);
        
        if (action === 'BUY') {
            result = await manager.executeBuy(account.page, symbol, quantity, 'MARKET');
        } else if (action === 'SELL') {
            result = await manager.executeSell(account.page, symbol, quantity, 'MARKET');
        } else if (action === 'CLOSE') {
            result = await manager.closeAllPositions(account.page);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
        
        res.json({ success: true, result, action });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================
// Risk Manager API Endpoints
// =========================

// קבלת הגדרות Risk Manager
app.get('/api/risk/settings', (req, res) => {
    res.json({
        success: true,
        settings: riskManager.settings
    });
});

// עדכון הגדרות Risk Manager
app.post('/api/risk/settings', (req, res) => {
    try {
        riskManager.updateSettings(req.body);
        res.json({ success: true, settings: riskManager.settings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// קבלת סטטיסטיקות Risk Manager
app.get('/api/risk/statistics', (req, res) => {
    res.json({
        success: true,
        statistics: riskManager.getStatistics()
    });
});

// Restart server
app.post('/api/restart', async (req, res) => {
    try {
        log('🔄 Restart requested...', 'warning');
        res.json({ success: true, message: 'Server restarting...' });
        
        // Shutdown gracefully
        await manager.shutdown();
        
        // Close HTTP server
        server.close(() => {
            log('🛑 Server closed', 'warning');
        });
        
        // Use batch file to handle restart
        setTimeout(() => {
            log('🚀 Launching restart script...');
            const { spawn } = require('child_process');
            const path = require('path');
            
            // Start restart batch file in new window
            const restartScript = path.join(__dirname, 'restart-server.bat');
            spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', restartScript], {
                cwd: __dirname,
                detached: true,
                stdio: 'ignore'
            });
            
            // Exit current process
            log('👋 Exiting old process...', 'warning');
            process.exit(0);
        }, 1000);
    } catch (error) {
        log('Restart error: ' + error.message, 'error');
        res.status(500).json({ success: false, error: error.message });
    }
});

// הפעלת/כיבוי ניטור אוטומטי
app.post('/api/risk/monitoring/:action', (req, res) => {
    try {
        if (req.params.action === 'start') {
            riskManager.startMonitoring();
        } else if (req.params.action === 'stop') {
            riskManager.stopMonitoring();
        }
        res.json({ 
            success: true, 
            monitoring: riskManager.monitoring 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================
// Graceful Shutdown
// =========================
process.on('SIGINT', async () => {
    log('\n🛑 Received shutdown signal...', 'warning');
    await manager.shutdown();
    server.close(() => {
        log('👋 Goodbye!', 'warning');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    await manager.shutdown();
    server.close(() => {
        process.exit(0);
    });
});

// =========================
// הפעלת השרת
// =========================
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   TRADOVATE MULTI-ACCOUNT CONTROL SYSTEM    ║
╠══════════════════════════════════════════════╣
║   🌐 Server: http://localhost:${PORT}         ║
║   📱 Mobile: http://[YOUR-IP]:${PORT}         ║
║   🔌 WebSocket: ws://localhost:${PORT}        ║
╚══════════════════════════════════════════════╝
    `);
    
    await initializeSystem();
});

module.exports = app;
