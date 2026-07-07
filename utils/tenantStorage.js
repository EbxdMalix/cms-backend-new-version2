const { AsyncLocalStorage } = require("async_hooks");

const tenantLocalStorage = new AsyncLocalStorage();

module.exports = tenantLocalStorage;
