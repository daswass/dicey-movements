import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260914000000_attach_completed_activity_zone.sql"),
  "utf8"
);

describe("completed activity zone attachment migration", () => {
  it("locks and authorizes the owner before attaching a previously null zone", () => {
    expect(migration).toContain("WHERE id = p_activity_id\n    AND user_id = p_user_id\n  FOR UPDATE");
    expect(migration).toContain("activity not found or not owned by user");
    expect(migration).toContain("IF v_activity.zone_id IS NOT NULL THEN");
    expect(migration).toContain("SET zone_id = p_zone_id");
  });

  it("is retry-safe and rejects a different existing zone", () => {
    expect(migration).toContain("IF v_activity.zone_id = p_zone_id THEN");
    expect(migration).toContain("RETURN QUERY SELECT to_jsonb(v_activity), false");
    expect(migration).toContain("activity zone is already attached");
  });

  it("recalculates zone claims through the same fail-open trigger path as inserts", () => {
    expect(migration).toContain("AFTER UPDATE OF zone_id ON public.activities");
    expect(migration).toContain("WHEN (OLD.zone_id IS NULL AND NEW.zone_id IS NOT NULL)");
    expect(migration).toContain("EXECUTE FUNCTION public.refresh_zone_claim_after_activity()");
  });

  it("does not expose the privileged RPC to browser roles", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.attach_activity_zone(uuid, uuid, text) FROM PUBLIC");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.attach_activity_zone(uuid, uuid, text) TO service_role");
  });
});
