// risk-manager.js - מודול ניהול סיכונים אוטומטי עם SL/TP
const EventEmitter = require('events');

class RiskManager extends EventEmitter {
    constructor(playwrightManager) {
        super();
        this.manager = playwrightManager;
        this.settings = this.loadDefaultSettings();
        this.activeOrders = new Map();
        this.monitoring = false;
        this.monitoringInterval = null;
    }

    // הגדרות ברירת מחדל
    loadDefaultSettings() {
        return {
            // הגדרות Stop Loss
            stopLoss: {
                enabled: true,
                type: 'POINTS', // POINTS, PERCENTAGE, DOLLAR
                value: 10, // 10 נקודות / 10% / $10
                trailing: false,
                trailingDistance: 5
            },
            
            // הגדרות Take Profit
            takeProfit: {
                enabled: true,
                type: 'POINTS', // POINTS, PERCENTAGE, DOLLAR
                value: 20, // 20 נקודות / 20% / $20
                partial: false,
                partialPercent: 50, // סגור 50% בטייק פרופיט
                levels: [ // רמות TP מרובות
                    { points: 10, percent: 33 },
                    { points: 20, percent: 33 },
                    { points: 30, percent: 34 }
                ]
            },
            
            // הגדרות כלליות
            general: {
                maxDailyLoss: 500, // הפסד יומי מקסימלי בדולרים
                maxDailyProfit: 1000, // רווח יומי מקסימלי
                autoCloseAtDayEnd: true,
                breakEvenAfterPoints: 10, // העבר ל-breakeven אחרי X נקודות רווח
                useOCO: true // השתמש בפקודות OCO (One Cancels Other)
            },
            
            // הגדרות לפי סימול
            symbolSettings: {
                'MNQ': {
                    stopLoss: { points: 10 },
                    takeProfit: { points: 20 },
                    tickValue: 0.5
                },
                'NQ': {
                    stopLoss: { points: 40 },
                    takeProfit: { points: 80 },
                    tickValue: 5
                },
                'ES': {
                    stopLoss: { points: 10 },
                    takeProfit: { points: 20 },
                    tickValue: 12.5
                },
                'MES': {
                    stopLoss: { points: 10 },
                    takeProfit: { points: 20 },
                    tickValue: 1.25
                }
            }
        };
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('📊 Risk Manager settings updated:', this.settings);
        this.emit('settings-updated', this.settings);
    }

    // Start automatic monitoring
    startMonitoring() {
        if (this.monitoring) {
            console.log('⚠️ Monitoring already active');
            return;
        }

        console.log('🔍 Starting automatic SL/TP monitoring...');
        this.monitoring = true;

        // Check every 2 seconds
        this.monitoringInterval = setInterval(() => {
            this.checkAllPositions();
        }, 2000);

        this.emit('monitoring-started');
    }

    // Stop monitoring
    stopMonitoring() {
        if (!this.monitoring) return;

        console.log('🛑 Stopping automatic monitoring');
        this.monitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.emit('monitoring-stopped');
    }

    // בדיקת כל הפוזיציות
    async checkAllPositions() {
        try {
            for (const [accountId, account] of this.manager.accounts) {
                if (account.status === 'connected' && account.positions?.length > 0) {
                    await this.checkAccountPositions(accountId, account);
                }
            }

            // בדיקת הפסד/רווח יומי
            await this.checkDailyLimits();

        } catch (error) {
            console.error('❌ Error checking positions:', error);
        }
    }

    // בדיקת פוזיציות של חשבון ספציפי
    async checkAccountPositions(accountId, account) {
        for (const position of account.positions) {
            const key = `${accountId}_${position.symbol}`;
            
            // אם זו פוזיציה חדשה, הוסף SL/TP
            if (!this.activeOrders.has(key)) {
                await this.addStopLossAndTakeProfit(account.page, position);
                this.activeOrders.set(key, {
                    ...position,
                    entryPrice: position.avgPrice || position.price,
                    stopLossSet: false,
                    takeProfitSet: false,
                    breakEvenMoved: false
                });
            } else {
                // בדוק אם צריך לעדכן את ה-SL/TP
                const orderInfo = this.activeOrders.get(key);
                await this.updateStopLossTakeProfit(account.page, position, orderInfo);
            }
        }

        // הסר פוזיציות שנסגרו
        this.cleanupClosedPositions(accountId, account.positions);
    }

