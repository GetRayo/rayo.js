const text = 'Thunderstruck... hello';
const object = {
  message: 'Thunderstruck',
  items: Array.from({ length: 12 }, (_, index) => ({ id: index, ready: true }))
};
const json = JSON.stringify(object);
const stream = 'Thunderstruck! '.repeat(2400);

export const payloads = { text, object, json, stream };
export const workloads = [];

for (const count of [1, 100, 1000]) {
  for (const kind of ['static', 'param', 'wildcard', 'miss']) {
    const suffix = kind === 'param' ? '/hello' : kind === 'wildcard' ? '/hello/world' : '';
    workloads.push({
      id: `routes/${kind}/${count}`,
      kind,
      count,
      path: kind === 'miss' ? '/missing' : `/route-${count - 1}${suffix}`,
      body: kind === 'miss' ? 'not found' : kind === 'param' ? 'hello' : 'ok',
      status: kind === 'miss' ? 404 : 200
    });
  }
}

for (const depth of [0, 5, 20]) {
  workloads.push({
    id: `middleware/${depth}`,
    kind: 'middleware',
    depth,
    path: '/hello',
    body: `${depth}`,
    status: 200
  });
}

for (const mode of ['raw', 'auto-text', 'text', 'object', 'json', 'json-string', 'header-json']) {
  workloads.push({
    id: `response/${mode}`,
    kind: 'response',
    mode,
    path: '/hello',
    body: ['raw', 'auto-text', 'text'].includes(mode) ? text : json,
    status: 200
  });
}

workloads.push(
  { id: 'query/absent', kind: 'query', path: '/hello', body: '{}', status: 200 },
  {
    id: 'query/present',
    kind: 'query',
    path: '/hello?name=Rayo&tag=a&tag=b&encoded=a%20b',
    body: JSON.stringify({ name: 'Rayo', tag: ['a', 'b'], encoded: 'a b' }),
    status: 200
  }
);

for (const chunkSize of [512, 16384]) {
  workloads.push({
    id: `stream/identity/${chunkSize}`,
    kind: 'stream',
    chunkSize,
    path: '/hello',
    body: stream,
    status: 200
  });
  for (const encoding of ['gzip', 'br']) {
    workloads.push({
      id: `stream/${encoding}/${chunkSize}`,
      kind: 'stream',
      chunkSize,
      encoding,
      headers: { 'accept-encoding': encoding },
      path: '/hello',
      body: stream,
      status: 200
    });
  }
}
