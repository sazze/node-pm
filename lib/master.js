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

  var cluster = require('cluster');

  return {
    /**
     * Start the master and fork childs
     */
    start: function() {
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

      cluster.setupMaster({
        exec: workerFile,
        silent: options.s,
        args: options._.length > 1 ? options._.slice(1) : []
      });

      fork(options.n);

      return this;
    },

    /**
     * Disconnectworkers and exit
     */
    stop: function() {
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