var http = require('http').createServer();

console.log('pid: %d', process.pid);

http.listen(0, function() {
  "use strict";
  // Kill Self after some time
  setTimeout(function() {
    process.exit(0);
  }, 50);
});