import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
const BUILD = resolve('build');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
export async function startServer(){
 const server=createServer((req,res)=>{const u=new URL(req.url,'http://l');let p=decodeURIComponent(u.pathname);if(p.endsWith('/'))p+='index.html';let f=join(BUILD,normalize(p));if(!existsSync(f)||statSync(f).isDirectory()){const h=f+'.html';if(existsSync(h))f=h;else{const e=extname(f);if(e&&e!=='.html'){res.writeHead(404);res.end('nf');return;}f=join(BUILD,'200.html');}}res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream','Cache-Control':'no-store'});createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {origin:`http://127.0.0.1:${server.address().port}`, close:()=>new Promise(r=>server.close(r))};
}
