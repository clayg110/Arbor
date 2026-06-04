-- ============================================================================
-- Arbor — seed data.  Apply AFTER 0001_init.sql + 0002_analytics.sql.
-- Safe to re-run (truncates app tables; never touches auth.users).
--   • ~14 "hero" companies matching the frontend mock (named, rich signals)
--   • ~1040 synthetic companies for realistic aggregate volume (~1,054 total)
-- Watchlist + analyst_notes are NOT seeded (they require real auth.users rows).
-- ============================================================================

truncate table
  public.deal_stage_history,
  public.signals_raw,
  public.analyst_notes,
  public.watchlist,
  public.llm_usage,
  public.companies
restart identity cascade;

-- ----------------------------------------------------------------------------
-- 1) Bulk synthetic universe (volume for analytics / summary strip)
-- ----------------------------------------------------------------------------
insert into public.companies
  (name, sector, deal_type, sponsor_firm, parent_company, confidence,
   current_stage, current_stage_since, created_at, updated_at)
select
  'Tracked Asset ' || g,
  (array['chemicals','industrials','agriculture','specialty_materials',
         'energy_fuels','pharma_inputs','consumer_coatings'])[1 + (g % 7)]::sector_enum,
  d.deal_type,
  case when d.deal_type = 'private_asset'
       then (array['Carlyle Group','Bain Capital','One Rock Capital Partners',
                   'SK Capital Partners','Advent International','Apollo Global',
                   'KPS Capital','Blackstone','Arsenal Capital Partners','H.I.G. Capital'])[1 + (g % 10)]
  end,
  case when d.deal_type = 'carveout'
       then (array['Dow Inc.','Celanese Corporation','Shell plc','Braskem S.A.',
                   'Cargill Inc.','Koch Industries','BASF SE','Eastman Chemical',
                   'Honeywell','Syngenta Group'])[1 + (g % 10)]
  end,
  (array['high','high','medium','medium','low','needs_review'])[1 + (g % 6)]::confidence_enum,
  (array['in_market','monitor_for_exit','monitor_for_exit',
         'on_hold','on_hold','pulled'])[1 + (g % 6)]::stage_enum,
  b.since,
  b.since - ((5 + (g % 120)) || ' days')::interval,
  b.since
from generate_series(1, 1040) g
cross join lateral (select (array['carveout','private_asset'])[1 + (g % 2)]::deal_type_enum as deal_type) d
cross join lateral (select now() - ((g % 150) || ' days')::interval as since) b;

-- ----------------------------------------------------------------------------
-- 2) Hero companies (match lib/feed-data.ts / lib/radar-data.ts)
-- ----------------------------------------------------------------------------
insert into public.companies
  (name, sector, deal_type, sponsor_firm, parent_company, description,
   confidence, current_stage, current_stage_since, created_at, updated_at)
