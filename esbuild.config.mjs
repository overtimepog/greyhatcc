import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]; // 'shodan', 'security-tools', or undefined (all)

const servers = {
  shodan: {
    entryPoint: resolve(__dirname, 'src/servers/shodan/index.ts'),
    outfile: resolve(__dirname, 'bridge/shodan-server.cjs'),
  },
  'security-tools': {
    entryPoint: resolve(__dirname, 'src/servers/security-tools/index.ts'),
    outfile: resolve(__dirname, 'bridge/security-tools-server.cjs'),
  },
  hackerone: {
    entryPoint: resolve(__dirname, 'src/servers/hackerone/index.ts'),
    outfile: resolve(__dirname, 'bridge/hackerone-server.cjs'),
  },
  'web-tools': {
    entryPoint: resolve(__dirname, 'src/servers/web-tools/index.ts'),
    outfile: resolve(__dirname, 'bridge/web-tools-server.cjs'),
  },
};

const toBuild = target ? { [target]: servers[target] } : servers;

if (target && !servers[target]) {
  console.error(`Unknown server: ${target}. Available: ${Object.keys(servers).join(', ')}`);
  process.exit(1);
}

for (const [name, config] of Object.entries(toBuild)) {
  const start = Date.now();
  console.log(`Building ${name}...`);
  await build({
    entryPoints: [config.entryPoint],
    outfile: config.outfile,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    minify: false,
    sourcemap: true,
    external: name === 'web-tools' ? ['playwright-core'] : [],
  });
  console.log(`Built ${name} -> ${config.outfile} (${Date.now() - start}ms)`);
}

console.log(`\nAll ${Object.keys(toBuild).length} server(s) built successfully.`);
