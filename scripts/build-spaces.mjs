import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../lib/space-rules.js',import.meta.url),new URL('../dist/space-rules.js',import.meta.url));

for(const file of ['mall-catalog.js','mall-directory.js','mall-paths.js'])copyFileSync(new URL('../lib/'+file,import.meta.url),new URL('../dist/'+file,import.meta.url));
