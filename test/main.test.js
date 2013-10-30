var expect = require('chai').expect;
var path = require('path');
var child = require('child_process');

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
  });

  describe('event listening', function() {
    it.skip('should call exit when process is killed hard', function(done) {
      var master = pm.start({n: 1, v: [], s: true, _: ['./test/scripts/httpServer.js']});
      var workerId = 0;
      var doneCount = 0;

      master.cluster.once('exit', function(worker) {
        expect(worker.id).to.equal(workerId);
        expect(worker.suicide).to.equal(false);
        done();
      });

      master.cluster.once('listening', function(worker) {
        workerId = worker.id;
        process.kill(worker.process.pid, 'SIGKILL');
      });
    });

    it.skip('should call exit when child process exits', function(done) {
      var master = pm.start({n: 1, v: [true], s: true, _: ['./test/scripts/childExit.js']});

      master.cluster.once('exit', function(worker) {
        expect(worker.suicide).to.equal(false);
        done();
      });
    });

    it('should kill the forked processes', function(done) {
      spawn('pid.js -n 1', function(out) {
        var pid = parseInt(out, 10)
        this.on('exit', function() {
          setTimeout(function() {
            try {
              process.kill(pid)
              done('child must no longer run')
            } catch(e) {
              done()
            }
          }, 500)
        })
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
  });
});

/**
 * Spawn a new process with cmd.  Will call callback on
 * data from stdout.  To kill spawn return 'kill' from
 * callback function.  if you return a function it will call
 * that function on next output.
 *
 * @param cmd the command to run
 * @param cb the callback function
 *
 * @returns {child_process}
 */
function spawn(cmd, cb) {
  var ps = child.spawn(__dirname + '/../bin/node-pm', cmd.split(' '), { cwd: __dirname + '/scripts' });
  var out = '';

  if (typeof cb === 'function') {
    ps.stdout.on('data', function(data) {
      out += data.toString();

      if (!cb) {
        return;
      }

      // Call the callback since we are done spawning
      var response = cb.call(ps, out);

      if (typeof response === 'function') {
        cb = response;
      } else if (response == 'kill') {
        cb = null;
        ps.kill();
      }
    });
  }
  return ps
}