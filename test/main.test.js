var expect = require('chai').expect;
var path = require('path');
var child = require('child_process');
var _ = require('underscore');

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

    it('should have different max age timers for each worker', function(done) {
      var timers = [];
      spawn('httpServer.js -n 4 -vv', function(line) {
        var matches;
        while ((matches = line.match(/.*Setting \d+ lifecycle timer to (\d+)/))) {
          var timeout = parseInt(matches[1]);
          if (!_.contains(timers, timeout)) {
            timers.push(timeout);
          }

          line = line.replace(matches[0], '');
        }

        if (timers.length == 4) {
          var unique = _.uniq(timers);

          expect(unique).to.have.members(timers);
          expect(timers).to.have.members(unique);
          done();
          return 'kill';
        }
      });
    })
  });

  describe('event listening', function() {
    it('should re-spawn child process if it is killed hard', function(done) {
      var killSent = false;

      spawn('pid.js -n 1 -v', function (out) {
        var matches;
        var pid;

        if ((matches = out.match(/.*pid: (\d+)/i))) {
          pid = matches[1];
        }

        if (!pid) {
          return;
        }

        if (!killSent) {
          killSent = true;

          setTimeout(function() {
            process.kill(pid, 'SIGKILL');
          }, 50);
        }

        if ((matches = out.match(/.*worker (\d+) exited.  Restarting..../))) {
          expect(matches[1]).to.equal(pid);
          done();
          return 'kill';
        }
      });
    });

    it('should call exit when child process exits', function(done) {
      spawn('childExit.js -n 1 -vvv', function(out) {
        var matches;
        var pid;

        if ((matches = out.match(/.*pid: (\d+)/i))) {
          pid = matches[1];
        }

        if (!pid) {
          return;
        }

        if ((matches = out.match(/.*worker (\d+) exit/))) {
          expect(matches[1]).to.equal(pid);
        }

        if (out.match(/.*worker \d+ committed suicide/)) {
          done('worker should not commit suicide');
          return 'kill';
        }

        if (out.match(/.*worker \d+ Exit Code: \d+/)) {
          expect(out).to.match(new RegExp('.*worker ' + pid + ' Exit Code: \\d+'));
          done();
          return 'kill';
        }
      });
    });

    it('should check that forked processes are running', function(done) {
      var pid;
      var killed = false;
      var outObj = {};

      spawn('pid.js -n 1 -vvv', function(out) {
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

          setTimeout(function() {
            process.kill(ps.pid, 'SIGTERM');
          }, 500);
        }
      });
    });

    it('should kill the forked processes', function(done) {
      spawn('pid.js -n 1', function (out) {
        var pid = parseInt(out.replace(/\D/g, ''), 10);
        this.on('exit', function () {
          setTimeout(function () {
            try {
              process.kill(pid);
              done('child must no longer run');
            } catch (e) {
              done();
            }
          }, 500);
        });
        return 'kill'
      });
    });
  });

  describe('while running', function() {
    it('should spawn 4 workers', function(done) {
      spawn('httpServer.js -vv -n 4', function(out) {
        if (out.match(/.*\d+ workers.*online/ig)) {
          expect(out).to.match(/.*4 workers.*online/ig);
          done();
          return 'kill';
        }
      });
    });

    it('should listen on more than one port', function(done) {
      var listenCount = 0;
      spawn('multipleHttpServers.js -vvv -n 1', function(out) {
        if (out.match(/.*worker \d+ listening on.*/ig)) {
          listenCount++;

          if (listenCount == 2) {
            done();
            return 'kill';
          }

          expect(listenCount).to.be.below(3);
        }
      });
    });

    it('should restart workers after lifecycle timeout', function(done) {
      this.timeout(3000);
      var timeoutPIDS = [];
      var restartPIDS = [];

      spawn('shutdown.js -vvv -n 4 --tMaxAge 400 --tStart 200 --tStop 200', function(out) {
        var matches;
        var pid;

        while ((matches = out.match(/.*worker (\d+) has reached the end of it's life/))) {
          pid = parseInt(matches[1]);

          if (!_.contains(timeoutPIDS, pid)) {
            timeoutPIDS.push(pid);
          }

          out = out.replace(matches[0], '');
        }

        while ((matches = out.match(/.*worker (\d+) exited.  Restarting/))) {
          pid = parseInt(matches[1]);

          if (!_.contains(restartPIDS, pid)) {
            restartPIDS.push(pid);
          }

          out = out.replace(matches[0], '');
        }

        if (restartPIDS.length == 4 && timeoutPIDS.length == 4) {
          expect(restartPIDS).to.have.members(timeoutPIDS);
          expect(timeoutPIDS).to.have.members(restartPIDS);
          done();
          return 'kill';
        }
      });
    });
  });

  describe('during shutdown', function() {
    it('should call shutdown', function(done) {
      var kill = 0;
      spawn('httpServer.js -vvv -n 1', function(line) {
        if (line.match(/1 workers are now listening/) && kill < 1) {
          kill++;
          process.kill(ps.pid);
        }

        if (line.match(/Shutting down/)) {
          done();
          return 'kill';
        }
      });
    });

    it('should kill long living connections', function(done) {
      var killed = 0;

      spawn('longLive.js --tStop 200 --tStart 100 --tStop 100 -vvv -n 1', function(out) {

        if (out.match(/sever is now listening/) && killed < 1) {
          killed++;
          process.kill(ps.pid);
        }
      })
      .once('exit', function() {
        done();
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
 * @param cb the callback function with either a out or line parameter
 *
 * @returns {child_process}
 */
function spawn(cmd, cb) {
  ps = child.spawn(__dirname + '/../bin/node-pm', cmd.split(' '), { cwd: __dirname + '/scripts' });
  var out = '';

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