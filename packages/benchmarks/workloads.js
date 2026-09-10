const text = 'Thunderstruck... hello';
const object = {
  message: 'Thunderstruck',
  items: Array.from({ length: 12 }, (_, index) => ({ id: index, ready: true }))
};
const json = JSON.stringify(object);
const stream = 'Thunderstruck! '.repeat(2400);

export const payloads = { text, object, json, stream };
export const workloads = [];

// A deterministic request mix visits early, middle and late registrations. Each
// expected body identifies the winning handler, including overlapping routes.
export function routeMix(count, overlap = false) {
  const routes = [];
  for (let index = 0; index < count; index += 1) {
    const kind = overlap ? 'param' : ['static', 'param', 'wildcard'][index % 3];
    const prefix = `/route-${index}`;
    const suffix = kind === 'param' ? '/:name' : kind === 'wildcard' ? '/*' : '';
    routes.push({ path: prefix + suffix, body: `${kind}:${index}` });
    if (overlap) {
      routes.push({ path: `${prefix}/fixed`, body: `static:${index}` });
      routes.push({ path: `${prefix}/*`, body: `wildcard:${index}` });
    }
  }
  const indices = [
    ...new Set([
      0,
      1,
      2,
      Math.floor(count / 2),
      Math.floor(count / 2) + 1,
      Math.floor(count / 2) + 2,
      count - 3,
      count - 2,
      count - 1
    ])
  ].filter((index) => index >= 0 && index < count);
  const requests = indices.flatMap((index) => {
    const kind = overlap ? 'param' : ['static', 'param', 'wildcard'][index % 3];
    const suffix = overlap ? '/fixed' : kind === 'param' ? '/hello' : kind === 'wildcard' ? '/hello/world' : '';
    const hit = { path: `/route-${index}${suffix}`, body: `${kind}:${index}`, status: 200 };
    return overlap ? [hit, { path: `/route-${index}/hello/world`, body: `wildcard:${index}`, status: 200 }] : [hit];
  });
  requests.push({ path: '/missing', body: 'not found', status: 404 });
  return { routes, requests };
}

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
  for (const overlap of [false, true]) {
    workloads.push({
      id: `routes/${overlap ? 'overlap' : 'mixed'}/${count}`,
      kind: 'route-mix',
      count,
      ...routeMix(count, overlap)
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
  },
  {
    id: 'query/encoded',
    kind: 'query',
    path: '/hello?name=Rayo%20server&path=%2Fhello%3Ftest%3D1&unicode=%E2%9A%A1&plus=a+b&empty=&flag',
    body: JSON.stringify({
      name: 'Rayo server',
      path: '/hello?test=1',
      unicode: '⚡',
      plus: 'a b',
      empty: '',
      flag: ''
    }),
    status: 200
  },
  {
    id: 'query/long',
    kind: 'query',
    path: `/hello?${Array.from({ length: 80 }, (_, index) => `key${index}=value%20${index}`).join('&')}`,
    body: JSON.stringify(
      Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`key${index}`, `value ${index}`]))
    ),
    status: 200
  }
);

for (const mode of ['no-accept', 'head', 'below-threshold']) {
  workloads.push({
    id: `compression-skip/${mode}`,
    kind: 'compression-skip',
    mode,
    path: '/hello',
    method: mode === 'head' ? 'HEAD' : 'GET',
    headers: mode === 'no-accept' ? {} : { 'accept-encoding': 'gzip, br' },
    body: mode === 'head' ? '' : text,
    status: 200
  });
}

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