    // הוספת Stop Loss ו-Take Profit לפוזיציה חדשה
    async addStopLossAndTakeProfit(page, position) {
        console.log(`📈 מוסיף SL/TP לפוזיציה: ${position.symbol}`);
        
        const symbolSettings = this.getSymbolSettings(position.symbol);
        const isLong = position.quantity > 0;
        
        try {
            // חישוב מחירי SL/TP
            const { stopPrice, takeProfitPrice } = this.calculatePrices(
                position, 
                symbolSettings, 
                isLong
            );

            // הוספת Stop Loss
            if (this.settings.stopLoss.enabled) {
                await this.placeStopLoss(page, position.symbol, Math.abs(position.quantity), stopPrice, isLong);
            }

            // הוספת Take Profit
            if (this.settings.takeProfit.enabled) {
                await this.placeTakeProfit(page, position.symbol, Math.abs(position.quantity), takeProfitPrice, isLong);
            }

            // אם OCO מופעל, קשר את הפקודות
            if (this.settings.general.useOCO) {
                await this.linkOCOOrders(page);
            }

            console.log(`✅ SL/TP הוגדרו בהצלחה עבור ${position.symbol}`);
            
            this.emit('sl-tp-added', {
                symbol: position.symbol,
                stopPrice,
                takeProfitPrice
            });

        } catch (error) {
            console.error(`❌ שגיאה בהוספת SL/TP עבור ${position.symbol}:`, error);
        }
    }

    // חישוב מחירי SL/TP
    calculatePrices(position, symbolSettings, isLong) {
        const entryPrice = position.avgPrice || position.price;
        let stopDistance, takeProfitDistance;

        // חישוב לפי סוג ההגדרה
        switch (this.settings.stopLoss.type) {
            case 'POINTS':
                stopDistance = symbolSettings.stopLoss?.points || this.settings.stopLoss.value;
                break;
            case 'PERCENTAGE':
                stopDistance = entryPrice * (this.settings.stopLoss.value / 100);
                break;
            case 'DOLLAR':
                const tickValue = symbolSettings.tickValue || 1;
                stopDistance = this.settings.stopLoss.value / tickValue;
                break;
        }

        switch (this.settings.takeProfit.type) {
            case 'POINTS':
                takeProfitDistance = symbolSettings.takeProfit?.points || this.settings.takeProfit.value;
                break;
            case 'PERCENTAGE':
                takeProfitDistance = entryPrice * (this.settings.takeProfit.value / 100);
                break;
            case 'DOLLAR':
                const tpTickValue = symbolSettings.tickValue || 1;
                takeProfitDistance = this.settings.takeProfit.value / tpTickValue;
                break;
        }

        // חישוב מחירים סופיים
        const stopPrice = isLong ? 
            entryPrice - stopDistance : 
            entryPrice + stopDistance;
            
        const takeProfitPrice = isLong ? 
            entryPrice + takeProfitDistance : 
            entryPrice - takeProfitDistance;

        return { stopPrice, takeProfitPrice };
    }

    // הצבת Stop Loss
    async placeStopLoss(page, symbol, quantity, stopPrice, isLong) {
        console.log(`🛑 מציב Stop Loss: ${symbol} @ ${stopPrice}`);
        
        // פתיחת חלון הזמנות
        await page.click('.orders-panel, #orders-tab');
        await page.waitForTimeout(500);
        
        // לחיצה על כפתור Stop Order
        await page.click('.stop-order-btn, #add-stop-order');
        await page.waitForTimeout(500);
        
        // מילוי פרטי הפקודה
        await page.fill('.stop-symbol, #stop-symbol', symbol);
        await page.fill('.stop-quantity, #stop-quantity', quantity.toString());
        await page.fill('.stop-price, #stop-price', stopPrice.toFixed(2));
        
        // בחירת כיוון (הפוך מהפוזיציה)
        if (isLong) {
            await page.click('.sell-stop, #stop-sell');
        } else {
            await page.click('.buy-stop, #stop-buy');
        }
        
        // אם Trailing Stop מופעל
        if (this.settings.stopLoss.trailing) {
            await page.check('.trailing-stop, #enable-trailing');
            await page.fill('.trail-distance, #trail-amount', 
                this.settings.stopLoss.trailingDistance.toString());
        }
        
        // שליחת הפקודה
        await page.click('.submit-stop, #place-stop-order');
        await page.waitForTimeout(1000);
    }

