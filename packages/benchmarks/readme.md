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

> These tests were conducted on a CPU-optimized server (DigitalOcean, 32 GB RAM, 16 vCPUs, Debian 11 x64) and Node.js v16.11.0.
> Measured after one warm-up run.

| &nbsp;     | Version | Router | Requests/s | Latency | Throughput/Mb |
| ---------- | ------: | :----: |-----------:|--------:|--------------:|
| Rayo/Storm |  1.3.1  |   ✔    |   116213.2 |    0.79 |         13.23 |
| Fastify    |  3.24.2 |   ✔    |    79097.6 |    12.1 |         13.96 |
| Rayo       |  1.3.9  |   ✔    |    76435.2 |    12.5 |         10.50 |
| Polka      |  0.5.2  |   ✔    |    74665.6 |    12.8 |         10.26 |
| Express    |  4.16.4 |   ✔    |    17874.4 |    55.2 |          2.45 |

> `Rayo/Storm` relies on the cluster feature which spawn a server process on each available CPU core, thus it yields better results.

Run on your own hardware; clone this repository, install the dependencies and run `npm run bench`. Optionally, you may also define your test's parameters:

```
$> rayobench -- -u http://localhost:5050 -c 1000 -p 25 -d 10
```

- `-u` (_url_) -Defaults to `http://localhost:5050`
- `-c` (_connections_) -Defaults to `100`
- `-p` (_pipelines_) -Defaults to `10`
- `-d` (_duration_) -Defaults to `10` (seconds)
- `-o` (_only_) Run only one particular benchmark. -Defaults to `null`

> Results ~~may~~ will vary on different hardware.


## Missing a framework?

Just submit a PR with whatever framework you consider is worthy of being ranked here.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
