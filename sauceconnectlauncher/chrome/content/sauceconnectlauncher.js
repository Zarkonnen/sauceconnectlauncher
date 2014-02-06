var sauceConnectLauncher = {};

var active = false;
var proc = null;
var obs = null;

sauceConnectLauncher.run = function() {
  if (!active) { start(); } else { stop(); }
};

var myAddon = null;

Components.utils.import("resource://gre/modules/AddonManager.jsm");
AddonManager.getAddonByID("sauceconnectlauncher@saucelabs.com", function(addon) {
  myAddon = addon;
});

function start() {
  startExecutable();
  uiShowRunning();
  active = true;
}

function stop() {
  stopExecutable();
}

function getExecutableFile() {
  return myAddon.getResourceURI("/chrome/content/sc").QueryInterface(Components.interfaces.nsIFileURL).file;
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
  return args;
}

function startExecutable() {
  var args = getArguments();
  if (!args) { return; }
  obs = {
    observe: function() {
      uiShowNotRunning();
      proc = null;
      obs = null;
      active = false;
    }
  };
  proc = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
  proc.init(getExecutableFile());
  proc.runAsync(args, args.length, obs);
}

function stopExecutable() {
  if (proc != null) {
    proc.kill();
  }
}

function uiShowRunning() {
  document.getElementById('sauceConnectLauncher-status-bar-icon').src = "chrome://sauceconnectlauncher/skin/status-bar.png";
  document.getElementById('sauceConnectLauncher-status-bar-icon').setAttribute('tooltiptext', _('deactivatesauceconnect'));
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
  document.getElementById('sauceConnectLauncher-status-bar-icon').src = "chrome://sauceconnectlauncher/skin/status-bar-off.png";
  document.getElementById('sauceConnectLauncher-status-bar-icon').setAttribute('tooltiptext', _('activatesauceconnect'));
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

function _(name) {
  return document.getElementById('strings').getString(name);
}