    // הצבת Take Profit
    async placeTakeProfit(page, symbol, quantity, takeProfitPrice, isLong) {
        console.log(`💰 מציב Take Profit: ${symbol} @ ${takeProfitPrice}`);
        
        // אם יש רמות TP מרובות
        if (this.settings.takeProfit.partial && this.settings.takeProfit.levels?.length > 0) {
            await this.placeMultipleTakeProfits(page, symbol, quantity, isLong);
            return;
        }
        
        // TP בודד
        await page.click('.limit-order-btn, #add-limit-order');
        await page.waitForTimeout(500);
        
        await page.fill('.limit-symbol, #limit-symbol', symbol);
        await page.fill('.limit-quantity, #limit-quantity', quantity.toString());
        await page.fill('.limit-price, #limit-price', takeProfitPrice.toFixed(2));
        
        // כיוון הפוך מהפוזיציה
        if (isLong) {
            await page.click('.sell-limit, #limit-sell');
        } else {
            await page.click('.buy-limit, #limit-buy');
        }
        
        await page.click('.submit-limit, #place-limit-order');
        await page.waitForTimeout(1000);
    }

    // הצבת Take Profit מרובה (scaling out)
    async placeMultipleTakeProfits(page, symbol, totalQuantity, isLong) {
        console.log(`💰 מציב Take Profit מרובה עבור ${symbol}`);
        
        const entryPrice = await this.getCurrentPrice(page, symbol);
        
        for (const level of this.settings.takeProfit.levels) {
            const quantity = Math.floor(totalQuantity * (level.percent / 100));
            const price = isLong ? 
                entryPrice + level.points : 
                entryPrice - level.points;
            
            await this.placeTakeProfit(page, symbol, quantity, price, isLong);
            await page.waitForTimeout(500);
        }
    }

    // עדכון Stop Loss ל-Breakeven
    async moveToBreakeven(page, position, orderInfo) {
        if (orderInfo.breakEvenMoved) return;
        
        const currentPnL = position.pnl || 0;
        const breakEvenThreshold = this.settings.general.breakEvenAfterPoints;
        const symbolSettings = this.getSymbolSettings(position.symbol);
        const tickValue = symbolSettings.tickValue || 1;
        const pointsProfit = currentPnL / (Math.abs(position.quantity) * tickValue);
        
        if (pointsProfit >= breakEvenThreshold) {
            console.log(`🔄 מעביר Stop Loss ל-Breakeven עבור ${position.symbol}`);
            
            const entryPrice = orderInfo.entryPrice;
            const isLong = position.quantity > 0;
            
            // עדכון ה-Stop Loss למחיר הכניסה + עמלה קטנה
            const newStopPrice = isLong ? 
                entryPrice + 1 : // נקודה אחת רווח
                entryPrice - 1;
            
            await this.updateStopLoss(page, position.symbol, newStopPrice);
            
            orderInfo.breakEvenMoved = true;
            
            this.emit('breakeven-moved', {
                symbol: position.symbol,
                newStopPrice
            });
        }
    }

    // עדכון Stop Loss (למשל ל-Trailing או Breakeven)
    async updateStopLoss(page, symbol, newPrice) {
        try {
            // פתיחת רשימת פקודות
            await page.click('.orders-list, #working-orders');
            await page.waitForTimeout(500);
            
            // מציאת ה-Stop Loss הקיים
            const stopOrder = await page.locator(`.order-row:has-text("${symbol}"):has-text("STOP")`).first();
            
            if (stopOrder) {
                // לחיצה על עריכה
                await stopOrder.click('.edit-order, .modify-btn');
                await page.waitForTimeout(500);
                
                // עדכון המחיר
                await page.fill('.edit-stop-price, #modify-price', newPrice.toFixed(2));
                
                // אישור
                await page.click('.confirm-edit, #confirm-modify');
                await page.waitForTimeout(1000);
                
                console.log(`✅ Stop Loss עודכן ל-${newPrice} עבור ${symbol}`);
            }
        } catch (error) {
            console.error(`❌ שגיאה בעדכון Stop Loss:`, error);
        }
    }

    // עדכון Stop Loss ו-Take Profit קיימים
    async updateStopLossTakeProfit(page, position, orderInfo) {
        // בדיקת Breakeven
        if (this.settings.general.breakEvenAfterPoints > 0) {
            await this.moveToBreakeven(page, position, orderInfo);
        }
        
        // עדכון Trailing Stop אם מופעל
        if (this.settings.stopLoss.trailing && !orderInfo.breakEvenMoved) {
            await this.updateTrailingStop(page, position, orderInfo);
        }
    }

