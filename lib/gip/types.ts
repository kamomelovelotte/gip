export const LEAGUES = ['KBO','NPB','MLB','LMB','LIDOM','LBPRC','LVBP','SNB','CPBL','CBL','ABL','DBL','Serie A Gold','Division 1','Extraliga','Hoofdklasse','División de Honor Oro','WPBL'] as const;
export type League = typeof LEAGUES[number];
export const CONTINENTS = ['아시아','북중미','남미·카리브','오세아니아','유럽','여자야구'] as const;
export type Continent = typeof CONTINENTS[number];
export const LEAGUES_BY_CONTINENT: Record<Continent, readonly League[]> = {
 '아시아':['KBO','NPB','CPBL','CBL'],
 '북중미':['MLB','LMB'],
 '남미·카리브':['LIDOM','LBPRC','LVBP','SNB'],
 '오세아니아':['ABL'],
 '유럽':['DBL','Serie A Gold','Division 1','Extraliga','Hoofdklasse','División de Honor Oro'],
 '여자야구':['WPBL']
};
export const LEGACY_LEAGUE_NAMES: Record<string, League> = {
 'Serie A':'Serie A Gold',
 '멕시칸 리그':'LMB','도미니카 윈터리그':'LIDOM','푸에르토리코 윈터리그':'LBPRC',
 '베네수엘라 윈터리그':'LVBP','쿠바 내셔널시리즈':'SNB','중국야구리그':'CBL',
 '호주야구리그':'ABL','독일 DBL':'DBL','이탈리아 세리에 A':'Serie A Gold',
 '프랑스 디비시옹 1':'Division 1','체코 엑스트랄리가':'Extraliga',
 '네덜란드 후프트클라세':'Hoofdklasse','스페인 야구리그':'División de Honor Oro',
 '미국 여자야구':'WPBL'
};
export type Team = { id: string; league: League; name: string; short: string; group: string };
export type Game = { id: string; league: League; date: string; startsAt: string; awayId: string; homeId: string; venue: string; status: 'scheduled' | 'final' | 'in_progress' | 'postponed'; awayScore: number | null; homeScore: number | null; timeTBD?: boolean; statusLabel?: string; inning?: string };
export type Standing = { teamId: string; group?: string; played: number; wins: number; losses: number; draws: number; percentage: number; gamesBehind: number };
export type Profile = { id: string; gipCode: string; nickname: string; teamIds: string[]; leagues: League[]; notifications: { start: boolean; final: boolean }; createdAt: string };
export type Review = { id: string; userId: string; kind: 'line' | 'visit'; gameId: string | null; date: string; matchup: string; venue: string; content: string; seat: string; photoData?: string; photoName?: string; createdAt: string; updatedAt: string };
export type ReviewInput = Omit<Review, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export interface BaseballRepository { getTeams(): Promise<Team[]>; getGames(date: string): Promise<Game[]>; getStandings(league: League, season?: number): Promise<Standing[]>; }
export interface UserRepository { current(): Promise<Profile | null>; signUp(nickname: string, password: string): Promise<Profile>; signIn(code: string, password: string): Promise<Profile>; signOut(): Promise<void>; update(profile: Profile): Promise<Profile>; reviews(): Promise<Review[]>; saveReview(input: ReviewInput, id?: string): Promise<Review>; deleteReview(id: string): Promise<void>; }
