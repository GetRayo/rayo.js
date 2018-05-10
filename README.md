<p align="center">
  <img src="https://raw.githubusercontent.com/RayoJS/Assets/master/Images/Cover.png" alt="RayoJS" />
</p>


## Install

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

