// Kept as an entry point for consumers of the old fixture name.
process.env.RAYO_BENCH = JSON.stringify({ ...JSON.parse(process.env.RAYO_BENCH || '{}'), mode: 'cluster' });
await import('./Rayo.js');
