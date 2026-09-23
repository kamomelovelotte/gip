import type { CSSProperties } from 'react';
// Use transparent PNG cutouts of the original official character sheet.
const poses = {
 blanket:[746,32,494,232], ball:[784,539,106,94], happy:[1010,531,110,102], sad:[1374,531,146,101], sleep:[1239,530,138,100],
 1:[38,849,84,73],2:[147,849,78,73],3:[263,842,84,80],4:[375,842,80,80],5:[491,835,86,87],6:[606,842,78,80],7:[722,840,80,82],8:[823,830,101,92],
} as const;
export type WooriPose = keyof typeof poses;
export function Woori({pose='blanket',className='',label='이불 속에서 야구공을 안고 있는 우리'}:{pose?:WooriPose;className?:string;label?:string}){
 const [,,w,h]=poses[pose];
 return <span role="img" aria-label={label} className={`woori ${className}`} style={{aspectRatio:`${w}/${h}`} as CSSProperties}><img src={`/brand/woori/${pose}.png`} alt="" draggable={false}/></span>;
}
export const growth = [
 {name:'야구 새싹',count:0,description:'이불 속에서 야구공을 꼭 안고 있어요.'},
 {name:'공과 친구',count:1,description:'이불 밖으로 나와 공과 친해지는 중이에요.'},
 {name:'캐치볼 연습',count:3,description:'모자와 글러브를 챙겼어요.'},
 {name:'유니폼 준비',count:7,description:'나만의 유니폼을 준비하고 있어요.'},
 {name:'리틀야구단 입단',count:15,description:'배트를 들고 야구를 시작해요.'},
 {name:'유소년 선수',count:30,description:'조금씩 야구를 배우고 있어요.'},
 {name:'신인 선수',count:50,description:'새로운 경기들이 기다리고 있어요.'},
 {name:'프로 야구선수',count:100,description:'다음 경기도 함께해요.'},
];
export function growthIndex(count:number){return growth.reduce((level,stage,i)=>count>=stage.count?i:level,0);}
