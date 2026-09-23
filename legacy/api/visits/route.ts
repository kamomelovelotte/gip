import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { visits } from "@/db/schema";
import { getRequestUserId, unauthorizedResponse } from "@/lib/request-user";

const results = new Set(["승", "패", "무"]);

export async function GET(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const rows = await getDb()
      .select()
      .from(visits)
      .where(eq(visits.userId, userId))
      .orderBy(desc(visits.gameDate), desc(visits.id))
      .limit(50);
    return Response.json({ visits: rows });
  } catch (error) {
    console.error("visits:get", error);
    return Response.json(
      { error: "직관 기록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const payload = (await request.json()) as {
      gameDate?: string;
      league?: string;
      awayTeam?: string;
      homeTeam?: string;
      ballpark?: string;
      seat?: string;
      score?: string;
      result?: string;
      memo?: string;
    };
    const values = {
      userId,
      gameDate: payload.gameDate?.trim().slice(0, 10) ?? "",
      league: payload.league?.trim().slice(0, 20) ?? "",
      awayTeam: payload.awayTeam?.trim().slice(0, 60) ?? "",
      homeTeam: payload.homeTeam?.trim().slice(0, 60) ?? "",
      ballpark: payload.ballpark?.trim().slice(0, 80) ?? "",
      seat: payload.seat?.trim().slice(0, 80) ?? "",
      score: payload.score?.trim().slice(0, 30) ?? "",
      result: payload.result?.trim() ?? "",
      memo: payload.memo?.trim().slice(0, 240) ?? "",
    };
    if (
      !values.gameDate ||
      !values.league ||
      !values.awayTeam ||
      !values.homeTeam ||
      !values.ballpark ||
      !results.has(values.result)
    ) {
      return Response.json(
        { error: "날짜, 리그, 팀, 구장, 결과를 확인해주세요." },
        { status: 400 },
      );
    }

    const [visit] = await getDb().insert(visits).values(values).returning();
    return Response.json({ visit }, { status: 201 });
  } catch (error) {
    console.error("visits:post", error);
    return Response.json(
      { error: "직관 기록을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