values
  ('Dow Polyurethanes','chemicals','carveout',null,'Dow Inc.',
    'Polyurethanes and PO/PG unit under strategic review.',
    'high','in_market', now()-interval '47 days', now()-interval '80 days', now()-interval '2 days'),
  ('Sachem','chemicals','private_asset','One Rock Capital Partners',null,
    'Specialty electronic & performance chemicals producer.',
    'high','in_market', now()-interval '12 days', now()-interval '30 days', now()-interval '4 days'),
  ('EPSilyte','chemicals','private_asset','INEOS Group',null,
    'Expandable polystyrene producer.',
    'high','in_market', now()-interval '7 days', now()-interval '14 days', now()-interval '1 days'),
  ('Nouryon Surfactants','specialty_materials','private_asset','Carlyle Group',null,
    'Surfactants division running a formal sale process.',
    'medium','in_market', now()-interval '3 days', now()-interval '4 days', now()-interval '3 days'),
  ('GEON Performance Solutions','chemicals','private_asset','West Street Capital Partners',null,
    'PVC compounding business spun out of PolyOne.',
    'high','in_market', now()-interval '18 days', now()-interval '60 days', now()-interval '5 days'),
  ('Mosaic Brazil Assets','agriculture','carveout',null,'Mosaic Company',
    'Brazilian distribution and blending assets.',
    'medium','monitor_for_exit', now()-interval '150 days', now()-interval '160 days', now()-interval '2 days'),
  ('Archroma','specialty_materials','private_asset','SK Capital Partners',null,
    'Textile and paper chemicals company.',
    'high','monitor_for_exit', now()-interval '1 days', now()-interval '1 days', now()-interval '1 days'),
  ('Altivia','chemicals','private_asset','Undisclosed',null,
    'Phenol, acetone and water-treatment chemistries.',
    'needs_review','monitor_for_exit', now()-interval '330 days', now()-interval '340 days', now()-interval '7 days'),
  ('Celanese Infraserv','industrials','carveout',null,'Celanese Corporation',
    'Site-services and utilities operations.',
    'high','monitor_for_exit', now()-interval '240 days', now()-interval '245 days', now()-interval '21 days'),
  ('Invista Nylon 6,6 Plants','industrials','carveout',null,'Koch Industries',
    'Integrated nylon 6,6 intermediates and polymer business.',
    'high','on_hold', now()-interval '3 days', now()-interval '70 days', now()-interval '1 days'),
  ('Cargill Deicing Salt','agriculture','carveout',null,'Cargill Inc.',
    'Deicing salt business — divestiture pulled.',
    'high','pulled', now()-interval '5 days', now()-interval '95 days', now()-interval '5 days'),
  ('Shell Phenol Assets','energy_fuels','carveout',null,'Shell plc',
    'Phenol and acetone production assets.',
    'high','on_hold', now()-interval '60 days', now()-interval '90 days', now()-interval '21 days'),
  ('Hexion Versatic Acids','chemicals','carveout',null,'Hexion Inc.',
    'Versatic acids and derivatives unit.',
    'needs_review','monitor_for_exit', now()-interval '90 days', now()-interval '95 days', now()-interval '3 days'),
  ('Innospec Fuel Specialties','energy_fuels','carveout',null,'Innospec Inc.',
    'Fuel specialties segment under strategic review.',
    'medium','monitor_for_exit', now()-interval '2 days', now()-interval '5 days', now()-interval '2 days');

-- ----------------------------------------------------------------------------
-- 3) One auto-ingested signal per company (powers source mix + last-signal view)
-- ----------------------------------------------------------------------------
insert into public.signals_raw
  (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed)
select
  id,
  'Automated signal for ' || name,
  '#',
  (array['sec_filing','earnings_transcript','google_news','rss_feed','manual'])
    [1 + (abs(hashtext(id::text)) % 5)]::source_type_enum,
  'Pipeline',
  'Auto',
  now() - ((abs(hashtext(id::text)) % 40) || ' days')::interval,
  true
from public.companies;

-- ----------------------------------------------------------------------------
-- 4) History for every company: a new_entry event + current-stage transition
-- ----------------------------------------------------------------------------
insert into public.deal_stage_history
  (company_id, stage, event_type, changed_at, changed_by, source_type)
select
  id, 'in_market', 'new_entry', created_at, 'system_auto',
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])
    [1 + (abs(hashtext(id::text)) % 4)]::source_type_enum
from public.companies;

insert into public.deal_stage_history
  (company_id, stage, event_type, changed_at, changed_by, source_type)
select
  id,
  current_stage,
  (case current_stage
     when 'monitor_for_exit' then 'moved_monitor'
     when 'on_hold'          then 'moved_on_hold'
     when 'pulled'           then 'pulled'
     else 'moved_in_market' end)::feed_event_enum,
  current_stage_since, 'system_auto',
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])
    [1 + (abs(hashtext(id::text || 'x')) % 4)]::source_type_enum
from public.companies
where current_stage <> 'in_market';

-- ----------------------------------------------------------------------------
-- 5) Rich hero signals + linked stage-change history (exercise feed adapter)
--    Each block: insert the extracted signal, then a history row pointing to it.
-- ----------------------------------------------------------------------------

