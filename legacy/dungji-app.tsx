"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Heart,
  Home,
  MapPin,
  NotebookPen,
  Radio,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

type Team = { id: string; name: string; score: number | null };
type Game = {
  id: string;
  league: "KBO" | "MLB" | "NPB";
  away: Team;
  home: Team;
  status: "live" | "final" | "scheduled";
  statusLabel: string;
  startTime: string;
  venue: string;
  source: "live" | "demo";
};
type Favorite = { id: number; teamId: string; teamName: string; league: string };
type Review = {
  id: number;
  gameId: string;
  gameLabel: string;
  mood: string;
  content: string;
  createdAt: string;
};
type Visit = {
  id: number;
  gameDate: string;
  league: string;
  awayTeam: string;
  homeTeam: string;
  ballpark: string;
  seat: string;
  score: string;
  result: "승" | "패" | "무";
  memo: string;
};

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const initialGames: Game[] = [
  {
    id: `kbo-lg-doosan-${today}`,
    league: "KBO",
    away: { id: "kbo-lg", name: "LG 트윈스", score: null },
    home: { id: "kbo-doosan", name: "두산 베어스", score: null },
    status: "scheduled",
    statusLabel: "데이터 연결 준비",
    startTime: `${today}T18:30:00+09:00`,
    venue: "잠실야구장",
    source: "demo",
  },
  {
    id: `npb-giants-tigers-${today}`,
    league: "NPB",
    away: { id: "npb-giants", name: "요미우리 자이언츠", score: null },
    home: { id: "npb-tigers", name: "한신 타이거스", score: null },
    status: "scheduled",
    statusLabel: "데이터 연결 준비",
    startTime: `${today}T18:00:00+09:00`,
    venue: "한신 고시엔 구장",
    source: "demo",
  },
];

const teamCatalog = [
  { id: "kbo-lg", name: "LG 트윈스", league: "KBO", code: "LG", color: "#c30452" },
  { id: "kbo-doosan", name: "두산 베어스", league: "KBO", code: "두", color: "#131230" },
  { id: "kbo-hanwha", name: "한화 이글스", league: "KBO", code: "한", color: "#f37321" },
  { id: "kbo-kt", name: "KT 위즈", league: "KBO", code: "KT", color: "#1c1c1c" },
  { id: "npb-giants", name: "요미우리 자이언츠", league: "NPB", code: "YG", color: "#f36c21" },
  { id: "npb-tigers", name: "한신 타이거스", league: "NPB", code: "HT", color: "#d6ac00" },
  { id: "mlb-147", name: "New York Yankees", league: "MLB", code: "NYY", color: "#132448" },
  { id: "mlb-119", name: "Los Angeles Dodgers", league: "MLB", code: "LAD", color: "#005a9c" },
  { id: "mlb-111", name: "Boston Red Sox", league: "MLB", code: "BOS", color: "#bd3039" },
];
const moods = ["짜릿", "행복", "아쉬움", "화남"];

