import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../lib/space-rules.js',import.meta.url),new URL('../dist/space-rules.js',import.meta.url));
