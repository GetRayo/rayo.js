# Performance changes and validation — 8 September 2026

This change implements the five findings from the performance review and adds published TypeScript declarations
for `rayo`, `@rayo/send`, `@rayo/compress`, and `@rayo/storm`.

1. **Response serialization:** `send()` avoids speculative JSON parsing for ordinary text and responses with an
   explicit content type. `text()`, `json()`, and `jsonString()` provide explicit paths. Response lengths use bytes,
   including UTF-8 and Buffer payloads. Existing automatic JSON detection and detached `send` callbacks are preserved.
2. **Route lookup:** a method/segment index replaces the full route scan. Request paths are split once; only the
   selected route's parameters are extracted. Matching retains matchit's registration precedence, raw parameters,
   suffixes, optional segments, wildcards, and trailing-slash behavior.
3. **Compression:** representation and threshold decisions happen before headers. Unknown-length streams compress
   immediately without collecting the body. Input and socket backpressure, negotiation, completion callbacks, and
   resource cleanup are handled together. Brotli receives a size hint when the response length is known.
4. **Middleware preparation:** global and route handlers are combined ahead of requests. Bridge middleware runs
   once; preparation is idempotent. New registrations invalidate the cache while in-flight requests keep their
   existing handler arrays. Prepared arrays must be treated as immutable by callers.
5. **Measurement and workers:** the benchmark suite now has 30 workloads, separate single-process and cluster modes,
   response validation, readiness signaling, repeated runs, latency percentiles, server CPU/RSS, and JSON output.
   Storm uses `os.availableParallelism()` for automatic worker counts and rejects invalid counts before forking.

Declarations cover middleware, options, routing and bridges, extended requests/responses, response helpers, and
Storm events. TypeScript consumers are checked using NodeNext and Bundler resolution. Runtime source remains JavaScript.

## Local measurements

The baseline was the local working tree saved immediately before implementation, including the existing local
changes; it was **not** a clean checkout of the remote branch. Both variants used the new harness and the same
installed dependencies. These measurements combine the changes rather than isolating each optimization.

Environment: Node v24.16.0, macOS arm64, Apple M1 Ultra. One server process and one load-generator process,
50 connections, pipelining 1. Each sample used a fresh server, one second of warmup and three measured seconds.
Each variant ran three times per case. Case order was seeded and reversed between rounds; baseline/candidate order
also alternated. All 36 runs passed response, status, timeout, and transport validation.

| Workload | Baseline req/s | Changed req/s | Change | Baseline p99 ms | Changed p99 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| One static route | 55,675 | 55,173 | -0.9% | 1.812 | 1.825 |
| Last static route of 1,000 | 37,232 | 54,693 | +46.9% | 2.595 | 1.867 |
| Last parameter route of 1,000 | 36,645 | 53,403 | +45.7% | 2.629 | 1.949 |
| Twenty global middleware callbacks | 53,776 | 54,075 | +0.6% | 1.879 | 1.868 |
| Plain text through `send()` | 33,733 | 51,504 | +52.7% | 2.831 | 1.980 |
| Serialized JSON with explicit content type | 45,125 | 48,443 | +7.4% | 2.269 | 2.121 |

All table values are medians; latency columns are medians of per-run percentiles. Route hits deliberately target
the last registration, so the large-table gains do not represent uniformly mixed application traffic.
The one-route and middleware results do not establish a throughput improvement. Serialized JSON varied substantially
(38,800–50,928 req/s for the changed code); its small-sample median should not be treated as a reliable general gain.

Median sampled peak RSS rose from about 86 MiB to 94–96 MiB in the 1,000-route cases, while the plain-text case
fell from about 102 MiB to 94 MiB. These process measurements include runtime and garbage-collection behavior;
they do not isolate the index's allocation cost. The index and prepared arrays trade registration-time work and
retained data for less request-time work.

These short local runs are indicative. The raw samples, errors, CPU/RSS values, settings, and source hashes are in
[performance-2026-09-08.json](./performance-2026-09-08.json). Compression was validated for correctness and stream
behavior; no compression throughput percentage is claimed from this comparison.

## Reproduce and extend

Run from the repository root, using longer intervals for application decisions:

```sh
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case routes/param --output routes.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case response --output responses.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case stream --output streams.json
```

Use `--rayo-path`, `--send-path`, and `--compress-path` with absolute entry-point paths to compare another checkout.
Choose cases supported by both revisions and alternate the variants. See the
[benchmark documentation](../packages/benchmarks/readme.md) for validation and measurement details.

Validation completed: `npm test` (lint, two TypeScript configurations, 181 runtime/harness tests), all 30 Rayo
workload smoke cases, four comparison-framework smoke cases, and a two-worker Storm smoke run.
Package dry runs after `npm run copies` include declarations, runtime dependencies, README files, and licenses
for all four packages, excluding the local backup files. CI is configured for Node 22 and 24; the local run used Node 24.
