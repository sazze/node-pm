var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var config = require('./config');
var cluster = require('cluster');

var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;
var info = Logger.info;

var lifecycleTimer;
var shutdownCalled = false;
var restarting = false;

var _ = require('underscore');

/**
 * The master
 *
 * @module
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 */
function Master() {
  EventEmitter.call(this);

  if (config.workerMessageHandler) {
    this.workerMessageHandler = require(config.workerMessageHandler);
  }

  if (!_.isFunction(this.workerMessageHandler)) {
    this.workerMessageHandler = function () {};
  }

  this.workerMessageHandler.bind(this);
}

util.inherits(Master, EventEmitter);

var master = module.exports = new Master();

Object.defineProperty(master, 'count', {
  /**
   * Get number of workers
   *
   * @returns {number}
   */
  get: function () {
    var c = 0;

    master.eachWorker(function () {
      c++;
    });

    return c;
  }
});

Object.defineProperty(master, 'cluster', {
  /**
   * get the cluster object
   *
   * @returns {*}
   */
  get: function () {
    return cluster;
  }
});

master.suicideOverrides = {};
master.shutdownCompleteFn = null;
master.disconnectTimers = {};

/**
 * Iterator for cluster workers
 * @param callback
 */
master.eachWorker = function (callback) {
  for (var id in cluster.workers) {
    callback(cluster.workers[id]);
  }
};

/**
 * Checks if a worker is running (can be called asynchronously or synchronously)
 * @param worker
 * @param callback
 * @returns {*}
 */
