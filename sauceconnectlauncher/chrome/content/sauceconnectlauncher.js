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

function startExecutable() {
  obs = {
    observe: function(a, b, c) {
      uiShowNotRunning();
      proc = null;
      obs = null;
      active = false;
    }
  };
  proc = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
  proc.init(getExecutableFile());
  proc.runAsync(["-u", prompt("Username?"), "-k", prompt("Access key?")], 4, obs);
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
