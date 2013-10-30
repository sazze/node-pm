var master;

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
    master = require('./master')().start();

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
  },

  /**
   * Checks if the master is running
   *
   * @returns {boolean}
   */
  get isRunning() {
    "use strict";

    return master && master.cluster && master.cluster.count > 0;
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
  var Logger = require('./Logger');
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