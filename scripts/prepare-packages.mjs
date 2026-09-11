import { copyFileSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { workspaces } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

copyFileSync(new URL('readme.md', root), new URL('packages/rayo/readme.md', root));
for (const workspace of workspaces) {
  copyFileSync(new URL('LICENSE', root), new URL(`${workspace}/LICENSE`, root));
}
