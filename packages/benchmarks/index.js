#!/usr/bin/env node

import { cpus } from 'os';
import autocannon from 'autocannon';
import minimist from 'minimist';
import nap from 'pancho';
import Table from 'cli-table';
import kleur from 'kleur';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fork } from 'child_process';
import { readdirSync, readFileSync } from 'fs';

const base = dirname(fileURLToPath(import.meta.url));
const comparePath = join(base, './compare');
const files = (() => {
  const array = readdirSync(comparePath).filter((file) => file.match(/(.+)\.js$/));
  let index = array.length;
  while (index) {
    const rand = Math.floor(Math.random() * (index -= 1));
    const temp = array[index];
    array[index] = array[rand];
    array[rand] = temp;
  }

  return array;
})();

const argv = minimist(process.argv.slice(2));
const workers = argv.w || cpus().length;
const connections = argv.c || 1000;
const pipelining = argv.p || 25;
const duration = argv.d || 5;

const cn = (title = null) =>
  autocannon({
    title,
    url: argv.u || 'http://localhost:5050/hello',
    connections,
    pipelining,
    duration,
    workers
  });

const { dependencies: version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const benchmark = async (bench = { index: 0, results: [] }) => {
  bench.results.push(
    // eslint-disable-next-line no-async-promise-executor
    await new Promise(async (yes, no) => {
      const file = files[bench.index];
      if (argv.o && argv.o !== file) {
        yes();
      } else {
        const forked = fork(`${comparePath}/${file}`);
        await nap(0.5);

        try {
          let title = file.replace('.js', '');
          const framework = kleur.blue(title);
          process.stdout.write(` ✔ ${framework}\n`);
          // Warm up...
          await cn();
          // Measure!
          const result = await cn(title);
          title = title === 'RayoStorm' ? '@rayo/storm' : title;
          result.version = (version[`${title.toLowerCase()}`] || '').replace('^', '');
          forked.kill('SIGINT');

          await nap(0.25);
          yes(result);
        } catch (error) {
          no(error);
        }
      }
    })
  );

  bench.index += 1;
  return bench.index < files.length
    ? benchmark(bench)
    : bench.results.sort((a, b) => (b.requests.average < a.requests.average ? -1 : 1));
};

process.stdout.write(
  `\n Running with ${connections} connections, ${pipelining} pipelines and on ${workers} CPU cores.\n
  (One warm-up round, and one measure round)\n\n`
);
benchmark().then((results) => {
  const table = new Table({
    head: ['', 'Version', 'Reqs/sec ^', 'Reqs/sec *', 'Latency *', 'Throughput *']
  });

  results.forEach((result) => {
    if (result) {
      table.push([
        kleur.blue(result.title.replace('.js', '')),
        result.version || '',
        result.requests.max,
        result.requests.average,
        result.latency.average,
        `${(result.throughput.average / 1024 / 1024).toFixed(2)} Mb.`
      ]);
    }
  });

  process.stdout.write(`${table.toString()}\n * Average\n`);
});
