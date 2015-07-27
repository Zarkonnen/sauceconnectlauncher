var sauceConnectLauncher = {};

var OFF = 0;
var STARTING = 1;
var ACTIVE = 2;
var STOPPING = 3;

var state = OFF;
var proc = null;
var obs = null;

var readyFile = null;
var readyFileLastModified = 0;
var readyPoller = null;

sauceConnectLauncher.logFile = null;

sauceConnectLauncher.onClick = function(event) {
  sauceConnectLauncher.run();
};

sauceConnectLauncher.run = function() {
  switch (state) {
    case OFF:
      start();
      break;
    case STARTING:
    case ACTIVE:
      stop();
      break;
  }
};

sauceConnectLauncher.showLog = function() {
  window.openDialog("chrome://sauceconnectlauncher/content/log.xul", "logdlg", "", sauceConnectLauncher);
};

sauceConnectLauncher.showOptions = function() {
  window.openDialog("chrome://sauceconnectlauncher/content/options.xul");
};

var myAddon = null;

Components.utils.import("resource://gre/modules/AddonManager.jsm");
AddonManager.getAddonByID("sauceconnectlauncher@saucelabs.com", function(addon) {
  myAddon = addon;
});

Components.utils.import("resource://gre/modules/FileUtils.jsm");

function getTemporaryFile(suggestedName) {
  var file = FileUtils.getFile("TmpD", [suggestedName]);
  file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
  return file;
}

function isMac() {
  return window.navigator.oscpu.indexOf("Mac OS X") != -1;
}

function isWindows() {
  return window.navigator.oscpu.indexOf("Windows") != -1;
}

function getExecutableFile() {
  var path = "/chrome/content/linux/sc";
  if (isMac()) { path = "/chrome/content/mac/sc"; }
  if (isWindows()) { path = "/chrome/content/win/sc.exe"; }
  return myAddon.getResourceURI(path).QueryInterface(Components.interfaces.nsIFileURL).file;
}

var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService);
prefs = prefs.getBranch("extensions.sauceconnectlauncher.");

function getArguments() {
  if (prefs.getCharPref("accountname") == "" || prefs.getCharPref("accesskey") == "") {
    var accountname = prompt(_("account_q"));
    if (!accountname) { return null; }
    prefs.setCharPref("accountname", accountname);
    var accesskey = prompt(_("accesskey_q"));
    if (!accesskey) { return null; }
    prefs.setCharPref("accesskey", accesskey);
  }
  
  var args = [ "-u", prefs.getCharPref("accountname"), "-k", prefs.getCharPref("accesskey") ];
  var string_prefs_mapping = [
    [ "tunnelidentifier", "-i" ],
    [ "resturl", "-x" ],
    [ "nosslbumpdomains", "-B" ],
    [ "directdomains", "-D" ],
    [ "fastfailregexps", "-F" ]
  ];
  string_prefs_mapping.forEach(function (m) {
    if (prefs.getCharPref(m[0]) != "") {
      args.push(m[1]);
      args.push(prefs.getCharPref(m[0]));
    }
  });
  if (prefs.getBoolPref("sharedtunnel")) {
    args.push("-s");
  }
  if (prefs.getCharPref("proxyhost") != "" && prefs.getIntPref("proxyport") != 0) {
    args.push("-p");
    args.push(prefs.getCharPref("proxyhost") + ":" + prefs.getIntPref("proxyport"));
  }
  if (prefs.getCharPref("proxyuser") != "" && prefs.getCharPref("proxypassword") != "") {
    args.push("-w");
    args.push(prefs.getCharPref("proxyuser") + ":" + prefs.getCharPref("proxypassword"));
  }
  readyFile = getTemporaryFile("sauceconnect_ready.tmp");
  readyFileLastModified = readyFile.lastModifiedTime;
  args.push("-f");
  args.push(readyFile.path);
  sauceConnectLauncher.logFile = getTemporaryFile("sauceconnect_log.tmp.txt");
  args.push("-l");
  args.push(sauceConnectLauncher.logFile.path);
  //args.push("-v");
  return args;
}

