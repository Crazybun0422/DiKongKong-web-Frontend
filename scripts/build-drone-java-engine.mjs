import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, '.game-build/java-engine');
const backendRoot = process.env.DRONE_JAVA_ROOT || path.resolve(root, '../DiKongKong-Backend');
await mkdir(target, { recursive: true });
await build({ entryPoints: [path.join(root, 'src/games/drone-race/java-engine.ts')], outfile: path.join(target, 'engine-v21.js'),
  bundle: true, platform: 'neutral', format: 'iife', target: 'es2020', minify: true, legalComments: 'none',
  banner: { js: '// Generated from shared V21 source by build-drone-java-engine.mjs; embedded in the Java application.' },
});
const bytes = await readFile(path.join(target, 'engine-v21.js'));
await writeFile(path.join(target, 'manifest.json'), JSON.stringify({ version: 21, entry: 'engine-v21.js', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length }, null, 2) + '\n');
if (await access(path.join(backendRoot, 'pom.xml')).then(() => true, () => false)) {
  const destination = path.join(backendRoot, 'src/main/resources/drone-game');
  await cp(target, destination, { recursive: true });
  console.log(`V21 calculations embedded in Java resources: ${destination}`);
} else console.log(`Java checkout not present; engine staged at ${target}. Set DRONE_JAVA_ROOT to synchronize.`);