-- Dow — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Dow 8-K excerpt', '#', 'sec_filing', 'SEC EDGAR', '8-K filing', now()-interval '2 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Goldman Sachs and Morgan Stanley engaged as advisors to explore strategic alternatives for the Polyurethanes segment.',
      'attribution','Dow Inc. Form 8-K, 3 Jun 2026')
  from public.companies where name='Dow Polyurethanes' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '2 days','system_auto','sec_filing','SEC EDGAR','8-K filing','moved from monitor for exit to in market' from s;

-- Sachem — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Bloomberg report', '#', 'google_news', 'Bloomberg M&A', 'News article', now()-interval '4 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Sachem Inc. has kicked off a sale process that could value the business at more than $600 million.',
      'attribution','Bloomberg M&A, 2 Jun 2026')
  from public.companies where name='Sachem' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '4 days','system_auto','google_news','Bloomberg M&A','News article','moved from monitor for exit to in market' from s;

-- GEON — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'PE Wire brief', '#', 'google_news', 'PE Wire', 'Deal brief', now()-interval '5 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Houlihan Lokey hired to run a sale process. First round bids expected late Q3 2026.',
      'attribution','PE Wire Deal Brief, 31 May 2026')
  from public.companies where name='GEON Performance Solutions' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '5 days','system_auto','google_news','PE Wire','Deal brief','moved from monitor for exit to in market' from s;

-- Nouryon — new entry
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'PE Wire new mandate', '#', 'google_news', 'PE Wire', 'Deal brief', now()-interval '3 days', true,
    jsonb_build_object('event_type','new_entry','stage','in_market','confidence','medium',
      'headline','added to tracker — private asset, Specialty materials',
      'deal_size','$800M–$1.2B',
      'new_entry', jsonb_build_object('owner_label','Sponsor','owner_name','Carlyle Group','deal_size','$800M–$1.2B',
        'reason','Jefferies mandated to run a formal sale process for Nouryon''s surfactants division.'))
  from public.companies where name='Nouryon Surfactants' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','new_entry', now()-interval '3 days','system_auto','google_news','PE Wire','Deal brief','added to tracker — private asset, Specialty materials' from s;

-- Mosaic — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Mosaic earnings call', '#', 'earnings_transcript', 'Mosaic Co. Q1 2026 earnings call', 'Transcript', now()-interval '2 days', true,
    jsonb_build_object('event_type','moved_monitor','stage','monitor_for_exit','confidence','medium',
      'headline','moved from on hold to monitor for exit',
      'key_quote','We remain open to the right transaction at the right value for our Brazilian distribution assets.',
      'attribution','The Mosaic Company Q1 2026 Earnings Call, 1 Jun 2026')
  from public.companies where name='Mosaic Brazil Assets' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','moved_monitor', now()-interval '2 days','system_auto','earnings_transcript','Mosaic Co. Q1 2026 earnings call','Transcript','moved from on hold to monitor for exit' from s;

-- Archroma — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Reuters report', '#', 'google_news', 'Reuters M&A', 'News article', now()-interval '1 days', true,
    jsonb_build_object('event_type','new_entry','stage','monitor_for_exit','confidence','high',
      'headline','added to tracker — private asset, Specialty materials',
      'new_entry', jsonb_build_object('owner_label','Sponsor','owner_name','SK Capital Partners','deal_size','Undisclosed',
        'reason','SK Capital exploring exit options for Archroma, acquired in 2021.'))
  from public.companies where name='Archroma' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','new_entry', now()-interval '1 days','system_auto','google_news','Reuters M&A','News article','added to tracker — private asset, Specialty materials' from s;

