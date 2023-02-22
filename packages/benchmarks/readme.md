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

```
$> rayobench -- -u http://localhost:5050 -c 1000 -p 25 -d 10
```

- `-u` (_url_) -Defaults to `http://localhost:5050`
- `-c` (_connections_) -Defaults to `500`
- `-p` (_pipelines_) -Defaults to `10`
- `-d` (_duration_) -Defaults to `5` (seconds)
- `-o` (_only_) Run only one particular benchmark. -Defaults to `null`
- `-w` (_workers_) The number of workers to run the benchmarks. -Defaults to `cpu count`

> Results ~~may~~ will vary on different hardware.


## How does it compare?

Please note that these results are only meant as raw performance indicators. Your application's logic, which is what makes most applications slow, may not see great performance gains between frameworks.

> These tests were conducted on Mac Studio (M1 Ultra, 64 GB RAM, 20 CPU) and Node.js v16.18.1.<br />
> Measured after one warm-up run.

```
Tested with:

500 connections,
20 pipelines,
5 seconds,
20 CPU cores.

┌────────────┬─────────┬────────────┬────────────┬───────────┬──────────────┐
│            │ Version │ Reqs/sec ^ │ Reqs/sec * │ Latency * │ Throughput * │
├────────────┼─────────┼────────────┼────────────┼───────────┼──────────────┤
│ Storm      │ 1.3.0   │ 226325     │ 213081.6   │ 23.05     │ 29.46 Mb.    │
├────────────┼─────────┼────────────┼────────────┼───────────┼──────────────┤
│ Rayo       │ 1.4.0   │ 127765     │ 125267.2   │ 39.24     │ 17.32 Mb.    │
├────────────┼─────────┼────────────┼────────────┼───────────┼──────────────┤
│ Polka      │ 0.5.2   │ 126479     │ 122886.4   │ 38.22     │ 16.99 Mb.    │
├────────────┼─────────┼────────────┼────────────┼───────────┼──────────────┤
│ Fastify    │ 4.10.2  │ 122810     │ 121273.6   │ 40.6      │ 21.63 Mb.    │
├────────────┼─────────┼────────────┼────────────┼───────────┼──────────────┤
│ Express    │ 4.17.1  │ 37094      │ 36035.2    │ 135.91    │ 4.98 Mb.     │
└────────────┴─────────┴────────────┴────────────┴───────────┴──────────────┘
 * Average
```

> When `Rayo` is powered by `Storm`, it relies on Nodejs' `cluster` which will spawn a server process on each available CPU core, thus yielding better results.


## Missing a framework?

Just submit a PR with whatever framework you consider is worthy of being ranked here.


## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
