var expect = require('chai').expect;
var path = require('path');
var child = require('child_process');
var _ = require('underscore');
var fs = require('fs');

var ps;

describe('Worker Manager', function() {
  "use strict";

  describe('during startup', function() {
    it('should require a start script', function(done) {
      spawn('', function(out) {
          expect(out).to.match(/.*app start script must be specified/);
          done();
      });
    });

    it('should require an existing start script', function(done) {
      spawn('fake.js', function(out) {
        expect(out).to.match(/.*cannot find application start script: fake.js/);
        done();
      });
    });

    it('should set default timeouts', function() {
      var config = require('../lib/config');
      expect(config).to.have.property('timeouts');
      expect(config.timeouts).to.have.property('start').and.to.equal(30000);
      expect(config.timeouts).to.have.property('stop').and.to.equal(30000);
      expect(config.timeouts).to.have.property('maxAge').and.to.equal(1800000);
    });

    it('should override default timeouts', function (done) {
      spawn('httpServer.js -n 1 -vvv --tStart 15000 --tStop 10000 --tMaxAge 900000', function(out) {
        var matches;

        if ((matches = out.match(/.*node-pm options: (\{.*\})/))) {
          var options = JSON.parse(matches[1]);

          expect(options).to.have.property('timeouts');
          expect(options.timeouts).to.have.property('start').and.to.equal(15000);
          expect(options.timeouts).to.have.property('stop').and.to.equal(10000);
          expect(options.timeouts).to.have.property('maxAge').and.to.equal(900000);

          expect(options).to.not.have.property('tStart');
          expect(options).to.not.have.property('tStop');
          expect(options).to.not.have.property('tMaxAge');

          done();
          return 'kill';
        }
      });
    });

    it('should work with an relative path', function(done) {
      spawn('httpServer.js -n 1');

      ps.on('cluster:listening', function(worker) {
          ps.kill();
      });

      ps.once('exit', function() {
        done();
      });
    });

    it('should work with an absolute path', function(done) {
      spawn(__dirname + '/scripts/httpServer.js -n 1');

      ps.on('cluster:listening', function(worker) {
        ps.kill();
      });

      ps.once('exit', function() {
        done();
      });
    });

    it('should run as a daemon', function (done) {
      this.timeout(5000);

      var parentExit = false;

      spawn('httpServer.js -n 1 -vvv -d --pidFile ' + path.join(__dirname, 'daemon.pid'));

      ps.once('exit', function () {
        parentExit = true;
      });

      setTimeout(function () {
        expect(parentExit).to.equal(true, 'parent did not exit');
        expect(fs.existsSync(path.join(__dirname, 'daemon.pid'))).to.equal(true, path.join(__dirname, 'daemon.pid') + ' does not exist');

        child.exec('cat ' + path.join(__dirname, 'daemon.pid'), function (err, stdout, stderr) {
          expect(err).to.equal(null);
          expect(stderr.length).to.equal(0);
          expect(stdout.length).to.be.gt(0);

          process.kill(parseInt(stdout.toString()), 'SIGTERM');

          setTimeout(function () {
            expect(fs.existsSync(path.join(__dirname, 'daemon.pid'))).to.equal(false, path.join(__dirname, 'daemon.pid') + ' not cleaned up');
            done();
          }, 500);
        });
      }, 1500);
    });
  });

  describe('event listening', function() {
    it('should send the start event', function(done) {
      var started = true;

      spawn('httpServer.js -n 1 -vvv');

      ps.on('start', function() {
        started = true;
      });

      ps.on('cluster:listening', function() {
        expect(started).to.equal(true);
        ps.kill();
        done();
      });
    });

    it('should re-spawn child process if it is killed hard', function(done) {
      var pid;

      spawn('pid.js -n 1');

      ps.once('cluster:online', function(worker) {
        pid = worker.process.pid;
      });

      ps.once('cluster:listening', function(worker) {
        expect(worker.process.pid).to.equal(pid);

        ps.once('cluster:listening', function(worker) {
          expect(worker.process.pid).not.to.equal(pid);

          ps.kill();

          ps.once('exit', function() {
            done();
          });
        });

        setTimeout(function () {
          process.kill(worker.process.pid, 'SIGKILL');
        }, 50);
      });
    });

    it('should call exit when child process exits', function(done) {
      var pid;

      spawn('childExit.js -n 1');

      ps.once('cluster:online', function(worker) {
        pid = worker.process.pid;
      });

      ps.once('cluster:exit', function(worker) {
        expect(worker.suicide).to.equal(false);
        expect(worker.process.pid).to.equal(pid);
        ps.kill();
        done();
      });
    });

    it('should kill the forked processes', function(done) {
      spawn('pid.js -n 1');

      ps.once('exit', function(worker) {
        setTimeout(function() {
          try {
            process.kill(worker.process.pid);
            done('child must no longer run');
          } catch (e) {
            done();
          }
        }, 500);
      });

      ps.once('cluster:listening', function() {
        ps.kill();
      });
    });
  });

  describe('while running', function() {
    it('should spawn 4 workers', function(done) {
      var listenCount = 0;

      spawn('httpServer.js -n 4');

      ps.on('cluster:listening', function(worker) {
        listenCount++;

        if (listenCount == 4) {
          ps.kill();
        }
      });

      ps.once('exit', function() {
        expect(listenCount).to.equal(4);
        done();
      });
    });

    it('should listen on more than one port', function(done) {
      var listenObjects = [];
      var pid;

      spawn('multipleHttpServers.js -n 1');

      ps.once('cluster:online', function(worker) {
        pid = worker.process.pid;
      });

      ps.on('cluster:listening', function(worker, address) {
        expect(worker.process.pid).to.equal(pid);

        if (listenObjects.length < 1) {
          listenObjects.push(address);
          return;
        }

        expect(listenObjects).to.not.include.members([address]);

        listenObjects.push(address);

        if (listenObjects.length == 2) {
          ps.kill();
        }
      });

      ps.once('cluster:exit', function(worker) {
        expect(worker.process.pid).to.equal(pid);
        expect(listenObjects.length).to.equal(2);
        done();
      })
    });

    it('should restart workers after lifecycle timeout', function(done) {
      this.timeout(5000);
      var pids = [];

      spawn('restart.js -n 4 --tMaxAge 800 --tStart 400 --tStop 400 -vvv');

      ps.on('cluster:online', function(worker) {
        pids.push(worker.process.pid);
      });

      ps.on('restart', function() {
        ps.kill();

        ps.once('exit', function() {
          expect(pids.length).to.equal(8);
          done();
        });
      });
    });

    it('should re-register the lifecycle timeout', function (done) {
      this.timeout(5000);

      var pids = [];
      var restartCount = 0;

      spawn('restart.js -n 4 --tMaxAge 800 --tStart 400 --tStop 400');

      ps.on('cluster:online', function (worker) {
        pids.push(worker.process.pid);
      });

      ps.on('restart', function () {
        restartCount++;

        if (restartCount == 2) {
          ps.kill();

          ps.once('exit', function () {
            expect(pids.length).to.equal(12);
            expect(restartCount).to.equal(2);
            done();
          });
        }
      });
    });

    it('should shutdown when fork loop is detected', function(done) {
      var shutdown = false;
      var forkLoop = false;

      spawn('childCrash.js -n 1 --tStart 100 --tStop 100');

      ps.once('forkLoop', function() {
        forkLoop = true;
      });

      ps.on('shutdown', function() {
        shutdown = true;
      });

      ps.on('exit', function() {
        expect(forkLoop).to.equal(true);
        expect(shutdown).to.equal(true);
        done();
      });
    });

    it('should allow inter-process communication', function (done) {
      var messageCount = 0;

      spawn('httpServer.js -n 2 --workerMessageHandler ' + path.join(__dirname, 'scripts', 'workerMessageHandlerPubSub.js'), function (line) {
        var msg = JSON.parse(line);

        expect(msg).to.have.property('pid');
        expect(msg).to.have.property('message');
        expect(msg.message).to.not.contain(msg.pid);

        messageCount++;

        if (messageCount >= 2) {
          return 'kill';
        }
      });

      ps.once('exit', function () {
        expect(messageCount).to.equal(2);
        done();
      });
    });
  });

  describe('during shutdown', function() {
    it('should call shutdown', function(done) {
      var shutdown = 0;

      spawn('httpServer.js -n 1');

      ps.on('shutdown', function() {
        shutdown++;
      });

      ps.once('cluster:listening', function() {
        setTimeout(function() {
          ps.kill();
        }, 50);
      });

      ps.once('exit', function() {
        expect(shutdown).to.equal(1);
        done();
      });
    });

    it('should kill long living connections', function(done) {
      var pid;

      spawn('longLive.js -vvv --tStop 100 -n 1');

      ps.once('cluster:listening', function(worker) {
        pid = worker.process.pid;
        ps.kill();
      });

      ps.once('cluster:exit', function(worker) {
        expect(worker.process.pid).to.equal(pid);
      });

      ps.once('exit', function() {
        done();
      });
    });

    it('should check that forked processes are running', function (done) {
      var pid;
      var killed = false;
      var outObj = {};

      spawn('pid.js -n 1 -vvv', function (out) {
        var matches;

        if (!pid && (matches = out.match(/.*pid: (\d+)/i))) {
          pid = matches[1];
        }

        if (!pid) {
          return;
        }

        outObj.out = out;

        if (!killed) {
          killed = true;

          this.on('exit', function () {
            expect(outObj.out).to.match(new RegExp('worker ' + pid + ' is running'));
            done();
          });

          setTimeout(function () {
            process.kill(ps.pid, 'SIGTERM');
          }, 500);
        }
      });
    });
  });

  afterEach(function() {
    try {
      if (ps) {
        ps.kill();
        ps = null;
      }
    } catch (e) {
      //ignore these errors
      ps = null;
    }
  });
});

