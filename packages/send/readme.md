<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover_send.png" alt="@rayo/send" />
</div>

## Install

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

`send` will attach itself to the [ServerResponse](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_class_http_serverresponse) (a.k.a `res`) and be callable as `res.send()`.

`res.send()` will try to guess the _content-type_ based on the payload and send the appropriate headers. It will also send a status code and end the response.

> **Note:** `res.send()` will incur a tiny performance hit due to the guess work and the headers being written with every response.


## API

#### send()

Currently, it does not take any arguments.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
