var Logger = require('./Logger');
var verbose = Logger.verbose;
var info = Logger.info;

/**
 * Register Process Events
 *
 * @module
 *
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 *
 * @param cluster
 */
module.exports = function(cluster) {
  "use strict";

  process.on('SIGTERM', function () {
    verbose('SIGTERM recieved');
    cluster.disconnect(process.exit);
  });

  process.on('SIGABRT', function () {
    verbose('SIGABRT recieved');
    cluster.disconnect(process.exit);
  });

  process.on('SIGINT', function () {
    verbose('SIGINT recieved');
    cluster.disconnect(process.exit);
  });

  process.on('SIGHUP', function () {
    verbose('SIGHUP recieved');
  });

  process.on('exit', function () {
    info('exiting node-pm');
    cluster.disconnect(process.exit);
  });
}