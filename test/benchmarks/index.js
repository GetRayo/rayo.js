/* eslint no-console: 0 */

const autocannon = require('autocannon');
const chalk = require('chalk');
const fs = require('fs');
const minimist = require('minimist');
const ora = require('ora');
const nap = require('pancho');
const Table = require('cli-table');
const { fork } = require('child_process');

const shuffle = (array) => {
  let index = array.length;
  while (index) {
    const rand = Math.floor(Math.random() * (index -= 1));
    const temp = array[index];
    array[index] = array[rand];
    array[rand] = temp;
  }

  return array;
};

const files = shuffle(
  fs.readdirSync(`${__dirname}/compare`).filter((file) => file.match(/(.+)\.js$/))
);

const argv = minimist(process.argv.slice(2));
const cannon = (title = null) =>
  new Promise((yes, no) => {
    autocannon(
      Object.assign(
        {},
        {
          url: argv.u || 'http://localhost:5050/users/rayo',
          connections: argv.c || 100,
          pipelining: argv.p || 10,
          duration: argv.d || 5
        },
        { title }
      ),
      (error, result) => (error ? no(error) : yes(result))
    );
  });

let index = 0;
const benchmark = async (results) => {
  results.push(
    await new Promise(async (yes, no) => {
      const file = files[index];
      if (argv.o && argv.o !== file) {
        return yes();
      }

      const forked = fork(`${__dirname}/compare/${file}`);
      await nap(0.25);

      try {
        // 1 warm-up round, 1 to measure.
        const spin = ora(`Warming up ${chalk.blue(file)}`).start();
        spin.color = 'yellow';
        await cannon();
        spin.text = `Running ${chalk.blue(file)}`;
        spin.color = 'green';
        const result = await cannon(file);
        spin.text = `${chalk.blue(file)}`;
        spin.succeed();
        forked.kill('SIGINT');
        await nap(0.25);
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
    if (result) {
      table.push([
        chalk.blue(result.title),
        result.requests.average,
        result.latency.average,
        (result.throughput.average / 1024 / 1024).toFixed(2)
      ]);
    }
  });

  console.log(table.toString());
});
