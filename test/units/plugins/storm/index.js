const should = require('should');
const cpus = require('os').cpus();
const { spawn } = require('child_process');

const exec = (file, options = {}) =>
  new Promise((yes) => {
    const res = [];
    const input = (buffer) => res.push(buffer.toString().replace('\n', ''));
    const path = `./test/units/plugins/storm/${file}`;

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
  should(responses.filter((res) => res === message))
    .be.an.Array()
    .with.length(length);

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
    exec('fixtures/worker').then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('Two workers', (done) => {
    exec('fixtures/worker', { workers: 2 }).then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 2);
      done();
    });
  });

  it('CPU length workers', (done) => {
    exec('fixtures/worker', { workers: cpus.length }).then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', cpus.length);
      done();
    });
  });

  it('Auto length workers', (done) => {
    exec('fixtures/worker', { workers: 'auto' }).then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', cpus.length);
      done();
    });
  });

  it('Without master function', (done) => {
    exec('fixtures/noMaster').then((res) => {
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('Stop', (done) => {
    exec('fixtures/stop').then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('Keep the cluster alive', (done) => {
    exec('fixtures/keepAlive').then((res) => {
      filter(res, 'Master!', 1);
      done();
    });
  });

  it('With monitor', (done) => {
    exec('fixtures/monitor').then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('With monitor, request', (done) => {
    exec('fixtures/monitorRequest').then((res) => {
      const json = extractJSON(res)[0];
      should(json)
        .be.an.Object()
        .and.have.properties('id', 'pid', 'ppid', 'status');

      should(json.id).be.a.Number();
      should(json.pid).be.a.Number();
      should(json.ppid).be.a.Number();
      should(json.status).be.a.String();

      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('With monitor, request for valid worker', (done) => {
    exec('fixtures/monitorRequest', { workerId: 1 }).then((res) => {
      const json = extractJSON(res);
      should(json)
        .be.an.Object()
        .and.have.properties('pid', 'ppid', 'platform', 'cpuTime', 'memory');

      should(json.memory)
        .be.an.Object()
        .and.have.properties('rss', 'heapTotal', 'heapUsed', 'external');

      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      done();
    });
  });

  it('With monitor, request for invald worker', (done) => {
    exec('fixtures/monitorRequest', { workerId: 5 }).then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      filter(res, 'Worker 5 does not exist.', 1);
      done();
    });
  });

  it('Message between processes, valid command', (done) => {
    exec('fixtures/command', { command: 'health' }).then((res) => {
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

      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      filter(res, 'health', 1); // master -> worker message
      filter(res, 'Hello from the worker!', 1); // worker -> master message
      done();
    });
  });

  it('Message between processes, invalid command', (done) => {
    exec('fixtures/command', { command: 'invalid_command' }).then((res) => {
      filter(res, 'Master!', 1);
      filter(res, 'Worker!', 1);
      filter(res, 'invalid_command', 1); // master -> worker message
      filter(res, 'Hello from the worker!', 1); // worker -> master message
      done();
    });
  });
};
