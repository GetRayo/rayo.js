#!/usr/bin/env node
/* eslint no-console: 0 */

const autocannon = require('autocannon');
const minimist = require('minimist');
const nap = require('pancho');
const Table = require('cli-table');
const { blue } = require('kleur');
const { fork } = require('child_process');
const { readdirSync } = require('fs');
const { dependencies: version } = require('./package.json');

const files = (() => {
  const array = readdirSync(`${__dirname}/compare`).filter((file) => file.match(/(.+)\.js$/));
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
const cannon = (title = null) =>
  new Promise((yes, no) => {
    autocannon(
      {
        title,
        url: argv.u || 'http://localhost:5050/users/rayo',
        connections: argv.c || 100,
        pipelining: argv.p || 10,
        duration: argv.d || 5
      },
      (error, result) => (error ? no(error) : yes(result))
    );
  });

let index = 0;
const benchmark = async (results = []) => {
  results.push(
    // eslint-disable-next-line no-async-promise-executor
    await new Promise(async (yes, no) => {
      let file = files[index];
      if (argv.o && argv.o !== file) {
        yes();
      } else {
        process.env.STORM_LOG_LEVEL = 'silent';
        const forked = fork(`${__dirname}/compare/${file}`);
        await nap(0.25);

        try {
          // First round to warm up, second round to measure.
          file = file.replace('.js', '');
          const framework = blue(file);
          process.stdout.write(` - ${framework}`);
          await cannon();
          const result = await cannon(file);
          result.version = (version[`${file.toLowerCase()}`] || '').replace('^', '');
          forked.kill('SIGINT');

          await nap(0.25);
          yes(result);
        } catch (error) {
          no(error);
        }
      }
    })
  );

  index += 1;
  return index < files.length
    ? benchmark(results)
    : results.sort((a, b) => (b.requests.average < a.requests.average ? -1 : 1));
};

benchmark().then((results) => {
  const table = new Table({
    head: ['', 'Version', 'Requests/sec', 'Latency', 'Throughput/Mb']
  });

  results.forEach((result) => {
    if (result) {
      table.push([
        blue(result.title.replace('.js', '')),
        result.version || '',
        result.requests.average,
        result.latency.average,
        (result.throughput.average / 1024 / 1024).toFixed(2)
      ]);
    }
  });

  console.log(table.toString());
});
