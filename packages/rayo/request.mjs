import { parse as parseUrl } from 'node:url';
import { parse as parseQuery } from 'node:querystring';

// These characters require Node's legacy URL handling. In particular, do not
// normalize ordinary paths: encoded slashes, backslashes and dot segments stay raw.
const unusual = /[\t\n\f\r #\u00a0\ufeff]/;

export default function parseRequest(req) {
  const target = req.url;
  let pathname, query;
  if (typeof target === 'string' && target.charCodeAt(0) === 47 && !unusual.test(target)) {
    const mark = target.indexOf('?');
    pathname = mark === -1 ? target : target.slice(0, mark);
    query = mark === -1 ? '' : target.slice(mark + 1);
  } else {
    ({ pathname, query } = parseUrl(target));
  }
  req.pathname = pathname;
  req.query = query ? parseQuery(query) : {};
}
