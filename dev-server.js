// Servidor de desenvolvimento: abre o programa no navegador (sem Electron) para testar a interface.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'src'), dataFile = path.join(__dirname, 'dev-data.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  if (req.url === '/api/db') {
    if (req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { fs.writeFileSync(dataFile, b); res.end('{}'); });
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : 'null');
    }
    return;
  }
  const f = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
  res.end(fs.readFileSync(f));
}).listen(process.env.PORT || 5173, () => console.log('http://localhost:' + (process.env.PORT || 5173)));
