<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_compress.png" alt="@rayo/compress" />
</div>

## Install

```
$> npm i @rayo/compress
```

Both `Gzip` and `Brotli` are supported, and the algorithm will be determined by the `accept-encoding` request header.<br />
With multiple values/options (e.g. "gzip, deflate, br"), `Gzip` will be preferred.

## Use

> `@rayo/compress` is also compatible with `Express` and many other frameworks.

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

> **Note:** You need to set the right response header, e.g. _application/json_ for `@rayo/compress` to be able to determine whether the payload can be compressed or not. Also keep in mind that not all types of content can be compressed.

`@rayo/compress` supports compression on these MIME types:

* text/plain
* text/csv
* text/html
* text/xml
* text/javascript
* application/json
* application/xml


## API

#### compress(options = {})
```
@param   {object} [options]
@returns {function}
```

 * `options.preferBrotli` (boolean, optional): Prefer `Brotli` if the `accept-encoding` request header has multiple values/options.<br />
   Keep in mind that `Brotli` has more performance overhead than `Gzip`.<br />
   Default: `false`.


 * `options.threshold` (number, optional): The minimum threshold (in bytes) for compressing responses.<br />
   Default: `1024`.


 * `options.level` (number, optional): The compression level to use.<br />
   Range (gzip): `1 to 9`.<br />
   Range (brotli): `1 to 11`.<br />
   A higher level will result in better compression, but will take longer to complete. A lower level will result in less compression, but will be much faster.<br />
   Default: `6`.


 * `options.chunkSize` (number, optional): Brake large responses into chunks of this size (in kilobytes). While this setting can have an impact on speed, compression is affected most dramatically by the level setting.<br />
   Default: `16`.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
