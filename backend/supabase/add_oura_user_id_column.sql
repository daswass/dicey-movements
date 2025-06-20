-- Alter oura_tokens table to add oura_user_id
ALTER TABLE oura_tokens
ADD COLUMN oura_user_id TEXT;

-- We can make this unique to ensure one Oura account maps to one app account
ALTER TABLE oura_tokens
ADD CONSTRAINT unique_oura_user_id UNIQUE (oura_user_id); 