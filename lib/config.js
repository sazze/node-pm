/**
 *
 * @param {string} _[0] the worker file
 * @param {bool} [s=false] silent all errors
 * @param {bool} [d=false] turn on debug logs
 * @param {bool} [v=false] turn on verbose logs
 * @param {bool} [n=0] how many processes to start (0 means match number of CPU's)
 */
module.exports = {
  v: false,
  d: false,
  s: false,
  n: 0,
  _: [],
  timeouts: {
    start: 30000,
    stop: 30000,
    maxAge: 1800000
  }
};