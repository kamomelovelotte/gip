import type {League} from './types';
export const OFFICIAL_SOURCES:Record<League,{name:string;url:string;records?:string;note?:string}>={
 KBO:{name:'KBO',url:'https://www.koreabaseball.com/',records:'https://www.koreabaseball.com/Schedule/Schedule.aspx',note:'앱 중계: 네이버 스포츠'},
 NPB:{name:'일본야구기구 NPB',url:'https://npb.jp/',records:'https://npb.jp/games/',note:'앱 중계: Yahoo! JAPAN 스포나비'},
 MLB:{name:'MLB',url:'https://www.mlb.com/',records:'https://www.mlb.com/schedule'},
 LMB:{name:'Liga Mexicana de Beisbol',url:'https://lmb.com.mx/'},
 LIDOM:{name:'LIDOM',url:'https://lidom.com/',records:'https://estadisticas.lidom.com/'},
 LBPRC:{name:'LBPRC',url:'https://www.ligapr.com/'},
 LVBP:{name:'LVBP',url:'https://lvbp.com/'},
 SNB:{name:'쿠바 Serie Nacional',url:'https://www.beisbolcubano.cu/',records:'https://www.beisbolcubano.cu/general/calendario.aspx',note:'공식 예정 일정 연결 · 경기 결과·순위·문자중계는 공식 사이트에서 확인해 주세요.'},
 CPBL:{name:'중화직업봉구대연맹 CPBL',url:'https://www.cpbl.com.tw/',records:'https://www.cpbl.com.tw/schedule',note:'제공처 접근 제한으로 조회가 지연될 수 있어요.'},
 CBL:{name:'중국야구협회',url:'http://baseball.sport.org.cn/',note:'공식 사이트 응답을 확인하지 못해 자동 조회를 연결하지 않았어요.'},
 ABL:{name:'Australian Baseball League',url:'https://theabl.com.au/'},
 DBL:{name:'독일야구소프트볼협회 DBV',url:'https://www.baseball.de/',records:'https://www.baseball-softball.de/spielbetrieb/deutsche-baseball-liga/'},
 'Serie A Gold':{name:'이탈리아야구소프트볼연맹 FIBS',url:'https://www.fibs.it/',records:'https://www.fibs.it/it/disciplines/baseball',note:'공식 기록 페이지의 외부 접근 제한으로 자동 조회를 연결하지 못했어요.'},
 'Division 1':{name:'프랑스야구소프트볼연맹 FFBS',url:'https://ffbs.fr/division-1-baseball/',records:'https://ffbs.wbsc.org/',note:'공식 기록 페이지의 외부 접근 제한으로 자동 조회를 연결하지 못했어요.'},
 Extraliga:{name:'체코야구협회 ČBA',url:'https://baseball.cz/',records:'https://baseball.cz/competition/detail/1'},
 Hoofdklasse:{name:'네덜란드야구소프트볼협회 KNBSB',url:'https://www.knbsb.nl/',records:'https://www.knbsb.nl/competities/uitslagen/',note:'공식 기록 페이지의 외부 접근 제한으로 자동 조회를 연결하지 못했어요.'},
 'División de Honor Oro':{name:'스페인야구소프트볼연맹 RFEBS',url:'https://www.rfebs.es/',records:'https://www.rfebs.es/es/disciplines/baseball',note:'공식 기록 페이지의 외부 접근 제한으로 자동 조회를 연결하지 못했어요.'},
 WPBL:{name:'Women’s Professional Baseball League',url:'https://www.womensprobaseballleague.com/',records:'https://www.womensprobaseballleague.com/schedule/',note:'공식 기록 서비스가 인증을 요구해 자동 조회를 연결하지 못했어요.'}
};
export const OFFICIAL_DATA_LEAGUES:League[]=['DBL','Extraliga','SNB'];
