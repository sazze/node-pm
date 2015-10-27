require('http').createServer().listen(0);

process.on('message', function (message, handle) {
  console.log(JSON.stringify({pid: process.pid, message: message}));
});

process.send('Hi, I\'m worker ' + process.pid);

var logCount = 0;

setInterval(function () {
  console.log('log attempt # ' + (++logCount));
  console.error('error log attempt # ' + logCount);
}, 500).unref();