import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const favorites = sqliteTable(
  "favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    teamId: text("team_id").notNull(),
    teamName: text("team_name").notNull(),
    league: text("league").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_favorites_user_team").on(table.userId, table.teamId),
    index("idx_favorites_user").on(table.userId),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    gameId: text("game_id").notNull(),
    gameLabel: text("game_label").notNull(),
    mood: text("mood").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_reviews_user_created").on(table.userId, table.createdAt),
  ],
);

export const visits = sqliteTable(
  "visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    gameDate: text("game_date").notNull(),
    league: text("league").notNull(),
    awayTeam: text("away_team").notNull(),
    homeTeam: text("home_team").notNull(),
    ballpark: text("ballpark").notNull(),
    seat: text("seat").notNull().default(""),
    score: text("score").notNull().default(""),
    result: text("result").notNull(),
    memo: text("memo").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_visits_user_date").on(table.userId, table.gameDate),
  ],
);
