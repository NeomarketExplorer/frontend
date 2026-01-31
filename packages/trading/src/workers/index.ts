/**
 * Web Worker infrastructure using Comlink
 *
 * Workers handle heavy computations off the main thread:
 * - P&L calculations
 * - Orderbook aggregation
 * - OHLC chart data transformation
 * - CSV export generation
 */

import * as Comlink from 'comlink';

export interface WorkerPool<T> {
  getWorker(): Comlink.Remote<T>;
  terminate(): void;
}

/**
 * Create a worker pool for load balancing
 */
export function createWorkerPool<T>(
  workerFactory: () => Worker,
  poolSize: number = navigator.hardwareConcurrency || 4
): WorkerPool<T> {
  const workers: Worker[] = [];
  const proxies: Comlink.Remote<T>[] = [];
  let currentIndex = 0;

  for (let i = 0; i < poolSize; i++) {
    const worker = workerFactory();
    workers.push(worker);
    proxies.push(Comlink.wrap<T>(worker));
  }

  return {
    getWorker(): Comlink.Remote<T> {
      const proxy = proxies[currentIndex];
      currentIndex = (currentIndex + 1) % poolSize;
      return proxy;
    },
    terminate(): void {
      workers.forEach(w => w.terminate());
    },
  };
}

/**
 * Create a single worker with Comlink
 */
export function createWorker<T>(workerFactory: () => Worker): Comlink.Remote<T> {
  const worker = workerFactory();
  return Comlink.wrap<T>(worker);
}
