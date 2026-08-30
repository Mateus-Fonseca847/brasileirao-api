-- CreateEnum
CREATE TYPE "season_status" AS ENUM (
    'IN_PROGRESS',
    'VALIDATION',
    'FINISHED'
);

-- CreateEnum
CREATE TYPE "match_status" AS ENUM (
    'SCHEDULED',
    'FINISHED',
    'CANCELLED',
    'ANNULLED',
    'NOT_PLAYED'
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "season_status" NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "teams_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "short_name" VARCHAR(100),
    "state" VARCHAR(2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_teams" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "round" INTEGER,
    "match_date" DATE,
    "kickoff_time" TIME(0),
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "home_goals" INTEGER,
    "away_goals" INTEGER,
    "played_home_goals" INTEGER,
    "played_away_goals" INTEGER,
    "stadium" VARCHAR(200),
    "status" "match_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_team_stats" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "shots" INTEGER,
    "possession" DECIMAL(5,2),
    "yellow_cards" INTEGER,
    "red_cards" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_team_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standings" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "goals_for" INTEGER NOT NULL,
    "goals_against" INTEGER NOT NULL,
    "goal_difference" INTEGER NOT NULL,
    "points_adjustment" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_key"
ON "seasons"("year");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key"
ON "teams"("slug");

-- CreateIndex
CREATE INDEX "teams_name_idx"
ON "teams"("name");

-- CreateIndex
CREATE INDEX "season_teams_season_id_idx"
ON "season_teams"("season_id");

-- CreateIndex
CREATE INDEX "season_teams_team_id_idx"
ON "season_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_teams_season_id_team_id_key"
ON "season_teams"("season_id", "team_id");

-- CreateIndex
CREATE INDEX "matches_season_id_idx"
ON "matches"("season_id");

-- CreateIndex
CREATE INDEX "matches_home_team_id_idx"
ON "matches"("home_team_id");

-- CreateIndex
CREATE INDEX "matches_away_team_id_idx"
ON "matches"("away_team_id");

-- CreateIndex
CREATE INDEX "matches_season_id_round_idx"
ON "matches"("season_id", "round");

-- CreateIndex
CREATE INDEX "matches_match_date_idx"
ON "matches"("match_date");

-- CreateIndex
CREATE INDEX "match_team_stats_team_id_idx"
ON "match_team_stats"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_team_stats_match_id_team_id_key"
ON "match_team_stats"("match_id", "team_id");

-- CreateIndex
CREATE INDEX "standings_season_id_idx"
ON "standings"("season_id");

-- CreateIndex
CREATE INDEX "standings_team_id_idx"
ON "standings"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "standings_season_id_team_id_key"
ON "standings"("season_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "standings_season_id_position_key"
ON "standings"("season_id", "position");

-- AddForeignKey
ALTER TABLE "season_teams"
ADD CONSTRAINT "season_teams_season_id_fkey"
FOREIGN KEY ("season_id")
REFERENCES "seasons"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "season_teams"
ADD CONSTRAINT "season_teams_team_id_fkey"
FOREIGN KEY ("team_id")
REFERENCES "teams"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "matches"
ADD CONSTRAINT "matches_season_id_fkey"
FOREIGN KEY ("season_id")
REFERENCES "seasons"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "matches"
ADD CONSTRAINT "matches_home_team_id_fkey"
FOREIGN KEY ("home_team_id")
REFERENCES "teams"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "matches"
ADD CONSTRAINT "matches_away_team_id_fkey"
FOREIGN KEY ("away_team_id")
REFERENCES "teams"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_match_id_fkey"
FOREIGN KEY ("match_id")
REFERENCES "matches"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_team_id_fkey"
FOREIGN KEY ("team_id")
REFERENCES "teams"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "standings"
ADD CONSTRAINT "standings_season_id_fkey"
FOREIGN KEY ("season_id")
REFERENCES "seasons"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "standings"
ADD CONSTRAINT "standings_team_id_fkey"
FOREIGN KEY ("team_id")
REFERENCES "teams"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- Season constraints
ALTER TABLE "seasons"
ADD CONSTRAINT "seasons_year_check"
CHECK ("year" >= 2003);

ALTER TABLE "seasons"
ADD CONSTRAINT "seasons_teams_count_check"
CHECK (
    "teams_count" IS NULL
    OR "teams_count" > 0
);

ALTER TABLE "seasons"
ADD CONSTRAINT "seasons_dates_check"
CHECK (
    "start_date" IS NULL
    OR "end_date" IS NULL
    OR "end_date" >= "start_date"
);

-- Team constraints
ALTER TABLE "teams"
ADD CONSTRAINT "teams_slug_not_empty_check"
CHECK (LENGTH(TRIM("slug")) > 0);

ALTER TABLE "teams"
ADD CONSTRAINT "teams_name_not_empty_check"
CHECK (LENGTH(TRIM("name")) > 0);

ALTER TABLE "teams"
ADD CONSTRAINT "teams_state_check"
CHECK (
    "state" IS NULL
    OR (
        LENGTH("state") = 2
        AND "state" = UPPER("state")
    )
);

-- Match constraints
ALTER TABLE "matches"
ADD CONSTRAINT "matches_different_teams_check"
CHECK ("home_team_id" <> "away_team_id");

ALTER TABLE "matches"
ADD CONSTRAINT "matches_round_check"
CHECK (
    "round" IS NULL
    OR "round" > 0
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_home_goals_check"
CHECK (
    "home_goals" IS NULL
    OR "home_goals" >= 0
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_away_goals_check"
CHECK (
    "away_goals" IS NULL
    OR "away_goals" >= 0
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_played_home_goals_check"
CHECK (
    "played_home_goals" IS NULL
    OR "played_home_goals" >= 0
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_played_away_goals_check"
CHECK (
    "played_away_goals" IS NULL
    OR "played_away_goals" >= 0
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_official_score_pair_check"
CHECK (
    ("home_goals" IS NULL AND "away_goals" IS NULL)
    OR
    ("home_goals" IS NOT NULL AND "away_goals" IS NOT NULL)
);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_played_score_pair_check"
CHECK (
    ("played_home_goals" IS NULL AND "played_away_goals" IS NULL)
    OR
    ("played_home_goals" IS NOT NULL AND "played_away_goals" IS NOT NULL)
);

-- Match team statistics constraints
ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_shots_check"
CHECK (
    "shots" IS NULL
    OR "shots" >= 0
);

ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_possession_check"
CHECK (
    "possession" IS NULL
    OR ("possession" >= 0 AND "possession" <= 100)
);

ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_yellow_cards_check"
CHECK (
    "yellow_cards" IS NULL
    OR "yellow_cards" >= 0
);

ALTER TABLE "match_team_stats"
ADD CONSTRAINT "match_team_stats_red_cards_check"
CHECK (
    "red_cards" IS NULL
    OR "red_cards" >= 0
);

-- Standing constraints
ALTER TABLE "standings"
ADD CONSTRAINT "standings_position_check"
CHECK ("position" > 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_played_check"
CHECK ("played" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_wins_check"
CHECK ("wins" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_draws_check"
CHECK ("draws" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_losses_check"
CHECK ("losses" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_goals_for_check"
CHECK ("goals_for" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_goals_against_check"
CHECK ("goals_against" >= 0);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_matches_sum_check"
CHECK (
    "played" = "wins" + "draws" + "losses"
);

ALTER TABLE "standings"
ADD CONSTRAINT "standings_goal_difference_check"
CHECK (
    "goal_difference" = "goals_for" - "goals_against"
);