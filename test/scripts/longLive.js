var http = require('http');
http
  .createServer(function() {
    "use strict";
    // Never end
  })
  .listen(59741, function(address) {
    "use strict";
    console.log('sever is now listening');
    http.get('http://127.0.0.1:59741/');
  });

