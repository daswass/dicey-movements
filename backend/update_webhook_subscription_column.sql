-- Drop the old single-ID column if it exists
ALTER TABLE oura_tokens
DROP COLUMN IF EXISTS webhook_subscription_id;

-- Add a new column to store multiple subscription IDs as a JSON array
ALTER TABLE oura_tokens
ADD COLUMN webhook_subscriptions JSONB; 