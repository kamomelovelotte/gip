import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { getRequestUserId, unauthorizedResponse } from "@/lib/request-user";

const moods = new Set(["짜릿", "행복", "아쉬움", "화남"]);

export async function GET(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const rows = await getDb()
      .select()
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(30);
    return Response.json({ reviews: rows });
  } catch (error) {
    console.error("reviews:get", error);
    return Response.json(
      { error: "후기를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = getRequestUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const payload = (await request.json()) as {
      gameId?: string;
      gameLabel?: string;
      mood?: string;
      content?: string;
    };
    const gameId = payload.gameId?.trim().slice(0, 100) ?? "";
    const gameLabel = payload.gameLabel?.trim().slice(0, 120) ?? "";
    const mood = payload.mood?.trim() ?? "";
    const content = payload.content?.trim().slice(0, 120) ?? "";
    if (!gameId || !gameLabel || !moods.has(mood) || !content) {
      return Response.json(
        { error: "경기, 감정, 한 줄 후기를 모두 입력해주세요." },
        { status: 400 },
      );
    }

    const [review] = await getDb()
      .insert(reviews)
      .values({ userId, gameId, gameLabel, mood, content })
      .returning();
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    console.error("reviews:post", error);
    return Response.json(
      { error: "후기를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
