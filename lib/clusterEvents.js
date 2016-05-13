var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;
var info = Logger.info;
var master = require('./master');
var config = require('./config');

/**
 * Register Cluster Events
 *
 * @module
 *
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 */
module.exports = (function () {
  "use strict";

  var forkTimers = {};
  var disconnectTimers = {};
  var cluster = master.cluster;

  var config = require('./config');

  // when the master forks a worker
  cluster.on('fork', function (worker) {
    verbose('worker %d forked', worker.process.pid);
    forkTimers[worker.id] = setTimeout(function () {
      forkTimeoutHandler(worker, cluster);
    }, config.timeouts.start);
  });

  // when a worker starts executing
  cluster.on('online', function (worker) {
    verbose('worker %d online', worker.process.pid);

    if (master.count == config.n) {
      debug('%d workers are now online', config.n);
    }

    if (forkTimers[worker.id]) {
      clearTimeout(forkTimers[worker.id]);
      delete forkTimers[worker.id];
    }

    // register for messages from the worker
    worker.on('message', function (message, handle) {
      master.workerMessageHandler(message, handle, worker);
      if (config.sticky) {
        require('./master/http').messageHandler(message, handle, worker);
      }
    });
  });

  // when a worker starts listening
  cluster.on('listening', function (worker, address) {
    verbose('worker %d listening on %s:%d', worker.process.pid, address.address, address.port);

    if (master.count == config.n) {
      debug('%d workers are now listening', config.n);
    }
  });

  // when a worker disconnects
  cluster.on('disconnect', function (worker) {
    verbose('worker %d disconnect', worker.process.pid);

    if (master.disconnectTimers[worker.id]) {
      clearTimeout(master.disconnectTimers[worker.id]);
      delete master.disconnectTimers[worker.id];
    }

    master.isRunning(worker, function(running) {
      if (running) {
        disconnectTimers[worker.id] = setTimeout(function () {
          disconnectTimeoutHandler(worker, cluster);
        }, config.timeouts.stop);
      }
    });
  });

  // when a worker exits
  cluster.on('exit', function (worker, code, signal) {
    verbose('worker %d exit', worker.process.pid);

    if (disconnectTimers[worker.id]) {
      clearTimeout(disconnectTimers[worker.id]);
      delete disconnectTimers[worker.id];
    }

    // check for workers that are faking their own death
    if (master.isRunning(worker)) {
      // give them some time to exit on their own before forcefully killing them
      var w = {
        id: worker.id,
        process: {
          pid: worker.process.pid
        }
      };

      var intervals = Math.max(Math.floor(config.timeouts.stop / 1000), 1);
      var intervalCount = 0;

      var exitInterval = setInterval(function () {
        intervalCount++;

        if (!master.isRunning(w)) {
          clearInterval(exitInterval);
          return;
        }

        if (intervalCount < intervals) {
          return;
        }

        clearInterval(exitInterval);

        try {
          return process.kill(w.process.pid, 'SIGKILL');
        } catch (e) {}
      }, 1000);
    }

    if (worker.suicide) {
      debug('worker %d committed suicide', worker.process.pid);
    }

    debug('worker %d Exit Code: %d', worker.process.pid, code);

    if (signal) {
      debug('worker %d Exit Signal: %s', worker.process.pid, signal);
    }

    if (worker.suicide && master.suicideOverrides[worker.id]) {
      worker.suicide = false;
      delete master.suicideOverrides[worker.id];
    }

    if (!worker.suicide) {
      info('worker %d exited.  Restarting....', worker.process.pid);
      cluster.fork();
    }
  });

  /**
   * Called when worker takes too long to fork
   *
   * @private
   * @param worker
   * @param cluster
   */
  function forkTimeoutHandler(worker, cluster) {
    verbose('worker %d is stuck in fork', worker.process.pid);

    if (!cluster.workers[worker.id]) {
      return;
    }

    // something is wrong with this worker.  Kill it!
    master.suicideOverrides[worker.id] = worker.id;

    master.isRunning(worker, function(running) {
      if (!running) {
        return;
      }

      try {
        debug('sending SIGKILL to worker %d', worker.process.pid);
        process.kill(worker.process.pid, 'SIGKILL');
      } catch (e) {
        // this can happen.  don't crash!!
      }
    });
  }

  /**
   * Called when worker is taking too long to disconnect
   *
   * @private
   * @param worker
   * @param cluster
   */
  function disconnectTimeoutHandler(worker, cluster) {
    verbose('worker %d is stuck in disconnect', worker.process.pid);

    // if this is not a suicide we need to preserve that as worker.kill() will make this a suicide
    if (!worker.suicide) {
      master.suicideOverrides[worker.id] = worker.id;
    }

    master.isRunning(worker, function(running) {
      if (!running) {
        return;
      }

      try {
        debug('sending SIGKILL to worker %d', worker.process.pid);
        process.kill(worker.process.pid, 'SIGKILL');
      } catch (e) {
        // this can happen.  don't crash!!
      }
    });
  }
})();