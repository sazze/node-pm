var http = require('http');
var server = http.createServer(function() {
  "use strict";
  // Never end
});

server.listen(0, function() {
    "use strict";
  var address = server.address();

  console.log('sever is now listening on %s:%d', address.address, address.port);
  http.get('http://127.0.0.1:' + address.port + '/');
});

