// Dynamic imports work from CommonJS applications without confusing ESM default exports.
async function consumer() {
  const { default: rayo } = await import('rayo');
  const { default: send } = await import('@rayo/send');
  const { default: compress } = await import('@rayo/compress');
  const { storm } = await import('@rayo/storm');
  rayo()
    .through(send(), compress())
    .get('/', (_req, res) => res.end('hello'));
  void storm;
}
void consumer;
