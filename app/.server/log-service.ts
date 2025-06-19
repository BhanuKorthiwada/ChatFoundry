type LogLevel = "debug" | "info" | "warn" | "error";

export const Logger = {
  // Default log level
  logLevel: "info" as LogLevel,

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  },

  shouldLog(level: LogLevel) {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  },

  debug(message: string, ...optionalParams: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${message}`, ...optionalParams);
    }
  },

  info(message: string, ...optionalParams: any[]) {
    if (this.shouldLog("info")) {
      console.info(`[INFO] ${message}`, ...optionalParams);
    }
  },

  warn(message: string, ...optionalParams: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, ...optionalParams);
    }
  },

  error(message: string, error?: unknown, ...optionalParams: any[]) {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${message}`, error, ...optionalParams);
    }
  },
};
