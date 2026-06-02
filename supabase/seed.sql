-- Arbor — mock seed data. Safe to re-run (truncates app tables first).
-- Apply AFTER 0001_init.sql. Does not touch auth.users.

truncate table public.analyst_notes,
               public.watchlist,
               public.signals_raw,
               public.deal_stage_history,
               public.companies
  restart identity cascade;

-- ---------- companies ----------
insert into public.companies
  (name, sector, deal_type, sponsor_firm, parent_company, description, confidence, current_stage, current_stage_since)
values
  ('Halcyon Specialty Chemicals','chemicals','carveout',null,'Dover Industrials','Coatings additives unit under strategic review.','high','in_market', now() - interval '12 days'),
  ('Meridian AgriScience','agriculture','private_asset','Brookfield Capital',null,'Crop-input formulations platform.','medium','in_market', now() - interval '5 days'),
  ('Orion Polymers','specialty_materials','carveout',null,'Continental Materials','Engineered polymer films division.','high','monitor_for_exit', now() - interval '40 days'),
  ('Vantage Energy Partners','energy_fuels','private_asset','Apollo Resource Fund',null,'Midstream fuel logistics operator.','medium','in_market', now() - interval '3 days'),
  ('Pinnacle Pharma Ingredients','pharma_inputs','carveout',null,'Helix Life Sciences','Active pharmaceutical intermediates plant.','needs_review','in_market', now() - interval '2 days'),
  ('Cascade Industrial Coatings','consumer_coatings','private_asset','Sterling PE',null,'Architectural coatings manufacturer.','high','monitor_for_exit', now() - interval '60 days'),
  ('Atlas Heavy Equipment','industrials','carveout',null,'Granite Holdings','Off-highway components business.','low','on_hold', now() - interval '18 days'),
  ('Verdant Crop Solutions','agriculture','carveout',null,'NutriCorp Global','Biological seed treatment unit.','high','in_market', now() - interval '8 days'),
  ('Cobalt Fine Chemicals','chemicals','private_asset','Carlyle Chemicals',null,'Custom synthesis CDMO.','medium','in_market', now() - interval '15 days'),
  ('Summit Industrial Filtration','industrials','private_asset','KPS Partners',null,'Industrial filtration systems.','high','monitor_for_exit', now() - interval '33 days'),
  ('Beacon Energy Storage','energy_fuels','carveout',null,'Volt Utilities','Grid-scale battery integration arm.','needs_review','in_market', now() - interval '1 days'),
  ('Lyra Coatings Group','consumer_coatings','carveout',null,'Sherwin Aligned','Powder coatings product line.','medium','pulled', now() - interval '22 days'),
  ('Nimbus Agrochemicals','agriculture','private_asset','TPG Growth',null,'Specialty herbicide producer.','high','in_market', now() - interval '6 days'),
  ('Granite Specialty Resins','specialty_materials','private_asset','Advent Materials',null,'Thermoset resin compounder.','medium','monitor_for_exit', now() - interval '47 days'),
  ('Ironclad Pumps & Valves','industrials','carveout',null,'Flowserve Holdings','Severe-service valve division.','high','in_market', now() - interval '9 days'),
  ('Solstice Biofuels','energy_fuels','private_asset','EQT Infrastructure',null,'Renewable diesel feedstock processor.','low','on_hold', now() - interval '27 days'),
  ('Helios Pharma Excipients','pharma_inputs','private_asset','Permira Health',null,'Excipients and coatings supplier.','high','in_market', now() - interval '4 days'),
  ('Crestline Industrial Gases','chemicals','carveout',null,'AirNova Group','Regional industrial gases unit.','medium','monitor_for_exit', now() - interval '52 days'),
  ('Westgate Mineral Coatings','consumer_coatings','private_asset','Bain Capital',null,'Mineral-based protective coatings.','high','in_market', now() - interval '11 days'),
  ('Tundra Ag Equipment','agriculture','carveout',null,'Deere Aligned','Precision-planting hardware line.','needs_review','in_market', now() - interval '2 days'),
  ('Aurora Petrochemicals','energy_fuels','carveout',null,'PetroCore','Olefins derivatives plant.','medium','pulled', now() - interval '35 days'),
  ('Sentinel Flow Controls','industrials','private_asset','Blackstone Industrial',null,'Process flow instrumentation maker.','high','monitor_for_exit', now() - interval '29 days'),
  ('Marigold Nutrient Systems','agriculture','private_asset','Warburg Pincus',null,'Micronutrient blends manufacturer.','medium','in_market', now() - interval '7 days'),
  ('Cinder Carbon Materials','specialty_materials','carveout',null,'Graphite Global','Synthetic graphite electrode unit.','low','on_hold', now() - interval '14 days'),
  ('Keystone Adhesives','chemicals','private_asset','CVC Capital',null,'Industrial adhesives & sealants.','high','in_market', now() - interval '10 days'),
  ('Brightwater Pharma Solvents','pharma_inputs','carveout',null,'Solventis Corp','GMP solvent recovery business.','medium','monitor_for_exit', now() - interval '44 days'),
  ('Falcon Powder Metals','industrials','private_asset','American Securities',null,'Powdered metal components.','high','in_market', now() - interval '13 days'),
  ('Emberline Roof Coatings','consumer_coatings','carveout',null,'BuildCo Holdings','Reflective roof coatings line.','needs_review','in_market', now() - interval '1 days'),
  ('Quartz Catalysts','chemicals','carveout',null,'Catalytica Group','Refinery catalyst regeneration unit.','medium','in_market', now() - interval '16 days'),
  ('Northwind Wind Services','energy_fuels','private_asset','Macquarie Green',null,'Wind turbine O&M services.','high','monitor_for_exit', now() - interval '38 days'),
  ('Sage Bioactives','pharma_inputs','private_asset','Gilde Healthcare',null,'Plant-derived bioactive ingredients.','medium','in_market', now() - interval '5 days'),
  ('Titan Conveyor Systems','industrials','carveout',null,'BulkHandling Inc','Bulk material conveyor division.','high','in_market', now() - interval '20 days'),
  ('Coral Reef Pigments','specialty_materials','private_asset','Lone Star Funds',null,'Effect pigments producer.','low','on_hold', now() - interval '24 days'),
  ('Vireo Seed Genetics','agriculture','carveout',null,'AgriGene Global','Trait licensing & seed genetics.','high','in_market', now() - interval '6 days'),
  ('Cobblestone Specialty Lubricants','chemicals','private_asset','Audax Group',null,'Synthetic lubricants formulator.','medium','monitor_for_exit', now() - interval '31 days'),
  ('Lumen Display Materials','specialty_materials','carveout',null,'OptoCorp','OLED emitter materials unit.','needs_review','in_market', now() - interval '2 days'),
  ('Redwood Renewable Fuels','energy_fuels','private_asset','I Squared Capital',null,'SAF blending terminal operator.','high','in_market', now() - interval '9 days'),
  ('Anchor Industrial Bearings','industrials','carveout',null,'Timken Aligned','Heavy-duty bearings product line.','medium','pulled', now() - interval '41 days'),
  ('Saffron Food Coatings','consumer_coatings','private_asset','Investcorp',null,'Edible & barrier coatings maker.','high','in_market', now() - interval '12 days'),
  ('Mosaic Membrane Tech','specialty_materials','private_asset','GTCR',null,'Separation membrane producer.','medium','monitor_for_exit', now() - interval '36 days');

