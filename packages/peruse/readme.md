<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_peruse.png" alt="@rayo/peruse" />
</div>

## Install

```
$> npm i @rayo/peruse
```


## Use

```js
const rayo = require('rayo');
const peruse = require('@rayo/peruse');

rayo({ port: 5050 })
  .through(peruse({ json: true }))
  .post('/hello/:user', (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.body));
  })
  .start();
```


## API

#### peruse(options = {})
```
@param   {object} [options]
@returns {function}
```

An object with key/value pairs as documented [here](https://nodejs.org/dist/latest-v8.x/docs/api/zlib.html#zlib_class_options).


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
