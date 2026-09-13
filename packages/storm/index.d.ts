import type { Cluster, Worker } from 'node:cluster';
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';

export type StormCluster = Cluster & { masterPid: number };
export type WorkerFunction = (this: Storm) => unknown;

export interface StormOptions {
  /** Positive integer or numeric string. Omit or pass 0 to use os.availableParallelism(). */
  workers?: number | string;
  /** Runs once in the primary process with the Storm instance as this. */
  master?: (this: Storm, cluster: StormCluster) => unknown;
  /** Replace workers when they exit. Defaults to true. */
  keepAlive?: boolean;
  /** Start the HTTP monitoring service. Defaults to true. */
  monitor?: boolean;
  /** Monitoring port. Omit or pass 0 for a port assigned by the operating system. */
  monitorPort?: number;
  /** Optional HTTP server used by the monitoring service. */
  server?: Server;
}

export interface StormEvents {
  worker: [pid: number];
  exit: [pid: number];
  offline: [];
}

export default class Storm extends EventEmitter<StormEvents> {
  constructor(work: WorkerFunction, options?: StormOptions);
  workers: number;
  keepAlive: boolean;
  monitor: boolean;
  work: () => unknown;
  start(options: StormOptions): void;
  /** Terminate the cluster and exit the primary process. */
  stop(): void;
  fork(worker: Worker): void;
}

/** Start a clustered application and return its Storm event emitter. */
export function storm(work: WorkerFunction, options?: StormOptions): Storm;
