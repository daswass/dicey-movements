import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260909000000_add_owned_zone_captains_rpc.sql"),
  "utf8"
);

describe("owned zone captains migration", () => {
  it("reads durable claims for the signed-in Sheister without any viewport predicate", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_my_zone_captains()");
    expect(migration).toContain("WHERE z.sheister_user_id = auth.uid()");
    expect(migration).not.toContain("lat_index BETWEEN");
  });
});
