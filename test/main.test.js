var expect = require('chai').expect;
var path = require('path');

describe('Worker Manager', function() {
  "use strict";
  var pm = null;

  beforeEach(function() {
    pm = require('..');
  });

  describe('during startup', function() {
    it('should require a start script', function() {
      expect(pm.start.bind(pm.start, {s: true})).to.throw('app start script must be specified');
    });

    it('should require an existing start script', function() {
      expect(pm.start.bind(pm.start, {s: true, _: ['fake.js']})).to.throw('cannot file application start script: fake.js');
    });

    it('should set default timeouts', function() {
      var config = require('../lib/config');
      expect(config).to.have.property('timeouts');
      expect(config.timeouts).to.have.property('start').and.to.equal(30000);
      expect(config.timeouts).to.have.property('maxAge').and.to.equal(1800000);
    });

    it('should spawn 4 workers', function() {
      var master = pm.start({n: 4, _: ['./test/scripts/httpServer.js']});
      expect(master.count).to.equal(4);
    });

    it('should listen on more than one port', function(done) {
      var listenCount = 0;

      var master = pm.start({n: 1, _: ['./test/scripts/multipleHttpServers.js']});

      master.cluster.on('listening', function(worker, address) {
        listenCount++;

        if (listenCount == 2) {
          done();
        }
      });
    });
  });

  describe('event listening', function() {
    it('should call exit when process is killed hard', function(done) {
      var master = pm.start({n: 1, s: true, _: ['./test/scripts/httpServer.js']});
      var workerId;

      master.cluster.on('exit', function(worker) {
        expect(worker.id).to.equal(workerId);
        expect(worker.suicide).to.equal(true);
        done();
      });

      master.cluster.on('listening', function(worker) {
          workerId = worker.id;
          process.kill(worker.process.pid, 'SIGKILL');
      });
    });
  });


  afterEach(function() {
    pm.stop();
    pm = null;

    // Delete Cache Keys
    delete require.cache[path.resolve('./lib/config.js')];
  });
});