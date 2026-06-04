# DataForge MDM — Governance Framework

## 1. Purpose & scope

Defines how master and reference data for the NYC taxi platform is owned,
created, matched, merged, versioned, and audited. In-scope domains:
**Taxi Zones** (Location) and **Vendors** (Vendor). Trip records are
transactional and out of scope for mastering.

## 2. Data classification

| Class | Examples | Treatment |
|---|---|---|
| Master | zones, vendors (golden records) | governed, deduplicated, versioned (SCD2) |
| Reference | service_zone codes, payment types | controlled vocabularies |
| Transactional | yellow taxi trips | validated against master, not mastered |

## 3. Data quality dimensions (tracked)

- **Accuracy** — values reflect reality (fare ≥ 0, valid timestamps).
- **Completeness** — required fields present (R01).
- **Consistency** — referential integrity to master (R04).
- **Timeliness** — pipeline freshness via `dq_run_summary.run_ts`.
- **Validity** — datatype/range rules (R02, R03).
- **Uniqueness** — duplicate detection (R05) + MDM matching.

Quality gate: pipeline FAILS when score `< 0.95` (configurable), routing to the
rejection + alert branch.

## 4. MDM implementation style

**Consolidation + Coexistence.** Source records flow in via batch; the matching
engine consolidates duplicates into golden records in RDS. Operational systems
can read golden records through the REST API; SCD2 preserves history for
coexistence and audit. (Registry-style virtual mastering and full Centralized
authoring are documented as future options.)

## 5. Match & merge policy

1. **Normalize** candidate keys: lowercase, strip punctuation, collapse
   whitespace, drop low-signal corporate stopwords (Inc/LLC/…).
2. **Score** with token-set (Jaccard) + fuzzy (edit-distance) blend; exact
   normalized match = 1.0. Threshold default **0.80**.
3. **Review** candidates (`match_score`, `reason`) — steward decision in demo.
4. **Survivorship** when merging:
   - prefer record with **fewer nulls** (completeness),
   - tie-break by **most trusted source** (`tlc_registry > partner_feed >
     manual_entry`),
   - then **most recently updated**,
   - **preserve all original source IDs** (`source_ids`),
   - attribute-level best-of-breed fill.
5. **Merge** updates/creates the golden record, deletes duplicates, writes a
   `merge_history` audit row, and refreshes SCD2.

## 6. Versioning (SCD Type 2)

Every governed attribute change creates a new version: the prior current row is
expired (`is_current=false`, `valid_to=now`) and a new current row inserted, keyed
by `record_hash` over descriptive attributes. Enables point-in-time queries and
rollback. Implemented in both PostgreSQL procedures (`scd2_upsert_*`) and the
Glue `scd2_upsert.py` (lake-side).

## 7. Stewardship & roles

| Role | Responsibility |
|---|---|
| Data Owner | accountable for a domain's definitions + quality targets |
| Data Steward | reviews match candidates, approves merges, resolves DQ failures |
| Platform Engineer | maintains pipelines, IaC, monitoring, CI/CD |
| Consumer | uses golden records via API / Athena / Redshift |

## 8. Lineage & audit trail

- **Lineage:** incoming → raw (immutable, versioned) → processed → curated →
  master; cataloged in Glue; transformations versioned in `sql/`.
- **Audit:** `merge_history` (who/what merged), SCD2 history (attribute changes),
  CloudTrail (API/infra), CloudWatch logs (job/Lambda execution).

## 9. Security & compliance (target state)

- Encrypt S3 (SSE) + RDS/Redshift (KMS); secrets in Secrets Manager with rotation.
- IAM least-privilege per role; API auth via Cognito/IAM/API keys.
- Private subnets + scoped security groups (demo uses public for simplicity).
- PII: taxi data is non-PII; for PII domains add Macie scanning + masking.

## 10. Change management

Infrastructure and code changes flow through Git PRs + GitHub Actions CI
(validate, test, deploy). SQL transformations and DQ tests are version-controlled
and reviewed like application code.
