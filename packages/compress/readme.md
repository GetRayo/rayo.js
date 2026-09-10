<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_compress.png" alt="@rayo/compress" />
</div>

## Install

Requires Node.js 24 or newer.

```
$> npm i @rayo/compress
```

Both `Gzip` and `Brotli` are supported, and the algorithm will be determined by the `accept-encoding` request header.<br />
With equal client quality values (e.g. "gzip, deflate, br"), `Gzip` will be preferred.

## Use

> `@rayo/compress` is also compatible with `Express` and many other frameworks.

```js
import rayo from 'rayo';
import compress from '@rayo/compress';

rayo({ port: 5050 })
  .through(compress({ threshold: 0 }))
  .get('/hello/:user', (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      message: `Hello ${req.params.user}.
      I am compressed!`
    }));
  })
  .start();
```

The example uses `threshold: 0` so this short response can be compressed when the client accepts gzip or Brotli.

> **Note:** Set the response's `Content-Type`, e.g. _application/json_, to match the payload. If omitted, `@rayo/compress` treats the payload as _text/plain_ when deciding whether to compress; it does not set `Content-Type`. Also keep in mind that not all types of content can be compressed.

`@rayo/compress` supports compression on these MIME types:

* text/plain
* text/css
* text/csv
* text/html
* text/xml
* text/javascript
* application/json
* application/xml
* application/javascript
* application types ending in `+json` or `+xml`


## API

#### compress(options = {})
```
@param   {object} [options]
@returns {function}
```

 * `options.preferBrotli` (boolean, optional): Prefer `Brotli` when the client gives gzip and Brotli equal quality values.<br />
   Keep in mind that `Brotli` has more performance overhead than `Gzip`.<br />
   Default: `false`.


 * `options.threshold` (number, optional): The minimum known response size (in bytes) for compression; unknown-length streams compress immediately.<br />
   Default: `1024`.


 * `options.level` (number, optional): The compression level to use.<br />
   Range (gzip): `1 to 9`.<br />
   Range (brotli): `1 to 11`.<br />
   A higher level will result in better compression, but will take longer to complete. A lower level will result in less compression, but will be much faster.<br />
   Default: `6`.


 * `options.chunkSize` (number, optional): Break compressed output into chunks of this size (in kibibytes). While this setting can have an impact on speed, compression is affected most dramatically by the level setting.<br />
   Default: `16`.



## Streaming and response handling

Compression is selected once, before the first body bytes or an explicit `writeHead()` / `flushHeaders()`:

* If `Content-Length` is set, its byte count determines whether the response meets `threshold`.
* For a single `res.end(body)`, the encoded byte length of `body` determines the threshold.
* For streams without a known length, compression starts immediately, including when the first chunk is small.
  The middleware does not buffer the response to discover its eventual size. Set `Content-Length` before writing
  when you want a short stream to remain uncompressed.

The middleware supports standard `res.write()` backpressure: when it returns `false`, wait for `res` to emit
`drain` before writing again. Compressed output also pauses when the response socket is full. `res.end()` returns
`res`, and its callback runs after the response finishes, or receives an error if the response fails or disconnects.
Compression resources are released when the response finishes or closes. Install the middleware before headers are sent.

The client's `Accept-Encoding` quality values are respected. A coding with `q=0` is never selected, explicit
`identity` preferences are honored, and `preferBrotli` breaks ties between equally preferred gzip and Brotli.
Eligible responses include `Vary: Accept-Encoding`, including when the client receives an uncompressed response.
This middleware falls back to an uncompressed response when neither supported coding is acceptable; applications
that require strict rejection of requests forbidding every available representation should handle that negotiation themselves.

HEAD requests, bodyless statuses (204, 205, 304), responses already carrying `Content-Encoding`, partial responses
with `Content-Range`, and responses with `Cache-Control: no-transform` are left uncompressed.

## TypeScript

Type declarations ship with the package and work with Node.js request/response types. Install `@types/node`
in a TypeScript application. The middleware also works with Rayo's extended request/response types:

```ts
import compress, { type CompressOptions } from '@rayo/compress';

const options: CompressOptions = { threshold: 2048, preferBrotli: true, level: 4 };
const middleware = compress(options);
```

## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
