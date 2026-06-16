import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

// 저장 가능한 JSON 화이트리스트 (에디터 💾 대상)
const TUNING_FILES: Record<string, string> = {
  weapon:      path.resolve(process.cwd(), 'src/character/weaponParams.json'),
  attackTiming: path.resolve(process.cwd(), 'src/character/attackTiming.json'),
};

// dev 전용: 에디터의 💾 저장 요청을 받아 해당 JSON의 key를 갱신
function tuningSavePlugin(): Plugin {
  return {
    name: 'tuning-save',
    configureServer(server) {
      server.middlewares.use('/__save-tuning', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const { target, key, value } = JSON.parse(body);
            const file = TUNING_FILES[target];
            if (!file) { res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown target' })); return; }
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            data[key] = value;
            fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Serve the asset/ folder as static files at the root URL
  // e.g. asset/warrok/Walking.glb → /warrok/Walking.glb
  publicDir: 'asset',
  plugins: [tuningSavePlugin()],
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    exclude: ['three'],
  },
});
