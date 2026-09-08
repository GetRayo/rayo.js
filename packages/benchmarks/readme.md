<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" />
</div>

## Run

From the repository root, install workspace dependencies with `npm install`, then:

```sh
# Compare single-process servers with identical parameter-route responses.
npm run bench --workspace @rayo/benchmarks

# Inspect the Rayo matrix, then select the workloads you need.
npm run bench --workspace @rayo/benchmarks -- --suite rayo --list
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case routes/param --output routes.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case response --output responses.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case stream/gzip

# Cluster runs are separate and explicitly limit the number of server workers.
npm run bench --workspace @rayo/benchmarks -- --mode cluster --server-workers 2

# Quick validation, not a meaningful performance measurement.
npm run bench --workspace @rayo/benchmarks -- --only Rayo --warmup 0 -d 1 -r 1 -c 2
```

The package can also be installed with `npm install -g @rayo/benchmarks` and invoked as `rayobench`.
Run `rayobench --help` for every option. Arguments go directly after `rayobench`; the extra `--` above belongs to npm.

| Option | Default | Meaning |
| --- | --- | --- |
| `--suite` | `compare` | `compare` or the `rayo` workload matrix |
| `--mode` | `single` | `single` or `cluster`; never mixed in the same comparison |
| `-o`, `--only` | all in suite | Framework name, e.g. `Rayo` (`RayoStorm` for cluster mode) |
| `--case` | all in suite | Exact workload ID or slash-separated prefix |
| `-c`, `--connections` | 50 | Concurrent connections |
| `-p`, `--pipelining` | 1 | HTTP requests pipelined per connection |
| `-d`, `--duration` | 5 | Measured seconds per run |
| `--warmup` | 2 | Warmup seconds per run; zero disables |
| `-r`, `--repeats` | 3 | Independent runs per workload |
| `-w`, `--server-workers` | 2 | Storm workers; used only in cluster mode |
| `--seed` | 1 | Reproducible initial order |
| `--output` | none | JSON file containing metadata and all completed runs |
| `--list` | false | List matching cases without starting servers |

The load generator uses one process. `-w` now controls **server** workers; older versions used it for load-generator workers.
Servers bind ephemeral loopback ports, so the old `-u` fixed-target option is no longer supported.

## Workloads

The comparison suite uses a single parameter route and an identical plain response sent through Node's `res.end()`.
It measures routing and framework dispatch overhead, without framework-specific serialization options.
Fastify uses `reply.raw.end()` for this reason. This deliberately small test does not represent an application.

The Rayo suite covers:

- Static, parameter and wildcard routes plus misses, with 1, 100 and 1,000 registered routes. Hits target the last registered route. Misses expect HTTP 404.
- Global middleware depths of 0, 5 and 20, with the response checking how many handlers actually ran.
- Raw text, automatic text detection, explicit `res.text()`, automatic object serialization, explicit `res.json()`, `res.jsonString()`, and serialized JSON with an existing content type.
- Absent and present query strings, including repeated and encoded values.
- Streaming a 33,600-byte payload in 512-byte or 16-KiB chunks, with identity, gzip or Brotli encoding at package defaults. The producer uses stream backpressure.

The full matrix has 30 cases and takes roughly eleven minutes with default timing; prefer a `--case` filter when investigating a particular change.
New explicit response APIs require a version of `@rayo/send` that implements them.

To compare checkouts, use `--rayo-path /absolute/path/to/packages/rayo/index.js`,
`--send-path /absolute/path/to/packages/send/index.js` and/or
`--compress-path /absolute/path/to/packages/compress/index.js`.
Overrides select those entry points only: their dependencies resolve from the selected checkout as usual.
Choose cases supported by both revisions, keep workload settings identical, and alternate baseline/candidate runs.

## Measurement and validation

Each case starts a fresh child server. Measurement waits for an IPC readiness message after listening; cluster readiness waits for every configured worker.
A seeded Fisher-Yates shuffle determines the first round, and subsequent rounds alternate forward and reverse order.
Each run performs response probes, an optional warmup and a measured interval. Servers and their worker process groups are stopped on success or failure.

Transport errors, timeouts, unexpected HTTP statuses and wrong bodies invalidate a run; no successful ranking is printed for a failed run.
Every uncompressed load-test response is checked against the expected body. Compressed responses are decompressed and validated in separate probes before and after the load intervals; their timed responses are checked for transport errors and status codes.
This avoids interpreting compressed bytes as UTF-8 in Autocannon's body hook. Validation and latency instrumentation add load-generator overhead consistently across cases.

The table reports medians across independent runs. Latency p50/p95/p99 are measured from individual completed requests with a microsecond HDR histogram; the table shows the median of each run's percentile, **not** a pooled percentile.
The JSON file also records each run's throughput, request count, exact status counts, errors, elapsed duration and heap usage, alongside actual installed package versions, Node version, CPU model, platform and settings.
Versions are read from resolved packages, including workspace packages and explicit entry-point overrides; they are not dependency version ranges.

CPU usage is measured in the server processes over the load interval, with 100% representing one fully occupied core. It excludes the load generator.
RSS is sampled every 50 ms while measuring. For cluster runs, CPU and heap are summed across the primary and workers; RSS is the sum of their individual observed peaks, not a simultaneous peak or unique physical memory measurement.

Run on an otherwise idle machine. Increase durations and repeats for decisions, compare the spread in JSON results, and use realistic application work before generalizing a microbenchmark gain.
A single local load process can become the bottleneck, especially for clustering; these results do not establish maximum cluster capacity.

## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
