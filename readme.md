<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&utm_medium=referral&utm_content=GetRayo/rayo.js&utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Coverage Status](https://coveralls.io/repos/github/GetRayo/rayo.js/badge.svg?branch=master)](https://coveralls.io/github/GetRayo/rayo.js?branch=master)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/GetRayo/rayo.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/GetRayo/rayo.js?targetFile=package.json)

</div>

This is a **framework** for the **modern** web; small, slick, elegant and fast.<br />
We built `Rayo` after spending too much time trying to fix the problems we encountered with other frameworks.
We needed something that could be an _almost_ out-of-the-box replacement for what most of our systems were built upon, without sacrificing productivity or performance.<br />

```
Your server will feel like it got hit by a lightning bolt...
```


## In a nutshell

- Really fast (Like, _really_ fast. See [how it compares](#how-does-it-compare)),
- similar API to Express¹,
- compatible with Express middleware,
- extensible & plugable,
- < 85 LOC (with routing and all)

> ¹ `Rayo` is not intended to be an Express replacement, thus the API is similar, inspired-by, but not identical.


```
There are examples 🔎 throughout the read.
```


## Install

```
$> npm i rayo
```


## Use

```js
const rayo = require('rayo');

rayo({ port: 5050 })
  .get('/hello/:user', (req, res) => res.end(`Hello ${req.params.user}`))
  .start();
```

<details>
<summary>🔎 (with multiple handlers)</summary>

```js
const rayo = require('rayo');

// "age" handler
const age = (req, res, step) => {
  req.age = 21;
  step();
};

// "name" handler
const name = (req, res, step) => {
  req.name = `Super ${req.params.user}`;
  step();
};

rayo({ port: 5050 })
  .get('/hello/:user', age, name, (req, res) => {
    res.end(
      JSON.stringify({
        age: req.age,
        name: req.name
      })
    );
  })
  .start();
```

</details>

#### A note on handlers

`handler` functions accept an [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) (a.k.a `req`), a [ServerResponse](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_class_http_serverresponse) (a.k.a `res`) and a `step through` (a.k.a `step`) function. `step()` is optional and may be used to move the program's execution logic to the next handler in the stack.

`step()` may also be used to return an error at any time. See [error handling](#error-handling).

> **Note:** An error will be thrown if `step()` is called on an empty stack.

Each `handler` exposes Node's native ServerResponse (`res`) object and it's your responsibility to deal with it accordingly, e.g. end the response (`res.end()`) where expected.

If you need an easier and more convenient way to deal with your responses, take a look at [@rayo/send].

#### Handler signature

```js
/**
 * @param {object}   req
 * @param {object}   res
 * @param {function} [step]
 */
const fn = (req, res, step) => {
  // Your logic.
};
```

#### Error handling

```
Please keep in mind that:
"Your code, your errors."¹
- It's your responsibility to deal with them accordingly.
```

> ² `Rayo` is WIP, so you may encounter actual errors that need to be dealt with. If so, please point them out to us via a `pull request`. 👍

If you have implemented your own error function (see `onError` under [options](#rayooptions--)) you may invoke it at any time by calling `step()` with an argument.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

const options = {
  port: 5050,
  onError: (error, req, res) => {
    res.end(`Here's your error: ${error}`);
  }
};

rayo(options)
  .get('/', (req, res, step) => step('Thunderstruck!'))
  .start();
```

</details><p></p>

In the above example, the error will be returned on the `/` path, since `step()` is being called with an argument. Run the example, open your browser and go to [http://localhost:5050](http://localhost:5050) and you will see "Here's your error: Thunderstruck!".

If you don't have an error function, you may still call `step()` (with an argument), which will use Rayo's own error function.


## API

#### rayo(options = {})

```
@param   {object} [options]
@returns {Rayo}
```

- `options.host` _{string}_
  - Listen on this host for incoming connections.
  - If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available, or the unspecified IPv4 address (0.0.0.0) otherwise.

- `options.port` _{number}_
  - Listen on this port for incoming connections.
  - If port is omitted or is 0, the operating system will assign an arbitrary, unused port.

- `options.storm` _{object}_
  - Harness the full power of multi-core CPUs. `Rayo` will spawn an instance across each core.
  - Accepts the same options object as `@rayo/storm`. See for [@rayo/storm] for details.
  - `Default:` null (no clustering)

- `options.server` _{http.Server}_
  - An instance [http.Server]. `Rayo` will attach to this.
  - `Default:` A new instance of [http.Server].

- `options.notFound` _{function}_

  > Invoked when undefined paths are requested.

  ```js
  /**
   * @param {object} req
   * @param {object} res
   */
  const fn = (req, res) => {
    // Your logic.
  };
  ```

  `Default:` Rayo will end the response with a "Page not found." message and a `404` status code.

- `options.onError` _{function}_

  > Invoked when `step()` is called with an argument.

  ```js
  /**
   * @param {*}        error
   * @param {object}   req
   * @param {object}   res
   * @param {function} [step]
   */
  const fn = (error, req, res, step) => {
    // Your logic.
  };
  ```

#### .verb(path, ...handlers)

```
@param   {string}   path
@param   {function} handlers - Any number, separated by a comma.
@returns {rayo}
```

> `Rayo` exposes all HTTP verbs as instance methods.

> Requests that match the given verb and path will be routed through the specified handlers.

This method is basically an alias of the [`.route`](#routeverb-path-handlers) method, with the difference that the `verb` is defined by the method name itself.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

/**
 * Setup a path ('/') on the specified HTTP verbs.
 */
rayo({ port: 5050 })
  .get('/', (req, res) => res.end('Thunderstruck, GET'))
  .head('/', (req, res) => res.end('Thunderstruck, HEAD'))
  .start();
```

</details>

#### .all(path, ...handlers)

```
@param   {string}   path
@param   {function} handlers - Any number, comma separated.
@returns {rayo}
```

> Requests which match any verb and the given path will be routed through the specified handlers.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

/**
 * Setup a path ('/') on all HTTP verbs.
 */
rayo({ port: 5050 })
  .all('/', (req, res) => res.end('Thunderstruck, all verbs.'))
  .start();
```

</details>

#### .through(...handlers)

```
@param   {function} handlers - Any number, comma separated.
@returns {rayo}
```

> All requests, any verb and any path, will be routed through the specified handlers.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

// "age" handler
const age = (req, res, step) => {
  req.age = 21;
  step();
};

// "name" handler
const name = (req, res, step) => {
  req.name = 'Rayo';
  step();
};

rayo({ port: 5050 })
  .through(age, name)
  .get('/', (req, res) => res.end(`${req.age} | ${req.name}`))
  .start();
```

</details>

#### .route(verb, path, ...handlers)

```
@param   {string}   verb
@param   {string}   path
@param   {function} handlers - Any number, comma separated.
@returns {rayo}
```

> Requests which match the given verb and path will be routed through the specified handlers.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

rayo({ port: 5050 })
  .route('GET', '/', (req, res) => res.end('Thunderstruck, GET'))
  .start();
```

</details>

#### .bridge(path)

```
@param   {string} path - The URL path to which verbs should be mapped.
@returns {bridge}
```

> Route one path through multiple verbs and handlers.

A `bridge` instance exposes all of Rayo's routing methods ([.through](#throughhandlers), [.route](#routeverb-path-handlers), [.verb](#verbpath-handlers) and [.all](#allpath-handlers)). You may create any number of bridges and Rayo will automagically take care of mapping them.

What makes `bridges` really awesome is the fact that they allow very granular control over what your application exposes. For example, enabling [@rayo/compression] only on certain paths.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

const server = rayo({ port: 5050 });

/**
 * Bridge the `/home` path to the `GET` and `HEAD` verbs.
 */
server
  .bridge('/home')
  .get((req, res) => res.end('You are home, GET'))
  .head((req, res) => res.end('You are home, HEAD'));

/**
 * Bridge the `/game` path to the `POST` and `PUT` verbs.
 */
server
  .bridge('/game')
  .post((req, res) => res.end('You are at the game, POST'))
  .put((req, res) => res.end('You are at the game, PUT'));

const auth = (req, res, step) => {
  req.isAuthenticated = true;
  step();
};

const session = (req, res, step) => {
  req.hasSession = true;
  step();
};

/**
 * Bridge the `/account` path to the `GET`, `POST` and `PUT` verbs
 * and through two handlers.
 */
server
  .bridge('/account')
  .through(auth, session)
  .get((req, res) => res.end('You are at the account, GET'))
  .post((req, res) => res.end('You are at the account, POST'))
  .put((req, res) => res.end('You are at the account, PUT'));

server.start();
```

</details>

#### .start(callback)

```
@param   {function} [callback] - Invoked on the server's `listening` event.
@returns {http.Server}
```

> Starts `Rayo` -Your server is now listening for incoming requests.

> `Rayo` will return the server address with the callback, if one was provided. This is useful, for example, to get the server port in case no port was specified in the options.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

rayo({ port: 5050 });
  .get((req, res) => res.end('Thunderstruck'))
  .start((address) => {
    console.log(`Rayo is up on port ${address.port}`);
  });
```

</details>


## Available modules

- [@rayo/compress]
- [@rayo/peruse]
- [@rayo/send]
- [@rayo/storm]


## How does it compare?

Please note that these results are only meant as raw performance indicators. Your application's logic, which is what makes most applications slow, may not see great performance gains between frameworks.

> These tests were conducted on a CPU-optimized server (DigitalOcean, 32 GB RAM, 16 vCPUs, Ubuntu 16.04.4 x64) and Node.js v10.5.0.
> Measured after one warm-up run.

| &nbsp;     | Version | Router | Requests/s | Latency | Throughput/Mb |
| ---------- | ------: | :----: | ---------: | ------: | ------------: |
| Rayo/storm |   1.0.1 |   ✔    |     111264 |    0.83 |         12.95 |
| Rayo       |   1.2.1 |   ✔    |    71491.2 |    1.32 |          8.07 |
| Polka      |   0.4.0 |   ✔    |    70083.2 |    1.36 |          8.03 |
| Fastify    |   1.6.0 |   ✔    |    69049.6 |    1.37 |         10.65 |
| Express    |  4.16.3 |   ✔    |    60867.2 |    1.57 |          7.08 |

Run on your own hardware; clone this repository, install the dependencies and run `npm run bench`. Optionally, you may also define your test's parameters:

```
$> npm run bench -- -u http://localhost:5050 -c 1000 -p 25 -d 10
```

- `-u` (_url_) -Defaults to `http://localhost:5050`
- `-c` (_connections_) -Defaults to `100`
- `-p` (_pipelines_) -Defaults to `10`
- `-d` (_duration_) -Defaults to `10` (seconds)
- `-o` (_only_) Run only one particular benchmark. -Defaults to `null`

> These results ~~may~~ will vary on different hardware.


## Examples

Can be found [here](https://github.com/GetRayo/rayo.js/tree/master/docs/examples).


## Contribute

See our [contributing](https://github.com/GetRayo/rayo.js/blob/master/CONTRIBUTING.md) notes.


## Kindly sponsored by

<a href="https://digitalocean.com">
 <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Sponsors/DigitalOcean.png" height="80" alt="DigitalOcean.com" />
</a>
<a href="https://doshii.io">
 <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Sponsors/Doshii.png" height="80" alt="Doshii.io" />
</a>


## Acknowledgements

:clap: `Thank you` to [everyone](https://github.com/nodejs/node/graphs/contributors) who has made Node.js possible and to all community members actively contributing to it.<br />
:steam_locomotive: Most of `Rayo` was written in chunks of 90 minutes per day and on the train while commuting to work.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)

<p align="center" style="margin:25px 0 10px">
  :zap:
</p>


[@rayo/compress]: https://github.com/GetRayo/rayo.js/tree/master/packages/compress
[@rayo/peruse]: https://github.com/GetRayo/rayo.js/tree/master/packages/peruse
[@rayo/send]: https://github.com/GetRayo/rayo.js/tree/master/packages/send
[@rayo/storm]: https://github.com/GetRayo/rayo.js/tree/master/packages/storm
[http.Server]: ttps://nodejs.org/api/http.html#http_class_http_server
