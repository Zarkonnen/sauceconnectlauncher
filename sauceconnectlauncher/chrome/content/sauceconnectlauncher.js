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

var tunnelIDFinder = null;
var tunnelID = 0;

sauceConnectLauncher.logFile = null;
sauceConnectLauncher.launchLog = "";

function readFile(file) { 
  var data = "";
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
                createInstance(Components.interfaces.nsIFileInputStream);
  var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                createInstance(Components.interfaces.nsIConverterInputStream);
  fstream.init(file, -1, 0, 0);
  cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish

  var str = {};
  var read = 0;
  do { 
    read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
    data += str.value;
  } while (read != 0);
  cstream.close(); // this closes fstream
  return data;
}

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

function checkCredentials(aname, akey) {
  sauceConnectLauncher.launchLog += "Checking credentials \"" + aname + "\":\"" + akey + "\".\n";
  var r = new XMLHttpRequest();
  r.open("GET", "https://saucelabs.com/rest/v1/users/" + aname, true);
  r.setRequestHeader("Authorization", "Basic " + btoa(aname + ":" + akey));
  r.addEventListener("load", function(e) {
    sauceConnectLauncher.launchLog += "Credentials check result:" + r.responseText + "\n";
  });
  r.addEventListener("error", function(e) {
    sauceConnectLauncher.launchLog += "Error checking credentials:" + r.statusText + "\n";
  });
  r.send();
}

function getArguments() {
  sauceConnectLauncher.launchLog = "";
  if (prefs.getCharPref("accountname") == "" || prefs.getCharPref("accesskey") == "") {
    var accountname = prompt(_("account_q"));
    if (!accountname) { return null; }
    prefs.setCharPref("accountname", accountname);
    var accesskey = prompt(_("accesskey_q"));
    if (!accesskey) { return null; }
    prefs.setCharPref("accesskey", accesskey);
  }
  
  var akey = prefs.getCharPref("accesskey").trim();
  var aname = prefs.getCharPref("accountname").trim();
  if (akey.match(/^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/)) {
    sauceConnectLauncher.launchLog += "Access key \"" + akey + "\" appears valid.\n";
  } else {
    sauceConnectLauncher.launchLog += "Access key \"" + akey + "\" appears invalid.\n";
  }
  checkCredentials(aname, akey);
  var args = [ "-u", aname, "-k", akey ];
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
      args.push(prefs.getCharPref(m[0]).trim());
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
    args.push(prefs.getCharPref("proxyuser").trim() + ":" + prefs.getCharPref("proxypassword").trim());
  }
  readyFile = getTemporaryFile("sauceconnect_ready.tmp");
  readyFileLastModified = readyFile.lastModifiedTime;
  args.push("-f");
  args.push(readyFile.path);
  sauceConnectLauncher.logFile = getTemporaryFile("sauceconnect_log.tmp.txt");
  args.push("-l");
  args.push(sauceConnectLauncher.logFile.path);
  //args.push("-v");
  sauceConnectLauncher.launchLog += "Args:\n";
  args.forEach(function(a) {
    sauceConnectLauncher.launchLog += "\"" + a + "\"\n";
  });
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
}

function start() {
  var args = getArguments();
  if (!args) { return; }
  tunnelID = 0;
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
  tunnelIDFinder = setInterval(function() {
    if (sauceConnectLauncher.logFile.exists()) {
      var sclog = readFile(sauceConnectLauncher.logFile);
      var m = sclog.match("Tunnel ID: ([a-z0-9]+)");
      if (m) {
        tunnelID = m[1];
        clearInterval(tunnelIDFinder);
        tunnelIDFinder = null;
      }
    }
  }, 100);
  if (prefs.getBoolPref("showlog")) {
    sauceConnectLauncher.showLog();
  }
}

function stop() {
  setState(STOPPING);
  if (readyPoller != null) {
    clearInterval(readyPoller);
    readyPoller = null;
  }
  if (tunnelIDFinder != null) {
    clearInterval(tunnelIDFinder);
    tunnelIDFinder = null;
  }
  if (proc != null) {
    proc.kill();
  }
  
  if (tunnelID) {
    var accountName = prefs.getCharPref("accountname");
    var key = prefs.getCharPref("accesskey");
    var r = new XMLHttpRequest();
    r.open("DELETE", "https://saucelabs.com/rest/v1/" + accountName + "/tunnels/" + tunnelID, true);
    r.setRequestHeader("Authorization", "Basic " + btoa(accountName + ":" + key));
    r.send();
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
