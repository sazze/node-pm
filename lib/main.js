#!/usr/bin/env node

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
   * @param settings
   * @return {module:lib/master}
   */
  start: function(settings) {
    "use strict";
    var cluster = require('cluster');
    var options = this.parseOptions(settings);
    this.setupLogger(options);

    // Start the Master
    return require('./master')(cluster).start(options);
  },

  /**
   * Parse Options
   *
   * @param options
   * @returns {*}
   */
  parseOptions: function(options) {
    "use strict";

    if (typeof options === 'undefined' && !module.parent) {
      var optimist = require('optimist');

      options = optimist
        .usage('Run a node app in style\n\nUsage: $0 [app start script]')
        .boolean('s').alias('s', 'silent').default('s', false).describe('s', 'silence workers')
        .boolean('d').alias('d', 'debug').default('d', false).describe('s', 'show debug output')
        .boolean('v').alias('v', 'verbose').default('v', false).describe('s', 'show verbose output')
        .alias('n', 'numProc').default('n', 0).describe('n', 'number of workers to spawn')
        .demand(1).argv;
    } else {
      var _ = require('underscore');
      _.defaults(options, {
        v: false,
        d: false,
        s: false,
        n: 0,
        _:[]
      });
    }

    return options;
  },

  /**
   * Setup Logger
   *
   * @param options
   */
  setupLogger: function(options) {
    "use strict";
    var Logger = require('./Logger');

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
}

if (!module.parent) {
  module.exports.start();
}









