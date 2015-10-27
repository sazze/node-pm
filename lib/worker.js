var lsof = require('lsof');
var path = require('path');
var fs = require('fs');

var args = process.argv.slice(2);

if (args.length == 0) {
  process.exit(1);
}

for (var i in args) {
  if(args.hasOwnProperty(i) && args[i] === '--sticky') {
    require('./overrides/http');
  }
}

/**
 * Handle STDOUT and STDERR streams for the worker process
 */
getIOFiles(function (io) {
  if (!io.stdoutPath || !io.stderrPath) {
    console.error('Failed to find STDOUT/STDERR destination path(s)');
    return;
  }

  process.on('message', function (message) {
    if (message == 'reload') {
      reOpenIO(io);
    }
  });
});

var workerFile = args[0];

require(path.resolve(process.cwd(), workerFile));

function reOpenIO(io) {
  // Close and re-open STDOUT and then STDERR
  fs.close(1, function (err) {
    if (err) {
      console.error(err.stack || err.message || err);
      return;
    }

    fs.open(io.stdoutPath, 'w+', function (err, fd) {
      if (err) {
        console.error(err.stack || err.message || err);
        return;
      }

      fs.close(2, function (err) {
        if (err) {
          console.error(err.stack || err.message || err);
          return;
        }

        fs.open(io.stderrPath, 'w+', function (err, fd) {
          if (err) {
            console.error(err.stack || err.message || err);
          }
        });
      });
    });
  });
}

function getIOFiles(callback) {
  if (typeof callback !== 'function') {
    callback = function () {};
  }

  var ioFiles = {
    stdoutPath: '',
    stderrPath: ''
  };

  lsof.raw(function (files) {
    // Find the destination of STDOUT and STDERR
    var file = null;

    for (var i in files) {
      file = files[i];

      if (!file || !file.name) {
        continue;
      }

      if (/^1[a-z]$/.test(file.fd)) {
        ioFiles.stdoutPath = path.resolve(file.name);
        continue;
      }

      if (/^2[a-z]$/.test(file.fd)) {
        ioFiles.stderrPath = path.resolve(file.name);
      }
    }

    callback(ioFiles);
  });
}