    // עדכון Trailing Stop
    async updateTrailingStop(page, position, orderInfo) {
        const currentPrice = await this.getCurrentPrice(page, position.symbol);
        const isLong = position.quantity > 0;
        const trailDistance = this.settings.stopLoss.trailingDistance;
        
        let newStopPrice;
        if (isLong) {
            newStopPrice = currentPrice - trailDistance;
            // עדכן רק אם המחיר החדש גבוה מה-Stop הקיים
            if (newStopPrice > (orderInfo.lastStopPrice || 0)) {
                await this.updateStopLoss(page, position.symbol, newStopPrice);
                orderInfo.lastStopPrice = newStopPrice;
            }
        } else {
            newStopPrice = currentPrice + trailDistance;
            // עדכן רק אם המחיר החדש נמוך מה-Stop הקיים
            if (newStopPrice < (orderInfo.lastStopPrice || Infinity)) {
                await this.updateStopLoss(page, position.symbol, newStopPrice);
                orderInfo.lastStopPrice = newStopPrice;
            }
        }
    }

    // קבלת מחיר נוכחי
    async getCurrentPrice(page, symbol) {
        try {
            const priceElement = await page.locator(`.price-ticker[data-symbol="${symbol}"], .last-price`).first();
            const priceText = await priceElement.textContent();
            return parseFloat(priceText.replace(/[^0-9.-]/g, ''));
        } catch {
            return 0;
        }
    }

    // קישור פקודות OCO (One Cancels Other)
    async linkOCOOrders(page) {
        try {
            await page.click('.oco-link, #link-oco');
            await page.waitForTimeout(500);
            
            // בחירת הפקודות האחרונות (SL ו-TP)
            await page.check('.select-last-two-orders');
            await page.click('.confirm-oco, #create-oco');
            
            console.log('🔗 פקודות OCO קושרו בהצלחה');
        } catch (error) {
            console.error('❌ שגיאה בקישור OCO:', error);
        }
    }

    // בדיקת הגבלות יומיות
    async checkDailyLimits() {
        let totalDailyPnL = 0;
        
        for (const [, account] of this.manager.accounts) {
            if (account.positions) {
                for (const position of account.positions) {
                    totalDailyPnL += position.pnl || 0;
                }
            }
        }
        
        // בדיקת הפסד יומי מקסימלי
        if (totalDailyPnL <= -this.settings.general.maxDailyLoss) {
            console.log('🚨 הגעת להפסד היומי המקסימלי! סוגר את כל הפוזיציות...');
            await this.manager.closeAll();
            this.emit('max-daily-loss-reached', totalDailyPnL);
        }
        
        // בדיקת רווח יומי מקסימלי
        if (totalDailyPnL >= this.settings.general.maxDailyProfit) {
            console.log('🎉 הגעת לרווח היומי המקסימלי! סוגר את כל הפוזיציות...');
            await this.manager.closeAll();
            this.emit('max-daily-profit-reached', totalDailyPnL);
        }
    }

    // ניקוי פוזיציות שנסגרו
    cleanupClosedPositions(accountId, currentPositions) {
        const currentSymbols = new Set(currentPositions.map(p => p.symbol));
        
        for (const [key, ] of this.activeOrders) {
            if (key.startsWith(accountId)) {
                const symbol = key.split('_')[1];
                if (!currentSymbols.has(symbol)) {
                    this.activeOrders.delete(key);
                    console.log(`🧹 הסרת מעקב אחרי ${symbol} (נסגר)`);
                }
            }
        }
    }

    // קבלת הגדרות לפי סימול
    getSymbolSettings(symbol) {
        return this.settings.symbolSettings[symbol] || {
            stopLoss: { points: this.settings.stopLoss.value },
            takeProfit: { points: this.settings.takeProfit.value },
            tickValue: 1
        };
    }

    // קבלת סטטיסטיקות
    getStatistics() {
        const stats = {
            totalOrders: this.activeOrders.size,
            stopLossActive: 0,
            takeProfitActive: 0,
            breakEvenMoved: 0,
            monitoring: this.monitoring
        };
        
        for (const [, orderInfo] of this.activeOrders) {
            if (orderInfo.stopLossSet) stats.stopLossActive++;
            if (orderInfo.takeProfitSet) stats.takeProfitActive++;
            if (orderInfo.breakEvenMoved) stats.breakEvenMoved++;
        }
        
        return stats;
    }

    // איפוס הכל
    reset() {
        this.stopMonitoring();
        this.activeOrders.clear();
        this.settings = this.loadDefaultSettings();
        console.log('🔄 Risk Manager אופס');
    }
}

module.exports = RiskManager;
