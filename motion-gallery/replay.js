/** Serial native replays, cancellable when a comparison is superseded.
 * Cache only successful results; no physics runs while playing or scrubbing. */
let rendererPromise, worker, active, nextRequest = 0;
const queue = [], cache = new Map();
const renderer = () => rendererPromise ??= import('/generated/motion-gallery-renderer/view.js')
  .catch(error => { rendererPromise = undefined; throw error; });

function finish(job, error, data) {
  job.signal?.removeEventListener('abort', job.abort);
  if (active === job) active = undefined;
  const index = queue.indexOf(job);
  if (index !== -1) queue.splice(index, 1);
  if (error) job.reject(error); else job.resolve(data);
  pump();
}
function pump() {
  if (active || !queue.length) return;
  const job = active = queue.shift();
  try {
    if (!worker) {
      const current = worker = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'});
      current.onmessage = ({data}) => {
        if (worker !== current || active?.request !== data.request) return;
        finish(active, data.error ? new Error(data.error) : null, data);
      };
      const fail = event => {
        if (worker !== current) return;
        current.terminate(); worker = undefined;
        if (active) finish(active, new Error(`Native replay unavailable: ${event.message || 'unreadable worker response'}`));
      };
      current.onerror = fail;
      current.onmessageerror = fail;
    }
    worker.postMessage({request: job.request, track: job.record.track, trace: job.record.trace});
  } catch (error) { finish(job, error); }
}
function replay(record, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const job = {request: ++nextRequest, record, signal, resolve, reject};
    job.abort = () => {
      // A synchronous native replay cannot process a cancellation message.
      // Only the active task has been posted, so terminating it loses no queued work.
      if (active === job) { worker?.terminate(); worker = undefined; }
      finish(job, signal.reason);
    };
    signal?.addEventListener('abort', job.abort, {once: true});
    queue.push(job); pump();
  });
}
export async function prepareView(record, digest, signal) {
  signal?.throwIfAborted();
  let entry = cache.get(digest);
  if (!entry) {
    const [{module, sheet}, native] = await Promise.all([
      renderer().then(async module => ({module, sheet: await module.loadRider()})),
      replay(record, signal),
    ]);
    signal?.throwIfAborted();
    entry = {module, sheet, native};
  }
  const {module, sheet, native} = entry;
  const view = module.createView(record, native, sheet);
  cache.delete(digest); cache.set(digest, entry);
  while (cache.size > 24) cache.delete(cache.keys().next().value);
  return {view, replayMs: native.replayMs, maxError: native.maxError};
}
