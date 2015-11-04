/**
 *
 * @param {string} _[0] the worker file
 * @param {bool} [s=false] silent all errors
 * @param {bool} [d=false] turn on debug logs
 * @param {bool} [v=false] turn on verbose logs
 * @param {bool} [n=0] how many processes to start (0 means match number of CPU's)
 * @param {string} [workerMessageHandler=''] the path to the module containing the worker message handler (for inter-process communication)
 * @param {string} [u=''] user to run the script as
 * @param {string} [g=''] group to run the script as
 */
module.exports = {
  v: [],
  s: false,
  n: 0,
  sticky: false,
  _: [],
  timeouts: {
    start: 30000,
    stop: 30000,
    maxAge: 1800000
  },
  workerMessageHandler: '',
  u: '',
  g: ''
};