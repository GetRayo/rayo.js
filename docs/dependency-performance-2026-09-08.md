# Dependency replacement and compression review — 8 September 2026

Baseline: commit `3d53df3`, immediately before this follow-up. The earlier performance report compared a different
baseline; its percentages must not be added to these results.

This report records the implementation, verification and measurements preserved in commit `9397437`.
The one-off dependency microbenchmark driver was subsequently removed; its historical source and invocation
details remain in that commit. The measurements and raw JSON below are retained as the record of that work.

## Implementation

`rayo` now compiles route patterns with its own registration parser. The existing indexed request-time matcher
is unchanged. The compiler preserves route precedence, parameter names, optional segments, wildcard behavior,
suffixes, and existing grammar quirks. It uses an absolute cursor through the pattern rather than repeatedly
shortening the remaining string.

Ordinary HTTP request targets are read directly into `req.pathname` and `req.query`, avoiding a legacy URL object
and its private request cache. Encoded separators, backslashes, dot segments, trailing slashes, repeated query keys,
decoding, and the default query-key limit retain their behavior. Unusual targets fall back to Node's legacy URL
parser for compatibility. Each dispatch reads `req.url`; Rayo neither reads nor overwrites `req._parsedUrl`.
Storm's monitor has a small pathname-only reader so it remains independent of the Rayo package.

`matchit@1.1.0` and `parseurl@1.3.3` are pinned development references for tests and measurements. Neither remains
in Rayo or Storm's runtime dependency graph. Other frameworks in the comparison benchmark may still depend on them.
The root workspace lockfile is now the sole lockfile; obsolete package-level lockfiles were removed.

Compression's finish, error, and close paths share a guarded finalizer. Lifecycle callbacks and state descriptors
are created only for responses selected for compression. Excluded responses skip negotiation, and uncompressed
streams retire their write wrapper without replacing wrappers installed by later middleware. Call sites guard
the compression decision so later chunks do not enter its closure-producing function. Missing encoding headers
take an immediate negotiation exit.
The response event interception and writable-state getters remain necessary for the tested backpressure and
`end()` contract. This is a modest size reduction, **223 to 215 lines**, with no helpers moved elsewhere to hide size.

## Verification

The suite includes explicit expected fixtures and pinned-oracle comparisons: 19,331 short/generated route patterns,
8,500 route matches, 6,000 varied request targets, and all 65,536 UTF-16 code units in both path and query positions.
It exercises raw/prototype-sensitive parameters, empty route registrations, redispatch, independent query objects,
real HTTP routing, and Storm monitor URLs. Compression regressions cover later middleware wrappers, restored
response descriptors/event observers, premature socket drain, slow output, errors, and disconnects.

An isolated consumer installed the four generated package tarballs offline, successfully imported and dispatched
through Rayo/send/compress, and confirmed that neither removed dependency was resolvable. New internal parser files
are included in the package file lists. TypeScript consumer checks continue to use NodeNext and Bundler resolution.
At that revision, the final `npm test` run passed lint, both TypeScript configurations, and **206 tests**. The new parser modules
achieved 100% statement and branch coverage in that run. The expanded HTTP matrix contains 41 selectable workloads.

## Measurement method

All measurements ran sequentially on Node v24.16.0, macOS arm64, Apple M1 Ultra. Each pair alternates its
baseline/candidate order across rounds. Cases also use a seeded alternating order.

Microbenchmarks used five independent process pairs per case, warmup, explicit pre-measurement GC, and the same
input corpus and output consumption for both variants. A bounded 256-result ring makes returned objects escape
the timed operation; checksums verify equivalent outputs. Route parsing uses 1,000,000 operations per run; URLs
without queries use 1,000,000, ordinary/encoded queries 300,000, and long queries 50,000. Warmup counts are 200,000,
200,000, 100,000, and 10,000 respectively. Query decoding is included in both URL implementations.
Each URL operation allocated a fresh request, modeling first dispatch rather than a pre-populated request cache.
Fresh request allocation, property assignment, ring writes and per-operation checksum consumption were timed;
the final retained-output checksum check ran after timing. Output equality was checked before measurements,
and checksums of both all operations and retained outputs had to agree across variants.

HTTP measurements use five pairs per case, a fresh single-process server for every run, two seconds of warmup and
five measured seconds, 50 connections, and pipelining 1. Dependency comparisons exercise the full candidate on
uncompressed workloads. Compression comparisons use a baseline snapshot with **only** `packages/compress/index.js`
replaced, isolating that change from URL parsing. The same new harness and dependencies serve both variants.

Each uncompressed response is checked against its specific request's status and body. Compressed responses have
binary-aware probes around timed loads, with timed status/transport validation. The HEAD workload uses an empty
representation because Autocannon does not handle nonzero HEAD content lengths correctly. Correctness tests
exercise native HEAD behavior separately.

Reported changes are medians of within-pair percentage changes. Minimum/maximum ranges describe the observed
samples, not confidence intervals. Microbenchmark improvements are not predictions of HTTP throughput gains.

