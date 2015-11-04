var Logger = require('./Logger');
var master;
var _ = require('underscore');
var uidNumber = require('uid-number');
var semver = require('semver');
var lsof = require('lsof');
var path = require('path');
var fs = require('fs');

var stdoutPath = '';
var stderrPath = '';

/**
 * @module
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 *
 * @example
 * Usage: node-pm app.js
 */
module.exports = {
  /**
   * Start the Worker Manager
   *
   * @param [settings={}]
   * @param [callback=function]
   */
  start: function(settings, callback) {
    "use strict";

    if (typeof settings === 'function') {
      callback = settings;
      settings = {};
    }

    if (typeof settings === 'undefined') {
      settings = {};
    }

    if (typeof callback !== 'function') {
      callback = function () {};
    }

    getLogFiles(function () {
      parseOptions(settings, function () {
        setupLogger();

        require('./Logger').verbose('Starting worker manager');

        // Start the Master
        master = require('./master');

        registerListeners(master);

        master.start();

        callback();
      });
    });
  },

  /**
   * Stop the worker Manager
   */
  stop: function(callback) {
    if (master) {
      master.stop(callback);
      master = null;
    }
  },

  reload: function (callback) {
    if (typeof callback !== 'function') {
      callback = function () {};
    }

    master.eachWorker(function (worker) {
      try {
        worker.send('reload');
      } catch (err) {
        Logger.error(err.message || err);
        Logger.verbose(err.stack || '');
      }
    });

    // re-open the STDOUT and STDERR files
    if (!stdoutPath || !stderrPath) {
      callback(new Error('Failed to find STDOUT/STDERR destination path(s)'));
      return;
    }

    // Close and re-open STDOUT and then STDERR
    fs.close(1, function (err) {
      if (err) {
        callback(err);
        return;
      }

      fs.open(stdoutPath, 'w+', function (err, fd) {
        if (err) {
          callback(err);
          return;
        }

        fs.close(2, function (err) {
          if (err) {
            callback(err);
            return;
          }

          fs.open(stderrPath, 'w+', function (err, fd) {
            callback(err);
          });
        });
      });
    });
  }
};

/**
 * Parse Options
 *
 * @private
 * @param options
 */
function parseOptions(options, callback) {
  "use strict";

  var _ = require('underscore');
  var config = require('./config');

  // get the UID and GID that we should run the workers as (allows workers to drop root privileges)
  if (options.u || options.g) {
    if (semver.gte(process.versions.node, '0.12.0')) {
      uidNumber((options.u ? options.u : null), (options.g ? options.g : null), function (err, uid, gid) {
        if (err) {
          Logger.error('Failed to change UID and GID for child processes.');
          Logger.verbose(err.stack || err.message || err);
        } else {
          options.u = uid;
          options.g = gid;
        }

        _.extend(config, options);
        callback();
      });
    } else {
      Logger.error('Changing UID and GID is only supported on node versions >= 0.12.0.  Ignoring requested UID and/or GID.');

      options.u = '';
      options.g = '';
      
      _.extend(config, options);
      callback();
    }
  } else {
    _.extend(config, options);
    callback();
  }
}

/**
 * Setup Logger
 *
 * @private
 */
function setupLogger() {
  "use strict";
  var options = require('./config');

  if (options.v.length == 3) {
    Logger.level = Logger.levels.verbose;
  } else if (options.v.length == 2) {
    Logger.level = Logger.levels.debug;
  } else if (options.v.length == 1) {
    Logger.level = Logger.levels.info;
  } else if (options.s) {
    Logger.level = Logger.levels.noLog;
  }
}

function registerListeners(master) {
  master.on('start', eventHandler.bind(undefined, 'start'));
  master.on('stop', eventHandler.bind(undefined, 'stop'));
  master.on('restart', eventHandler.bind(undefined, 'restart'));
  master.on('shutdown', eventHandler.bind(undefined, 'shutdown'));
  master.on('forkLoop', eventHandler.bind(undefined, 'forkLoop'));
  master.cluster.on('fork', eventHandler.bind(undefined, 'cluster:fork'));
  master.cluster.on('online', eventHandler.bind(undefined, 'cluster:online'));
  master.cluster.on('listening', eventHandler.bind(undefined, 'cluster:listening'));
  master.cluster.on('disconnect', eventHandler.bind(undefined, 'cluster:disconnect'));
  master.cluster.on('exit', eventHandler.bind(undefined, 'cluster:exit'));
}

function eventHandler() {
  if (typeof process.send !== 'function') {
    return;
  }

  if (arguments.length < 2) {
    Logger.verbose('called with wrong number of arguments');
    return;
  }

  try {
    var string = JSON.stringify(Array.prototype.slice.call(arguments, 0), function(key, value) {
      if (key.match(/^_/)) {
        //private key, don't encode
        return undefined;
      }

      return value;
    });

    process.send(string);
  } catch (e) {
    Logger.verbose(e);
    Logger.verbose(arguments);
  }
}

function getLogFiles(callback) {
  if (typeof callback !== 'function') {
    callback = function () {};
  }

  lsof.raw(function (files) {
    // Find the destination of STDOUT and STDERR
    _.forEach(files, function (file) {
      if (_.isUndefined(file.name) || !file.name) {
        return;
      }

      if (/^1[a-z]$/.test(file.fd)) {
        stdoutPath = path.resolve(file.name);
        return;
      }

      if (/^2[a-z]$/.test(file.fd)) {
        stderrPath = path.resolve(file.name);
      }
    });

    callback();
  });
}