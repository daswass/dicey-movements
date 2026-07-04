-- Legacy leaderboard table: UI now reads activities/oura_activities directly.
-- Safe to run after confirming the table has no meaningful production data.

DROP TABLE IF EXISTS leaderboard CASCADE;
