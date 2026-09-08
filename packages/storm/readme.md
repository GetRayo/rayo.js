<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_storm.png" alt="@rayo/storm" />
</div>

Harness the full power of multi-core CPUs.<br />
`storm` will cluster your application and spawn an instance on each available core. You can expect performance gains of up to 150%.

`storm` will handle OS signals as expected.

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

Once all worker processes have been spawned, `storm` will, by default, launch a monitoring service which will enable you to get basic metrics for each process.

The monitor service resource will be mapped to the `/monitor` path. Detailed information on each worker will be mapped to the `/monitor/{workerId}` path.

In the above example, the monitor service will be available at `http://localhost:31000/monitor`

> The monitor service is WIP. However, this does not affect storm's stability.

## API

#### storm(work [, options = {}])
```
@param   {function} Called when starting a worker process.
@param   {object}   [options]
@returns {Storm} Event emitter for the cluster.
```

- `options.workers` _{number|string}_
  - Positive integer number of workers to spawn. Numeric strings are accepted. Invalid counts throw a `RangeError` before any workers are created.
  - `Default:` [`os.availableParallelism()`](https://nodejs.org/api/os.html#osavailableparallelism), which estimates the parallelism available to this process. `0` also selects this default.

- `options.master` _{function}_
  - Called when starting the master process.
  - This will only be called once.
  - The `master` function will be passed one argument; the `cluster`.

- `options.keepAlive` _{boolean}_
  - Whether the cluster should be kept alive or not. Fork new processes on process death.
  - `Default:` true

- `options.monitor` _{boolean}_
  - Whether the cluster should be monitored or not.
  - `Default:` true

- `options.monitorPort` _{number}_
  - Listen on this port for incoming `/monitor` connections.
  - If port is omitted or is 0, the operating system will assign an arbitrary, unused port.

- `options.server` _{http.Server}_
  - Optional server for the monitoring service. Storm starts listening on `monitorPort`.

The returned `Storm` instance emits `worker` and `exit` with the worker process ID, and `offline` when stopped. It exposes `workers` (the resolved worker count), `keepAlive`, and `monitor`. Calling `stop()` terminates the cluster and exits the primary process.

### TypeScript

Declarations for the default `Storm` class, the `storm()` factory, and `StormOptions` are included:

```ts
import { storm, type StormOptions } from '@rayo/storm';

const options: StormOptions = {
  workers: 2,
  monitor: false,
  master(cluster) {
    console.log(cluster.masterPid, this.workers);
  }
};

storm(() => startApplication(), options)
  .on('worker', (pid) => console.log(`Worker ${pid} is online`));
```


## Contribute

See our [contributing](https://github.com/GetRayo/rayo.js/blob/master/CONTRIBUTING.md) notes.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
