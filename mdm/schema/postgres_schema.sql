-- DataForge MDM - operational master data schema (PostgreSQL / RDS)
-- Current (Type 1) master tables + staging for incoming source records.
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS mdm;
SET search_path TO mdm, public;

-- ----------------------------------------------------------------- zones
CREATE TABLE IF NOT EXISTS zones (
    zone_id        SERIAL PRIMARY KEY,           -- golden surrogate id
    location_id    INTEGER,                      -- natural key (TLC LocationID)
    zone_name      TEXT NOT NULL,
    borough        TEXT,
    service_zone   TEXT,
    source_system  TEXT DEFAULT 'manual_entry',
    is_golden      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zones_location ON zones (location_id);
CREATE INDEX IF NOT EXISTS idx_zones_name ON zones (lower(zone_name));

-- ----------------------------------------------------------------- vendors
CREATE TABLE IF NOT EXISTS vendors (
    vendor_pk      SERIAL PRIMARY KEY,           -- golden surrogate id
    vendor_id      INTEGER,                      -- natural key (TLC VendorID)
    vendor_name    TEXT NOT NULL,
    vendor_code    TEXT,
    tech_provider  TEXT,
    contact_email  TEXT,
    source_system  TEXT DEFAULT 'manual_entry',
    is_golden      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_vid ON vendors (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors (lower(vendor_name));

-- --------------------------------------------------------- merge audit trail
CREATE TABLE IF NOT EXISTS merge_history (
    merge_id       SERIAL PRIMARY KEY,
    domain         TEXT NOT NULL,                -- 'zone' | 'vendor'
    survivor_id    INTEGER NOT NULL,
    duplicate_ids  INTEGER[] NOT NULL,
    match_score    NUMERIC(5,4),
    reason         TEXT,
    merged_by      TEXT DEFAULT 'api',
    merged_at      TIMESTAMPTZ DEFAULT now()
);

-- Touch updated_at on change.
CREATE OR REPLACE FUNCTION mdm.touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zones_touch ON zones;
CREATE TRIGGER trg_zones_touch BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION mdm.touch_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_touch ON vendors;
CREATE TRIGGER trg_vendors_touch BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION mdm.touch_updated_at();
