var http = require('http').createServer();
http.listen(0, function() {
  "use strict";
  // Kill Self after some time
  setTimeout(function() {
    process.exit(0);
  }, 50);
});