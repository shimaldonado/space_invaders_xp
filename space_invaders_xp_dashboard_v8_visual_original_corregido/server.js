const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.pdf':'application/pdf', '.zip':'application/zip'
};

function ensureData(){
  fs.mkdirSync(DATA_DIR, { recursive:true });
  fs.mkdirSync(BACKUP_DIR, { recursive:true });
  if(!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, '{}', 'utf8');
}
function readBody(req){
  return new Promise((resolve, reject)=>{
    let body='';
    req.on('data', chunk=>{
      body += chunk;
      if(body.length > 20 * 1024 * 1024){
        req.destroy();
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', ()=>resolve(body));
    req.on('error', reject);
  });
}
function send(res, code, payload, type='application/json; charset=utf-8'){
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control':'no-store' });
  res.end(payload);
}
function safeFile(urlPath){
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const full = path.join(ROOT, clean);
  if(!full.startsWith(ROOT)) return null;
  return full;
}

ensureData();
const server = http.createServer(async (req, res)=>{
  try{
    if(req.url.startsWith('/api/state')){
      ensureData();
      if(req.method === 'GET'){
        return send(res, 200, fs.readFileSync(STATE_FILE, 'utf8') || '{}');
      }
      if(req.method === 'PUT' || req.method === 'POST'){
        const body = await readBody(req);
        let parsed;
        try{ parsed = JSON.parse(body); }catch(e){ return send(res, 400, JSON.stringify({ ok:false, error:'JSON inválido' })); }
        if(fs.existsSync(STATE_FILE)){
          const stamp = new Date().toISOString().replace(/[:.]/g,'-');
          fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-${stamp}.json`));
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(parsed, null, 2), 'utf8');
        return send(res, 200, JSON.stringify({ ok:true, savedAt:new Date().toISOString() }));
      }
      return send(res, 405, JSON.stringify({ ok:false, error:'Método no permitido' }));
    }
    const file = safeFile(req.url);
    if(!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
      return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }catch(err){
    send(res, 500, JSON.stringify({ ok:false, error:err.message }));
  }
});
server.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Dashboard XP disponible en http://localhost:${PORT}`);
  console.log('Los cambios se guardan en data/state.json');
});
