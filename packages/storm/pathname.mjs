import { parse } from 'node:url';

// The monitor only needs a pathname. Keep this package independent of Rayo,
// including the same raw-path behavior for ordinary HTTP request targets.
const unusual = /[\t\n\f\r #\u00a0\ufeff]/;

export default function pathname(target) {
  if (typeof target !== 'string' || target.charCodeAt(0) !== 47 || unusual.test(target)) {
    return parse(target).pathname;
  }
  const mark = target.indexOf('?');
  return mark === -1 ? target : target.slice(0, mark);
}
