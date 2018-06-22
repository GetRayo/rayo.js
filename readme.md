<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" /><br />

[![Codacy](https://api.codacy.com/project/badge/Grade/d392c578eaaa4860823b8e4f9dadda63)](https://www.codacy.com/app/aichholzer/rayo.js?utm_source=github.com&utm_medium=referral&utm_content=GetRayo/rayo.js&utm_campaign=Badge_Grade)
[![CodeFactor](https://www.codefactor.io/repository/github/getrayo/rayo.js/badge)](https://www.codefactor.io/repository/github/getrayo/rayo.js)
[![Coverage Status](https://coveralls.io/repos/github/GetRayo/rayo.js/badge.svg?branch=master)](https://coveralls.io/github/GetRayo/rayo.js?branch=master)
[![Build status](https://travis-ci.org/GetRayo/rayo.js.svg?branch=master)](https://travis-ci.org/GetRayo/rayo.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/GetRayo/rayo.js.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/GetRayo/rayo.js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/GetRayo/rayo.js?targetFile=package.json)

</div>

Este es un **framework** para la web **moderna**; pequeño, sagaz, elegante y rápido. Construimos 'Rayo' luego de pasar muchísimo tiempo pensando en cómo solucionar los problemas a los que nos enfrentamos con otros frameworks. Necesitábamos algo que "pudiese ser" un reemplazo creativo a aquello sobre lo cual, la mayoría de nuestros sistemas eran construidos, sin sacrificar productividad ni performance.  <br />

```
Tu servidor sentirá que fue golpeado por un rayo...
```

## En resumidas cuentas

- Realmente rápido (En serio, en serio muy rápido. Dirígete a [cómo se compara](#cómo-se-compara)) para saber más,
- API similar a 'express'¹,
- Compatible con el middleware 'express' ,
- Extensible y conectable,
- < 85 LOC (sin ruteo en lo absoluto)

> ¹ `Rayo` no tiene la intención de ser un reemplazo de express, la API es similar, inspirada en, pero no idéntica.

```
Se incluyen ejemplos 🔎 a lo largo de la lectura.
```

## Instalar

```
$> npm i rayo
```

## Usar

```js
const rayo = require('rayo');

rayo({ port: 5050 })
  .get('/hello/:user', (req, res) => res.end(`Hello ${req.params.user}`))
  .start();
```

<details>
<summary>🔎 (Con multiples manejadores(handlers))</summary>

```js
const rayo = require('rayo');

// "age" handler
const age = (req, res, step) => {
  req.age = 21;
  step();
};

// "name" handler
const name = (req, res, step) => {
  req.name = `Super ${req.params.user}`;
  step();
};

rayo({ port: 5050 })
  .get('/hello/:user', age, name, (req, res) => {
    res.end(
      JSON.stringify({
        age: req.age,
        name: req.name
      })
    );
  })
  .start();
```

</details>

#### Nota sobre los Handlers

Las funciones `Handlers` aceptan un [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) (a su vez denominados `req`), un [ServerResponse](https://nodejs.org/dist/latest-v9.x/docs/api/http.html#http_class_http_serverresponse) (denominados `res`) y una función `step through` (denominados `step`). `step()` es opcional, sería  usado para mover la lógica de ejecución del programa al siguiente Handler de la pila.

`step()` también puede ser utilizado para retornar un error en cualquier momento. Ver [manejo de errores](#manejo-de-errores).

> **Nota:** Se generará un error si `step()` es llamada desde una pila vacía.


Cada `handler` expone el objeto ServerResponse(`res`) nativo de Node y es tu responsabilidad manejarlo adecuadamente; Ej: terminar la respuesta (`res.end()`) donde es debido.  

Si lo que necesitas es una manera más fácil y conveniente para trabajar con tus respuestas (responses), echale un vistazo a [@rayo/send](https://github.com/GetRayo/rayo.js/tree/master/packages/plugins/send).

#### Firma de un Handler 

```js
/**
 * @param {object}   req
 * @param {object}   res
 * @param {function} [step]
 */
const fn = (req, res, step) => {
  // Tu lógica.
};
```

#### Manejo de Errores

```
Por favor, ten presente que:
"Tu código, Tus errores."¹
- Es tu responsabilidad tratar con ellos adecuadamente.
```

> ² `Rayo` está en estado WIP (Work in Progress - En desarrollo)  , por lo tanto es posible que encuentres errores reales con los que deberás lidiar para resolver. De ser asi, por favor haznoslo saber y apuntalos mediante una `pull request`. 👍

Si estás implementando tu propia función error (Ver `onError` debajo de [optiones](#opcionesRayo--)) deberías invocarla, en cualquier momento, llamando a la función `step()` con un argumento.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

const options = {
  port: 5050,
  onError: (error, req, res) => {
    res.end(`Here's your error: ${error}`);
  }
};

rayo(options)
  .get('/', (req, res, step) => step('Thunderstruck!'))
  .start();
```

</details><p></p>

En el ejemplo anterior, el error será retornado en la ruta `/`, dado que `step()` es llamada con un argumento. Ejecuta el ejemplo, abre tu explorador y ve a [http://localhost:5050](http://localhost:5050) y verás lo siguiente: "Here's your error: Thunderstruck!".

Si no tienes una función de error, de igual manera deberás llamar a la función `step()` (con un argumento), que usará función de error propia de Rayo.

## API

#### rayo(options = {})

```
@param   {object} [options]
@returns {Rayo}
```

- `options.port` _{number}_
  _ Escucha en el puerto indicado posibles conexiones.
  _ Si se omite el puerto o es 0 (cero), el sistema operativo asignará un puerto, libre, arbitrariamente.

- `options.host` _{string}_
  _ Escucha el host esperando conexiones entrantes.
  _ Si se omite el host, el servidor aceptará conecciones sobre la dirección ip sin especificar (::) cuando IPv6 esté disponible, o sobre la dirección IPv4 sin especificar (0.0.0.0) en todo caso.

- `options.server` _{http.Server}_
  _ Una instancia [http.Server](https://nodejs.org/api/http.html#http_class_http_server). `Rayo` se adjunta a este.
  _ `Default:` Una nueva instancia [http.Server](https://nodejs.org/api/http.html#http_class_http_server).

- `options.notFound` _{function}_

  > Invocada cuando campos indefinidos son requeridos.

  ```js
  /**
   * @param {object} req
   * @param {object} res
   */
  const fn = (req, res) => {
    // Your logic.
  };
  ```

  `Default:` Rayo finalizara la respuesta con un mensaje de "Page not found." y un código de estado `404`.

- `options.onError` _{function}_

  > Invocada cuando `step()` es llamada con un argumento.

  ```js
  /**
   * @param {*}        error
   * @param {object}   req
   * @param {object}   res
   * @param {function} [step]
   */
  const fn = (error, req, res, step) => {
    // Tu logica.
  };
  ```

#### .verb(path, ...handlers)

```
@param   {string}   path
@param   {function} handlers - Cualquier número, separados por coma.
@returns {rayo}
```

> `Rayo` expone todos los verbos HTTP como métodos de instancia.

> Peticiones que se correspondan con el verbo propuesto y la ruta, serán redireccionadas a través de handlers específicos.


Este método es basicamente un alias del metodo [`.route`](#routeverb-path-handlers), con la diferencia de que el `verbo` es definido nombre del método en sí mismo.


<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

/**
 * Asigna una ruta ('/') en los verbos HTTP especificados.
 */
rayo({ port: 5050 })
  .get('/', (req, res) => res.end('Thunderstruck, GET'))
  .head('/', (req, res) => res.end('Thunderstruck, HEAD'))
  .start();
```

</details>

#### .all(path, ...handlers)

```
@param   {string}   path
@param   {function} handlers - Cualquier número, separados por coma.
@returns {rayo}
```

> Peticiones que se correspondan con algún verbo y la ruta especificada, serán redireccionadas a través de handlers específicos. 

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

/**
* Asigna una ruta ('/') en todos los verbos HTTP especificados.
 */
rayo({ port: 5050 })
  .all('/', (req, res) => res.end('Thunderstruck, all verbs.'))
  .start();
```

</details>

#### .through(...handlers)

```
@param   {function} handlers - Cualquier número, separados por coma.
@returns {rayo}
```

> Todas las peticiones, cualquier verbo y cualquier ruta, serán redireccionadas a través de los handlers específicos.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

// "age" handler
const age = (req, res, step) => {
  req.age = 21;
  step();
};

// "name" handler
const name = (req, res, step) => {
  req.name = 'Rayo';
  step();
};

rayo({ port: 5050 })
  .through(age, name)
  .get('/', (req, res) => res.end(`${req.age} | ${req.name}`))
  .start();
```

</details>

#### .route(verb, path, ...handlers)

```
@param   {string}   verb
@param   {string}   path
@param   {function} handlers - Cualquier número, separados por coma.
@returns {rayo}
```

> Las peticiones que se correspondan con el verbo provisto y la ruta, serán redireccionadas a través de los handlers específicos. 

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

rayo({ port: 5050 })
  .route('GET', '/', (req, res) => res.end('Thunderstruck, GET'))
  .start();
```

</details>

#### .bridge(path)

```
@param   {string} path - La ruta URL a la cual los verbos deben ser mapeados.
@returns {bridge}
```

> Redirecciona una ruta Route one path through multiple verbs and handlers.

Una instancia `bridge` expone todos los métodos de redireccionamiento de Rayo ([.through](#throughhandlers), [.route](#routeverb-path-handlers), [.verb](#verbpath-handlers) y [.all](#allpath-handlers)). Tu crearas cualquier número de `bridges` y Rayo automágicamente se ocupará de mapearlos. 

Lo que hace de los `bridges` algo realmente genial es el hecho que permiten un control muy granular sobre lo que tu aplicación expone. Por ejemplo, habilitar [content compression](https://github.com/GetRayo/rayo.js/tree/master/packages/plugins/compress) solo en ciertas rutas.


<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

const server = rayo({ port: 5050 });

/**
 * ‘Bridge’ (puentea) la ruta `/home` a los verbos `GET` y `HEAD`.
 */
server
  .bridge('/home')
  .get((req, res) => res.end('You are home, GET'))
  .head((req, res) => res.end('You are home, HEAD'));

/**
 * ‘Bridge’ (puentea) la ruta `/game` a los verbos `POST` y `PUT`.
 */
server
  .bridge('/game')
  .post((req, res) => res.end('You are at the game, POST'))
  .put((req, res) => res.end('You are at the game, PUT'));

const auth = (req, res, step) => {
  req.isAuthenticated = true;
  step();
};

const session = (req, res, step) => {
  req.hasSession = true;
  step();
};

/**
 * ‘Bridge’ (puentea) la ruta `/account` a los verbos `GET`, `POST`  y `PUT`.
 * y a través de dos handlers.
 */
server
  .bridge('/account')
  .through(auth, session)
  .get((req, res) => res.end('You are at the account, GET'))
  .post((req, res) => res.end('You are at the account, POST'))
  .put((req, res) => res.end('You are at the account, PUT'));

server.start();
```

</details>

#### .start(callback)

```
@param   {function} [callback] -  Invocada en el evento `listening` del servidor.
@returns {http.Server}
```

> Inicia `Rayo` -Tu servidor ahora está escuchando peticiones entrantes.

> `Rayo` retornará la dirección del server con el callback (devolución de llamada), si fue provisto de una. Muy útil, por ejemplo, para obtener el puerto del servidor en caso que no se haya especificado un puerto en las opciones.

<details>
<summary>🔎</summary>

```js
const rayo = require('rayo');

rayo({ port: 5050 });
  .get((req, res) => res.end('Thunderstruck'))
  .start((address) => {
    console.log(`Rayo is up on port ${address.port}`);
  });
```

</details>

## Cómo se compara?

Aquí hay algunos de los mejores contendientes. Por favor tengan en cuenta que estos resultados significan sólo indicadores puros de performance. La lógica de tu aplicación, que es lo que hace lenta a la mayoría de aplicaciones, no verá un gran incremento de performance usando un framework sobre otro.<br />

> Todos los test fueron corridos en un servidor optimizado en CPU (DigitalOcean, 32 GB RAM, 16 vCPUs, Ubuntu 16.04.4 x64).

<details>
<summary>🔎 -Node V.8.11.3</summary>

| &nbsp;  | Version | Router | Peticiones/s | Latencia | Throughput/Mb |
| ------- | ------: | :----: | ---------: | ------: | ------------: |
| Polka   |   0.4.0 |   ✔    |      62410 |    1.52 |          7.28 |
| Rayo    |   1.0.4 |   ✔    |    62174.4 |    1.54 |          7.08 |
| Fastify |   1.6.0 |   ✔    |      56784 |    1.69 |          8.75 |
| Express |  4.16.3 |   ✔    |    50665.6 |     1.9 |          5.88 |

</details>
<p></p>

<details>
<summary>🔎 -Node V.10.4.1</summary>

| &nbsp;  | Version | Router | Peticiones/s | Latencia | Throughput/Mb |
| ------- | ------: | :----: | ---------: | ------: | ------------: |
| Rayo    |   1.0.4 |   ✔    |    71612.8 |    1.33 |          8.28 |
| Polka   |   0.4.0 |   ✔    |    71094.4 |    1.33 |          8.18 |
| Fastify |   1.6.0 |   ✔    |    67740.8 |     1.4 |         10.55 |
| Express |  4.16.3 |   ✔    |    62108.8 |    1.53 |          7.17 |

</details>
<p></p>

Correlos en tu propio hardware; Clona este repositorio; Instala las dependencias y corre npm run bench`. Opcional: podrias definir los parámetros de los test:

```
$> npm run bench -- -u http://localhost:5050 -c 1000 -p 25 -d 10
```

- `-u` (_url_) -Por defecto a `http://localhost:5050`
- `-c` (_connections_) -Por defecto en `100`
- `-p` (_pipelines_) -Por defecto en `10`
- `-d` (_duration_) -Por defecto en `10` (seconds)
- `-o` (_only_) Corre solo un benchmark en particular. -Por defecto en `null`

> Por favor tener en cuenta que estos resultados ~~pueden~~ variarán en diferentes configuraciones de hardware.

## Ejemplos

Podrán encontrarlos [aqui](https://github.com/GetRayo/rayo.js/tree/master/docs/examples).

## Contribuye

Mirá nuestras notas sobre [contribuciones](CONTRIBUTING.md) notes.

## Agradecimientos

:clap: `Gracias` a [todos](https://github.com/nodejs/node/graphs/contributors) quienes hicieron Nodejs posible y a todos los miembros de la comunidad que activamente contribuyen a este.<br />
:steam_locomotive: La mayor parte de `Rayo` fue escrita en tramos de 90 minutos por dia y durante el viaje en tren, mientras viajaba al trabajo.

## Licencia

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)

<p align="center" style="margin:25px 0 10px">
  :zap:
</p>



