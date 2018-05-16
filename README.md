<p align="center">
  <img src="https://raw.githubusercontent.com/RayoJS/Assets/master/Images/Cover.png" alt="RayoJS" />
</p>


## Install

[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)

```
$> npm i rayo
```

## Use

```js
const rayo = require('rayo');

rayo
  .get('/hello/:user', (req, res) => res.end(`Hello ${req.params.user}`))
  .start({ port: 5050 });
```


## Contribute
```
fork https://github.com/RayoJS/Rayo/
```


## License

[MIT](https://github.com/RayoJS/Rayo/blob/master/LICENSE)

