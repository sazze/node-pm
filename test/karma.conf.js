module.exports = function(config) {
  config.set({
    basePath: '..',
    frameworks: ['mocha'],
    files: [
      'test/**/*.test.js'
    ],
    autoWatch: true,
    browsers: ['Chrome']
  });
};