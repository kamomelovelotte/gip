import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {id:'/',name:'GIP · 집',short_name:'GIP',lang:'ko',start_url:'/#home',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',icons:[{src:'/favicon.svg',sizes:'any',type:'image/svg+xml'}]};
}
