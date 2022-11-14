const levels = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1
};

/* c8 ignore next */
let logLevel = process.env.LOG_LEVEL || 'error';
/* c8 ignore next */
logLevel = levels[logLevel] || 1;

const format = (prop, args) => {
  /* c8 ignore next */
  const values = args
    .map((arg) => (!(arg instanceof Error) && typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg))
    .join('\n');

  const date = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'long',
    hour12: false
  })
    .format(new Date())
    .replace(',', '');

  const upperCase = prop.toUpperCase();
  const message = date;
  return `[${upperCase}] (${message}) ${values}`;
};

/**
 * Keep in mind that logging (writing to the console) can be an expensive operation
 * in high traffic situations, and it will have an impact on performance-sensitive
 * applications.
 *
 * Use with caution!
 */
export default new Proxy(
  {},
  {
    get:
      (target, prop) =>
      (...args) => {
        /* c8 ignore next */
        return (levels[prop] || 1) <= logLevel ? process.stdout.write(format(prop, args)) : null;
      }
  }
);
