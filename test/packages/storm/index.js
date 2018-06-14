const should = require('should');
const cpus = require('os').cpus();
const { spawn } = require('child_process');

const exec = (file, options = {}) =>
  new Promise((yes) => {
    const res = [];
    const input = (buffer) => res.push(buffer.toString().replace('\n', ''));
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
      options.command
    ]);
    pcs.stdout.on('data', input);
    pcs.stderr.on('data', input);
    pcs.on('close', yes.bind(null, res));
  });

const filter = (responses, message, length) =>
  new Promise((yes) => {
    const messages = responses.filter((res) => res === message);
    should(messages).be.an.Array();
    should(messages.length).be.aboveOrEqual(length);
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

  return json[0];
};

module.exports = () => {
  it('Throws an error', (done) => {
    exec('fixtures/throwError').then((res) => {
      const error = res[0].indexOf('You need to provide a worker function.');
      should(error).be.greaterThan(1000);
      done();
    });
  });

  it('One worker', (done) => {
    exec('fixtures/worker')
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('Two workers', (done) => {
    exec('fixtures/worker', { workers: 2 })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 2))
      .then(() => done());
  });

  it('CPU length workers', (done) => {
    exec('fixtures/worker', { workers: cpus.length })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', cpus.length))
      .then(() => done());
  });

  it('Auto length workers', (done) => {
    exec('fixtures/worker', { workers: 'auto' })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', cpus.length))
      .then(() => done());
  });

  it('Without master function', (done) => {
    exec('fixtures/noMaster')
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('Stop', (done) => {
    exec('fixtures/stop')
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('Keep the cluster alive', (done) => {
    exec('fixtures/keepAlive', { workers: 2 })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 2))
      .then(() => done());
  });

  it('With monitor', (done) => {
    exec('fixtures/monitor')
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('With monitor, request', (done) => {
    exec('fixtures/monitorRequest')
      .then((res) => {
        const json = extractJSON(res)[0];
        should(json)
          .be.an.Object()
          .and.have.properties('id', 'pid', 'ppid', 'status');

        should(json.id).be.a.Number();
        should(json.pid).be.a.Number();
        should(json.ppid).be.a.Number();
        should(json.status).be.a.String();

        return filter.bind(null, res, 'Master!', 1);
      })
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('With monitor, request for valid worker', (done) => {
    exec('fixtures/monitorRequest', { workerId: 1 })
      .then((res) => {
        const json = extractJSON(res);
        should(json)
          .be.an.Object()
          .and.have.properties('pid', 'ppid', 'platform', 'cpuTime', 'memory');

        should(json.memory)
          .be.an.Object()
          .and.have.properties('rss', 'heapTotal', 'heapUsed', 'external');

        return filter.bind(null, res, 'Master!', 1);
      })
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then(() => done());
  });

  it('With monitor, request for invald worker', (done) => {
    exec('fixtures/monitorRequest', { workerId: 5 })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then((res) => filter.bind(res, 'Worker 5 does not exist.', 1))
      .then(() => done());
  });

  it('Message between processes, valid command', (done) => {
    exec('fixtures/command', { command: 'health' })
      .then((res) => {
        const json = extractJSON(res);
        should(json)
          .be.an.Object()
          .and.have.properties('pid', 'ppid', 'platform', 'upTime', 'cpuTime', 'memory');

        should(json.cpuTime)
          .be.a.Number()
          .and.greaterThan(0);

        should(json.memory)
          .be.an.Object()
          .and.have.properties('rss', 'heapTotal', 'heapUsed', 'external');

        return filter.bind(null, res, 'Master!', 1);
      })
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then((res) => filter.bind(null, res, 'health!', 1)) // mas -> wor
      .then((res) => filter.bind(null, res, 'Hello from the worker!', 1)) // wor -> mas
      .then(() => done());
  });

  it('Message between processes, invalid command', (done) => {
    exec('fixtures/command', { command: 'invalid_command' })
      .then((res) => filter.bind(null, res, 'Master!', 1))
      .then((res) => filter.bind(null, res, 'Worker!', 1))
      .then((res) => filter.bind(res, 'invalid_command', 1)) // mas -> wor
      .then((res) => filter.bind(res, 'iHello from the worker!', 1)) // wor -> mas
      .then(() => done());
  });
};
