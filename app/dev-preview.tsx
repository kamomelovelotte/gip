'use client';
import { useEffect, useState } from 'react';
import { GipApp } from './gip-app';
export function DevPreview(){
 const [width,setWidth]=useState(0),[embedded,setEmbedded]=useState(true);
 useEffect(()=>setEmbedded(window.parent!==window),[]);
 if(embedded)return <GipApp/>;
 return <><div style={{position:'fixed',top:4,right:5,zIndex:100,fontSize:12,background:'white',border:'1px solid #ddd',padding:5,borderRadius:5}}><label>개발 화면 크기 <select aria-label="개발 화면 크기" value={width} onChange={e=>setWidth(Number(e.target.value))}><option value={0}>데스크톱</option><option value={390}>390px</option><option value={320}>320px</option></select></label></div>{width?<iframe title="모바일 GIP 미리보기" src="/" style={{display:'block',width,height:844,maxWidth:'100%',border:'1px solid #ddd',margin:'36px auto'}}/>:<GipApp/>}</>;
}
