<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![NSP Status](https://nodesecurity.io/orgs/rayo/projects/b16aa9a6-c080-44e1-9c91-77609aa498be/badge)](https://nodesecurity.io/orgs/rayo/projects/b16aa9a6-c080-44e1-9c91-77609aa498be)
[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GetRayo/rayo.js&amp;utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Coverage Status](https://coveralls.io/repos/github/GetRayo/rayo.js/badge.svg?branch=master)](https://coveralls.io/github/GetRayo/rayo.js?branch=master)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)
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
  .through(compress)
  .get('/hello/:user', (req, res) => res.send(`Hello ${req.params.user}`))
  .start();
```


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