function shutdown() {
  if (readyPoller != null) {
    clearInterval(readyPoller);
    readyPoller = null;
  }
  setState(OFF);
  proc = null;
  obs = null;
  readyFile = null;
  sauceConnectLauncher.logFile = null;
}

function start() {
  var args = getArguments();
  if (!args) { return; }
  setState(STARTING);
  obs = {
    observe: shutdown
  };
  proc = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
  proc.init(getExecutableFile());
  proc.runAsync(args, args.length, obs);
  readyPoller = setInterval(function() {
    if (readyFile.exists() && readyFile.lastModifiedTime > readyFileLastModified) {
      setState(ACTIVE);
      clearInterval(readyPoller);
      readyPoller = null;
    }
  }, 500);
}

function stop() {
  setState(STOPPING);
  if (readyPoller != null) {
    clearInterval(readyPoller);
    readyPoller = null;
  }
  if (proc != null) {
    proc.kill();
  }
}

// Stop the tunnel when Firefox shuts down.
var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
observerService.addObserver({observe: stop}, "quit-application-requested", false);
// NB quit-application-granted or quit-application would be better things to listen to, but in practice, they don't work!

function setState(st) {
  sauceConnectLauncher.putIntoLink("state", st);
  state = st;
  switch (state) {
    case OFF:
      uiShowNotRunning();
      break;
    case STARTING:
      uiShowStarting();
      break;
    case ACTIVE:
      uiShowRunning();
      break;
    case STOPPING:
      uiShowStopping();
      break;
  }
}

function uiShowRunning() {
  var el = document.getElementById('sauceConnectLauncher-menuitem');
  if (el) { el.setAttribute('label', _('deactivatesauceconnect')); }
  el = document.getElementById('sauceConnectLauncher-appmenuitem');
  if (el) { el.setAttribute('label', _('deactivatesauceconnect')); }
  el = document.getElementById('sauceConnectLauncher-toolbar-button');
  if (el) {
    el.setAttribute('tooltiptext', _('deactivatesauceconnect'));
    el.className = "toolbar-on";
  }
}

function uiShowNotRunning() {
  var el = document.getElementById('sauceConnectLauncher-menuitem');
  if (el) { el.setAttribute('label', _('activatesauceconnect')); }
  el = document.getElementById('sauceConnectLauncher-appmenuitem');
  if (el) { el.setAttribute('label', _('activatesauceconnect')); }
  el = document.getElementById('sauceConnectLauncher-toolbar-button');
  if (el) {
    el.setAttribute('tooltiptext', _('activatesauceconnect'));
    el.className = "toolbar-off";
  }
}

function uiShowStarting() {
  var el = document.getElementById('sauceConnectLauncher-menuitem');
  if (el) { el.setAttribute('label', _('sauceconnectstarting')); }
  el = document.getElementById('sauceConnectLauncher-appmenuitem');
  if (el) { el.setAttribute('label', _('sauceconnectstarting')); }
  el = document.getElementById('sauceConnectLauncher-toolbar-button');
  if (el) {
    el.setAttribute('tooltiptext', _('sauceconnectstarting'));
    el.className = "toolbar-starting";
  }
}

function uiShowStopping() {
  var el = document.getElementById('sauceConnectLauncher-menuitem');
  if (el) { el.setAttribute('label', _('sauceconnectstopping')); }
  el = document.getElementById('sauceConnectLauncher-appmenuitem');
  if (el) { el.setAttribute('label', _('sauceconnectstopping')); }
  el = document.getElementById('sauceConnectLauncher-toolbar-button');
  if (el) {
    el.setAttribute('tooltiptext', _('sauceconnectstopping'));
    el.className = "toolbar-on";
  }
}

function _(key) {
  try {
    return document.getElementById('strings').getString(key);
  } catch (e) {
    // If we're closing this may not work, so we just return the key.
    return key;
  }
}


/** Integration */
// Regex for checking if a given page is allowed to talk to integration. Only file:// and sauce labs URLs are.
sauceConnectLauncher.getIntegrationURLPattern = function() {
  return /^(file:\/\/)|(https?:\/\/(www\.)?saucelabs\.com)/;
}

