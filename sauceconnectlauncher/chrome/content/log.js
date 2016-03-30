var sauceConnectLauncher = window.arguments[0];

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

function refreshLog() {
  if (!sauceConnectLauncher.logFile || !sauceConnectLauncher.logFile.exists()) { return; }
  document.getElementById('logbox').value = sauceConnectLauncher.launchLog + readFile(sauceConnectLauncher.logFile);
}

window.setTimeout(refreshLog, 10);

window.setInterval(refreshLog, 1000);
