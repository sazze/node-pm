var Extend = require('sand-extend').Extend;
var http = require('http');

function HTTP(requestListener) {
  if (!(this instanceof HTTP)) {
    return new HTTP(requestListener);
  }

  this.super(requestListener);

  this.setupListen();
  this.setupMessageHandler();
}

Extend(HTTP, http.Server, {
  setupListen: function() {
    var oldListen = this.listen;

    this.listen = function() {
      process.send({event: 'http:listen', args: Array.prototype.slice.call(arguments)});
      var lastArg = arguments[arguments.length - 1];

      if (typeof lastArg === 'function') lastArg();

      return oldListen.apply(this, null);
    };
  },

  setupMessageHandler: function() {
    var self = this;
    process.on('message', function(msg, socket) {
      if (msg !== 'sticky-session:connection') return;

      //console.log('sending socket');

      //self.emit('connection', socket);
      self.emit('connection', socket);
    });
  }
});

http.Server = HTTP;

http.createServer = function(requestListener) {
  return new HTTP(requestListener);
};