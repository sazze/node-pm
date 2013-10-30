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
 */
exports = module.exports = function() {
  "use strict";

  var cluster = new require('cluster');


  if (typeof cluster.eachWorker === 'undefined') {
    /**
     * Iterator for cluster workers
     * @param callback
     */
    cluster.__proto__.eachWorker = function (callback) {
      for (var id in cluster.workers) {
        callback(cluster.workers[id]);
      }
    };
  }

  if (typeof cluster.count === 'undefined') {
    /**
     * Returns the total number of active workers
     * @readonly
     */
    Object.defineProperty(cluster, "count", {
      get: function() {
        var c = 0;

        cluster.eachWorker(function() {
          c++;
        });

        return c;
      }
    });
  }

  return {
    /**
     * Start the master and fork childs
     */
    start: function() {
      verbose('Starting master');
      var options = require('./config');
      var workerFile = (options._ ? options._[0] : null);

      if (!workerFile) {
        error('app start script must be specified')
        throw new Error('app start script must be specified');
      }

      if (!fs.existsSync(workerFile)) {
        error('cannot find application start script: %s', workerFile);
        throw new Error('cannot file application start script: ' + workerFile);
      }

      // require event handlers
      require('./processEvents')(cluster);
      require('./clusterEvents')(cluster);

      verbose('Setting up master with worker file: %s', workerFile);

      // The Settings for the cluster master
      var masterOptions = {
        exec: workerFile,
        silent: options.s,
        args: options._.length > 1 ? options._.slice(1) : []
      };

      cluster.setupMaster(masterOptions);

      fork(options.n);

      return this;
    },

    /**
     * Disconnectworkers and exit
     */
    stop: function(callback) {
      cluster.shutdownCompleteFn = callback;

      process.kill(process.pid, 'SIGTERM');
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
      return cluster.count;
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

    require('./config').n = numProc;


    debug('forking %d workers', numProc);

    for (var i = 0; i < numProc; i++) {
      cluster.fork();
    }
  }
}