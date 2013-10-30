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

  process.on('SIGTERM', function sigTerm() {
    verbose('SIGTERM recieved');
    shutdown();
  });

  process.on('SIGABRT', function sigAbort() {
    verbose('SIGABRT recieved');
    shutdown();
  });

  process.on('SIGINT', function sigInt() {
    verbose('SIGINT recieved');
    shutdown();
  });

  process.on('SIGHUP', function sigHup() {
    verbose('SIGHUP recieved');
  });

  process.on('exit', function exit() {
    info('exiting node-pm');
    shutdown();
  });

  /**
   * @private
   * @fires shutdown
   */
  function shutdown() {
    verbose('Shutting down...');

    var numWorkers = cluster.count;
    var numExits = 0;

    verbose('waiting for %d workers to exit...', numWorkers);

    cluster.on('exit', function exit(worker) {
      numExits++;

      verbose('%d workers exited', numExits);

      if (numExits >= numWorkers) {
        // this is the exit for the last worker
        cleanup();
      }
    });

    // notify the workers that we're shutting down
    cluster.eachWorker(function eachWorker(worker) {
      /**
       * @event shutdown
       */
      worker.send('shutdown');
    });

    cluster.disconnect();
  }

  /**
   * @private
   */
  function cleanup() {
    verbose('Cleaning up...');

    if (typeof cluster.shutdownCompleteFn === 'function') {
      process.nextTick(cluster.shutdownCompleteFn);
    }

    cluster.removeAllListeners();
    process.removeAllListeners();
  }
};