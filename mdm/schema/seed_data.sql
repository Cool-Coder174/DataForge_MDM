-- DataForge MDM - seed master data + initial SCD2 history.
-- Demonstrates golden records and seeds SCD2 so /history returns rows.

SET search_path TO mdm, public;

-- ----------------------------------------------------------------- zones
INSERT INTO zones (location_id, zone_name, borough, service_zone, source_system)
VALUES
    (7,   'Astoria',                 'Queens',    'Boro Zone',  'tlc_registry'),
    (142, 'Lincoln Square East',     'Manhattan', 'Yellow Zone','tlc_registry'),
    (161, 'Midtown Center',          'Manhattan', 'Yellow Zone','tlc_registry'),
    (236, 'Upper East Side North',   'Manhattan', 'Yellow Zone','tlc_registry'),
    (237, 'Upper East Side South',   'Manhattan', 'Yellow Zone','tlc_registry'),
    (132, 'JFK Airport',             'Queens',    'Airports',   'tlc_registry'),
    (138, 'LaGuardia Airport',       'Queens',    'Airports',   'tlc_registry')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- vendors
INSERT INTO vendors (vendor_id, vendor_name, vendor_code, tech_provider, contact_email, source_system)
VALUES
    (1, 'Creative Mobile Technologies LLC', 'CMT', 'Creative Mobile Technologies', 'ops@cmtnyc.com', 'tlc_registry'),
    (2, 'VeriFone Inc',                     'VTS', 'VeriFone',                      'support@verifone.com', 'tlc_registry'),
    (6, 'Myle Technologies Inc',            'MYLE','Myle',                          'hello@myle.com', 'tlc_registry'),
    (7, 'Helix Technologies',               'HELIX','Helix',                        'info@helix.io', 'partner_feed')
ON CONFLICT DO NOTHING;

-- ----------------------------------- seed SCD2 current versions from masters
SELECT mdm.scd2_upsert_zone(location_id, zone_name, borough, service_zone)
  FROM zones;
SELECT mdm.scd2_upsert_vendor(vendor_id, vendor_name, vendor_code, tech_provider)
  FROM vendors;

-- ----------------------------------- prove SCD2 history with a change
-- Re-classify zone 161 service_zone -> creates a second version (history!).
SELECT mdm.scd2_upsert_zone(161, 'Midtown Center', 'Manhattan', 'Boro Zone');
-- Rename vendor 2 -> creates a second version.
SELECT mdm.scd2_upsert_vendor(2, 'Verifone Incorporated', 'VTS', 'VeriFone');
