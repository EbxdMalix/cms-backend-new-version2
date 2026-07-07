const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, JSON.stringify(meta));
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, JSON.stringify(meta));
  },
  error: (message, error = {}) => {
    console.error(`[ERROR] ${message}`, error.stack || error.message || error);
  },
  security: (event, meta = {}) => {
    console.warn(`[SECURITY - ${event.toUpperCase()}]`, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

module.exports = logger;
