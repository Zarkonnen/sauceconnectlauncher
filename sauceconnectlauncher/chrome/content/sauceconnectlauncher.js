var sauceConnectLauncher = {};

var active = false;

sauceConnectLauncher.run = function() {
  if (!active) { start(); } else { stop(); }
};

function start() {
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
  
  active = true;
}

function stop() {
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
  
  active = false;
}

function _(name) {
  return document.getElementById('strings').getString(name);
}