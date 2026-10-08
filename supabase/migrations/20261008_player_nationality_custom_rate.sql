-- Nationality is independent of agent affiliation; a per-player rate overrides the agency default.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS custom_rate numeric(6,2);
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_custom_rate_range;
ALTER TABLE public.players ADD CONSTRAINT players_custom_rate_range CHECK (custom_rate IS NULL OR (custom_rate >= 0 AND custom_rate <= 100));
COMMENT ON COLUMN public.players.custom_rate IS 'Optional player-specific rakeback percentage. NULL inherits agencies.rate. Existing game_entries.rate_snapshot is unchanged.';
