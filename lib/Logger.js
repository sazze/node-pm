/**
 * A Simple Logger with levels
 * @module
 * @author Kevin Smithson <ksmithson@sazze.com>
 */

var Logger = module.exports = {
  /**
   * A debug log
   *
   * @param {string} message the message
   * @param {mixed} [...] arguments to pass to log
   */
  debug: function() {
    log.call(this, levels.debug, '\x1B[36m[debug]\x1B[39m ', arguments);
  },

  /**
   * A info log
   *
   * @param {string} message the message
   * @param {mixed} [...] arguments to pass to log
   */
  info: function() {
    log.call(this, levels.info, '\x1B[32m[info]\x1B[39m ', arguments);
  },

  /**
   * A verbose log
   *
   * @param {string} message the message
   * @param {mixed} [...] arguments to pass to log
   */
  verbose: function() {
    log.call(this, levels.verbose, '\x1B[35m[verbose]\x1B[39m ', arguments);
  },

  /**
   * A error log
   *
   * @param {string} message the message
   * @param {mixed} [...] arguments to pass to log
   */
  error: function() {
    log.call(this, levels.error, '\x1B[31m[error]\x1B[39m ', arguments);
  },

  /**
   * Set the level to use
   *
   * @param {int} logLevel the level of the log
   */
  set level(logLevel) {
    "use strict";
    level = logLevel;
  },

  /**
   * get the log level
   *
   * @returns {number}
   */
  get level() {
    "use strict";
    return level;
  }
}

/**
 * The levels of logs
 * @type {{verbose: number, debug: number, info: number, error: number, noLog: number}}
 */
var levels = {
  verbose: 10,
  debug: 7,
  info: 5,
  error: 1,
  noLog: 0
};

// Set default level to error
var level = levels.error;

// expose the available levels
Logger.levels = levels;

/**
 * The internal log function
 *
 * @private
 * @param {int} logLevel the log level that is allowed
 * @param prefix the prefix that gets prepended to the message
 * @param args and object of arguments, usually from global [arguments]
 */
function log(logLevel, prefix, args) {
  "use strict";
  if (logLevel > level) {
    return;
  }

  args = Array.prototype.slice.call(args);

  if (typeof args[0] === 'undefined') {
    return;
  }

  var message = args[0];
  args.splice(0, 1, prefix + message);

  console.log.apply(this, args);
}