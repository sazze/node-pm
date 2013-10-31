require('http').createServer().listen(0);

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    process.exit(0);
  }
});