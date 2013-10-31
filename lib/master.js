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

  if (typeof cluster.isRunning === 'undefined') {
    /**
     * Checks if a worker is running (can be called asynchronously or synchronously)
     * @param worker
     * @param callback
     * @returns {*}
     */
    cluster.__proto__.isRunning = function(worker, callback) {
      debug('checking if worker %d is running', worker.process.pid);

      var checkPid = function() {
        try {
          return process.kill(worker.process.pid, 0);
        } catch (e) {
          verbose(e);
          return e.code === 'EPERM';
        }
      };

      var running = checkPid();

      debug('worker %d is %s', worker.process.pid, (running ? 'running' : 'not running'));

      if (typeof callback === 'function') {
        callback(running, worker);
        return running;
      }

      return running;
    }
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

      verbose('node-pm options: %j', options);

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