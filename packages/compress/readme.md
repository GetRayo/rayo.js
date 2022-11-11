<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_compress.png" alt="@rayo/compress" />
</div>

## Install

```
$> npm i @rayo/compress
```


## Use

```js
import rayo from 'rayo';
import compress from '@rayo/compress';

rayo({ port: 5050 })
  .through(compress())
  .get('/hello/:user', (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      message: `Hello ${req.params.user}.
      I am compressed!`
    }));
  })
  .start();
```

**Note:** You need to set the right header, e.g. _application/json_ for `compress` to be able to determine whether the payload can be compressed or not. Also keep in mind that not all types of content can be compressed.


## API

#### compress(options = {})
```
@param   {object} [options]
@returns {function}
```

An object with key/value pairs as documented [here](https://nodejs.org/dist/latest-v8.x/docs/api/zlib.html#zlib_class_options).


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
