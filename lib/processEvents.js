var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;
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
    shutdown();
  });

  process.on('SIGABRT', function () {
    verbose('SIGABRT recieved');
    shutdown();
  });

  process.on('SIGINT', function () {
    verbose('SIGINT recieved');
    shutdown();
  });

  process.on('SIGHUP', function () {
    verbose('SIGHUP recieved');
  });

  process.on('exit', function () {
    info('exiting node-pm');
    shutdown();
  });

  function shutdown() {
    verbose('Shutting down...');

    var numWorkers = cluster.count;
    var numExits = 0;

    verbose('waiting for %d worker to exit...', numWorkers);

    cluster.on('exit', function(worker) {
      numExits++;

      verbose('%d workers exited', numExits);

      if (numExits >= numWorkers) {
        // this is the exit for the last worker
        cleanup();
      }
    });

    cluster.disconnect();
  }

  function cleanup() {
    verbose('Cleaning up...');

    if (typeof cluster.shutdownCompleteFn === 'function') {
      process.nextTick(cluster.shutdownCompleteFn);
    }

    cluster.removeAllListeners();
    process.removeAllListeners();
  }
};