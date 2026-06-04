-- ============================================================================
-- Arbor — extend sector_enum with the 5 real §2.1 sectors (chemicals already
-- exists), so deals can be created/ingested outside chemicals. Idempotent.
-- ADD VALUE only (no usage in this migration) → safe to run as-is on PG15.
-- ============================================================================

alter type sector_enum add value if not exists 'aerospace_defense';
alter type sector_enum add value if not exists 'capital_goods';
alter type sector_enum add value if not exists 'automotive';
alter type sector_enum add value if not exists 'transportation';
alter type sector_enum add value if not exists 'basic_materials';
