/**
 * Caps how many snapshot requests are in flight AT ONCE across the entire
 * app, regardless of how many camera tiles are mounted. A 16-camera grid
 * each independently polling its own snapshot — even with a jittered
 * interval — can still fire well over a dozen simultaneous requests. Real
 * embedded DVR web servers commonly choke on more than a couple of
 * concurrent HTTP/CGI sessions (the response gets slow rather than failing
 * outright), and a single-worker dev server queues everything behind those
 * slow requests too — together that's what previously made the whole app
 * (not just the camera grid) grind to a crawl. This throttles requests to a
 * small number of concurrent slots; everything else queues and waits its
 * turn instead of piling on.
 */
const MAX_CONCURRENT = 3;
let active = 0;
const queue: (() => void)[] = [];

export function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
    };

    if (active < MAX_CONCURRENT) {
      run();
    } else {
      queue.push(run);
    }
  });
}