/**
 * Spawn a new process with cmd.  Will call callback on
 * data from stdout.  To kill spawn return 'kill' from
 * callback function.  if you return a function it will call
 * that function on next output.
 *
 * @param cmd the command to run
 * @param [cb] the callback function with either a out or line parameter
 *
 * @returns {child_process}
 */
function spawn(cmd, cb) {
  ps = child.spawn(__dirname + '/../bin/node-pm', cmd.split(' '), { cwd: __dirname + '/scripts', stdio: [null, null, null, 'ipc'] });
  var out = '';

  ps.on('message', function(json) {
    var args = JSON.parse(json);

    if (ps) {
      ps.emit.apply(ps, args);
    }
  });

  /*
  ps.stderr.on('data', function(data) {
    console.log(data.toString());
  });

  ps.stdout.on('data', function(data) {
    console.log(data.toString());
  });
  */

  if (typeof cb === 'function') {
    ps.stdout.on('data', function(data) {
      var line = data.toString();
      out += line;

      if (!cb) {
        return;
      }

      // Determine which output they want
      var paramNames = getParameterName(cb);
      var param = out;
      if (paramNames.length == 1 && paramNames[0] == 'line') {
        param = line;
      }

      // Call the callback since we are done spawning
      var response = cb.call(ps, param);

      if (typeof response === 'function') {
        cb = response;
      } else if (response == 'kill') {
        cb = null;
        process.kill(ps.pid);
      } else if (response === false) {
        cb = null;
      }
    });
  }
  return ps
}

/**
 * Returns the parameter names of a function
 *
 * @param fn
 * @returns {Array}
 */
function getParameterName(fn) {
  "use strict";
  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  var fnStr = fn.toString().replace(STRIP_COMMENTS, '')
  var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(/([^\s,]+)/g)

  return result === null ? [] : result;
}