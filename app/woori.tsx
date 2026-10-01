import type { CSSProperties } from 'react';
// Use transparent PNG cutouts of the original official character sheet.
const poses = {
 blanket:[746,32,494,232], ball:[784,539,106,94], happy:[1010,531,110,102], sad:[1374,531,146,101], sleep:[1239,530,138,100],
} as const;
export type WooriPose = keyof typeof poses;
export function Woori({pose='blanket',className='',label='이불 속에서 야구공을 안고 있는 우리'}:{pose?:WooriPose;className?:string;label?:string}){
 const [,,w,h]=poses[pose];
 return <span role="img" aria-label={label} className={`woori ${className}`} style={{aspectRatio:`${w}/${h}`} as CSSProperties}><img src={`/brand/woori/${pose}.png`} alt="" draggable={false}/></span>;
}
