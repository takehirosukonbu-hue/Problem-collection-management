import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const port=Number(process.env.PORT||4173);
const host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
  const target=path.resolve(root,name);
  if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
  const body=await fs.readFile(target);
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,host,()=>console.log(`Local: http://localhost:${port}${host==='0.0.0.0'?' (LAN enabled)':''}`));
