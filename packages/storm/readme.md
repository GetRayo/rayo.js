<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GetRayo/rayo.js&amp;utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Coverage Status](https://coveralls.io/repos/github/GetRayo/rayo.js/badge.svg?branch=master)](https://coveralls.io/github/GetRayo/rayo.js?branch=master)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/GetRayo/rayo.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/GetRayo/rayo.js?targetFile=package.json)
</div>

Harness the full power of multi-core CPUs.<br />
`storm` will cluster your application and spawn an instance on each available core. You can expect performance gains of up to 150%.

`storm` will handle OS signals as expected.

> `storm` is available, by default, with `rayo.js`. See [rayo/options.storm](https://github.com/GetRayo/rayo.js#rayooptions--)

## Install

```
$> npm i @rayo/storm
```


## Use

```js
const storm = require('@rayo/storm');

const yourAwesomeFunction = (workerId) => {
  console.log(`Hello, I am worker ${workerId}`);
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
@returns {void}
```

- `options.workers` _{number}_
  - Number of workers to spawn.
  - `Default:` Number of available [CPU cores](https://nodejs.org/api/os.html#os_os_cpus).

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


## Contribute

See our [contributing](https://github.com/GetRayo/rayo.js/blob/master/CONTRIBUTING.md) notes.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
