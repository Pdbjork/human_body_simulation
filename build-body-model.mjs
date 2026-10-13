import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const license = await readFile(new URL('./node_modules/three/LICENSE', import.meta.url), 'utf8');
await build({
    entryPoints: ['js/body-model.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    legalComments: 'inline',
    banner: { js: `/* Bundled three.js and addons:\n${license}*/` },
    outfile: 'js/body-model.bundle.js',
});
