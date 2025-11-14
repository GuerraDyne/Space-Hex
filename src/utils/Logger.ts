/**
 * Modular debug logging system for Space Hex
 * Can be toggled on/off without affecting main code
 */

// Simple debug configuration
const DEBUG_CONFIG = {
  ENABLED: true,
  CATEGORIES: ['GAME_ENGINE', 'HEX_BOARD', 'MULTIPLAYER', 'UI', 'GENERAL', 'LOBBY', 'DEPLOYMENT']
};

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export type LogCategory = 
  | 'GAME_ENGINE'
  | 'HEX_BOARD'
  | 'MULTIPLAYER'
  | 'UI'
  | 'LOBBY'
  | 'DEPLOYMENT'
  | 'GENERAL';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private enabled: boolean = DEBUG_CONFIG.ENABLED;
  private level: LogLevel = LogLevel.INFO;
  private enabledCategories: Set<LogCategory> = new Set();
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 1000;

  private constructor() {
    // Enable all categories by default in debug mode
    if (this.enabled) {
      DEBUG_CONFIG.CATEGORIES.forEach(category => {
        this.enabledCategories.add(category as LogCategory);
      });
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Enable or disable logging entirely
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Enable logging for a specific category
   */
  enableCategory(category: LogCategory): void {
    this.enabledCategories.add(category);
  }

  /**
   * Disable logging for a specific category
   */
  disableCategory(category: LogCategory): void {
    this.enabledCategories.delete(category);
  }

  /**
   * Enable all categories
   */
  enableAllCategories(): void {
    DEBUG_CONFIG.CATEGORIES.forEach(category => {
      this.enabledCategories.add(category as LogCategory);
    });
  }

  /**
   * Disable all categories
   */
  disableAllCategories(): void {
    this.enabledCategories.clear();
  }

  /**
   * Main logging method
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: any): void {
    // Quick exit if logging is disabled
    if (!this.enabled) return;
    
    // Check level filter
    if (level > this.level) return;
    
    // Check category filter (if any categories are enabled, only log those)
    if (this.enabledCategories.size > 0 && !this.enabledCategories.has(category)) return;

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = { timestamp, level, category, message, data };

    // Add to history
    this.addToHistory(logEntry);

    // Console output with styling
    const prefix = `[${timestamp}] [${LogLevel[level]}] [${category}]`;
    const style = this.getConsoleStyle(level);

    if (data !== undefined) {
      console.log(`%c${prefix} ${message}`, style, data);
    } else {
      console.log(`%c${prefix} ${message}`, style);
    }

    // Report errors to crash reporting service (if implemented)
    if (level === LogLevel.ERROR) {
      this.reportError(category, message, data);
    }
  }

  /**
   * Get console styling for different log levels
   */
  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return 'color: #ff4444; font-weight: bold;';
      case LogLevel.WARN:
        return 'color: #ffaa00; font-weight: bold;';
      case LogLevel.INFO:
        return 'color: #4488ff; font-weight: normal;';
      case LogLevel.DEBUG:
        return 'color: #888888; font-weight: normal;';
      case LogLevel.TRACE:
        return 'color: #666666; font-weight: normal;';
      default:
        return 'color: #000000; font-weight: normal;';
    }
  }

  /**
   * Add log entry to history (circular buffer)
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  /**
   * Report critical errors (placeholder for crash reporting)
   */
  private reportError(category: LogCategory, message: string, data?: any): void {
    // TODO: Integrate with crash reporting service (Firebase Crashlytics, Sentry, etc.)
    console.error(`CRITICAL ERROR [${category}]: ${message}`, data);
  }

  // Convenience methods for different log levels
  
  error(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  warn(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  info(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  debug(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  trace(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.TRACE, category, message, data);
  }

  /**
   * Get the current log history
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs as text (for debugging)
   */
  exportLogs(): string {
    return this.logHistory
      .map(entry => `${entry.timestamp} [${LogLevel[entry.level]}] [${entry.category}] ${entry.message}`)
      .join('\n');
  }

  /**
   * Performance timing helper
   */
  time(category: LogCategory, label: string): void {
    if (!this.enabled) return;
    console.time(`[${category}] ${label}`);
  }

  timeEnd(category: LogCategory, label: string): void {
    if (!this.enabled) return;
    console.timeEnd(`[${category}] ${label}`);
  }

  /**
   * Group logging (for related operations)
   */
  group(category: LogCategory, title: string): void {
    if (!this.enabled) return;
    console.group(`[${category}] ${title}`);
  }

  groupEnd(): void {
    if (!this.enabled) return;
    console.groupEnd();
  }
}

// Export singleton instance for easy use throughout the app
export const logger = Logger.getInstance();

// Usage examples:
// logger.info('GAME_ENGINE', 'Game started', { playerCount: 4 });
// logger.debug('MOVEMENT', 'Ship moved', { from, to, shipType });
// logger.error('NETWORK', 'Connection failed', error);
// logger.warn('MOTHERSHIP', 'Invalid pilot attempt', { shipId, reason });