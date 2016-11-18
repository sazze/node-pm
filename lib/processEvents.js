var Logger = require('./Logger');
var debug = Logger.debug;
var verbose = Logger.verbose;
var error = Logger.error;
var info = Logger.info;
var master = require('./master');
var pm = require('../');

/**
 * Register Process Events
 *
 * @module
 *
 * @author Kevin Smithson <ksmithson@sazze.com>
 * @author Craig Thayer <cthayer@sazze.com>
 */
module.exports = (function() {
  "use strict";

  var cluster = master.cluster;

  process.on('SIGTERM', function sigTerm() {
    verbose('SIGTERM recieved');
    master.shutdown();
  });

  process.on('SIGABRT', function sigAbort() {
    verbose('SIGABRT recieved');
    master.shutdown();
  });

  process.on('SIGINT', function sigInt() {
    verbose('SIGINT recieved');
    master.shutdown();
  });

  process.on('SIGHUP', function sigHup() {
    verbose('SIGHUP recieved');
    reload();
  });

  process.on('exit', function exit() {
    info('exiting node-pm');
    master.shutdown();
  });

  process.on('SIGUSR2', function sigUsr2() {
    verbose('SIGUSR2 recieved');
    reload();
  });

  function reload() {
    verbose('Reloading...');

    //TODO reload the config

    pm.reload(function reloadComplete(err) {
      if (err) {
        error(err.message || err);
        verbose(err.stack || '');
      }

      // info('node-pm reloaded');

      master.restart(function reloadComplete(err) {
       if (err) {
         error(err.message || err);
         verbose(err.stack || '');
       }

       info('node-pm reloaded');
      });
    });
  }
})();