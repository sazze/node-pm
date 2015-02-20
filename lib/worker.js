var args = process.argv.slice(2);
if (args.length == 0) {
  process.exit(1);
}

for (var i in args) {
  if(args.hasOwnProperty(i) && args[i] === '--sticky') {
    require('./overrides/http');
  }
}

var workerFile = args[0];

require(require('path').resolve(process.cwd(), workerFile));