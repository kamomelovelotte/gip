import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'GIP · 집', description:'야구가 있는 곳, 어디든 우리 집. 우리 팀 경기와 순위, 한줄평과 직관 후기.', icons:{icon:'/favicon.svg'}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#ffffff'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
