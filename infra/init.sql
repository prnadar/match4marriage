-- Initial DB bootstrap.
-- Creates extensions required by the app.
-- Alembic handles all schema migrations after this.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for fuzzy profile search
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- for JSONB + array GIN indexes
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- for accent-insensitive name search
