const should = require('should');
const cpus = require('os').cpus();
const { spawn } = require('child_process');

const exec = (file, options = {}) =>
  new Promise((yes) => {
    const res = [];
    const input = (buffer) => res.push(buffer.toString());
    const path = `./test/packages/storm/${file}`;

    if (options.workers === 'auto') {
      options.workers = 0;
    } else if (!options.workers) {
      options.workers = 1;
    }

    const pcs = spawn('node', [
      path,
      options.workers,
      options.workerId || 0,
      options.command,
      options.service || 'monitor'
    ]);

    pcs.stdout.on('data', input);
    pcs.stderr.on('data', input);
    pcs.on('close', () => setTimeout(() => yes(res), 250));
  });

const filter = (responses, message) =>
  new Promise((yes) => {
    const messages = responses.filter((res) => {
      const rex = new RegExp(message, 'gi');
      return res.match(rex);
    });

    should(messages).be.an.Array();
    should(messages.length).be.equal(1);

    // eslint-disable-next-line no-promise-executor-return
    return yes(responses);
  });

const extractJSON = (res) => {
  const json = res
    .map((element) => {
      try {
        return JSON.parse(element);
      } catch (e) {
        return null;
      }
    })
    .filter((i) => i);

  return json;
};

module.exports = () => {
  it('Throws an error', async () => {
    const res = await exec('fixtures/throwError');
    const error = res[0].indexOf('You need to provide a worker function.');
    return should(error).be.greaterThan(90);
  });

  it('One worker', async () => {
    const res = await exec('fixtures/worker');
    return filter(res, 'Master process: \\d+');
  });

  it('Two workers', async () => {
    const res = await exec('fixtures/worker', { workers: 2 });
    return filter(res, 'Master process: \\d+');
  });

  it('CPU length workers', async () => {
    const res = await exec('fixtures/worker', { workers: cpus.length });
    return filter(res, 'Master process: \\d+');
  });

  it('Auto length workers', async () => {
    const res = await exec('fixtures/worker', { workers: 'auto' });
    return filter(res, 'Master process: \\d+');
  });

  it('Without master function', async () => exec('fixtures/noMaster'));

  it('Stop', async () => {
    const res = await exec('fixtures/stop');
    return filter(res, 'Master process: \\d+');
  });

  it('Keep the cluster alive', async () => {
    const res = await exec('fixtures/keepAlive', { workers: 2 });
    return filter(res, 'Master process: \\d+');
  });

  it('With monitor', async () => {
    const res = await exec('fixtures/monitor');
    return filter(res, 'Master process: \\d+');
  });

  it('With monitor, request', async () => {
    const res = await exec('fixtures/monitorRequest');
    return filter(res, 'Master process: \\d+');
  });

  it('With monitor, invalid request', async () => {
    const res = await exec('fixtures/monitorRequest', { service: 'monitors' });
    filter(res, 'Master process: \\d+');
    return filter(res, 'This service does not exist.');
  });

  it('With monitor, request for valid worker', async () => {
    const res = await exec('fixtures/monitorRequest', { workerId: 1 });
    return filter(res, 'Master process: \\d+');
  });

  it('With monitor, request for invalid worker', async () => {
    const res = await exec('fixtures/monitorRequest', { workerId: 5 });
    filter(res, 'Master process: \\d+');
    return filter(res, 'Worker 5 does not exist.');
  });

  it('Message between processes, valid command', async () => {
    const res = await exec('fixtures/command', { command: 'health' });
    const json = extractJSON(res).pop();
    should(json).be.an.Object().and.have.properties('pid', 'upTime', 'cpuTime', 'memory');

    should(json.cpuTime).be.a.Number().and.greaterThan(0);

    should(json.memory).be.an.Object().and.have.properties('rss', 'heapTotal', 'heapUsed', 'external');

    filter(res, 'Master process: \\d+');
    return filter(res, 'Hello from the worker!');
  });

  it('Message between processes, invalid command', async () => {
    const res = await exec('fixtures/command', { command: 'invalid_command' });
    filter(res, 'Master process: \\d+');
    return filter(res, 'Hello from the worker!'); // worker -> master
  });
};
