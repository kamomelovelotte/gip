import { CONTINENTS, LEAGUES_BY_CONTINENT, type Continent, type League } from './types';

export const leagueCountries: Record<League, string> = {
 KBO:'한국', NPB:'일본', CPBL:'대만', CBL:'중국', MLB:'미국·캐나다', LMB:'멕시코',
 LIDOM:'도미니카공화국', LBPRC:'푸에르토리코', LVBP:'베네수엘라', SNB:'쿠바',
 ABL:'호주', DBL:'독일', 'Serie A Gold':'이탈리아', 'Division 1':'프랑스',
 Extraliga:'체코', Hoofdklasse:'네덜란드', 'División de Honor Oro':'스페인', WPBL:'미국',
};
const name: Partial<Record<League,string>> = { MLB:'MLB·메이저리그' };
export const leagueLabel = (league:League) => `${name[league]??league}(${leagueCountries[league]})`;
const korean = new Intl.Collator('ko-KR');
export const orderedContinents = [...CONTINENTS].sort(korean.compare) as Continent[];
export const orderedLeagues = (continent:Continent) => [...LEAGUES_BY_CONTINENT[continent]].sort((a,b)=>korean.compare(leagueCountries[a],leagueCountries[b])||korean.compare(a,b));
const spokenPrefixes:Record<string,string>={ KIA:'기아', KT:'케이티', LG:'엘지', NC:'엔씨', SSG:'에스에스지', LA:'엘에이', HCAW:'에이치씨에이더블유', UVV:'유브이브이', BBC:'비비씨' };
const teamSortKey=(name:string)=>name.replace(/^[A-Z]+(?=\s)/,prefix=>spokenPrefixes[prefix]??prefix);
export const compareTeamNames=(a:string,b:string)=>korean.compare(teamSortKey(a),teamSortKey(b));
