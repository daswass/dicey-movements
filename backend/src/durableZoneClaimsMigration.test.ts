import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260908000001_durable_zone_claims.sql"),
  "utf8"
);
const completionMigration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260908000000_durable_workout_completion.sql"),
  "utf8"
);

describe("durable zone claims migration", () => {
  it("persists claims and recalculates only after a newly inserted activity", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.zone_claims");
    expect(migration).toContain("AFTER INSERT ON public.activities");
    expect(migration).toContain("PERFORM public.recalculate_zone_claim(NEW.zone_id)");
    expect(completionMigration).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("retains incumbent ties and permits only a strictly higher challenger score", () => {
    expect(migration).toContain("v_challenger_score > v_incumbent_score");
    expect(migration).toContain("ties never displace the recorded sheister");
  });

  it("keeps map reads bounded and zone naming tied to durable ownership", () => {
    expect(migration).toContain("get_zone_captains_in_viewport");
    expect(migration).toContain("viewport is too large; zoom in to load zone claims");
    expect(migration).toContain("FROM public.zone_claims\n    WHERE zone_id = p_zone_id AND sheister_user_id = v_user_id");
  });
});