sauceConnectLauncher.linkElement = null;
sauceConnectLauncher.linkInterval = null;

sauceConnectLauncher.checkLink = function() {
  if (!sauceConnectLauncher.linkElement) { return; }
  if (state == OFF && sauceConnectLauncher.popFromLink("launch") == "true") {
    sauceConnectLauncher.run();
  }
  var newSettings = sauceConnectLauncher.popFromLink("settings");
  if (newSettings) {
    sauceConnectLauncher.setSettingsJSON(newSettings);
  }
  sauceConnectLauncher.putIntoLink("state", state);
  sauceConnectLauncher.putIntoLink("settings", sauceConnectLauncher.getSettingsJSON());
};

sauceConnectLauncher.putIntoLink = function(key, value) {
  if (!sauceConnectLauncher.linkElement) { return; }
  sauceConnectLauncher.linkElement.setAttribute("get" + key, value);
};

sauceConnectLauncher.popFromLink = function(key) {
  if (!sauceConnectLauncher.linkElement) { return null; }
  if (sauceConnectLauncher.linkElement.hasAttribute("set" + key)) {
    var val = sauceConnectLauncher.linkElement.getAttribute("set" + key);
    sauceConnectLauncher.linkElement.removeAttribute("set" + key);
    return val;
  }
  return null;
};

sauceConnectLauncher.getSettingsJSON = function() {
  return JSON.stringify({
    "accountname": prefs.getCharPref("accountname"),
    "accesskey": prefs.getCharPref("accesskey"),
    "tunnelidentifier": prefs.getCharPref("tunnelidentifier"),
    "resturl": prefs.getCharPref("resturl"),
    "nosslbumpdomains": prefs.getCharPref("nosslbumpdomains"),
    "directdomains": prefs.getCharPref("directdomains"),
    "fastfailregexps": prefs.getCharPref("fastfailregexps"),
    "proxyuser": prefs.getCharPref("proxyuser"),
    "proxypassword": prefs.getCharPref("proxypassword"),
    "proxyhost": prefs.getCharPref("proxyhost"),
    "proxyport": prefs.getIntPref("proxyport"),
    "sharedtunnel": prefs.getBoolPref("sharedtunnel")
  });
}

sauceConnectLauncher.setSettingsJSON = function(settingsJSON) {
  var sets = JSON.parse(settingsJSON);
  ["accountname", "accesskey", "tunnelidentifier", "resturl", "nosslbumpdomains", "directdomains", "fastfailregexps", "proxyuser", "proxypassword", "proxyhost"].forEach(function(k) {
    if (sets[k]) {
      prefs.setCharPref(k, sets[k]);
    }
  });
  if (sets["proxyport"]) { prefs.setIntPref("proxyport", sets["proxyport"]); }
  if (sets["sharedtunnel"]) { prefs.setBoolPref("sharedtunnel", sets["sharedtunnel"]); }
}

sauceConnectLauncher.onPageLoad = function(e) {
  var doc = e.originalTarget;
  var url = doc.location.href;
  if (url.match(sauceConnectLauncher.getIntegrationURLPattern())) {
    clearInterval(sauceConnectLauncher.linkInterval);
    sauceConnectLauncher.linkInterval = setInterval(function() {
      var el = null;
      try {
        el = doc.getElementById("__scl_link");
      } catch (e) { /* doc may be stale, in which case never mind */ }
      if (el) {
        sauceConnectLauncher.linkElement = el;
        sauceConnectLauncher.putIntoLink("state", state);
        sauceConnectLauncher.putIntoLink("settings", sauceConnectLauncher.getSettingsJSON());
        clearInterval(sauceConnectLauncher.linkInterval);
        sauceConnectLauncher.linkInterval = setInterval(sauceConnectLauncher.checkLink, 100);
      }
    }, 100);
  }
}

gBrowser.addEventListener("DOMContentLoaded", sauceConnectLauncher.onPageLoad, false);
