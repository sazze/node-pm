#!/usr/bin/env node

var cluster = require('cluster');
var os = require('os');
var fs = require('fs');
var optimist = require('optimist');

var argv = optimist
    .usage('Run a node app in style\n\nUsage: $0 [app start script]')
    .boolean('s').alias('s', 'silent').default('s', false).describe('s', 'silence workers')
    .boolean('d').alias('d', 'debug').default('d', false).describe('s', 'show debug output')
    .alias('n', 'numProc').default('n', 0).describe('n', 'number of workers to spawn')
    .demand(1).argv;

var numProc = argv.numProc || os.cpus().length;
var workerFile = argv._[0];
var silent = argv.silent;
var debug = argv.debug;

if (!workerFile) {
    throw new Error('app start script must be specified');
}

if (!fs.existsSync(workerFile)) {
    throw new Error('cannot file application start script: ' + workerFile);
}

process.on('SIGTERM', function() {
    console.log('SIGTERM recieved');
    cluster.disconnect(process.exit);
});

process.on('SIGABRT', function() {
    console.log('SIGABRT recieved');
    cluster.disconnect(process.exit);
});

process.on('SIGINT', function() {
    console.log('SIGINT recieved');
    cluster.disconnect(process.exit);
});

process.on('SIGHUP', function() {
    console.log('SIGHUP recieved');
});

cluster.setupMaster({
    exec: workerFile,
    silent: silent
});

cluster.on('fork', function(worker) {
    console.log('worker ' + worker.process.pid + ' forked');
});

cluster.on('online', function(worker) {
    console.log('worker ' + worker.process.pid + ' online');
});

cluster.on('listening', function(worker, address) {
    console.log('worker ' + worker.process.pid + ' listening on ' + address.address + ':' + address.port);
});

cluster.on('disconnect', function(worker) {
    console.log('worker ' + worker.process.pid + ' disconnect');
});

cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' exit');

    if (debug) {
        if (worker.suicide) {
            console.log('suicide');
        }

        console.log(code);
        console.log(signal);
    }
    
    if (!worker.suicide) {
        console.log('worker ' + worker.process.pid + ' exited.  Restarting....');
        cluster.fork();
    }
});

if (debug) {
    console.log('forking ' + numProc + ' workers');
}

for (var i = 0; i < numProc; i++) {
    cluster.fork();
}