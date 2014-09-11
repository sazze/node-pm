/**
 * @author Craig Thayer <cthayer@sazze.com>
 * @copyright 2014 Sazze, Inc.
 */

/**
 * Implements simple pub-sub message model between workers (sends a message from one worker to all other workers)
 *
 * @param message
 * @param handle
 * @param worker
 */
module.exports = function (message, handle, worker) {
  this.eachWorker(function (w) {
    if (w.id == worker.id) {
      // don't send the message to the worker that sent it to us
      return;
    }

    w.send(message);
  });
};