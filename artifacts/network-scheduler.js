// One application-wide request budget. Writes are never automatically replayed.
function install(platform, limit = 6) {
  if (!platform || platform.request.__scheduled) return;
  const native = platform.request.bind(platform);
  const queue = [];
  let active = 0;
  function drain() {
    while (active < limit && queue.length) {
      const now = Date.now();
      queue.sort((a, b) => (b.priority + (now-b.created)/5000) - (a.priority + (now-a.created)/5000));
      // Reserve two request slots for login/profile and sharing heartbeats.
      const index = active >= Math.max(1, limit - 2) ? queue.findIndex(job => job.priority > 0) : 0;
      if (index < 0) break;
      const job = queue.splice(index, 1)[0];
      if (job.done) continue;
      job.started = true; active++;
      try {
        job.nativeTask = native({ ...job.options,
          success: value => { if (!job.done) job.options.success?.(value); },
          fail: value => { if (!job.done) job.options.fail?.(value); },
          complete: value => job.finish(value)
        });
        for (const [method, args] of job.listeners) job.nativeTask?.[method]?.(...args);
      } catch (error) {
        const result = { errMsg: error.errMsg || error.message || 'request:fail' };
        try { if (!job.done) job.options.fail?.(result); } finally { job.finish(result); }
      }
    }
  }
  function request(options = {}) {
    const url = options.url || '';
    const job = { options, created: Date.now(), priority: /\/api\/(location-sharing|user\/profile|weapp\/login)/.test(url) ? 2 : 0,
      done: false, started: false, nativeTask: null, listeners: [] };
    job.finish = result => {
      if (job.done) return;
      job.done = true;
      if (job.started) active--;
      try { options.complete?.(result); } finally { drain(); }
    };
    const task = { abort() {
      if (job.done) return;
      if (job.started) { job.nativeTask?.abort(); return; }
      const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1);
      const result = { errMsg: 'request:fail abort' };
      try { options.fail?.(result); } finally { job.finish(result); }
    } };
    for (const method of ['onHeadersReceived','offHeadersReceived','onChunkReceived','offChunkReceived']) {
      task[method] = (...args) => {
        if (job.nativeTask) job.nativeTask[method]?.(...args);
        else if (!job.done) job.listeners.push([method, args]);
      };
    }
    queue.push(job); drain(); return task;
  }
  request.__scheduled = true;
  // WeChat exposes some APIs with an accessor; defining the own property also works there.
  Object.defineProperty(platform, 'request', { value: request, writable: true, configurable: true });
}
module.exports = { install };
