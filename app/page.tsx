import { GipApp } from './gip-app';
import { DevPreview } from './dev-preview';
export default function Page(){return process.env.NODE_ENV==='development'?<DevPreview/>:<GipApp/>;}
