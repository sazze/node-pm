console.log('in worker (' + process.pid + ').  I run forever!!!');

var http = require('http').createServer();

http.listen(0);

http.on('request', function(req, res) {
    console.log(process.pid + ': ' + req.url);
    res.end(req.url);
});