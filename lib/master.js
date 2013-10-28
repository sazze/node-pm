var fs = require('fs');
var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;

/**
 * The master
 *
 * @module
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 *
 * @param cluster
 */
exports = module.exports = function(cluster) {
  "use strict";

  require('./events')(cluster);

  cluster.on('fork', function (worker) {
    debug('worker %d forked', worker.process.pid);
  });

  cluster.on('online', function (worker) {
    verbose('worker ' + worker.process.pid + ' online');
  });

  cluster.on('listening', function (worker, address) {
    verbose('worker ' + worker.process.pid + ' listening on ' + address.address + ':' + address.port);
  });

  cluster.on('disconnect', function (worker) {
    verbose('worker ' + worker.process.pid + ' disconnect');
  });

  cluster.on('exit', function (worker, code, signal) {
    verbose('worker ' + worker.process.pid + ' exit');

    if (worker.suicide) {
      debug('suicide');
    }

    debug(code);
    debug(signal);

    if (!worker.suicide) {
      debug('worker %d exited.  Restarting....', worker.process.pid);
      cluster.fork();
    }
  });


  return {
    /**
     * Start the master and fork childs
     *
     * @param options the options
     * @param {string} options._[0] the worker file
     * @param {bool} [options.s=false] silent all errors
     * @param {bool} [options.d=false] turn on debug logs
     * @param {bool} [options.v=false] turn on verbose logs
     */
    start: function(options) {
      var workerFile = options._[0];

      if (!workerFile) {
        error('app start script must be specified')
        throw new Error('app start script must be specified');
      }

      if (!fs.existsSync(workerFile)) {
        error('cannot find application start script: %s', workerFile);
        throw new Error('cannot file application start script: ' + workerFile);
      }

      cluster.setupMaster({
        exec: workerFile,
        silent: options.s
      });

      fork(options.n);

      return this;
    },

    /**
     * Disconnectworkers and exit
     */
    exit: function() {
      cluster.disconnect();
    },

    /**
     * get the cluster object
     *
     * @returns {*}
     */
    get cluster() {
      return cluster;
    },

    /**
     * Get number of workers
     *
     * @returns {number}
     */
    get count() {
      var c = 0;

      for (var id in cluster.workers) {
        c++;
      }

      return c;
    }
  }


  /**
   * Fork Workers N times
   *
   * @private
   * @param {int} [number=cpus.length] the number of processes to start
   */
  function fork(number) {
    var numProc = number || require('os').cpus().length;

    debug('forking %d workers', numProc);

    for (var i = 0; i < numProc; i++) {
      cluster.fork();
    }
  }
}