-- Zone ownership is derived territory metadata. It must never prevent the primary workout
-- activity from being recorded when a claim refresh encounters legacy/bad zone data.

CREATE OR REPLACE FUNCTION public.refresh_zone_claim_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.zone_id IS NOT NULL THEN
    BEGIN
      PERFORM public.recalculate_zone_claim(NEW.zone_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'zone claim refresh failed for activity %, zone %: %', NEW.id, NEW.zone_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
