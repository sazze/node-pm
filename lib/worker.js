var lsof = require('lsof');
var path = require('path');
var fs = require('fs');

var args = process.argv.slice(2);

if (args.length == 0) {
  process.exit(1);
}

var uid = process.getuid();
var gid = process.getgid();

for (var i in args) {
  if (args.hasOwnProperty(i) && args[i] === '--sticky') {
    require('./overrides/http');
  }

  if (args.hasOwnProperty(i) && /^--uid=\d+$/.test(args[i])) {
    uid = args[i].replace(/\D/g, '') * 1;
  }

  if (args.hasOwnProperty(i) && /^--gid=\d+$/.test(args[i])) {
    gid = args[i].replace(/\D/g, '') * 1;
  }
}

/**
 * Handle STDOUT and STDERR streams for the worker process
 */
getIOFiles(function (io) {
  if (!io.stdoutPath || !io.stderrPath) {
    console.error('Failed to find STDOUT/STDERR destination path(s)');

    setUser();

    runWorkerFile();

    return;
  }

  // make sure io paths are properly owned
  chownIOFiles(io, function (err) {
    if (err) {
      process.exit(3);
    }

    process.on('message', function (message) {
      if (message == 'reload') {
        reOpenIO(io);
      }
    });

    setUser();

    runWorkerFile();
  });
});

function reOpenIO(io, callback) {
  if (typeof callback !== 'function') {
    callback = function () {};
  }

  // Close and re-open STDOUT and then STDERR
  fs.close(1, function (err) {
    if (err) {
      console.error(err.stack || err.message || err);
      callback(err);
      return;
    }

    fs.open(io.stdoutPath, 'w+', function (err, fd) {
      if (err) {
        console.error(err.stack || err.message || err);
        callback(err);
        return;
      }

      fs.close(2, function (err) {
        if (err) {
          console.error(err.stack || err.message || err);
          callback(err);
          return;
        }

        fs.open(io.stderrPath, 'w+', function (err, fd) {
          if (err) {
            console.error(err.stack || err.message || err);
          }

          callback(err);
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

function chownIOFiles(io, callback) {
  if (typeof callback !== 'function') {
    callback = function () {};
  }

  fs.chown(io.stdoutPath, uid, gid, function (err) {
    if (err) {
      console.error('Failed to chown stdout (' + io.stdoutPath + ')');
      callback(err);
      return;
    }

    fs.chown(io.stderrPath, uid, gid, function (err) {
      if (err) {
        console.error('Failed to chown stderr (' + io.stderrPath + ')');
      }

      callback(err);
    })
  });
}

function setUser() {
  try {
    // this can only be run by a super user or user with special permissions (don't freak out if it fails)
    process.initgroups(uid, gid);
  } catch (e) {
  }

  process.setgid(gid);
  process.setuid(uid);
}

function runWorkerFile() {
  var workerFile = args[0];

  require(path.resolve(process.cwd(), workerFile));
}