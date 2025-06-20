-- Alter oura_tokens table to add webhook_subscription_id
ALTER TABLE oura_tokens
ADD COLUMN webhook_subscription_id TEXT; 