node-pm [![Build Status](https://travis-ci.org/sazze/node-pm.png?branch=master/master)](https://travis-ci.org/sazze/node-pm) [![NPM version](https://badge.fury.io/js/node-pm.png)](http://badge.fury.io/js/node-pm) [![Code Climate](https://codeclimate.com/github/sazze/node-pm/badges/gpa.svg)](https://codeclimate.com/github/sazze/node-pm)
====================

Run your nodejs service in style (think php-fpm for nodejs)

**Version Matrix:**

node version | node-pm version
------------ | ---------------
6.9.x | >= 0.11.6
4.2.x | >= 0.11.6
0.12.x | 0.11.0 - 0.11.5
0.10.x | 0.11.0 - 0.11.5
0.8.x | <= 0.10.6

* node versions below 4.2.0 are no longer supported as of version 0.11.6 of node-pm

Installation
====================

### Install node-pm

``` bash
    npm install -g node-pm
```

Usage
====================

### Run application

``` bash
    node-pm app.js
```

### List node-pm options

``` bash
    node-pm
```

Run Tests
====================

``` bash
    npm test
```

Generate Docs
====================

### Install jsdoc

``` bash
    npm install -g jsdoc
```

### Generate Docs

``` bash
    npm run-script docs
```

====================

#### Contributors:
    [Craig Thayer](https://github.com/sazze)
    [Kevin Smithson](https://github.com/sazze)

#### License: MIT

See LICENSE for the full license text.
