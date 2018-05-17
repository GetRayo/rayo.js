/* eslint no-console: 0 */

const autocannon = require('autocannon');
const chalk = require('chalk');
const fs = require('fs');
const ora = require('ora');
const { fork } = require('child_process');
const Table = require('cli-table');

const files = fs
  .readdirSync(`${__dirname}/compare`)
  .filter((file) => file.match(/(.+)\.js$/))
  .sort();

const cannon = (options = {}) =>
  new Promise((yes, no) => {
    autocannon(
      {
        title: options.file || null,
        url: options.url || 'http://localhost:5050',
        connections: options.connections || 100,
        pipelining: options.pipelining || 10,
        duration: options.duration || 5
      },
      (error, result) => {
        if (error) {
          return no(error);
        }
        return yes(result);
      }
    );
  });

let index = 0;
const benchmark = async (results) => {
  results.push(
    await new Promise(async (yes, no) => {
      const file = files[index];
      const forked = fork(`${__dirname}/compare/${file}`);
      try {
        // Warm-up & test
        const spin = ora(`Warming up ${chalk.blue(file)}...`).start();
        spin.color = 'yellow';
        await cannon();
        spin.text = `Running ${chalk.blue(file)}...`;
        spin.color = 'green';
        const result = await cannon({ file });
        spin.succeed();
        forked.kill('SIGINT');
        return yes(result);
      } catch (error) {
        return no(error);
      }
    })
  );

  index += 1;
  if (index < files.length) {
    return benchmark(results);
  }

  return results.sort((a, b) => {
    if (b.requests.average < a.requests.average) {
      return -1;
    }

    return b.requests.average > a.requests.average ? 1 : 0;
  });
};

benchmark([]).then((results) => {
  const table = new Table({
    head: ['', 'Requests/s', 'Latency', 'Throughput/Mb']
  });

  results.forEach((result) => {
    table.push([
      chalk.blue(result.title),
      result.requests.average,
      result.latency.average,
      (result.throughput.average / 1024 / 1024).toFixed(2)
    ]);
  });

  console.log(table.toString());
});
