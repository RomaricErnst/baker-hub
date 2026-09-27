import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const require=createRequire(path.join(root,'.ci-tools/package.json'));
const esbuild=require('esbuild');
const poolish=process.argv.includes('--poolish');
await esbuild.build({
 entryPoints:[path.join(here,poolish?'poolish-entry.tsx':'entry.tsx')],bundle:true,
 outfile:path.join(root,poolish?'.ci-tools/poolish-roundtrip.js':'.ci-tools/starter-roundtrip.js'),
 platform:'browser',format:'iife',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"development"'},
 alias:{'next-intl':path.join(here,'stub-next-intl.js')},
 nodePaths:[path.join(root,'node_modules')],logLevel:'warning',
});

