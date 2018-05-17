<p align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" />
</p>

[![Lines of code](https://img.shields.io/badge/LOC-97-yellow.svg)](https://img.shields.io/badge/LOC-97-yellow.svg)
[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GetRayo/rayo.js&amp;utm_campaign=Badge_Grade)
[![NSP Status](https://nodesecurity.io/orgs/rayo/projects/b16aa9a6-c080-44e1-9c91-77609aa498be/badge)](https://nodesecurity.io/orgs/rayo/projects/b16aa9a6-c080-44e1-9c91-77609aa498be)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)

Yep, you got that right! -Only `97 lines of code` (after [ESLint](https://github.com/eslint/eslint) and [Prettier](https://github.com/prettier/prettier)).

```
Everything in the -modern- web is arguable,
however we are convinced that Rayo is the fastest framework.
In the world.
Period.
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

#### With middleware

```js
const rayo = require('rayo');

const age = (req, res, step) => {
  req.age = `Your age is ${req.params.age}`;
  step();
};

const name = (req, res, step) => {
  req.name = `Your name is ${req.params.name}`;
  step();
};

rayo({ port: 5050 })
  .through(age, name)
  .get('/hello/:name/:age', (req, res) => {
    res.end(
      JSON.stringify({
        age: req.age,
        name: req.name
      })
    );
  })
  .start((address) => {
    console.log(`The server is listening on port ${address.port}`);
  });
```

#### A note on middleware

`Middleware` functions accept an [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) (a.k.a `req`), a [ServerResponse](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_class_http_serverresponse) (a.k.a `res`) and a `step-through` (a.k.a `step`) function. Use `step()` to move your program's execution logic to the next middleware in the stack.

> **Note:** An error will be thrown if `step()` is invoked on an empty middleware stack.

`Rayo` exposes Node's core [ServerResponse](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_class_http_serverresponse) (`res`) object and it's your responsibility to deal with it accordingly. However, `Rayo` does bind a smart `send()` function to the response. Using `res.send()` will try to guess the content type and send the appropriate headers, status code and body, it will also end the response.

> **Note:** `res.send()` will incur a performance hit due to the headers being written with every response, regardless of them being intended or not.


## API

```
Before reading any further, think about this;
"Your code, your errors."¹
- It's your responsibility to deal with these errors accordingly.
```

#### rayo(options = {})
* `options.port` (_Type: number_) -Listen on this port for incoming connections. If port is omitted or is 0, the operating system will assign an arbitrary, unused, port.

* `options.host` (_Type: string_) -Listen on this host for incoming connections. If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available, or the unspecified IPv4 address (0.0.0.0) otherwise.

* `options.server` (_Instance of: http.Server_) -A server instance to which `Rayo` will be attached. By default, `Rayo` will create a new [http.Server](https://nodejs.org/api/http.html#http_class_http_server).

> Return: `Instance of Rayo`

#### .through(...functions)
Middleware functions through which every request will be sent through. Remember that you need to step through the stack with the `step()` function.

* `functions` (_Type: function_) -Any number of functions, comma separated. Note that each function must follow the `(req, res, step)` signature, where `step` is optional unless you intend to move your program's execution past any given function in the stack.

> Return: `Chainable Rayo`

#### .start(callback)
Start `Rayo` and [listen](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_server_listen) on the specified port.

* `callback` (_Type: function_) -A function to be executed once the server has emitted the `listening` event. `Rayo` will pass the server address to this callback, this is useful, for example, to get the server port in case no port was specified as part of the options. (See the usage example above)

> Return: `http.Server`.

> ¹ `Rayo` is WIP, so you may encounter actual errors that need to be dealt with. If so, please point them out to us via a `pull request`. 👍

## How does it compare?

Here are some of the top contenders. Please note that these results are only meant as raw performance indicators. Your application's logic, which is what makes most applications slow, may not see great performance gains from using one framework over another.

#### Node V.8.11.1
 &nbsp;         | Rayo  | Polka   | Fastify | Express
--------------- | ----- | ------- | ------- | -------
Requests (/s)   | 33304 | 32068.8 | 31449.6 | 19493.6
Latency (ms)    | 2.93  | 3.04    | 3.1     | 5.02
Throughput (Mb) | 3.712 | 3.5875  | 4.925   | 3.0625

#### Node V.10.1.0
 &nbsp;         | Rayo    | Polka   | Fastify | Express
--------------- | ------- | ------- | ------- | -------
Requests (/s)   | 39465.6 | 38454.4 | 38166.4 | 26075.2
Latency (ms)    | 2.46    | 2.53    | 2.55    | 3.74
Throughput (Mb) | 4.4375  | 4.2625  | 5.975   | 4.0625


## Contribute
```
$> fork https://github.com/GetRayo/rayo.js
$> Do your thing.
$> Submit a PR.
```


## Acknowledgements

- `Thank you` :clap: [TJ Holowaychuk](https://github.com/tj) for [express](https://github.com/expressjs/express) -It has been a good source of inspiration and it has served us well for many years.

- `Thank you` :clap: [Luke Edwards](http://github.com/lukeed/) for [matchit](https://github.com/lukeed/matchit) -Initially we started looking at [path-to-regexp](https://github.com/pillarjs/path-to-regexp) for route matching and parsing, then we decided to roll-out our own version and the we found `matchit` -Why re-invent the wheel, right?

- `Thank you` :clap: [Everyone](https://github.com/nodejs/node/graphs/contributors) who has made Nodejs possible.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