master.isRunning = function (worker, callback) {
  debug('checking if worker %d is running', worker.process.pid);

  var checkPid = function () {
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
};

/**
 * Performs a graceful restart of the workers (one at a time)
 * @param callback
 */
master.restart = function (callback) {
  var workers = [];
  var totalWorkers = this.count;

  info('restarting all workers (%d)', totalWorkers);

  var restart = function (callback) {
    if (workers.length < 1) {
      master.emit('restart', master);
      callback();
      return;
    }

    var worker = workers.pop();

    verbose('restarting worker %d', worker.process.pid);

    cluster.once('listening', function (w, address) {
      debug('worker %d restarted as %d', worker.process.pid, w.process.pid);

      if (shutdownCalled && workers.length > 0) {
        // we need to shutdown.  halt the restart loop.
        verbose('halting restart loop due to shutdown request');
        workers = [];
      }

      restart(callback);
    });

    master.suicideOverrides[worker.id] = worker.id;

    if (worker.process.connected) {
      worker.send('shutdown');
      worker.disconnect();
    } else {
      error('Worker %d is already restarting', worker.process.pid);
    }
  };

  master.eachWorker(function (worker) {
    verbose('pushing worker %d onto restart stack', worker.process.pid);

    workers.push(worker);

    verbose('%d workers on restart stack', workers.length);

    if (workers.length == totalWorkers) {
      verbose('restarting workers (%d)', workers.length);
      restart(callback);
    }
  });
};

/**
 * Start the master and fork children
 */
master.start = function () {
  verbose('Starting master');
  var options = config;
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
  require('./processEvents');
  require('./clusterEvents');

  if (options.sticky) {
    require('./master/http');
  }

  verbose('Setting up master with worker file: %s', workerFile);

  var args = options._.length > 1 ? options._.slice(1) : [];
  args.unshift(workerFile);

  if (options.sticky) {
    args.push('--sticky');
  }

  // The Settings for the cluster master
  var masterOptions = {
    exec: __dirname + '/worker.js',
    silent: options.s,
    args: args
  };

  cluster.setupMaster(masterOptions);

  fork(options.n);

  lifecycleTimer = setTimeout(lifecycleTimeoutHandler.bind(master), config.timeouts.maxAge);

  debug('Setting worker lifecycle timer to %d', config.timeouts.maxAge);

  master.emit('start', master);

  return master;
};

/**
 * Disconnect workers and exit
 */
master.stop = function (callback) {
  master.shutdownCompleteFn = callback;

  clearTimeout(lifecycleTimer);

  process.kill(process.pid, 'SIGTERM');

  master.emit('stop', master);
};

/**
 * Shutdown node-pm
 *
 * DO NOT CALL this DIRECTLY unless you know what you're doing.  Use stop() instead
 *
 * @fires shutdown
 */
master.shutdown = function() {
  if (shutdownCalled) {
    // this function can only be called once
    return;
  }

  shutdownCalled = true;

  shutdown();

  function shutdown() {
    if (restarting) {
      verbose('waiting for restart to finish');
      setTimeout(shutdown, 50);
      return;
    }

    verbose('Shutting down...');

    var numWorkers = master.count;
    var numExits = 0;

    verbose('waiting for %d workers to exit...', numWorkers);

    cluster.on('exit', function() {
      numExits++;

      verbose('%d workers exited', numExits);

      if (numExits >= numWorkers) {
        // this is the exit for the last worker
        cleanup();
      }
    });

    /**
     * @event shutdown
     */
    master.emit('shutdown', master);

    // notify the workers that we're shutting down
    master.eachWorker(function(worker) {
      verbose('setting disconnect timeout to %d ms', config.timeouts.stop);

      master.disconnectTimers[worker.id] = setTimeout(function() {
        verbose('master disconnect timeout reached for worker %d', worker.process.pid);

        try {
          process.kill(worker.process.pid, 'SIGKILL');
        } catch (e) {
          error('cannot stop worker %d', worker.process.pid);
        }
      }, config.timeouts.stop);

      verbose('telling worker %d to shutdown', worker.process.pid);

      worker.send('shutdown');
    });

    verbose('telling %d workers to disconnect', master.count);
    cluster.disconnect();
  }
};

/**
 * Fork Workers N times
 *
 * @private
 * @param {int} [number=cpus.length] the number of processes to start
 */
function fork(number) {
  var numProc = number || require('os').cpus().length;

  config.n = numProc;

  debug('forking %d workers', numProc);

  forkLoopProtect();

  for (var i = 0; i < numProc; i++) {
    cluster.fork();
  }
}

/**
 * Called when workers have reached the end of their lifespan
 *
 * @private
 */
function lifecycleTimeoutHandler() {
  if (shutdownCalled) {
    return;
  }

  verbose('workers have reached the end of their life');

  restarting = true;

  master.restart(function () {
    restarting = false;

    if (!shutdownCalled) {
      lifecycleTimer = setTimeout(lifecycleTimeoutHandler.bind(master), config.timeouts.maxAge);
    }
  });
}

/**
 * @private
 */
function cleanup() {
  verbose('Cleaning up...');

  if (typeof master.shutdownCompleteFn === 'function') {
    process.nextTick(master.shutdownCompleteFn);
  }

  //cluster.removeAllListeners();
  //process.removeAllListeners();

  verbose('about to die');
  process.exit(0);
}

function forkLoopProtect() {
  var onlineLoopMax = config.n * 5;
  var onlineLoopTimer;
  var onlineLoopCount = 0;
  var onlineLoopTimeoutTime = (config.timeouts.start + config.timeouts.stop) * config.n * 5;

  cluster.on('online', function(worker) {
    verbose('increment fork loop counter (worker %d)', worker.process.pid);

    onlineLoopCount++;

    verbose('fork loop counter: %d/%d', onlineLoopCount, onlineLoopMax);

    if (!onlineLoopTimer) {
      onlineLoopTimer = setTimeout(onlineLoopTimeout, onlineLoopTimeoutTime);
    }

    if (onlineLoopCount > onlineLoopMax) {
      master.emit('forkLoop', master);
      info('Fork loop detected.  Shutting down...');
      master.stop();
    }
  });

  function onlineLoopTimeout() {
    verbose('resetting online count');
    onlineLoopCount = 0;
    clearTimeout(onlineLoopTimer);
    onlineLoopTimer = null;
  }
}