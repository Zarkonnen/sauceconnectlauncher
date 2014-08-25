/**
 * Code for communicating with Sauce Connect Launcher. It gets around the plugin sandboxing by
 * talking to the plugin via the attributes of a specific HTML element.
 */

var __sclSpan = null;

function initSCLLink() {
    __sclSpan = document.createElement("span");
    __sclSpan.setAttribute("id", "__scl_link");
    document.body.appendChild(__sclSpan);
}

/**
 * Set the various SCL settings from the settings object, which can be partial (with only some keys set).
 */
function setSCLSettings(settings) {
    __putSCL("setsettings", settings);
}

/** Get the full settings from SCL. */
function getSCLSettings() {
    return __getSCL("getsettings");
}

/**
 * Get SCL state code:
 *
 * OFF = 0
 * STARTING = 1
 * ACTIVE = 2
 * STOPPING = 3
 */
function getSCLState() {
    return __getSCL("getstate");
}

/** Launch SCL if it's not already up. */
function launchSCL() {
    __putSCL("setlaunch", "true");
}

// Helper functions.
function __putSCL(key, value) {
    __sclSpan.setAttribute(key, value);
}

function __getSCL(key) {
    return __sclSpan.getAttribute(key);
}
