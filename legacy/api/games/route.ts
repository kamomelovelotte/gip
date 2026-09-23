type MlbSchedule = {
  dates?: Array<{
    games?: Array<{
      gamePk: number;
      gameDate: string;
      status?: { abstractGameState?: string; detailedState?: string };
      teams?: {
        away?: { score?: number; team?: { id?: number; name?: string } };
        home?: { score?: number; team?: { id?: number; name?: string } };
      };
      linescore?: { currentInningOrdinal?: string };
      venue?: { name?: string };
    }>;
  }>;
};

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function demoGames(date: string) {
  return [
    {
      id: `kbo-lg-doosan-${date}`,
      league: "KBO",
      away: { id: "kbo-lg", name: "LG 트윈스", score: null },
      home: { id: "kbo-doosan", name: "두산 베어스", score: null },
      status: "scheduled",
      statusLabel: "데이터 연결 준비",
      startTime: `${date}T18:30:00+09:00`,
      venue: "잠실야구장",
      source: "demo",
    },
    {
      id: `kbo-hanwha-kt-${date}`,
      league: "KBO",
      away: { id: "kbo-hanwha", name: "한화 이글스", score: null },
      home: { id: "kbo-kt", name: "KT 위즈", score: null },
      status: "scheduled",
      statusLabel: "데이터 연결 준비",
      startTime: `${date}T18:30:00+09:00`,
      venue: "수원 KT 위즈 파크",
      source: "demo",
    },
    {
      id: `npb-giants-tigers-${date}`,
      league: "NPB",
      away: { id: "npb-giants", name: "요미우리 자이언츠", score: null },
      home: { id: "npb-tigers", name: "한신 타이거스", score: null },
      status: "scheduled",
      statusLabel: "데이터 연결 준비",
      startTime: `${date}T18:00:00+09:00`,
      venue: "한신 고시엔 구장",
      source: "demo",
    },
  ];
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedDate = requestUrl.searchParams.get("date") ?? todayInSeoul();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : todayInSeoul();

  try {
    const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
    url.searchParams.set("sportId", "1");
    url.searchParams.set("date", date);
    url.searchParams.set("hydrate", "linescore,team");
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw new Error(`MLB schedule ${response.status}`);
    const payload = (await response.json()) as MlbSchedule;
    const mlbGames = (payload.dates?.[0]?.games ?? []).map((game) => {
      const abstract = game.status?.abstractGameState ?? "Preview";
      const status =
        abstract === "Live" ? "live" : abstract === "Final" ? "final" : "scheduled";
      return {
        id: `mlb-${game.gamePk}`,
        league: "MLB",
        away: {
          id: `mlb-${game.teams?.away?.team?.id ?? "away"}`,
          name: game.teams?.away?.team?.name ?? "Away",
          score: game.teams?.away?.score ?? null,
        },
        home: {
          id: `mlb-${game.teams?.home?.team?.id ?? "home"}`,
          name: game.teams?.home?.team?.name ?? "Home",
          score: game.teams?.home?.score ?? null,
        },
        status,
        statusLabel:
          status === "live"
            ? game.linescore?.currentInningOrdinal ?? "LIVE"
            : game.status?.detailedState ?? "예정",
        startTime: game.gameDate,
        venue: game.venue?.name ?? "",
        source: "live",
      };
    });

    return Response.json({
      date,
      games: [...mlbGames, ...demoGames(date)],
      mlbLive: true,
    });
  } catch (error) {
    console.error("games:mlb", error);
    return Response.json({ date, games: demoGames(date), mlbLive: false });
  }
}