## Results

| Isolated operation | Baseline ns/op | Candidate ns/op | Paired ops/sec change | Observed pair range |
| --- | ---: | ---: | ---: | ---: |
| Route-pattern compilation | 201.3 | 153.3 | +30.7% | +30.3% to +31.3% |
| URL, no query | 48.1 | 39.3 | +22.9% | +22.2% to +24.6% |
| URL, ordinary query | 373.4 | 328.1 | +15.0% | +12.8% to +16.9% |
| URL, encoded query | 855.3 | 763.2 | +11.8% | +11.3% to +14.4% |
| URL, long query | 24,015.2 | 21,092.6 | +13.9% | +10.6% to +14.9% |

Nanoseconds/operation are medians of each variant's runs; percentage changes are medians of paired ratios.
The compiler gain applies to registration-time work. Removing the remaining `matchit` dependency does not itself
speed up the existing request-time matcher.

| HTTP workload, complete candidate | Paired req/sec change | Observed pair range | Paired p99 change |
| --- | ---: | ---: | ---: |
| One static route | +1.0% | -9.3% to +4.2% | -1.1% |
| Mixed hits/misses among 1,000 routes | +1.7% | +0.6% to +2.4% | -1.1% |
| Ordinary query | +1.3% | -2.1% to +1.7% | -1.6% |
| Long query, 80 fields | +5.7% | +2.9% to +7.2% | -6.4% |

Long-query requests improved in all five pairs. The mixed-route gain was consistently positive but small.
The simple-route and ordinary-query ranges include regressions, so those measurements do not establish a reliable
throughput improvement. This distinction matters: faster helpers delivered modest whole-request changes.
Median paired peak RSS changed by approximately -4.4% for mixed routes and stayed within 0.4% for the other
dependency workloads; these are sampled process peaks, not isolated allocation counts.

| HTTP workload, compression change only | Paired req/sec change | Observed pair range | Paired p99 change |
| --- | ---: | ---: | ---: |
| No accepted encoding | +0.04% | -4.8% to +5.5% | +0.2% |
| Below compression threshold | +0.7% | +0.1% to +4.2% | -1.3% |
| Gzip stream, 512-byte chunks | +0.05% | -0.1% to +49.7% | -5.4% |
| Brotli stream, 512-byte chunks | +2.9% | -7.3% to +40.7% | -1.6% |
| HEAD response | +4.2% | +1.3% to +4.9% | -5.5% |

HEAD and below-threshold throughput improved in all five pairs. The no-encoding and gzip medians were essentially
unchanged. Streaming results had large outliers, and the Brotli range includes regressions; these runs do not
establish a general compression throughput gain. Median paired peak RSS fell approximately 26.5% for no accepted
encoding, 8.4% below threshold, and 29.7% for HEAD, while increasing 5.0% for gzip and 4.1% for Brotli. These process
peaks are sensitive to garbage collection and runtime state and do not measure allocation counts directly.

Raw measurements: [isolated operations](dependency-micro-2026-09-08.json),
[dependency HTTP comparisons](dependency-http-2026-09-08.json), and
[isolated compression HTTP comparisons](compression-http-2026-09-08.json).
The dependency HTTP report predates the final compression adjustment; its parser hashes match the final files,
and those uncompressed workloads do not load compression. The isolated compression report measures the final
215-line implementation.

## Reproduce the HTTP measurements

Install dependencies with `npm ci` at the repository root. See the
[benchmark guide](../packages/benchmarks/readme.md) for all controls and limitations.

These HTTP commands rerun the measured cases, individually or by prefix, using the same load settings
(defaults: 50 connections, pipelining 1, two-second warmup, five-second measurement). The saved HTTP reports grouped
their selected cases in one plan per comparison, alternating case order across rounds.

```sh
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case routes/static/1 --baseline /path/to/baseline --repeats 5 --output static.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case routes/mixed/1000 --baseline /path/to/baseline --repeats 5 --output mixed.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case query/present --baseline /path/to/baseline --repeats 5 --output query-present.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case query/long --baseline /path/to/baseline --repeats 5 --output query-long.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case compression-skip --baseline /path/to/baseline --candidate /path/to/compression-only-snapshot --repeats 5 --output compression.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case stream/gzip/512 --baseline /path/to/baseline --candidate /path/to/compression-only-snapshot --repeats 5 --output gzip.json
npm run bench --workspace @rayo/benchmarks -- --suite rayo --case stream/br/512 --baseline /path/to/baseline --candidate /path/to/compression-only-snapshot --repeats 5 --output brotli.json
```

For the isolated compression comparison, create two snapshots of `3d53df3` with resolvable dependencies and replace
only `packages/compress/index.js` in the candidate snapshot. The JSON reports retain exact settings, source hashes,
workloads, raw samples, and paired statistics. Increase durations/repeats and use application traffic before making
capacity decisions.
