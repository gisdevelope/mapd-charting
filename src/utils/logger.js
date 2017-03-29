export const logger = {};

logger.enableDebugLog = false;

logger.warn = function (msg) {
    if (console) {
        if (console.warn) {
            console.warn(msg);
        } else if (console.log) {
            console.log(msg);
        }
    }

    return logger;
};

logger.debug = function (msg) {
    if (logger.enableDebugLog && console) {
        if (console.debug) {
            console.debug(msg);
        } else if (console.log) {
            console.log(msg);
        }
    }

    return logger;
};

logger.deprecate = function (fn, msg) {
    // Allow logging of deprecation
    var warned = false;
    function deprecated () {
        if (!warned) {
            logger.warn(msg);
            warned = true;
        }
        return fn.apply(this, arguments);
    }
    return deprecated;
};