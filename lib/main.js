var Logger = require('./Logger');
var master;
var _ = require('underscore');

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
   * @return {module:lib/master}
   */
  start: function(settings) {
    "use strict";

    if (typeof settings === 'undefined') {
      settings = {};
    }

    parseOptions(settings);
    setupLogger();

    require('./Logger').verbose('Starting worker manager');

    // Start the Master
    master = require('./master');

    registerListeners(master);

    master.start();

    return master;
  },

  /**
   * Stop the worker Manager
   */
  stop: function(callback) {
    if (master) {
      master.stop(callback);
      master = null;
    }
  }
};

/**
 * Parse Options
 *
 * @private
 * @param options
 */
function parseOptions(options) {
  "use strict";

  var _ = require('underscore');
  var config = require('./config');

  _.extend(config, options);
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
  } catch (e) {
    Logger.verbose(e);
    Logger.verbose(arguments);
    return;
  }

  process.send(string);
}