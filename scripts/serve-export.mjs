import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('out');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.png':'image/png'};
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
 try{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 let file=resolve(root,'.'+name);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('페이지를 찾을 수 없습니다.');}
}).listen(port,()=>console.log(`GIP is running on http://localhost:${port}`));
