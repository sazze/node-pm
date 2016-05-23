var http = require('http').createServer().listen(0);

console.log('pid: %d', process.pid);

// don't exit when signals are received
process.on('SIGTERM', function () {});
process.on('SIGABRT', function () {});
process.on('SIGINT', function () {});

// make sure the process never gracefully dies
var interval = setInterval(function () {
  console.log('still alive (pid: ' + process.pid + ')');
}, 5000);