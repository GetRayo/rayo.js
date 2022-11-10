const levels = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1
};

/* istanbul ignore next */
let logLevel = process.env.LOG_LEVEL || 'error';
/* istanbul ignore next */
logLevel = levels[logLevel] || 1;

const format = (prop, args) => {
  /* istanbul ignore next */
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
 * in high traffic situations and it will have an impact on performance-sensitive
 * applications.
 *
 * Use with caution!
 */
/* istanbul ignore next */
export default new Proxy(
  {},
  {
    get:
      (target, prop) =>
      (...args) => {
        return (levels[prop] || 1) <= logLevel ? process.stdout.write(format(prop, args)) : null;
      }
  }
);
