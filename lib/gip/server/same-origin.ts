// Next.js may construct Request.url with an internal hostname. The HTTP Host
// header still identifies the origin that the browser actually requested.
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');if(!origin)return false;
 try{const source=new URL(origin),url=new URL(request.url),host=request.headers.get('host')??url.host;
 const protocol=process.env.VERCEL?(request.headers.get('x-forwarded-proto')??url.protocol.replace(':','')):url.protocol.replace(':','');
 return source.host===host && source.protocol===`${protocol}:`;
 }catch{return false;}
}
