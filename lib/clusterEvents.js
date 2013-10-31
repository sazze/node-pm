var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;
var info = Logger.info;


/**
 * Register Cluster Events
 *
 * @module
 *
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 *
 * @param cluster
 */
module.exports = function (cluster) {
  "use strict";

  var forkTimers = {};
  var lifecycleTimers = {};
  var disconnectTimers = {};
  var suicideOverrides = {};

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

    if (cluster.count == require('./config').n) {
      debug('%d workers are now online', config.n);
    }

    // Create a splay for the lifecycle timers
    var splay = Math.floor((Math.random() * (config.timeouts.stop + config.timeouts.start)) + config.timeouts.stop);
    var maxAge = config.timeouts.maxAge + splay;

    lifecycleTimers[worker.id] = setTimeout(function () {
      lifecycleTimeoutHandler(worker, cluster);
    }, maxAge);

    debug('Setting %d lifecycle timer to %d', worker.process.pid, maxAge);
  });

  // when a worker starts listening
  cluster.on('listening', function (worker, address) {
    verbose('worker %d listening on %s:%d', worker.process.pid, address.address, address.port);

    if (cluster.count == config.n) {
      debug('%d workers are now listening', config.n);
    }

    if (forkTimers[worker.id]) {
      clearTimeout(forkTimers[worker.id]);
      delete forkTimers[worker.id];
    }
  });

  // when a worker disconnects
  cluster.on('disconnect', function (worker) {
    verbose('worker %d disconnect', worker.process.pid);

    if (lifecycleTimers[worker.id]) {
      clearTimeout(lifecycleTimers[worker.id]);
      delete lifecycleTimers[worker.id];
    }

    disconnectTimers[worker.id] = setTimeout(function () {
      disconnectTimeoutHandler(worker, cluster);
    }, config.timeouts.stop);
  });

  // when a worker exits
  cluster.on('exit', function (worker, code, signal) {
    verbose('worker %d exit', worker.process.pid);

    if (lifecycleTimers[worker.id]) {
      clearTimeout(lifecycleTimers[worker.id]);
      delete lifecycleTimers[worker.id];
    }

    if (disconnectTimers[worker.id]) {
      clearTimeout(disconnectTimers[worker.id]);
      delete disconnectTimers[worker.id];
    }

    if (worker.suicide) {
      debug('worker %d committed suicide', worker.process.pid);
    }

    debug('worker %d Exit Code: %d', worker.process.pid, code);

    if (signal) {
      debug('worker %d Exit Signal: %s', worker.process.pid, signal);
    }

    if (worker.suicide && suicideOverrides[worker.id]) {
      worker.suicide = false;
      delete suicideOverrides[worker.id];
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
    suicideOverrides[worker.id] = worker.id;
    process.kill(worker.process.pid, 'SIGKILL');
  }

  /**
   * Called when worker has reached the end of it's lifespan
   *
   * @private
   * @param worker
   * @param cluster
   */
  function lifecycleTimeoutHandler(worker, cluster) {
    verbose('worker %d has reached the end of it\'s life', worker.process.pid);

    if (!cluster.workers[worker.id]) {
      return;
    }

    suicideOverrides[worker.id] = worker.id;

    // notify the worker that we're shutting it down
    worker.send('shutdown');
    
    worker.disconnect();
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
      suicideOverrides[worker.id] = worker.id;
    }

    try {
      process.kill(worker.process.pid, 'SIGKILL');
    } catch (e) {
      // this can happen if the pid no longer exists.  don't crash!!
    }
  }
};