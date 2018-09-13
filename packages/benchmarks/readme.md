<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" />
</div>

## Install

```
$> npm i -g @rayo/benchmarks
```


## Run

```
$> rayobench
```


## How does it compare?

Please note that these results are only meant as raw performance indicators. Your application's logic, which is what makes most applications slow, may not see great performance gains between frameworks.

> These tests were conducted on a CPU-optimized server (DigitalOcean, 32 GB RAM, 16 vCPUs, Ubuntu 16.04.4 x64) and Node.js v10.5.0.
> Measured after one warm-up run.

| &nbsp;     | Version | Router | Requests/s | Latency | Throughput/Mb |
| ---------- | ------: | :----: | ---------: | ------: | ------------: |
| Rayo/Storm |   1.1.0 |   ✔    |     126176 |    0.69 |         14.65 |
| Rayo       |   1.2.3 |   ✔    |    76435.2 |    1.24 |          8.95 |
| Polka      |   0.4.0 |   ✔    |    75931.2 |    1.25 |          8.73 |
| Fastify    |  1.11.0 |   ✔    |    70675.2 |    1.34 |         10.95 |
| Express    |  4.16.3 |   ✔    |    64400.0 |    1.48 |          7.33 |

Run on your own hardware; clone this repository, install the dependencies and run `npm run bench`. Optionally, you may also define your test's parameters:

```
$> rayobench -- -u http://localhost:5050 -c 1000 -p 25 -d 10
```

- `-u` (_url_) -Defaults to `http://localhost:5050`
- `-c` (_connections_) -Defaults to `100`
- `-p` (_pipelines_) -Defaults to `10`
- `-d` (_duration_) -Defaults to `10` (seconds)
- `-o` (_only_) Run only one particular benchmark. -Defaults to `null`

> These results ~~may~~ will vary on different hardware.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
