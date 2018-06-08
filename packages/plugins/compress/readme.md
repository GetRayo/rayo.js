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
$> npm i @rayo/compress
```


## Use

```js
const rayo = require('rayo');
const compress = require('@rayo/compress');

rayo({ port: 5050 })
  .through(compress())
  .get('/hello/:user', (req, res) => res.send({
    message: `Hello ${req.params.user}. I am compressed!`
  }))
  .start();
```


## API

#### compress(options = {})
```
@param   {object} [options]
@returns {function}
```

An object with key/value pairs as documented [here](https://nodejs.org/dist/latest-v8.x/docs/api/zlib.html#zlib_class_options).


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
