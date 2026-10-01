import { GameDetailPage } from './game-detail-page';
import { LEAGUES, type League } from '@/lib/gip/types';

export const metadata = {title:'경기 상세 · GIP'};
export default async function Page({params,searchParams}:{params:Promise<{gameId:string}>;searchParams:Promise<{league?:string;date?:string}>}) {
  const {gameId}=await params,{league,date}=await searchParams;
  const selected=LEAGUES.includes(league as League)?league as League:gameId.startsWith('naver-')?'KBO':gameId.startsWith('yahoo-')?'NPB':'MLB';
  return <GameDetailPage gameId={gameId} league={selected} date={date ?? ''}/>;
}
