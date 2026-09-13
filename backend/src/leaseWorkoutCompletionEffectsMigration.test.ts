import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260913000001_lease_workout_completion_effects.sql"),
  "utf8"
);

describe("leased workout completion effects migration", () => {
  it("reclaims only pending or expired leases and prevents stale completion", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS lease_token uuid");
    expect(migration).toContain("lease_expires_at <= now()");
    expect(migration).toContain("AND lease_token = p_lease_token");
    expect(migration).toContain("p_lease_seconds integer DEFAULT 300");
  });

  it("exposes bounded recovery listing only to the service role", () => {
    expect(migration).toContain("list_recoverable_workout_completion_effects(p_limit integer DEFAULT 100)");
    expect(migration).toContain("LIMIT LEAST(GREATEST(p_limit, 1), 1000)");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.list_recoverable_workout_completion_effects(integer) TO service_role;"
    );
  });
});
