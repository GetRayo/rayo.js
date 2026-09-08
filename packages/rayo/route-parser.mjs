// Compile route patterns once at registration. These records retain the route
// grammar used by earlier Rayo releases: static, parameter, wildcard, optional.
export default function parseRoute(pattern) {
  if (pattern === '/') return [{ old: pattern, type: 0, val: '/', end: '' }];

  let cursor = pattern.charCodeAt(0) === 47 ? 1 : 0;
  let limit = pattern.length;
  if (limit > cursor && pattern.charCodeAt(limit - 1) === 47) limit -= 1;
  const segments = [];

  while (cursor < limit) {
    const initial = pattern.charCodeAt(cursor);
    if (initial === 42) {
      // A wildcard's key includes the remaining pattern. Advancing one character
      // also preserves legacy parsing of nonterminal or repeated wildcards.
      segments.push({ old: pattern, type: 2, val: pattern.slice(cursor, limit), end: '' });
      cursor += 1;
      continue;
    }

    const slash = pattern.indexOf('/', cursor);
    const boundary = slash < 0 || slash > limit ? limit : slash;
    let type = 0;
    let nameStart = cursor;
    let nameEnd = boundary;
    let suffix = '';
    if (initial === 58) {
      type = 1;
      nameStart += 1;
      for (let position = nameStart; position < boundary; position += 1) {
        const character = pattern.charCodeAt(position);
        if (character === 63) {
          type = 3;
          nameEnd = position;
        } else if (character === 46 && suffix === '') {
          nameEnd = position;
          // Historically, a suffix includes the remaining pattern, even when
          // it contains another slash. Keep that behavior for existing routes.
          suffix = pattern.slice(position, limit);
        }
      }
    }

    segments.push({ old: pattern, type, val: pattern.slice(nameStart, nameEnd), end: suffix });
    cursor = boundary + 1;
  }

  return segments;
}
