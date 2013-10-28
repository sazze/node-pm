var expect = require('chai').expect;

describe('Starting up Worker Manager', function() {
  "use strict";
  var pm = null;
  var master = null;

  beforeEach(function() {
    pm = require('../lib/main');
  });

  it('should spawn 4 workers', function() {
    master = pm.start({n: 4, _: ['./test/scripts/httpServer.js']});
    expect(master.count).to.equal(4);
  });

  afterEach(function() {
    master.exit();
  });
});