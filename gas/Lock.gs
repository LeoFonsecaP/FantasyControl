/**
 * Script lock helpers for critical writes.
 */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(30000);
  if (!acquired) {
    throw new Error('Sistema ocupado. Tente novamente em alguns segundos.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
