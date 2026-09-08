<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![Rayo](https://github.com/GetRayo/rayo.js/actions/workflows/test.js.yml/badge.svg?branch=master)](https://github.com/GetRayo/rayo.js/actions/workflows/test.js.yml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/948d1283795347e8b0b95075c6d2cf0b)](https://www.codacy.com/gh/GetRayo/rayo.js/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GetRayo/rayo.js&amp;utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Known Vulnerabilities](https://snyk.io/test/github/GetRayo/rayo.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/GetRayo/rayo.js?targetFile=package.json)

</div>

This is a **framework** for the **modern** web; small, slick, elegant and fast.<br />
I built `Rayo` after spending too much time trying to fix the problems I encountered with other frameworks.
I needed something that could be an _almost_ out-of-the-box replacement for what most systems were built upon, without sacrificing productivity or performance.<br />

```
Your server will feel like it got hit by a lightning bolt...
```

## In a nutshell

- Really fast (Like, _really_ fast. See [@rayo/benchmarks]),
- similar API to Express¹,
- compatible with (most) Express middleware²,
- extensible & pluggable,
- indexed routing with reusable middleware stacks

> ¹ `Rayo` is not intended to be an Express replacement, thus the API is similar, inspired-by, but not identical.<br />
> ² Some middleware rely on Express-specific features, which `Rayo` may or may not implement.


```
There are examples 🔎 throughout the read.
```

## Install

Requires Node.js 24 or newer. The same minimum applies to `@rayo/send`, `@rayo/compress`, and `@rayo/storm`.

```sh
npm install rayo
```

The examples use ES modules: save them as `.mjs` files or set `"type": "module"` in your application's
`package.json`. Install optional helpers when needed with `npm install @rayo/send @rayo/compress`.

## Use

```js
import rayo from 'rayo';

rayo({ port: 5050 })
  .get('/hello/:user', (req, res) => res.end(`Hello ${req.params.user}`))
  .start();
```

<details>
<summary>🔎 (with multiple handlers)</summary>

```js
import rayo from 'rayo';

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

Handlers receive an [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) (`req`), a [ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) (`res`), and a continuation function (`step`, often named `next`). Call `step()` to run the next handler, or finish the response without calling it.

Pass a truthy error to `step(error)` to invoke [error handling](#error-handling).

> **Note:** An error will be thrown if `step()` is called on an empty stack.

End responses with `res.end()` or an installed response helper. Call the continuation at most once, and do not
call it after finishing a response. Rayo does not automatically advance middleware when a handler returns a
promise, and it does not catch thrown errors or rejected promises. Catch asynchronous failures and pass them
to `step(error)` explicitly.

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

Calling `step(error)` with a truthy value invokes `onError(error, req, res, handler)`, when configured.
The fourth argument is the handler that reported the error. Without `onError`, Rayo sends a `400` response
with `error.message` for an `Error`, or `String(error)` for other values, as UTF-8 plain text.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

const options = {
  port: 5050,
  onError: (error, req, res) => {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(error instanceof Error ? error.message : String(error));
  }
};

rayo(options)
  .get('/', (req, res, step) => step(new Error('Thunderstruck!')))
  .start();
```

</details><p></p>

The example returns `Thunderstruck!` with status `500` at [http://localhost:5050](http://localhost:5050).
Custom error handlers set their own status, headers, and response body.

## API

### TypeScript

The `rayo`, `@rayo/send`, `@rayo/compress`, and `@rayo/storm` packages include declarations.
Install TypeScript and `@types/node` in a TypeScript application, choosing the Node type major that matches your
runtime. Use NodeNext or Bundler module resolution. The example below also requires `@rayo/send` and `@rayo/compress`.

```ts
import rayo, { type Request } from 'rayo';
import send, { type SendResponse } from '@rayo/send';
import compress from '@rayo/compress';

interface AppRequest extends Request {
  accountId: string;
}

const app = rayo<AppRequest, SendResponse>({ port: 5050 });
app.through(send(), compress(), (req, res, next) => {
  req.accountId = 'example';
  next();
});
app.get('/hello/:name', (req, res) => {
  res.json({ name: req.params.name, account: req.accountId });
});
app.start();
```

Request and response extensions describe what your middleware installs; install that middleware before handlers
that use those fields. Without a response subtype, send helpers are optional on Node's `ServerResponse`.

### Request fields

Rayo populates these fields before middleware runs:

| Field | Value |
| --- | --- |
| `req.pathname` | The parsed pathname used for routing. |
| `req.query` | Decoded query keys and values; repeated keys produce arrays. |
| `req.params` | Raw, URL-encoded route parameters; an empty object on a route miss. |
| `req.ip` | The nonempty `x-forwarded-for` header when supplied, otherwise the connection's remote address. |

The forwarded header is used as supplied; `req.ip` does not apply a trusted-proxy policy. Rayo does not parse
request bodies automatically.

### Routing and middleware preparation

Rayo extracts the pathname and query directly from ordinary HTTP request targets. Encoded separators, backslashes,
and dot segments remain unchanged for routing. Unusual forms use Node's legacy URL parser to preserve existing
behavior. Query values retain Node's `querystring.parse` decoding, repeated keys, and default 1,000-key limit.
Every dispatch reads `req.url` again; Rayo does not read or overwrite middleware's private `req._parsedUrl` cache.

Routes are indexed by method and path segments. Matches retain registration order, optional parameters, wildcards,
trailing-slash handling, and raw URL-encoded parameter values. A static route does not override an earlier parameter
route. Bridges are checked before direct routes, with later bridges checked first.

Rayo compiles route patterns during registration using its own parser. The supported syntax remains `/users/:id`,
`/users/:id?`, `/files/:name.json`, and `/files/*`; existing parsing behavior is checked against recorded compatibility
fixtures in the test suite. Pattern compilation happens before request handling and does not decode path segments.
Optional parameters can be absent. A wildcard matches deeper paths, but its `req.params['*']` value contains
only the first matched segment: `/files/*` matches `/files/a/b` with `'*': 'a'`.

Global middleware and route handlers are combined once during preparation. Registration through `.get()`, `.route()`,
`.through()`, and bridges automatically invalidates the index; the next request rebuilds it. `.prepare()` (or `.through()`
with no handlers) prepares eagerly and is safe to repeat. Do not mutate prepared arrays returned by `.fetch()`.

Bridge middleware runs once before its handlers. When multiple bridges and direct registrations use the same literal
method/path, their handlers are combined in bridge precedence order followed by the direct handlers.

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
  - Run the HTTP server in clustered workers. By default, the worker count uses `os.availableParallelism()`;
    set `workers` to choose a different count.
  - Accepts the [@rayo/storm] options. Monitoring and worker replacement are enabled by default;
    set `monitor: false` or `keepAlive: false` to disable them.
  - `Default:` null (no clustering)

- `options.server` _{http.Server}_
  - An existing [http.Server], including an HTTPS server, that is not already listening. `.start()` attaches
    Rayo's request handler and calls `listen()` on this server.
  - `Default:` A new [http.Server] created when `.start()` runs.

- `options.notFound` _{function}_

  > Invoked when no route matches the request's method and pathname.

  ```js
  /**
   * @param {object} req
   * @param {object} res
   */
  const fn = (req, res) => {
    // Your logic.
  };
  ```

  Global middleware runs before this handler. `Default:` a `404` response with UTF-8 plain text such as
  `GET /missing is undefined.`. A custom `notFound` handler sets its own response status and body.

- `options.onError` _{function}_

  > Invoked when `step(error)` receives a truthy value.

  ```js
  /**
   * @param {*}        error
   * @param {object}   req
   * @param {object}   res
   * @param {function} [handler] - The handler that reported the error, not a continuation.
   */
  const fn = (error, req, res, handler) => {
    // Your logic.
  };
  ```

  `Default:` a `400` response containing the error message as UTF-8 plain text.

#### .verb(path, ...handlers)

```
@param   {string}   path
@param   {function} handlers - Any number, separated by a comma.
@returns {rayo}
```

Convenience methods are `.get()`, `.head()`, `.post()`, `.put()`, `.delete()`, `.connect()`, `.options()`,
`.trace()`, and `.patch()`. `HEAD` handlers must be registered explicitly; a `GET` route does not supply one.
Rayo listens to Node's `request` event. HTTP tunnelling and protocol upgrades require handling Node's separate
`connect` and `upgrade` events on the server.

> Requests that match the given verb and path will be routed through the specified handlers.

This method is basically an alias of the [`.route`](#routeverb-path-handlers) method, with the difference that the `verb` is defined by the method name itself.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

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

Registers the given path for the nine convenience methods listed above. To use another method, register it
explicitly with `.route()`.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

/**
 * Setup a path ('/') on the nine supported convenience methods.
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

On the app, these handlers run before route handlers and also run for unmatched paths. On a bridge, they run
only for that bridge's registered routes. Calling `.through()` without handlers is equivalent to `.prepare()`.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

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

Method names are case-sensitive; use uppercase names such as `'GET'`. Repeated registration of the same
literal method and path appends handlers. This method always takes an explicit path, including on a bound bridge.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

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

Group handlers for one route pattern. This binds the shortcut methods and `.all()` to that pattern;
it does not mount a path prefix.

A bound bridge exposes [.through](#throughhandlers), [.route](#routeverb-path-handlers),
[the verb methods](#verbpath-handlers), [.all](#allpath-handlers), `.prepare()`, and `.fetch()`.
Use `.get(handler)` on a bound bridge; on the app use `.get(path, handler)`.
Calling `.bridge()` without a path creates a group whose methods take explicit paths and which can contain
further bridges. Bound bridges do not expose `.bridge()`.

Bridge middleware can enable [@rayo/compress] or other behavior for selected routes.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

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

#### .prepare()

Build the route indexes and reusable middleware stacks eagerly. Returns the app or bridge and is safe to call
repeatedly. `.start()` and `.fetch()` prepare automatically. Further registrations invalidate preparation and
are picked up by the next lookup.

#### .fetch(verb, path)

Look up a route without executing its handlers. Use an uppercase method and a pathname without its query string.
Returns `null` on a miss, or `{ params, stack, dispatchStack }`: `stack` includes route and contributing bridge
handlers; `dispatchStack` also includes the current app or bridge's global middleware. Treat both arrays as
immutable because they are shared between requests.

#### .start(callback)

```
@param   {function} [callback] - Invoked on the server's `listening` event.
@returns {http.Server|null}
```

Prepare routes and start listening. The method returns the server immediately; use the optional callback to
know when it is listening. The callback receives `{ address, family, port, workerPid }`.
This is useful when the operating system assigns the port.

With Storm, the callback runs separately in each worker. The primary process normally returns `null` because
it does not create an HTTP server locally.

<details>
<summary>🔎</summary>

```js
import rayo from 'rayo';

rayo({ port: 5050 })
  .get('/', (req, res) => res.end('Thunderstruck'))
  .start((address) => {
    console.log(`Rayo is up on port ${address.port}`);
  });
```

</details>


## Available modules

- [@rayo/compress] provides gzip/Brotli response compression, negotiation, thresholds, and streaming backpressure.
- [@rayo/send] adds `res.send()`, `res.text()`, `res.json()`, and `res.jsonString()` response helpers.
- [@rayo/storm] manages clustered workers, replacement on exit, and optional HTTP monitoring.

## Performance

[@rayo/benchmarks] measures complete HTTP requests, with route-count, middleware, query, payload, and streaming
workloads. It also supports paired comparisons between checkouts. Follow its guide to reproduce measurements;
results depend on the workload, hardware, and Node version.

The [September 2026 dependency report](https://github.com/GetRayo/rayo.js/blob/master/docs/dependency-performance-2026-09-08.md)
records the parser replacement measurements and their limitations. Those historical results predate the latest
dependency upgrades and do not establish a current framework ranking.


## Examples

Can be found [here](https://github.com/GetRayo/rayo.js/tree/master/docs/examples).

## Contribute

Run `npm ci` and `npm test` from the repository root. The npm workspaces share the root `package-lock.json`;
individual package lockfiles are not used. Parser compatibility tests keep fixed expectations from the former
dependencies, so neither `matchit` nor `parseurl` is a direct dependency of this project.

See our [contributing](https://github.com/GetRayo/rayo.js/blob/master/CONTRIBUTING.md) notes.

Useful commands from the repository root:

```sh
npm ci
npm test                  # Lint, strict type checks, tests, and coverage
npm run unit             # Runtime tests only; fails if no tests are selected
npm run test:types       # NodeNext and Bundler consumer checks
npm run bench --workspace @rayo/benchmarks -- --list
```

CI runs on Node 24 and sends its Cobertura coverage report to Codacy. Before packaging, `npm run copies`
synchronizes the root README into `packages/rayo` and the root license into all five package directories.

## Kindly sponsored by

<a href="https://digitalocean.com">
 <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Sponsors/DigitalOcean.png" height="80" alt="DigitalOcean.com" />
</a>

## Acknowledgements

:clap: `Thank you` to [everyone](https://github.com/nodejs/node/graphs/contributors) who has made Node.js possible and to all community members actively contributing to it.<br />
:steam_locomotive: Most of `Rayo` was written in chunks of 90 minutes per day and on the train while commuting to work.

## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE). Copyright (c) 2018 - 2026 Stefan Aichholzer.

<p align="center" style="margin:25px 0 10px">
  :zap:
</p>


[@rayo/benchmarks]: https://github.com/GetRayo/rayo.js/tree/master/packages/benchmarks
[@rayo/compress]: https://github.com/GetRayo/rayo.js/tree/master/packages/compress
[@rayo/send]: https://github.com/GetRayo/rayo.js/tree/master/packages/send
[@rayo/storm]: https://github.com/GetRayo/rayo.js/tree/master/packages/storm
[http.Server]: https://nodejs.org/api/http.html#http_class_http_server
