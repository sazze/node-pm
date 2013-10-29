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

    // Start the Master
    master = require('./master')().start();

    return master;
  },

  stop: function() {
    if (master) {
      master.stop();
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
  var Logger = require('./Logger');
  var options = require('./config');

  if (options.v) {
    Logger.level = Logger.levels.verbose;
  } else if (options.d) {
    Logger.level = Logger.levels.debug;
  } else if (!options.s) {
    Logger.level = Logger.levels.info;
  } else {
    Logger.level = Logger.levels.noLog;
  }
}