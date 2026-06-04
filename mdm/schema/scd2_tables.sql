-- DataForge MDM - SCD Type 2 history tables + upsert procedures (PostgreSQL)
-- Tracks full history of master attribute changes for zones and vendors.

SET search_path TO mdm, public;

-- ------------------------------------------------------------ dim_zone_scd2
CREATE TABLE IF NOT EXISTS dim_zone_scd2 (
    surrogate_key  BIGSERIAL PRIMARY KEY,
    location_id    INTEGER NOT NULL,            -- natural key
    zone_name      TEXT,
    borough        TEXT,
    service_zone   TEXT,
    valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to       TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31',
    is_current     BOOLEAN NOT NULL DEFAULT TRUE,
    record_hash    TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zone_scd2_nk ON dim_zone_scd2 (location_id, is_current);

-- ---------------------------------------------------------- dim_vendor_scd2
CREATE TABLE IF NOT EXISTS dim_vendor_scd2 (
    surrogate_key  BIGSERIAL PRIMARY KEY,
    vendor_id      INTEGER NOT NULL,            -- natural key
    vendor_name    TEXT,
    vendor_code    TEXT,
    tech_provider  TEXT,
    valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to       TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31',
    is_current     BOOLEAN NOT NULL DEFAULT TRUE,
    record_hash    TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_scd2_nk ON dim_vendor_scd2 (vendor_id, is_current);

-- ------------------------------------------------------ SCD2 upsert: zone
-- detect changed attributes via record_hash; expire old + insert new version.
CREATE OR REPLACE FUNCTION mdm.scd2_upsert_zone(
    p_location_id INTEGER,
    p_zone_name   TEXT,
    p_borough     TEXT,
    p_service_zone TEXT
) RETURNS TEXT AS $$
DECLARE
    v_hash TEXT;
    v_cur_hash TEXT;
BEGIN
    v_hash := md5(coalesce(p_zone_name,'') || '||' || coalesce(p_borough,'')
                  || '||' || coalesce(p_service_zone,''));

    SELECT record_hash INTO v_cur_hash
      FROM dim_zone_scd2
     WHERE location_id = p_location_id AND is_current = TRUE;

    IF v_cur_hash IS NULL THEN
        INSERT INTO dim_zone_scd2 (location_id, zone_name, borough, service_zone, record_hash)
        VALUES (p_location_id, p_zone_name, p_borough, p_service_zone, v_hash);
        RETURN 'inserted_new';
    ELSIF v_cur_hash = v_hash THEN
        RETURN 'no_change';
    ELSE
        UPDATE dim_zone_scd2
           SET is_current = FALSE, valid_to = now(), updated_at = now()
         WHERE location_id = p_location_id AND is_current = TRUE;
        INSERT INTO dim_zone_scd2 (location_id, zone_name, borough, service_zone, record_hash)
        VALUES (p_location_id, p_zone_name, p_borough, p_service_zone, v_hash);
        RETURN 'versioned';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------- SCD2 upsert: vendor
CREATE OR REPLACE FUNCTION mdm.scd2_upsert_vendor(
    p_vendor_id   INTEGER,
    p_vendor_name TEXT,
    p_vendor_code TEXT,
    p_tech_provider TEXT
) RETURNS TEXT AS $$
DECLARE
    v_hash TEXT;
    v_cur_hash TEXT;
BEGIN
    v_hash := md5(coalesce(p_vendor_name,'') || '||' || coalesce(p_vendor_code,'')
                  || '||' || coalesce(p_tech_provider,''));

    SELECT record_hash INTO v_cur_hash
      FROM dim_vendor_scd2
     WHERE vendor_id = p_vendor_id AND is_current = TRUE;

    IF v_cur_hash IS NULL THEN
        INSERT INTO dim_vendor_scd2 (vendor_id, vendor_name, vendor_code, tech_provider, record_hash)
        VALUES (p_vendor_id, p_vendor_name, p_vendor_code, p_tech_provider, v_hash);
        RETURN 'inserted_new';
    ELSIF v_cur_hash = v_hash THEN
        RETURN 'no_change';
    ELSE
        UPDATE dim_vendor_scd2
           SET is_current = FALSE, valid_to = now(), updated_at = now()
         WHERE vendor_id = p_vendor_id AND is_current = TRUE;
        INSERT INTO dim_vendor_scd2 (vendor_id, vendor_name, vendor_code, tech_provider, record_hash)
        VALUES (p_vendor_id, p_vendor_name, p_vendor_code, p_tech_provider, v_hash);
        RETURN 'versioned';
    END IF;
END;
$$ LANGUAGE plpgsql;