function gameLabel(game: Game) {
  return `${game.away.name} vs ${game.home.name}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function jsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
  return payload;
}

export function DungjiApp({
  user,
  signOutPath,
}: {
  user: { displayName: string; email: string };
  signOutPath: string;
}) {
  const [activeTab, setActiveTab] = useState("scores");
  const [league, setLeague] = useState("ALL");
  const [date, setDate] = useState(today);
  const [games, setGames] = useState<Game[]>(initialGames);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [mlbLive, setMlbLive] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(initialGames[0].id);
  const [reviewMood, setReviewMood] = useState("짜릿");
  const [reviewText, setReviewText] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitForm, setVisitForm] = useState({
    gameDate: today,
    league: "KBO",
    awayTeam: "",
    homeTeam: "",
    ballpark: "",
    seat: "",
    score: "",
    result: "승",
    memo: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    setGamesLoading(true);
    fetch(`/api/games?date=${date}`, { signal: controller.signal })
      .then((response) => jsonOrError<{ games: Game[]; mlbLive: boolean }>(response))
      .then((payload) => {
        setGames(payload.games);
        setMlbLive(payload.mlbLive);
        if (payload.games[0]) setSelectedGameId(payload.games[0].id);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("스코어를 불러오지 못해 데모 일정을 보여드려요.");
      })
      .finally(() => setGamesLoading(false));
    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    const load = async <T,>(url: string, key: string, setter: (rows: T[]) => void) => {
      try {
        const response = await fetch(url);
        const payload = await jsonOrError<Record<string, T[]>>(response);
        setter(payload[key] ?? []);
      } catch {
        toast.error("내 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    };
    void Promise.all([
      load<Favorite>("/api/favorites", "favorites", setFavorites),
      load<Review>("/api/reviews", "reviews", setReviews),
      load<Visit>("/api/visits", "visits", setVisits),
    ]);
  }, []);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.teamId)),
    [favorites],
  );
  const filteredGames = useMemo(() => {
    const list = league === "ALL" ? games : games.filter((game) => game.league === league);
    return [...list].sort((a, b) => {
      const aFavorite = favoriteIds.has(a.away.id) || favoriteIds.has(a.home.id) ? 1 : 0;
      const bFavorite = favoriteIds.has(b.away.id) || favoriteIds.has(b.home.id) ? 1 : 0;
      return bFavorite - aFavorite;
    });
  }, [games, league, favoriteIds]);
  const allTeams = useMemo(() => {
    const known = new Map(teamCatalog.map((team) => [team.id, team]));
    for (const game of games) {
      for (const team of [game.away, game.home]) {
        if (!known.has(team.id)) {
          known.set(team.id, {
            id: team.id,
            name: team.name,
            league: game.league,
            code: team.name.split(" ").map((word) => word[0]).join("").slice(0, 3),
            color: "#173a63",
          });
        }
      }
    }
    return [...known.values()];
  }, [games]);

  const toggleFavorite = useCallback(
    async (teamId: string, teamName: string, teamLeague: string) => {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, teamName, league: teamLeague }),
      });
      const payload = await jsonOrError<{ favorited: boolean; favorite?: Favorite }>(response);
      if (payload.favorited && payload.favorite) {
        setFavorites((current) => [
          ...current.filter((favorite) => favorite.teamId !== teamId),
          payload.favorite!,
        ]);
        toast.success(`${teamName}을(를) 내 팀에 담았어요.`);
      } else {
        setFavorites((current) => current.filter((favorite) => favorite.teamId !== teamId));
        toast.success(`${teamName}을(를) 내 팀에서 뺐어요.`);
      }
      return payload;
    },
    [],
  );

  const saveReview = useCallback(
    async (input: { gameId: string; gameLabel: string; mood: string; content: string }) => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await jsonOrError<{ review: Review }>(response);
      setReviews((current) => [payload.review, ...current]);
      toast.success("오늘의 야구를 둥지에 남겼어요.");
      return payload.review;
    },
    [],
  );

  const saveVisit = useCallback(async (input: Omit<Visit, "id">) => {
    const response = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await jsonOrError<{ visit: Visit }>(response);
    setVisits((current) => [payload.visit, ...current]);
    toast.success("직관 기록이 저장됐어요.");
    return payload.visit;
  }, []);

  useEffect(() => {
    type Tool = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown | Promise<unknown>;
    };
    type Context = {
      registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    };

    register({
      name: "show_league_scores",
      title: "리그 경기 보기",
      description: "둥지의 스코어 탭을 열고 선택한 리그 경기만 표시합니다.",
      inputSchema: {
        type: "object",
        properties: { league: { type: "string", enum: ["ALL", "KBO", "MLB", "NPB"] } },
        required: ["league"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const value = (input as { league?: string }).league;
        if (!value || !["ALL", "KBO", "MLB", "NPB"].includes(value)) throw new Error("지원하는 리그가 아닙니다.");
        setLeague(value);
        setActiveTab("scores");
        return { league: value, visibleGames: games.filter((game) => value === "ALL" || game.league === value).length };
      },
    });
    register({
      name: "toggle_favorite_team",
      title: "응원팀 즐겨찾기 전환",
      description: "팀을 사용자의 내 팀 목록에 추가하거나 제거합니다.",
      inputSchema: {
        type: "object",
        properties: {
          teamId: { type: "string" },
          teamName: { type: "string" },
          league: { type: "string", enum: ["KBO", "MLB", "NPB"] },
        },
        required: ["teamId", "teamName", "league"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { teamId?: string; teamName?: string; league?: string };
        if (!value.teamId || !value.teamName || !value.league) throw new Error("팀 정보가 필요합니다.");
        return toggleFavorite(value.teamId, value.teamName, value.league);
      },
    });
    register({
      name: "add_game_review",
      title: "한 줄 경기 후기 남기기",
      description: "선택한 경기에 감정과 120자 이내의 한 줄 후기를 저장합니다.",
      inputSchema: {
        type: "object",
        properties: {
          gameId: { type: "string" },
          gameLabel: { type: "string" },
          mood: { type: "string", enum: moods },
          content: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["gameId", "gameLabel", "mood", "content"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const value = input as { gameId?: string; gameLabel?: string; mood?: string; content?: string };
        if (!value.gameId || !value.gameLabel || !value.mood || !value.content?.trim()) throw new Error("경기, 감정, 후기 내용이 필요합니다.");
        const review = await saveReview({
          gameId: value.gameId,
          gameLabel: value.gameLabel,
          mood: value.mood,
          content: value.content.trim(),
        });
        return { id: review.id, saved: true };
      },
    });
    return () => lifecycle.abort();
  }, [games, saveReview, toggleFavorite]);

  const submitReview = async () => {
    const game = games.find((item) => item.id === selectedGameId);
    if (!game || !reviewText.trim()) return toast.error("경기와 한 줄 후기를 입력해주세요.");
    setReviewSaving(true);
    try {
      await saveReview({ gameId: game.id, gameLabel: gameLabel(game), mood: reviewMood, content: reviewText.trim() });
      setReviewText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "후기를 저장하지 못했어요.");
    } finally {
      setReviewSaving(false);
    }
  };

  const submitVisit = async () => {
    setVisitSaving(true);
    try {
      await saveVisit(visitForm as Omit<Visit, "id">);
      setVisitForm((current) => ({ ...current, awayTeam: "", homeTeam: "", ballpark: "", seat: "", score: "", memo: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "직관 기록을 저장하지 못했어요.");
    } finally {
      setVisitSaving(false);
    }
  };

  const visitWins = visits.filter((visit) => visit.result === "승").length;
  const decidedVisits = visits.filter((visit) => visit.result !== "무").length;
  const winRate = decidedVisits ? Math.round((visitWins / decidedVisits) * 100) : 0;
  const ballparks = new Set(visits.map((visit) => visit.ballpark)).size;

  const scoreCard = (game: Game) => (
    <article key={game.id} className={`score-card ${game.status === "live" ? "is-live" : ""}`}>
      <div className="score-card-top">
        <div className="flex items-center gap-2">
          <Badge className="league-badge" variant="outline">{game.league}</Badge>
          {game.source === "demo" && <span className="demo-label">DEMO</span>}
        </div>
        <span className={`game-status status-${game.status}`}>
          {game.status === "live" && <Radio aria-hidden="true" />}{game.statusLabel}
        </span>
      </div>
      {[game.away, game.home].map((team) => (
        <div className="team-row" key={team.id}>
          <button
            type="button"
            className={`favorite-button ${favoriteIds.has(team.id) ? "selected" : ""}`}
            aria-label={`${team.name} ${favoriteIds.has(team.id) ? "즐겨찾기 해제" : "즐겨찾기"}`}
            onClick={() => void toggleFavorite(team.id, team.name, game.league).catch((error) => toast.error(error.message))}
          ><Star aria-hidden="true" /></button>
          <span className="team-dot">{team.name.slice(0, 1)}</span>
          <strong>{team.name}</strong>
          <span className="team-score">{team.score ?? "–"}</span>
        </div>
      ))}
      <div className="score-card-bottom">
        <span><Clock3 aria-hidden="true" />{formatTime(game.startTime)}</span>
        <span><MapPin aria-hidden="true" />{game.venue || "구장 정보 준비 중"}</span>
        <button type="button" onClick={() => { setSelectedGameId(game.id); setActiveTab("reviews"); }}>
          한 줄 후기 <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </article>
  );

  return (
    <div className="dungji-shell">
      <Toaster position="top-center" richColors />
      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="wordmark" onClick={() => setActiveTab("scores")}>
            <span className="nest-mark" aria-hidden="true"><span /></span><span>둥지</span>
          </button>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="contents">
            <TabsList variant="line" className="desktop-nav" aria-label="주요 메뉴">
              <TabsTrigger value="scores">스코어</TabsTrigger>
              <TabsTrigger value="favorites">내 팀</TabsTrigger>
              <TabsTrigger value="reviews">한 줄 후기</TabsTrigger>
              <TabsTrigger value="visits">직관일지</TabsTrigger>
            </TabsList>
          </Tabs>
          <a className="account-chip" href={signOutPath} target="_top" title="로그아웃">
            <span className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
            <span><small>MY DUGOUT</small>{user.displayName}</span>
          </a>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="app-tabs">
        <main className="main-content">
          <TabsContent value="scores" className="tab-panel">
            <section className="score-hero">
              <div>
                <p className="eyebrow"><span /> TODAY&apos;S BASEBALL</p>
                <h1>오늘, 야구는<br /><em>여기 모여 있어요.</em></h1>
                <p className="hero-copy">MLB는 실시간으로, KBO·NPB는 데이터 파트너 연결 전 데모 일정으로 보여드려요.</p>
              </div>
              <div className="hero-tools">
                <label className="date-control"><CalendarDays aria-hidden="true" /><span className="sr-only">경기 날짜</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <span className={`data-state ${mlbLive ? "connected" : ""}`}><span /> {mlbLive ? "MLB LIVE CONNECTED" : "MLB 연결 확인 중"}</span>
              </div>
            </section>

            <section className="favorite-rail" aria-label="내 팀 바로가기">
              <div className="rail-title"><Heart aria-hidden="true" />내 팀</div>
              {favorites.length ? (
                <div className="favorite-pills">{favorites.map((favorite) => <button key={favorite.teamId} type="button" onClick={() => setLeague(favorite.league)}><span>{favorite.teamName.slice(0, 1)}</span>{favorite.teamName}</button>)}</div>
              ) : <p>경기 카드의 별을 눌러 응원팀을 가장 먼저 모아보세요.</p>}
              <button type="button" className="rail-link" onClick={() => setActiveTab("favorites")}>팀 고르기 <ChevronRight /></button>
            </section>

            <section className="scores-section">
              <div className="section-heading">
                <div><span className="section-kicker">GAME BOARD</span><h2>경기 스코어</h2></div>
                <div className="league-switcher" role="group" aria-label="리그 필터">
                  {["ALL", "KBO", "MLB", "NPB"].map((item) => <button key={item} type="button" className={league === item ? "active" : ""} onClick={() => setLeague(item)}>{item === "ALL" ? "전체" : item}</button>)}
                </div>
              </div>
              {gamesLoading ? (
                <div className="score-grid" aria-busy="true">{[0, 1, 2, 3].map((item) => <div className="score-skeleton" key={item} />)}</div>
              ) : filteredGames.length ? <div className="score-grid">{filteredGames.map(scoreCard)}</div> : (
                <div className="empty-card"><Search /><h3>이 날짜에는 경기가 없어요.</h3><p>다른 날짜나 리그를 골라보세요.</p></div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="favorites" className="tab-panel">
            <section className="page-intro compact"><p className="eyebrow"><span /> MY TEAMS</p><h1>내 팀만 쏙,<br /><em>한눈에.</em></h1><p>별을 누르면 다음 방문에도 그대로 남아 있어요.</p></section>
            <section className="team-catalog">
              {allTeams.map((team) => {
                const selected = favoriteIds.has(team.id);
                return (
                  <button type="button" key={team.id} className={`team-tile ${selected ? "selected" : ""}`} onClick={() => void toggleFavorite(team.id, team.name, team.league).catch((error) => toast.error(error.message))}>
                    <span className="team-emblem" style={{ backgroundColor: team.color }}>{team.code}</span>
                    <span><small>{team.league}</small><strong>{team.name}</strong></span><Star aria-hidden="true" />
                  </button>
                );
              })}
            </section>
          </TabsContent>

          <TabsContent value="reviews" className="tab-panel">
            <section className="page-intro compact"><p className="eyebrow"><span /> ONE LINE, ONE GAME</p><h1>오늘 경기는,<br /><em>한마디로?</em></h1></section>
            <div className="two-column-layout">
              <section className="form-card sticky-card">
                <div className="card-number">01</div><h2>한 줄 후기 남기기</h2>
                <label className="field-label">경기</label>
                <Select value={selectedGameId} onValueChange={setSelectedGameId}><SelectTrigger className="w-full"><SelectValue placeholder="경기를 선택하세요" /></SelectTrigger><SelectContent>{games.map((game) => <SelectItem key={game.id} value={game.id}>{game.league} · {gameLabel(game)}</SelectItem>)}</SelectContent></Select>
                <label className="field-label">오늘의 감정</label>
                <div className="mood-row">{moods.map((mood) => <button type="button" key={mood} className={reviewMood === mood ? "active" : ""} onClick={() => setReviewMood(mood)}>{mood}</button>)}</div>
                <label className="field-label" htmlFor="review-text">한 줄 후기</label>
                <Textarea id="review-text" value={reviewText} maxLength={120} onChange={(event) => setReviewText(event.target.value)} placeholder="9회말 그 장면, 아직도 심장이 뛴다." />
                <div className="form-footer"><span>{reviewText.length}/120</span><Button onClick={() => void submitReview()} disabled={reviewSaving}>{reviewSaving ? "저장 중…" : "둥지에 남기기"}</Button></div>
              </section>
              <section className="records-column">
                <div className="records-heading"><div><span className="section-kicker">MY REVIEWS</span><h2>내가 남긴 경기</h2></div><Badge variant="outline">{reviews.length}개의 기록</Badge></div>
                {reviews.length ? reviews.map((review) => <article className="review-card" key={review.id}><span className="mood-stamp">{review.mood}</span><div><small>{review.gameLabel}</small><p>“{review.content}”</p><time>{new Date(review.createdAt).toLocaleDateString("ko-KR")}</time></div></article>) : <div className="empty-card"><NotebookPen /><h3>첫 후기를 기다리고 있어요.</h3><p>짧을수록 그날의 감정이 또렷하게 남아요.</p></div>}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="visits" className="tab-panel">
            <section className="visit-hero">
              <div><p className="eyebrow"><span /> BALLPARK LOG</p><h1>내가 본 야구는<br /><em>기록이 된다.</em></h1></div>
              <div className="stat-cluster"><div><strong>{visits.length}</strong><span>총 직관</span></div><div><strong>{winRate}<small>%</small></strong><span>직관 승률</span></div><div><strong>{ballparks}</strong><span>방문 구장</span></div></div>
            </section>
            <div className="two-column-layout visits-layout">
              <section className="form-card">
                <div className="card-number">02</div><h2>새 직관 기록</h2>
                <div className="form-grid">
                  <label><span>날짜</span><Input type="date" value={visitForm.gameDate} onChange={(event) => setVisitForm({ ...visitForm, gameDate: event.target.value })} /></label>
                  <label><span>리그</span><Select value={visitForm.league} onValueChange={(value) => setVisitForm({ ...visitForm, league: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["KBO", "MLB", "NPB"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
                  <label><span>원정팀</span><Input value={visitForm.awayTeam} onChange={(event) => setVisitForm({ ...visitForm, awayTeam: event.target.value })} placeholder="예: LG 트윈스" /></label>
                  <label><span>홈팀</span><Input value={visitForm.homeTeam} onChange={(event) => setVisitForm({ ...visitForm, homeTeam: event.target.value })} placeholder="예: 두산 베어스" /></label>
                  <label className="full"><span>구장</span><Input value={visitForm.ballpark} onChange={(event) => setVisitForm({ ...visitForm, ballpark: event.target.value })} placeholder="잠실야구장" /></label>
                  <label><span>좌석</span><Input value={visitForm.seat} onChange={(event) => setVisitForm({ ...visitForm, seat: event.target.value })} placeholder="1루 블루석" /></label>
                  <label><span>스코어</span><Input value={visitForm.score} onChange={(event) => setVisitForm({ ...visitForm, score: event.target.value })} placeholder="5 : 3" /></label>
                </div>
                <label className="field-label">결과</label>
                <div className="result-row">{["승", "패", "무"].map((result) => <button type="button" key={result} className={visitForm.result === result ? "active" : ""} onClick={() => setVisitForm({ ...visitForm, result })}>{result}</button>)}</div>
                <label className="field-label" htmlFor="visit-memo">기억하고 싶은 순간</label>
                <Textarea id="visit-memo" value={visitForm.memo} onChange={(event) => setVisitForm({ ...visitForm, memo: event.target.value })} placeholder="응원가가 가장 크게 들렸던 순간을 적어보세요." />
                <Button className="w-full" onClick={() => void submitVisit()} disabled={visitSaving}>{visitSaving ? "저장 중…" : "직관 기록 저장"}</Button>
              </section>
              <section className="records-column">
                <div className="records-heading"><div><span className="section-kicker">MY TICKETS</span><h2>직관 타임라인</h2></div></div>
                {visits.length ? visits.map((visit) => <article className="ticket-card" key={visit.id}><div className={`ticket-result result-${visit.result}`}>{visit.result}</div><div className="ticket-main"><div><Badge variant="outline">{visit.league}</Badge><time>{visit.gameDate}</time></div><h3>{visit.awayTeam} <span>vs</span> {visit.homeTeam}</h3><p><MapPin />{visit.ballpark}{visit.seat ? ` · ${visit.seat}` : ""}</p>{visit.memo && <blockquote>“{visit.memo}”</blockquote>}</div><div className="ticket-score">{visit.score || "—"}</div></article>) : <div className="empty-card"><BookOpen /><h3>아직 빈 직관일지예요.</h3><p>첫 야구장의 공기부터 천천히 채워보세요.</p></div>}
              </section>
            </div>
          </TabsContent>
        </main>

        <TabsList className="mobile-nav" aria-label="모바일 주요 메뉴">
          <TabsTrigger value="scores"><Home /><span>홈</span></TabsTrigger>
          <TabsTrigger value="favorites"><Star /><span>내 팀</span></TabsTrigger>
          <TabsTrigger value="reviews"><NotebookPen /><span>후기</span></TabsTrigger>
          <TabsTrigger value="visits"><Trophy /><span>직관</span></TabsTrigger>
        </TabsList>
      </Tabs>
      <footer><span>둥지</span><p>야구가 머무는 가장 가까운 곳.</p><div><CircleUserRound /> {user.email}</div></footer>
    </div>
  );
}
