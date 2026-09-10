import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260910000000_make_zone_claim_trigger_fail_open.sql"),
  "utf8"
);

describe("zone claim refresh resilience migration", () => {
  it("preserves activity inserts when derived zone ownership refresh fails", () => {
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(migration).toContain("RETURN NEW");
    expect(migration).toContain("PERFORM public.recalculate_zone_claim(NEW.zone_id)");
  });
});
