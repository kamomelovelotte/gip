import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites } from "@/db/schema";
import { getRequestUserId, unauthorizedResponse } from "@/lib/request-user";

export async function GET(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const rows = await getDb()
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(asc(favorites.createdAt));
    return Response.json({ favorites: rows });
  } catch (error) {
    console.error("favorites:get", error);
    return Response.json(
      { error: "즐겨찾기를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const payload = (await request.json()) as {
      teamId?: string;
      teamName?: string;
      league?: string;
    };
    const teamId = payload.teamId?.trim().slice(0, 80) ?? "";
    const teamName = payload.teamName?.trim().slice(0, 80) ?? "";
    const league = payload.league?.trim().slice(0, 20) ?? "";
    if (!teamId || !teamName || !league) {
      return Response.json({ error: "팀 정보가 필요합니다." }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.teamId, teamId)))
      .limit(1);

    if (existing) {
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.teamId, teamId)));
      return Response.json({ favorited: false });
    }

    const [favorite] = await db
      .insert(favorites)
      .values({ userId, teamId, teamName, league })
      .returning();
    return Response.json({ favorited: true, favorite }, { status: 201 });
  } catch (error) {
    console.error("favorites:post", error);
    return Response.json(
      { error: "즐겨찾기를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
