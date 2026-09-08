<div align="center">
  <img src="https://raw.githubusercontent.com/GetRayo/Assets/master/Images/Cover.png" alt="Rayo" />
</div>

## Run

Requires Node.js 24 or newer.

From the repository root, install workspace dependencies with `npm install`, then:

```sh
# Compare single-process servers with identical parameter-route responses.
npm run bench --workspace @rayo/benchmarks

# Inspect the Rayo matrix, then select the workloads you need.
npm run bench --workspace @rayo/benchmarks -- --suite rayo --list
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case routes/param --output routes.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case response --output responses.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case stream/gzip

# Alternate baseline and candidate for each workload and round.
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case query --baseline /path/to/baseline --output paired-query.json

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
| `--baseline` | none | Baseline repository checkout for paired Rayo, single-process comparison |
| `--candidate` | harness checkout | Candidate repository checkout; requires `--baseline` |

The load generator uses one process. `-w` now controls **server** workers; older versions used it for load-generator workers.
Servers bind ephemeral loopback ports, so the old `-u` fixed-target option is no longer supported.

## Workloads

The comparison suite uses a single parameter route and an identical plain response sent through Node's `res.end()`.
It measures routing and framework dispatch overhead, without framework-specific serialization options.
Fastify uses `reply.raw.end()` for this reason. This deliberately small test does not represent an application.

The Rayo suite covers:

- Static, parameter and wildcard routes plus misses, with 1, 100 and 1,000 registered routes. Hits target the last registered route. Misses expect HTTP 404.
- Mixed request sequences visit early, middle and late registrations among 1, 100 and 1,000 static/parameter/wildcard routes, plus a miss. The 1-route case contains a static hit and a miss. Separate `routes/overlap` cases contain 1, 100 or 1,000 **groups of three routes** (parameter, static, wildcard) to exercise registration precedence and deeper wildcard hits. Every expected response identifies the winning handler.
- Global middleware depths of 0, 5 and 20, with the response checking how many handlers actually ran.
- Raw text, automatic text detection, explicit `res.text()`, automatic object serialization, explicit `res.json()`, `res.jsonString()`, and serialized JSON with an existing content type.
- Absent, ordinary, encoded and long query strings; the long case decodes 80 named fields.
- Installed compression middleware skipped for missing Accept-Encoding, a HEAD request, or a response below the compression threshold. `stream/identity` remains the control with no compression middleware installed.
- Streaming a 33,600-byte payload in 512-byte or 16-KiB chunks, with identity, gzip or Brotli encoding at package defaults. The producer uses stream backpressure.

The full matrix has 41 cases and takes roughly fifteen minutes with default timing; paired comparisons take about twice as long. Prefer a `--case` filter when investigating a particular change.
New explicit response APIs require a version of `@rayo/send` that implements them.
The HEAD load fixture uses an empty representation (`Content-Length: 0`): Autocannon's parser does not correctly skip a HEAD body when its declared length is nonzero. Native HTTP correctness tests cover that case separately.

Use `--baseline /path/to/checkout` for a paired comparison, optionally with `--candidate /path/to/checkout`.
Both directories need the repository's `packages/{rayo,send,compress,storm}` layout and resolvable dependencies.
The same harness and workload definitions serve both variants. For each workload, each round measures both variants consecutively, reversing baseline/candidate order every other round. The workload order also alternates. Choose cases supported by both revisions.

Paired JSON records configuration, workload definitions, checkout paths, Git commits and tracked changes (where available), SHA-256 hashes of each checkout's package sources, and all raw runs. Per-pair percentage changes are computed as `(candidate / baseline - 1) * 100`; the summary reports their median and observed minimum/maximum. A positive throughput change is faster; a negative latency change is lower latency. Ranges describe these samples, not statistical confidence intervals. A zero baseline metric yields `null` for its percentage change. Completed runs are saved even if a later measurement fails.

For a single selective override, `--rayo-path /absolute/path/to/packages/rayo/index.js`, `--send-path` and `--compress-path` remain available; they cannot be combined with paired checkout flags. Overrides select those entry points only: their dependencies resolve from the selected checkout as usual. Single-process pairing avoids ambiguities from transitive Storm resolution across checkouts.

## Measurement and validation

Each case starts a fresh child server. Measurement waits for an IPC readiness message after listening; cluster readiness waits for every configured worker.
A seeded Fisher-Yates shuffle determines the first round, and subsequent rounds alternate forward and reverse order.
Each run performs response probes, an optional warmup and a measured interval. Servers and their worker process groups are stopped on success or failure.

Transport errors, timeouts, unexpected HTTP statuses and wrong bodies invalidate a run; no successful ranking is printed for a failed run.
Every uncompressed load-test response is checked against its specific request's expected status and body, including pipelined mixed hit/miss sequences. Each expected status must appear at least once. HEAD probes and loads use HEAD and expect an empty body. Compressed responses are decompressed and validated in separate probes before and after the load intervals; their timed responses are checked for transport errors and status codes.
This avoids interpreting compressed bytes as UTF-8 in Autocannon's body hook. Validation and latency instrumentation add load-generator overhead consistently across cases.

The table reports medians across independent runs. Latency p50/p95/p99 are measured from individual completed requests with a microsecond HDR histogram; the table shows the median of each run's percentile, **not** a pooled percentile.
The JSON file also records each run's throughput, request count, exact status counts, errors, elapsed duration and heap usage, alongside actual installed package versions, Node version, CPU model, platform and settings.
Versions are read from resolved packages, including workspace packages and explicit entry-point overrides; they are not dependency version ranges.

CPU usage is measured in the server processes over the load interval, with 100% representing one fully occupied core. It excludes the load generator.
RSS is sampled every 50 ms while measuring. For cluster runs, CPU and heap are summed across the primary and workers; RSS is the sum of their individual observed peaks, not a simultaneous peak or unique physical memory measurement.

Run on an otherwise idle machine. Increase durations and repeats for decisions, compare the spread in JSON results, and use realistic application work before generalizing a microbenchmark gain.
A single local load process can become the bottleneck, especially for clustering; these results do not establish maximum cluster capacity.

## Historical dependency measurements

The one-off driver used to measure the `matchit` and `parseurl` replacements was removed after that work. Its source and invocation details remain in commit `9397437`. The [dependency performance report](../../docs/dependency-performance-2026-09-08.md) preserves the historical results, raw JSON and measurement method. The HTTP workloads and paired checkout comparisons above remain available for ongoing performance work.

## License

[MIT](https://github.com/GetRayo/rayo.js/blob/master/LICENSE)
