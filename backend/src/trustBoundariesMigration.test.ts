import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260913000000_lock_down_oauth_tokens_and_friend_acceptance.sql"),
  "utf8"
);

describe("trust-boundaries migration", () => {
  it("keeps Oura OAuth tokens server-owned", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Users can view their own Oura tokens"');
    expect(migration).toContain("REVOKE ALL ON TABLE public.oura_tokens FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT ALL ON TABLE public.oura_tokens TO service_role");
  });

  it("derives friend-request authority from auth.uid rather than client parameters", () => {
    expect(migration).toContain("accept_friend_request_transaction(p_friendship_record_id uuid)");
    expect(migration).toContain("actor_id uuid := auth.uid()");
    expect(migration).toContain("IF actor_id IS NULL THEN");
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.accept_friend_request_transaction(uuid, uuid, uuid)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.accept_friend_request_transaction(uuid) FROM PUBLIC");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.accept_friend_request_transaction(uuid) TO authenticated");
  });
});
