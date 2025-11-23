// logger.js - Simple logger with English messages
const chalk = require('chalk');

class Logger {
    static info(message) {
        console.log(`ℹ️  ${message}`);
    }

    static success(message) {
        console.log(`✅ ${message}`);
    }

    static error(message, error = null) {
        console.error(`❌ ${message}`);
        if (error) {
            console.error(error);
        }
    }

    static warning(message) {
        console.log(`⚠️  ${message}`);
    }

    static debug(message) {
        console.log(`🔍 ${message}`);
    }

    static loading(message) {
        console.log(`🚀 ${message}`);
    }

    static network(message) {
        console.log(`📡 ${message}`);
    }

    static key(message) {
        console.log(`🔑 ${message}`);
    }

    static monitor(message) {
        console.log(`📊 ${message}`);
    }
}

module.exports = Logger;
