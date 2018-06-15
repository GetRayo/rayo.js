<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GetRayo/rayo.js&amp;utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Coverage Status](https://coveralls.io/repos/github/GetRayo/rayo.js/badge.svg?branch=master)](https://coveralls.io/github/GetRayo/rayo.js?branch=master)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/GetRayo/rayo.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/GetRayo/rayo.js?targetFile=package.json)
</div>

## Install

```
$> npm i @rayo/send
```


## Use

```js
const rayo = require('rayo');
const send = require('@rayo/send');

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

> **Note:** `res.send()` will incur a performance hit due to the guess work and the headers being written with every response.


## API

#### send()

Currently, it does not take any arguments.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