-- Altivia — conflict (flagged)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Conflicting coverage', '#', 'google_news', 'Google News', 'Two conflicting articles', now()-interval '7 days', true,
    jsonb_build_object('event_type','flagged','stage','monitor_for_exit','confidence','needs_review',
      'headline','flagged for analyst review — conflicting signals detected',
      'conflict', jsonb_build_object(
        'signalA', jsonb_build_object('source','Reuters, 28 May','text','in active sale process with three strategic bidders.','stage','in_market'),
        'signalB', jsonb_build_object('source','Chemical Week, 30 May','text','process paused amid feedstock pricing concerns.','stage','on_hold')))
  from public.companies where name='Altivia' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','flagged', now()-interval '7 days','system_auto','google_news','Google News','Two conflicting articles','flagged for analyst review — conflicting signals detected' from s;

-- Invista — quote (on hold)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Koch earnings call', '#', 'earnings_transcript', 'Koch Industries Q1 2026 earnings call', 'Transcript', now()-interval '1 days', true,
    jsonb_build_object('event_type','moved_on_hold','stage','on_hold','confidence','high',
      'headline','process placed on hold by Koch Industries',
      'key_quote','We have made the decision to pause the divestiture process and will reassess in H2 2026.',
      'attribution','Koch Industries Q1 2026 Earnings Call, 2 Jun 2026')
  from public.companies where name='Invista Nylon 6,6 Plants' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'on_hold','moved_on_hold', now()-interval '1 days','system_auto','earnings_transcript','Koch Industries Q1 2026 earnings call','Transcript','process placed on hold by Koch Industries' from s;

-- Cargill — quote (pulled)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Cargill press release', '#', 'google_news', 'Cargill', 'Press release', now()-interval '5 days', true,
    jsonb_build_object('event_type','pulled','stage','pulled','confidence','high',
      'headline','pulled from process — asset retained by Cargill',
      'key_quote','Cargill has determined deicing salt is a strong strategic fit and will not be divesting.',
      'attribution','Cargill Press Release, 1 Jun 2026')
  from public.companies where name='Cargill Deicing Salt' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'pulled','pulled', now()-interval '5 days','system_auto','google_news','Cargill','Press release','pulled from process — asset retained by Cargill' from s;

-- Hexion — conflict (flagged)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Conflicting coverage', '#', 'google_news', 'Google News', 'Two conflicting articles', now()-interval '3 days', true,
    jsonb_build_object('event_type','flagged','stage','monitor_for_exit','confidence','needs_review',
      'headline','flagged for analyst review — conflicting signals detected',
      'conflict', jsonb_build_object(
        'signalA', jsonb_build_object('source','Mergermarket, 1 June','text','process ongoing with four financial sponsors in second round.','stage','in_market'),
        'signalB', jsonb_build_object('source','Hexion IR statement, 2 June','text','we do not comment on market speculation regarding portfolio decisions.','stage','on_hold')))
  from public.companies where name='Hexion Versatic Acids' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','flagged', now()-interval '3 days','system_auto','google_news','Google News','Two conflicting articles','flagged for analyst review — conflicting signals detected' from s;

-- Innospec — new entry
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Innospec 10-K', '#', 'sec_filing', 'SEC EDGAR', '10-K filing', now()-interval '2 days', true,
    jsonb_build_object('event_type','new_entry','stage','monitor_for_exit','confidence','medium',
      'headline','added to tracker — carveout, Energy & fuels',
      'new_entry', jsonb_build_object('owner_label','Parent','owner_name','Innospec Inc.','deal_size','Undisclosed',
        'reason','Annual report indicates the Fuel Specialties segment is under strategic review.'))
  from public.companies where name='Innospec Fuel Specialties' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','new_entry', now()-interval '2 days','system_auto','sec_filing','SEC EDGAR','10-K filing','added to tracker — carveout, Energy & fuels' from s;

-- ----------------------------------------------------------------------------
-- 6) Sample LLM usage rows (cost tracking demo)
-- ----------------------------------------------------------------------------
insert into public.llm_usage (source_type, model, input_tokens, output_tokens, cost_usd, created_at)
select
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])[1 + (g % 4)]::source_type_enum,
  'claude-sonnet-4-20250514',
  800 + (g % 600), 120 + (g % 200),
  round((0.003 + (g % 50) * 0.0001)::numeric, 4),
  now() - ((g % 7) || ' days')::interval
from generate_series(1, 60) g;
