export const runtime='nodejs';
export const maxDuration=60;
import {accountRequest} from '@/lib/gip/server/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}){return accountRequest(request,(await params).action);}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){return accountRequest(request,(await params).action);}