-- ---------- stage history + signals (derived per company) ----------
do $$
declare
  c record;
  qmap jsonb := jsonb_build_object(
    'in_market', 'The Board has authorized the exploration of strategic alternatives, including a potential sale of the business.',
    'monitor_for_exit', 'Management noted the asset is performing ahead of plan and a process is expected in the coming quarters.',
    'on_hold', 'The previously announced strategic review has been paused pending market conditions.',
    'pulled', 'The company has decided to retain the division and is no longer pursuing a divestiture.'
  );
  src text;
begin
  for c in select * from public.companies loop
    src := case when c.deal_type = 'carveout' then 'sec_filing' else 'rss_feed' end;

    -- original entry into tracking (always in_market)
    insert into public.deal_stage_history
      (company_id, stage, changed_at, changed_by, source_type, source_url, notes, confidence)
    values
      (c.id, 'in_market', c.created_at - interval '70 days', 'system_auto',
       src::source_type_enum,
       'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany',
       'Initial signal: entered tracking universe.', 'medium');

    -- current stage transition (if not still the initial in_market)
    if c.current_stage <> 'in_market' then
      insert into public.deal_stage_history
        (company_id, stage, changed_at, changed_by, source_type, source_url, notes, confidence)
      values
        (c.id, c.current_stage, c.current_stage_since,
         case when c.confidence = 'needs_review' then 'system_auto' else 'analyst_manual' end,
         src::source_type_enum,
         'https://www.reuters.com/markets/deals/',
         qmap ->> c.current_stage::text, c.confidence);
    end if;

    -- a couple of raw signals
    insert into public.signals_raw
      (company_id, raw_text, source_url, source_type, processed, matched_company_id, llm_output)
    values
      (c.id, qmap ->> c.current_stage::text,
       'https://www.sec.gov/edgar/search/', src::source_type_enum, true, c.id,
       jsonb_build_object('company_name', c.name, 'deal_type', c.deal_type,
                          'stage', c.current_stage, 'confidence', c.confidence)),
      (c.id, 'Industry sources indicate advisors have been engaged to evaluate options for ' || c.name || '.',
       'https://www.axios.com/pro/pro-rata', 'google_news', true, c.id, null);
  end loop;
end $$;
