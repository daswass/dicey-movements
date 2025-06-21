-- Remove webhook_subscriptions column from oura_tokens table
-- Since we're using application-level webhooks instead of per-user webhooks

ALTER TABLE oura_tokens DROP COLUMN IF EXISTS webhook_subscriptions; 