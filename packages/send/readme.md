<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_send.png" alt="@rayo/send" />
</div>

## Install

Requires Node.js 24 or newer.

```
$> npm i @rayo/send
```


## Use

```js
import rayo from 'rayo';
import send from '@rayo/send';

rayo({ port: 5050 })
  .through(send())
  .get('/hello/:user', (req, res) => {
    res.send({
      message: `Hello ${req.params.user}. I was sent with headers!`
    });
  })
  .start();
```

`send()` attaches `send`, `text`, `json`, and `jsonString` methods to Node's `ServerResponse` (`res`). Call the new helpers as response methods, for example `res.text('Hello')`; they use the response as `this`. The original `res.send` remains bound to its response and can also be passed as a callback or extracted into a variable.

`res.send()` will try to guess the _content-type_ based on the payload and send the appropriate headers. It will also send a status code and end the response.

For known response formats, use an explicit helper to avoid content detection:

```js
res.text('Hello');                       // Plain text, no JSON parsing
res.json({ message: 'Hello' });          // Serialize once
res.json('Hello');                       // JSON string: "Hello"
res.jsonString('{"message":"Hello"}');   // Already serialized; no parsing
```

`jsonString` trusts the caller to supply valid JSON. All helpers preserve an existing `Content-Type`, calculate `Content-Length` in bytes, add `X-Powered-By`, and end the response. Each accepts optional `statusCode` (default `200`) and `statusText` (the HTTP reason phrase) arguments.

`res.send(string)` skips detection when `Content-Type` is already set. Otherwise it detects valid JSON strings (including JSON primitives), serializes objects, sends Buffers unchanged as `application/octet-stream`, and converts other primitives to text. `send()` and `text()` send an empty body for `null` or `undefined`. `json(null)` sends `null`; `json(undefined)` sends an empty body, following `JSON.stringify` semantics.

```js
res.setHeader('Content-Type', 'application/json');
res.send(alreadySerializedJSON); // No parse-and-discard work
res.text('Order not found', 404);
```

### TypeScript

Declarations are included. With Rayo, specify `SendResponse` for handlers that run after this middleware:

```ts
import rayo, { type Request } from 'rayo';
import send, { type SendResponse } from '@rayo/send';

rayo<Request, SendResponse>()
  .through(send())
  .get('/hello', (req, res) => res.json({ message: 'Hello' }));
```

On plain Node responses the helpers are optional in the types, since they exist only after the middleware runs.


## API

#### send()

Currently, it does not take any arguments.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
