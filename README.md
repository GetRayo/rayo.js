<p align="center">
  <img src="https://raw.githubusercontent.com/TheRayos/Assets/master/Images/Cover.png" alt="rayo.js" />
</p>


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

const age = (req, res, next) => {
  req.age = `Your age is ${req.params.age}`;
  next();
};

const name = (req, res, next) => {
  req.name = `Your name is ${req.params.user}`;
  next();
};

rayo({ port: 5050 })
  .through(age, name)
  .get('/hello/:user/:age', (req, res) => {
    res.end(
      JSON.stringify({
        age: req.age,
        name: req.name
      })
    );
  })
  .start();
```



## How does it compare?

Here are some of the top contenders. Please note that these results are only meant as raw performance indicators. Your application's logic, which is what makes most applications slow, may not see great performance gains from using one framework or another.

#### Node V.8.11.1
 &nbsp;         | Rayo  | Polka   | Fastify | Express
--------------- | ----- | ------- | ------- | -------
Requests (rqs)  | 33304 | 32068.8 | 31449.6 | 19493.6
Latency (ms)    | 2.93  | 3.04    | 3.1     | 5.02
Throughput (Mb) | 3.712 | 3.5875  | 4.925   | 3.0625

#### Node V.10.1.0
 &nbsp;         | Rayo    | Polka   | Fastify | Express
--------------- | ------- | ------- | ------- | -------
Requests (rqs)  | 39465.6 | 38454.4 | 38166.4 | 26075.2
Latency (ms)    | 2.46    | 2.53    | 2.55    | 3.74
Throughput (Mb) | 4.4375  | 4.2625  | 5.975   | 4.0625


## Contribute
```
fork https://github.com/TheRayos/rayo.js
```


## License

[MIT](https://github.com/TheRayos/rayo.js/blob/master/LICENSE)

