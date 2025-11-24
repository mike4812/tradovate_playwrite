// playwright-manager.js - מנהל החשבונות הראשי
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class PlaywrightManager {
    constructor() {
        this.accounts = new Map(); // מאחסן את כל החשבונות הפעילים
        this.browsers = new Map(); // Store separate browser for each account
        this.maxConcurrent = 25; // מקסימום חשבונות במקביל
        this.sessionDir = path.join(__dirname, 'sessions');
    }

    // Initialize system
    async initialize() {
        console.log('🚀 Initializing Playwright Manager...');
        
        // Create sessions directory if not exists
        await fs.mkdir(this.sessionDir, { recursive: true });
        
        console.log('✅ Playwright Manager ready!');
        return true;
    }

    // Login to Tradovate account
    async loginAccount(accountData) {
        const { username, password, accountId } = accountData;
        let context = null;
        let browser = null;
        
        try {
            console.log(`🔐 Logging in to account ${username}...`);
            
            // Launch separate browser for each account
            browser = await chromium.launch({
                headless: false,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            
            // Store browser reference
            this.browsers.set(accountId, browser);
            
            // Create new context for each account
            const contextPath = path.join(this.sessionDir, `${accountId}.json`);
            context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                storageState: await this.loadStorageState(contextPath)
            });

            // פתיחת דף חדש
            const page = await context.newPage();
            
            // Setup stealth mode
            await this.setupStealthMode(page);
            
            console.log(`📡 Navigating to Tradovate...`);
            // Navigate to Tradovate with extended timeout
            await page.goto('https://trader.tradovate.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            console.log(`✅ Page loaded successfully`);
            // Wait for JavaScript to load
         //   await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
          //      console.log(`⚠️ Network idle not reached, continuing anyway...`);
          //  });

            // Check if already logged in
            const isLoggedIn = await this.checkIfLoggedIn(page);
            
            if (!isLoggedIn) {
                console.log(`🔑 Not logged in, performing login...`);
                // Perform login
                await this.performLogin(page, username, password);
                
                // Save session
                console.log(`💾 Saving session state...`);
                await context.storageState({ path: contextPath });
            } else {
                console.log(`✅ Already logged in from saved session`);
            }

            // Save account in map
            this.accounts.set(accountId, {
                context,
                page,
                username,
                status: 'connected',
                balance: 0,
                positions: [],
                lastUpdate: new Date()
            });

            console.log(`✅ Account ${username} connected successfully!`);
            
            // Start monitoring the account
            await this.startAccountMonitoring(accountId);
            
            return { success: true, accountId };
            
        } catch (error) {
            console.error(`❌ Error connecting to account ${username}:`, error.message);
            
            // Clean up context if it was created
            if (context) {
                try {
                    await context.close();
                    console.log(`🧹 Cleaned up context for ${username}`);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            
            return { success: false, error: error.message };
        }
    }

    // הגדרות למניעת זיהוי אוטומציה
    async setupStealthMode(page) {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // הסתרת עובדת שזה Playwright
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // החלפת languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        });
    }

    // בדיקה אם החשבון כבר מחובר
    async checkIfLoggedIn(page) {
        try {
            await page.waitForSelector('.account-info', { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    // Perform login
    async performLogin(page, username, password) {
        // debugger; // 🔴 BREAKPOINT 1: Start of login
        console.log(`🔑 Performing login for ${username}...`);
        
        try {
            // debugger; // 🔴 BREAKPOINT 2: Before finding username field
            // Wait for login page to load - try different selectors
            console.log(`🔍 Searching for username field...`);
            const usernameSelector = await page.waitForSelector(
                'input[type="text"], input[type="email"], input[name="username"], input[id*="user"], input[placeholder*="user" i], input[placeholder*="email" i]',
                { timeout: 10000 }
            ).catch(async () => {
                // If not found, show page structure
                console.log(`❌ Login field not found. Page structure:`);
                const bodyHTML = await page.evaluate(() => document.body.innerHTML);
                console.log(bodyHTML.substring(0, 1000));
                
                // Take a screenshot for debugging
                await page.screenshot({ path: `debug-${username}.png`, fullPage: true }).catch(() => {});
                
                throw new Error('Username field not found');
            });
            
            // debugger; // 🔴 BREAKPOINT 3: Username field found
            console.log(`✅ Username field found`);
            // Fill username instantly
            await usernameSelector.fill(username);
            await page.waitForTimeout(200);
            
            // debugger; // 🔴 BREAKPOINT 4: Before password field
            console.log(`🔍 Searching for password field...`);
            // Fill password
            const passwordSelector = await page.waitForSelector(
                'input[type="password"], input[name="password"], input[id*="pass"]',
                { timeout: 5000 }
            );
            await passwordSelector.fill(password);
            await page.waitForTimeout(200);
            
            // debugger; // 🔴 BREAKPOINT 5: Before clicking login button
            console.log(`🖱️ Clicking login button...`);
            // Click login button
            const loginButton = await page.waitForSelector(
                'button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in"), input[type="submit"]',
                { timeout: 5000 }
            );
            await loginButton.click();
            
            await page.waitForTimeout(200);
            // debugger; // 🔴 BREAKPOINT 5: Before clicking Access Simulation button
            console.log(`🖱️ Clicking Access Simulation...`);
            // Click Access Simulation button
            const accessButton = await page.waitForSelector(
                 'button:has-text("Start Simulated Trading"), button:has-text("Access Simulation")',
                { timeout: 5000 }
            ).catch(() => null);
            
            if (accessButton) {
                await accessButton.click();
                console.log(`✅ Clicked Access Simulation button`);
            } else {
                console.log(`⚠️ No Access Simulation button found, continuing...`);
            }

            // debugger; // 🔴 BREAKPOINT 6: After clicking, before waiting
            console.log(`⏳ Waiting for login to complete...`);
            // Wait for login - use fastest condition
            const loginResult = await Promise.race([
                page.waitForNavigation({ timeout: 15000 }).then(() => 'navigation'),
                page.waitForURL(/trader\.tradovate\.com\/(?!login)/, { timeout: 15000 }).then(() => 'url-change'),
                page.waitForSelector('.account-info, .dashboard, .trading-panel, .dom-widget', { timeout: 15000 }).then(() => 'dashboard-loaded')
            ]).catch(async (error) => {
                console.log(`⚠️ Login wait timed out:`, error.message);
                // Take screenshot for debugging
                await page.screenshot({ path: `login-timeout-${username}.png`, fullPage: true }).catch(() => {});
                return 'timeout';
            });
            
            // debugger; // 🔴 BREAKPOINT 7: Login completed/timed out
            console.log(`📊 Login result: ${loginResult}`);
            
            await page.waitForTimeout(1000);
            const currentUrl = page.url();
            // debugger; // 🔴 BREAKPOINT 8: Check final URL
            console.log(`📍 Current URL: ${currentUrl}`);
            
            // Check if we're still on login page
            if (currentUrl.includes('login') || currentUrl.includes('signin')) {
                // debugger; // 🔴 BREAKPOINT 9: Login failed - still on login page
                throw new Error('Login failed - still on login page. Check credentials.');
            }
            
            console.log(`✅ Login completed for ${username}`);
        } catch (error) {
            // debugger; // 🔴 BREAKPOINT 10: Error caught - inspect error details
            console.error(`❌ Login error for ${username}:`, error.message);
            throw error;
        }
    }

    // טעינת storage state אם קיים
    async loadStorageState(path) {
        try {
            await fs.access(path);
            return path;
        } catch {
            return undefined;
        }
    }

    // מעקב אחרי חשבון
    async startAccountMonitoring(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) return;

        const monitoringInterval = setInterval(async () => {
            try {
                // Check if account still exists and page is not closed
                const currentAccount = this.accounts.get(accountId);
                if (!currentAccount || !currentAccount.page || currentAccount.page.isClosed()) {
                    console.log(`Account ${accountId} no longer active, stopping monitoring`);
                    clearInterval(monitoringInterval);
                    return;
                }
                
                // עדכון מאזן וחשבון
                const accountInfo = await this.getAccountBalance(currentAccount.page);
                
                // עדכון פוזיציות
                const positions = await this.getAccountPositions(currentAccount.page);
                
                // עדכון במפה
                currentAccount.accountName = accountInfo.accountName;
                currentAccount.equity = accountInfo.equity;
                currentAccount.pnl = accountInfo.pnl;
                currentAccount.balance = accountInfo.equity; // backwards compatibility
                currentAccount.positions = positions;
                currentAccount.lastUpdate = new Date();
                
            } catch (error) {
                // Check if error is due to closed page/browser
                if (error.message.includes('Target page, context or browser has been closed') ||
                    error.message.includes('Target closed')) {
                    console.log(`Account ${accountId} browser closed, stopping monitoring`);
                    clearInterval(monitoringInterval);
                    this.accounts.delete(accountId);
                } else {
                    console.error(`Error monitoring account ${accountId}:`, error.message);
                }
            }
        }, 3000); // עדכון כל 3 שניות
        
        // Store interval reference for cleanup
        account.monitoringInterval = monitoringInterval;
    }

    // קבלת מאזן חשבון
    async getAccountBalance(page) {
        try {
            const accountInfo = await page.evaluate(() => {
                // Get account name from the dropdown - based on your HTML structure
                let accountName = 'Unknown';
                const accountNameEl = document.querySelector('.account-selector .name div, .account .name div');
                if (accountNameEl) {
                    accountName = accountNameEl.textContent.trim();
                }
                
                // Get EQUITY and P&L - Try currency-wrap first
                let equity = 0;
                let pnl = 0;
                const currencyWraps = document.querySelectorAll('.currency-wrap');
                
                // Find Equity and P&L by looking at labels near currency-wrap elements
                for (const wrap of currencyWraps) {
                    const parent = wrap.parentElement;
                    const label = parent?.querySelector('small, .label');
                    if (label) {
                        const labelText = label.textContent.toUpperCase();
                        const valueText = wrap.textContent.trim().split(/\s+/)[0]; // Get first part before "usd"
                        
                        if (labelText.includes('EQUITY') && equity === 0) {
                            equity = parseFloat(valueText.replace(/[^0-9.-]/g, ''));
                            console.log('Found Equity in currency-wrap:', equity);
                        } else if ((labelText.includes('OPEN P') || labelText.includes('P&L') || labelText.includes('P/L')) && pnl === 0) {
                            pnl = parseFloat(valueText.replace(/[^0-9.-]/g, ''));
                            console.log('Found P&L in currency-wrap:', pnl);
                        }
                        
                        // Break if we found both
                        if (equity !== 0 && pnl !== 0) break;
                    }
                }
                
                // Fallback to old method if equity not found
                if (equity === 0) {
                    const equityLabels = Array.from(document.querySelectorAll('small, .label')).filter(el => 
                        el.textContent.toUpperCase().includes('EQUITY')
                    );
                    
                    if (equityLabels.length > 0) {
                        const equityParent = equityLabels[0].parentElement;
                        const equityValue = equityParent.querySelector('.value, div:not(.label), .currency-wrap');
                        if (equityValue) {
                            equity = parseFloat(equityValue.textContent.replace(/[^0-9.-]/g, ''));
                        }
                    }
                }
                
                // Fallback to old method if P&L not found
                if (pnl === 0) {
                    const pnlLabels = Array.from(document.querySelectorAll('small, .label')).filter(el => 
                        el.textContent.toUpperCase().includes('OPEN P') || el.textContent.toUpperCase().includes('P&L') || el.textContent.toUpperCase().includes('P/L')
                    );
                    
                    if (pnlLabels.length > 0) {
                        const pnlParent = pnlLabels[0].parentElement;
                        const pnlValue = pnlParent.querySelector('.value, div:not(.label), .currency-wrap');
                        if (pnlValue) {
                            pnl = parseFloat(pnlValue.textContent.replace(/[^0-9.-]/g, ''));
                        }
                    }
                }
                
                // Fallback: search entire body text
                if (equity === 0 || pnl === 0) {
                    const bodyText = document.body.innerText;
                    
                    if (equity === 0) {
                        const equityMatch = bodyText.match(/EQUITY[:\s]+(-?\$?[\d,]+\.?\d*)/i);
                        if (equityMatch) {
                            equity = parseFloat(equityMatch[1].replace(/[^0-9.-]/g, ''));
                        }
                    }
                    
                    if (pnl === 0) {
                        const pnlMatch = bodyText.match(/OPEN P[\/&]L[:\s]+(-?\$?[\d,]+\.?\d*)/i);
                        if (pnlMatch) {
                            pnl = parseFloat(pnlMatch[1].replace(/[^0-9.-]/g, ''));
                        }
                    }
                }
                
                console.log('Account Info:', { accountName, equity, pnl });
                
                return {
                    accountName,
                    equity,
                    pnl
                };
            });
            return accountInfo;
        } catch (error) {
            console.error('Error getting account balance:', error);
            return { accountName: 'Unknown', equity: 0, pnl: 0 };
        }
    }

    // קבלת פוזיציות פתוחות
    async getAccountPositions(page) {
        try {
            const positions = await page.evaluate(() => {
                const positionElements = document.querySelectorAll('.position-row, .open-position');
                return Array.from(positionElements).map(el => ({
                    symbol: el.querySelector('.symbol')?.textContent || '',
                    quantity: parseFloat(el.querySelector('.quantity')?.textContent || 0),
                    pnl: parseFloat(el.querySelector('.pnl')?.textContent?.replace(/[^0-9.-]/g, '') || 0)
                }));
            });
            return positions;
        } catch {
            return [];
        }
    }

    // ========== פונקציות מסחר מרכזיות ==========

    // פתיחת פוזיציית BUY בכל החשבונות
    async buyAll(symbol = 'NQ', quantity = 1, orderType = 'MARKET') {
        console.log(`📈 מבצע BUY ALL - ${symbol} כמות: ${quantity}`);
        const results = [];
        
        for (const [accountId, account] of this.accounts) {
            if (account.status === 'connected') {
                try {
                    const result = await this.executeBuy(account.page, symbol, quantity, orderType);
                    results.push({
                        accountId,
                        username: account.username,
                        success: true,
                        result
                    });
                } catch (error) {
                    results.push({
                        accountId,
                        username: account.username,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        return results;
    }

    // פתיחת פוזיציית SELL בכל החשבונות
    async sellAll(symbol = 'NQ', quantity = 1, orderType = 'MARKET') {
        console.log(`📉 מבצע SELL ALL - ${symbol} כמות: ${quantity}`);
        const results = [];
        
        for (const [accountId, account] of this.accounts) {
            if (account.status === 'connected') {
                try {
                    const result = await this.executeSell(account.page, symbol, quantity, orderType);
                    results.push({
                        accountId,
                        username: account.username,
                        success: true,
                        result
                    });
                } catch (error) {
                    results.push({
                        accountId,
                        username: account.username,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        return results;
    }

    // סגירת כל הפוזיציות בכל החשבונות
    async closeAll() {
        console.log(`🔴 מבצע CLOSE ALL - סוגר את כל הפוזיציות`);
        const results = [];
        
        for (const [accountId, account] of this.accounts) {
            if (account.status === 'connected') {
                try {
                    const result = await this.closeAllPositions(account.page);
                    results.push({
                        accountId,
                        username: account.username,
                        success: true,
                        result
                    });
                } catch (error) {
                    results.push({
                        accountId,
                        username: account.username,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        return results;
    }

    // Get quantity from Tradovate page
    async getQuantity(page) {
        try {
            const quantityInput = await page.waitForSelector('input.form-control[placeholder="Select value"]', { timeout: 5000 }).catch(() => null);
            if (quantityInput) {
                const value = await quantityInput.inputValue();
                return parseInt(value) || 1;
            }
            return 1;
        } catch (error) {
            console.error('Error getting quantity:', error.message);
            return 1;
        }
    }

    // Set quantity on Tradovate page
    async setQuantity(page, quantity) {
        try {
            const quantityInput = await page.waitForSelector('input.form-control[placeholder="Select value"]', { timeout: 5000 });
            
            // Clear current value
            await quantityInput.click({ clickCount: 3 }); // Select all
            await page.keyboard.press('Backspace');
            
            // Type new quantity
            await quantityInput.type(quantity.toString());
            
            console.log(`✅ Set quantity to: ${quantity}`);
            return { success: true, quantity };
        } catch (error) {
            console.error(`❌ Failed to set quantity:`, error.message);
            throw error;
        }
    }

    // Change quantity for account (up/down)
    async changeQuantity(accountId, delta) {
        const account = this.accounts.get(accountId);
        if (!account || account.status !== 'connected') {
            throw new Error('Account not connected');
        }

        const currentQty = await this.getQuantity(account.page);
        const newQty = Math.max(1, Math.min(10, currentQty + delta)); // Min 1, Max 10
        
        await this.setQuantity(account.page, newQty);
        return { success: true, oldQuantity: currentQty, newQuantity: newQty };
    }

    // ביצוע פקודת BUY
    async executeBuy(page, symbol, quantity, orderType) {
        console.log(`🔵 Executing BUY: ${symbol} qty: ${quantity}`);
        return await this.executeBuyViaUI(page, symbol, quantity, orderType);
    }

    // Execute BUY via UI - Click Buy Mkt button
    async executeBuyViaUI(page, symbol, quantity, orderType) {
        console.log(`🟢 Executing BUY for ${symbol}`);
        
        try {
            // Get the quantity from the input field on the page
            const quantityInput = await page.waitForSelector('input.form-control[placeholder="Select value"]', { timeout: 5000 }).catch(() => null);
            let actualQuantity = quantity;
            
            if (quantityInput) {
                const inputValue = await quantityInput.inputValue();
                actualQuantity = parseInt(inputValue) || quantity;
                console.log(`📊 Using quantity from page: ${actualQuantity}`);
            }
            
            // Find Buy Mkt button - it's a div with class btn btn-success
            const buyButton = await page.waitForSelector(
                'div.btn-success:has-text("Buy Mkt"), div.btn:has-text("Buy Mkt"), .btn-success:has-text("Buy")',
                { timeout: 10000 }
            );
            
            await buyButton.click();
            console.log(`✅ Clicked Buy Mkt button`);
            
            await page.waitForTimeout(500);
            
            return { 
                status: 'executed', 
                symbol, 
                quantity: actualQuantity, 
                side: 'BUY',
                time: new Date().toISOString() 
            };
        } catch (error) {
            console.error(`❌ Failed to execute BUY:`, error.message);
            throw error;
        }
    }

    // ביצוע פקודת SELL
    async executeSell(page, symbol, quantity, orderType) {
        console.log(`🔴 Executing SELL: ${symbol} qty: ${quantity}`);
        return await this.executeSellViaUI(page, symbol, quantity, orderType);
    }

    // Execute SELL via UI - Click Sell Mkt button
    async executeSellViaUI(page, symbol, quantity, orderType) {
        console.log(`🔴 Executing SELL for ${symbol}`);
        
        try {
            // Get the quantity from the input field on the page
            const quantityInput = await page.waitForSelector('input.form-control[placeholder="Select value"]', { timeout: 5000 }).catch(() => null);
            let actualQuantity = quantity;
            
            if (quantityInput) {
                const inputValue = await quantityInput.inputValue();
                actualQuantity = parseInt(inputValue) || quantity;
                console.log(`📊 Using quantity from page: ${actualQuantity}`);
            }
            
            // Find Sell Mkt button - it's a div with class btn btn-danger
            const sellButton = await page.waitForSelector(
                'div.btn-danger:has-text("Sell Mkt"), div.btn:has-text("Sell Mkt"), .btn-danger:has-text("Sell")',
                { timeout: 10000 }
            );
            
            await sellButton.click();
            console.log(`✅ Clicked Sell Mkt button`);
            
            await page.waitForTimeout(500);
            
            return { 
                status: 'executed', 
                symbol, 
                quantity: actualQuantity, 
                side: 'SELL',
                time: new Date().toISOString() 
            };
        } catch (error) {
            console.error(`❌ Failed to execute SELL:`, error.message);
            throw error;
        }
    }

    // סגירת כל הפוזיציות
    async closeAllPositions(page) {
        console.log(`⭕ Closing all positions...`);
        
        try {
            // Find and click the panic button "Exit All Positions Cancel All"
            const panicButton = await page.waitForSelector(
                'div.btn.btn-danger.panic-button',
                { timeout: 10000 }
            );
            
            await panicButton.click();
            console.log(`✅ Clicked "Exit All Positions Cancel All" panic button`);
            
            // Wait for action to complete
            await page.waitForTimeout(1500);
            
            return { 
                status: 'completed', 
                closedPositions: 'all',
                action: 'Exit All Positions Cancel All',
                time: new Date().toISOString() 
            };
        } catch (error) {
            console.error(`❌ Failed to close positions:`, error.message);
            throw error;
        }
    }

    // קבלת סטטוס של כל החשבונות
    getAllAccountsStatus() {
        const status = [];
        for (const [accountId, account] of this.accounts) {
            status.push({
                accountId,
                username: account.username,
                accountName: account.accountName || account.username,
                status: account.status,
                balance: account.balance || 0,
                equity: account.equity || 0,
                pnl: account.pnl || 0,
                positions: account.positions || [],
                lastUpdate: account.lastUpdate
            });
        }
        return status;
    }

    // Disconnect account
    async disconnectAccount(accountId) {
        const account = this.accounts.get(accountId);
        if (account) {
            // Clear monitoring interval if exists
            if (account.monitoringInterval) {
                clearInterval(account.monitoringInterval);
                console.log(`🛑 Stopped monitoring for ${accountId}`);
            }
            
            // Close context
            try {
                await account.context.close();
            } catch (error) {
                console.log(`Context already closed for ${accountId}`);
            }
            
            this.accounts.delete(accountId);
            console.log(`👋 Account ${accountId} disconnected`);
        }
        
        // Close the browser instance for this account
        const browser = this.browsers.get(accountId);
        if (browser) {
            try {
                await browser.close();
            } catch (error) {
                console.log(`Browser already closed for ${accountId}`);
            }
            this.browsers.delete(accountId);
        }
    }

    // Close all connections
    async shutdown() {
        console.log('🔌 Shutting down system...');
        
        for (const [accountId] of this.accounts) {
            await this.disconnectAccount(accountId);
        }
        
        // Close any remaining browsers
        for (const [accountId, browser] of this.browsers) {
            await browser.close();
        }
        this.browsers.clear();
        
        console.log('✅ System shutdown successfully');
    }
}

module.exports = PlaywrightManager;
