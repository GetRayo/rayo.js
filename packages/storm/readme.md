<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_storm.png" alt="@rayo/storm" />
</div>

Harness the full power of multi-core CPUs.<br />
`storm` will cluster your application using `os.availableParallelism()` workers by default. Performance gains depend on your workload and available resources.

`storm` handles `SIGINT` and `SIGTERM` in the primary process by terminating its workers and exiting.

> `storm` is available, by default, with `rayo.js`. See [rayo/options.storm](https://github.com/GetRayo/rayo.js#rayooptions--)

## Install

Requires Node.js 24 or newer.

```
$> npm i @rayo/storm
```


## Use

```js
import { storm } from '@rayo/storm';

const yourAwesomeFunction = () => {
  console.log(`Hello, I am worker ${process.pid}`);
};

storm(yourAwesomeFunction, {
  monitorPort: 31000
});
```

After forking the workers, `storm` will, by default, launch a monitoring service which will enable you to get basic metrics for each process. It does not wait for the workers to be online.

The monitor service resource will be mapped to the `/monitor` path. Worker health information will be mapped to the `/monitor/{workerId}` path, where `workerId` is the cluster worker ID rather than its process ID.

In the above example, the monitor service will be available at `http://localhost:31000/monitor`

> The monitor service is WIP.

## API

#### storm(work [, options = {}])
```
@param   {function} Called when starting a worker process.
@param   {object}   [options]
@returns {Storm} Event emitter for the cluster.
```

`work` runs in each worker process. Regular functions receive the `Storm` instance as `this`.

- `options.workers` _{number|string}_
  - Positive integer number of workers to spawn. Numeric strings are accepted. Invalid counts throw a `RangeError` before any workers are created.
  - `Default:` [`os.availableParallelism()`](https://nodejs.org/api/os.html#osavailableparallelism), which estimates the parallelism available to this process. `0` or `'0'` also selects this default.

- `options.master` _{function}_
  - Called in the primary process after the initial workers have been forked.
  - This will only be called once during initialization.
  - The `master` function receives the `cluster`, including `cluster.masterPid`. Regular functions receive the `Storm` instance as `this`.

- `options.keepAlive` _{boolean}_
  - Whether to replace workers whenever they exit, including normal exits.
  - `Default:` true

- `options.monitor` _{boolean}_
  - Whether to run the HTTP monitoring service or not.
  - `Default:` true

- `options.monitorPort` _{number}_
  - Listen on this port for incoming `/monitor` connections.
  - If port is omitted or is 0, the operating system will assign an arbitrary, unused port.

- `options.server` _{http.Server}_
  - Optional HTTP server for the monitoring service that is not already listening. Storm starts listening on `monitorPort`; by default it creates a new server.

In the primary process, the returned `Storm` instance emits `worker` when a worker becomes online and `exit` when it exits, each with the worker process ID. It exposes `workers` (the resolved worker count), `keepAlive`, and `monitor`. Call `stop()` in the primary process to request worker termination, emit `offline`, and then exit the primary process; `offline` does not wait for all worker exits.

### TypeScript

Declarations for the default `Storm` class, the `storm()` factory, and `StormOptions` are included. Install `@types/node` and include `"node"` in your `tsconfig.json` `types` list:

```ts
import { storm, type StormOptions } from '@rayo/storm';

const startApplication = () => {
  console.log(`Application started in worker ${process.pid}`);
};

const options: StormOptions = {
  workers: 2,
  monitor: false,
  master(cluster) {
    console.log(cluster.masterPid, this.workers);
  }
};

storm(startApplication, options)
  .on('worker', (pid) => console.log(`Worker ${pid} is online`));
```


## Contribute

See our [contributing](https://github.com/GetRayo/rayo.js/blob/master/CONTRIBUTING.md) notes.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
