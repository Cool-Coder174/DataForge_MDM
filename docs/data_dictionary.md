# DataForge MDM — Data Dictionary

## Source datasets

### Yellow Taxi Trip Records (`incoming/yellow_taxi/`)
| Column | Type | Notes |
|---|---|---|
| vendor_id | int | TLC technology provider code (1,2,6,7) |
| tpep_pickup_datetime | timestamp | trip start |
| tpep_dropoff_datetime | timestamp | trip end |
| passenger_count | int | reported passengers |
| trip_distance | double | miles |
| pu_location_id | int | pickup TLC zone (LocationID) |
| do_location_id | int | dropoff TLC zone (LocationID) |
| fare_amount | double | metered fare |
| tip_amount | double | tip |
| total_amount | double | total charged |
| payment_type | int | 1=credit,2=cash,… |

### Taxi Zone Lookup (`incoming/taxi_zones/`)
| Column | Type | Notes |
|---|---|---|
| LocationID | int | natural key |
| Borough | string | NYC borough |
| Zone | string | zone name |
| service_zone | string | Yellow/Boro/Airports/EWR |

### Vendor reference (`incoming/vendors/`)
| Column | Type | Notes |
|---|---|---|
| vendor_id | int | natural key |
| vendor_name | string | legal/display name (has duplicates for matching) |
| vendor_code | string | short code (CMT/VTS/…) |
| tech_provider | string | provider |
| contact_email | string | contact |
| source_system | string | tlc_registry / partner_feed / manual_entry |
| updated_at | date | last update (survivorship recency) |

## Curated star schema

### fact_trip / fact_trip_enriched (`curated/`)
`trip_id` (sha256 natural-key hash), `vendor_id`, `vendor_name`, `vendor_code`,
`pickup_datetime`, `dropoff_datetime`, `passenger_count`, `trip_distance`,
`pu_location_id`, `do_location_id`, `pickup_borough`, `pickup_zone`,
`dropoff_borough`, `dropoff_zone`, `fare_amount`, `tip_amount`, `total_amount`,
`trip_duration_min`, `fare_per_mile`, `tip_pct`, `pickup_date` (partition).

### dim_date
`date_key`, `date_value`, `year`, `month`, `day`, `day_of_week`, `is_weekend`.

### dim_zone / dim_vendor (current golden)
zone: `location_id`, `borough`, `zone_name`, `service_zone`.
vendor: `vendor_id`, `vendor_name`, `vendor_code`.

## Master zone (SCD2 + DQ)

### dim_zone_scd2 / dim_vendor_scd2 (`master/`)
`surrogate_key`, `natural_key`, descriptive attrs, `valid_from`, `valid_to`,
`is_current`, `record_hash`, `created_at`, `updated_at`.

### dq_run_summary (`master/`)
`run_id`, `run_ts`, `quality_score`, `total_rows`, `rejected_rows`,
`failed_rule_count`, `status`.

### dq_results (`curated/`)
`rule_id`, `description`, `failed_rows`, `status`, `run_id`, `run_ts`,
`quality_score`, `total_rows`.

## MDM operational store (RDS PostgreSQL, schema `mdm`)

- `zones(zone_id PK, location_id, zone_name, borough, service_zone, source_system, is_golden, created_at, updated_at)`
- `vendors(vendor_pk PK, vendor_id, vendor_name, vendor_code, tech_provider, contact_email, source_system, is_golden, created_at, updated_at)`
- `dim_zone_scd2`, `dim_vendor_scd2` (history; see above)
- `merge_history(merge_id PK, domain, survivor_id, duplicate_ids[], match_score, reason, merged_by, merged_at)`

## MDM REST API (API Gateway → `mdm_api` Lambda)

| Method | Path | Description |
|---|---|---|
| GET | `/zones` | list golden zones |
| POST | `/zones` | create zone |
| GET | `/zones/{zone_id}` | read one |
| PUT | `/zones/{zone_id}` | update (+ SCD2 history) |
| POST | `/zones/match` | duplicate candidates (`{zone_name, threshold?}`) |
| POST | `/zones/merge` | merge (`{survivor_id, duplicate_ids[]}`) → golden |
| GET | `/zones/{zone_id}/history` | SCD2 versions |
| GET/POST/PUT … | `/vendors…` | same shape for vendors |

Match response item: `{id, value, match_score, reason}`.
Merge response: `{merged, survivor_id, merged_ids, match_score, golden_record}`.
