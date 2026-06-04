// Generates supabase/migrations/0006_taxonomy.sql from the Backend §2.1/§2.2
// taxonomy in "Arbor Updates.md". Data lives here (structured + reproducible);
// re-run with: node scripts/gen-taxonomy-seed.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations", "0006_taxonomy.sql");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---- §2.1 universe: sector slug → subsector label → companies ----
const UNIVERSE = {
  aerospace_defense: {
    Aerospace: ["Airbus", "Boeing", "Bombardier", "General Electric", "HEICO", "Howmet Aerospace", "Moog", "Rolls-Royce", "Safran", "Standard Aero", "Textron", "TransDigm Group", "Woodward"],
    "Defense Primes": ["BAE Systems", "L3Harris Technologies", "Lockheed Martin", "General Dynamics", "Raytheon Technologies", "Northrop Grumman"],
    "Mid-Cap Defense": ["AeroVironment", "BWX Technologies", "Curtiss-Wright", "Huntington Ingalls", "Kratos", "Leonardo DRS", "Mercury Systems", "Karman"],
    "Government Services": ["Amentum", "ASGN", "Booz Allen Hamilton", "CACI", "Jacobs Engineering Group", "KBR", "Leidos", "Parsons", "Science Applications International", "V2X"],
    Space: ["BlackSky Technology", "Intuitive Machines", "MDA Space", "Planet Labs", "Redwire", "Rocket Lab USA", "Spire Global", "Voyager", "Viasat", "York Space Systems"],
  },
  capital_goods: {
    "Flow Control": ["Alfa Laval", "Baker Hughes", "Flowserve", "Gorman-Rupp", "Graco", "IDEX", "IMI", "Ingersoll Rand", "Itron", "ITT", "Rotork", "Smiths Group", "Sulzer"],
    "Water & Filtration": ["A. O. Smith", "Badger Meter", "Franklin Electric", "Hayward", "Pentair", "Veralto", "Watts Water Technologies", "Xylem", "Zurn Elkay Water Solutions"],
    "Multi Industry": ["3M", "AMETEK", "Crane", "Dover", "Emerson Electric", "Enpro", "Fortive", "GE Vernova", "Honeywell", "Illinois Tool Works", "Johnson Controls International", "Nordson", "Parker-Hannifin", "SPX Technologies"],
    Solar: ["Array", "Enphase", "Nextracker", "Shoals Technologies", "SMA Solar Technology", "SolarEdge Technologies", "Soltec Power"],
    "Electrical & Lighting": ["Acuity Brands", "Amphenol", "Atkore", "Belden", "Eaton", "Generac", "Hubbell", "Littelfuse", "nVent Electric", "Signify", "TE Connectivity", "Vertiv", "Wolfspeed"],
    Automation: ["ATS", "AutoStore", "Cognex", "Durr", "Interroll", "John Bean Technologies", "MKS Instruments", "Rockwell Automation", "Zebra Technologies"],
    "HVAC / Tools": ["AAON", "Carrier Global", "Daikin Industries", "Enerpac Tool Group", "Lennox International", "Lincoln Electric", "NIBE Industrier", "Stanley Black & Decker", "TETRA Technologies", "Trane Technologies"],
    "Appliances and Equipment": ["Alliance Laundry", "Electrolux", "Electrolux Professional", "Jensen Group", "Middleby", "Nilfisk", "Tennant", "TTi", "Whirlpool"],
    "Motion Control": ["Gates Industrial", "RBC Bearings", "Regal Rexnord", "Timken Company"],
  },
  chemicals: {
    Chemicals: ["Air Products and Chemicals", "Axalta Coating Systems", "CF Industries", "Compass Minerals", "Corteva", "Dow", "FMC", "H.B. Fuller", "Linde", "LyondellBasell", "Minerals Technologies", "Mosaic", "Nutrien", "Olin", "PPG", "RPM", "Sherwin-Williams", "Westlake"],
    Intermediates: ["Avient", "Cabot", "Celanese", "Chemours", "Eastman", "Huntsman", "Orion Engineered Carbons", "Stepan", "Trinseo", "Tronox"],
    Specialties: ["Albemarle", "Ashland", "Balchem", "DuPont de Nemours", "Ecolab", "Ecovyst", "Element Solutions", "Entegris", "Hexcel", "Ingevity", "International Flavors & Fragrances", "Qnity", "Quaker Houghton", "Rogers", "Sensient", "Solstice Advanced Materials"],
  },
  automotive: {
    "Auto Retail": ["Asbury Automotive", "AutoNation", "CarMax", "Carvana", "Group 1 Automotive", "Lithia Motors", "Penske Automotive", "Sonic Automotive"],
  },
  transportation: {
    Airlines: ["Air Canada", "Alaska Air", "Allegiant", "American Airlines", "Delta Air Lines", "Frontier Group", "JetBlue Airways", "Southwest Airlines", "Sun Country Airlines", "United Airlines"],
    "Asset Heavy": ["ArcBest", "Daseke", "Deutsche Post", "FedEx", "Heartland Express", "J.B. Hunt Transport", "Kirby", "Knight-Swift Transportation", "Matson", "Old Dominion Freight Line", "SAIA", "Schneider National", "TFI International", "United Parcel Service", "Werner Enterprises", "XPO"],
    "Asset Light": ["C.H. Robinson", "DSV", "Expeditors", "Forward Air", "Freightos", "Full Truck Alliance", "GXO Logistics", "Hub Group", "Kuehne & Nagel", "Landstar", "Pitney Bowes", "RXO"],
    Rail: ["Canadian National Railway", "Canadian Pacific Railway", "CSX", "Norfolk Southern", "Union Pacific"],
    Cruise: ["Carnival", "Lindblad Expeditions", "Norwegian Cruise Line", "Royal Caribbean", "Viking"],
  },
  basic_materials: {
    "Rigid Packaging": ["Ardagh Metal Packaging", "Ball", "Crown", "OI Glass"],
    "Specialty Packaging": ["Amcor", "AptarGroup", "Avery Dennison", "CCL Industries", "Greif", "Huhtamaki", "SIG Group", "Silgan", "Sonoco Products"],
    "Fiber-Based Packaging - NA": ["Graphic Packaging", "International Paper", "Packaging Corporation of America", "Smurfit Westrock"],
    "Fiber-Based Packaging - Europe": ["Billerud", "Mayr-Melnhof Karton", "Mondi", "Sappi", "Stora Enso"],
    "Construction Aggregates": ["Arcosa", "Eagle Materials", "Granite Construction", "Knife River", "Martin Marietta Materials", "Titan Americas", "Vulcan Materials"],
    "Pulp & Paper": ["Canfor Pulp", "Clearwater Paper", "Mercer International", "Ravonier Advanced Materials", "Suzano", "The Navigator Company"],
    "Wood Products": ["Boise Cascade", "Canfor", "Interfor", "Louisiana Pacific", "Universal Forest Products", "West Fraser"],
    "Timber REITs": ["PotlatchDeltic", "Weyerhaeuser"],
  },
};

// ---- §2.2 Chemicals Radar: deal_type → stage → companies ----
const RADAR = {
  carveout: {
    in_market: ["AMVAC", "Bioceres Crop Solutions", "Calumet TruFuel", "Dow Polyurethanes", "FMC", "Ingevity Advanced Polymer Technologies", "Nutrien Brazilian Soybean Business", "Nutrien Phosphates", "Solvay Flurochemicals", "Total Styrene and Polystyrene Plant", "Trinseo", "AmSty"],
    monitor_for_exit: ["Celanese Infraserv", "Celanese Teijin Films JV", "Hexion Versatic Acids", "Mosaic Brazil Assets", "Shell U.S. Chemical Assets"],
    on_hold: ["Beaulieu International Group / Pinnacle Polymers", "Braskem U.S. Assets", "Cargill Deicing Salt", "Compass Minerals Arizona Chemical", "IDL Chemical", "Element Solutions", "HF Sinclair Lubricants and Specialties", "Invista Nylon 6,6 Plants", "Syngenta Group non Ag/crop business", "Shell Phenol A"],
  },
  private_asset: {
    in_market: ["Boulder Scientific Company", "Chroma", "Delrin", "Drew Marine", "EPSilyte", "Fralock", "gChem", "Prince Izant", "Old World Industries", "Osterman", "Weitron"],
    monitor_for_exit: ["Altivia", "AluChem", "Barrday", "Carbide Industries LLC", "Covia", "Dixie Chemical", "DK (unnamed)", "GEON", "Greene Weed", "Meridian", "Microporous", "Miraclon", "Polytek Development Corp.", "Sachem", "SafeChem", "Shamrock", "Shrieve", "Tilley Distribution", "Vincit", "Wakefield"],
    on_hold: ["AgXplore", "Connection Chemical", "FXI", "Innophos", "Isola", "Lion Elastomers", "Microban", "TPC Group", "Valudor Products LLC", "Vantage"],
  },
};

const lines = [];
lines.push("-- ============================================================================");
lines.push("-- Arbor — real taxonomy (Backend §2.1) + Chemicals deal radar (Backend §2.2).");
lines.push("-- Generated by scripts/gen-taxonomy-seed.mjs. Idempotent. Apply after 0005.");
lines.push("-- Non-destructive: demo companies untouched; §2.1 universe lands in a new");
lines.push("-- universe_companies table; §2.2 chemical deals land in companies (sector");
lines.push("-- 'chemicals', which already exists in sector_enum).");
lines.push("-- ============================================================================");
lines.push("");
lines.push("-- subsector on deal companies (nullable; chemicals left blank per §1.1).");
lines.push("alter table public.companies add column if not exists subsector text;");
lines.push("");
lines.push("-- Monitored company universe (§2.1). No deal stage — sector/subsector as text.");
lines.push(`create table if not exists public.universe_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sector     text not null,
  subsector  text,
  created_at timestamptz not null default now(),
  unique (name, sector, subsector)
);`);
lines.push("create index if not exists idx_universe_sector on public.universe_companies (sector);");
lines.push("alter table public.universe_companies enable row level security;");
lines.push(`drop policy if exists "universe_read" on public.universe_companies;`);
lines.push(`create policy "universe_read" on public.universe_companies
  for select to authenticated using (true);`);
lines.push("grant select on public.universe_companies to authenticated;");
lines.push("");
lines.push("create or replace view public.v_universe_counts as");
lines.push("  select sector, subsector, count(*)::int as n");
lines.push("  from public.universe_companies group by sector, subsector;");
lines.push("grant select on public.v_universe_counts to authenticated;");
lines.push("alter view public.v_universe_counts set (security_invoker = on);");
lines.push("");

// universe inserts
const uRows = [];
for (const [sector, subs] of Object.entries(UNIVERSE)) {
  for (const [subsector, names] of Object.entries(subs)) {
    for (const name of names) uRows.push(`  (${q(name)}, ${q(sector)}, ${q(subsector)})`);
  }
}
lines.push(`-- §2.1 universe (${uRows.length} companies)`);
lines.push("insert into public.universe_companies (name, sector, subsector) values");
lines.push(uRows.join(",\n"));
lines.push("on conflict (name, sector, subsector) do nothing;");
lines.push("");

// radar inserts → companies (+ new_entry history) via CTE
const cRows = [];
const seen = new Set();
for (const [deal, stages] of Object.entries(RADAR)) {
  for (const [stage, names] of Object.entries(stages)) {
    for (const name of names) {
      if (seen.has(name)) continue; // dedup (Boulder Scientific appears twice)
      seen.add(name);
      cRows.push(`  (${q(name)}, 'chemicals', ${q(deal)}, ${q(stage)}, 'high')`);
    }
  }
}
lines.push(`-- §2.2 Chemicals deal radar (${cRows.length} companies) → companies + new_entry history`);
lines.push("with ins as (");
lines.push("  insert into public.companies (name, sector, deal_type, current_stage, confidence) values");
lines.push(cRows.join(",\n"));
lines.push("  returning id, current_stage, name");
lines.push(")");
lines.push("insert into public.deal_stage_history (company_id, stage, event_type, changed_by, source_type, headline)");
lines.push("select id, current_stage, 'new_entry', 'analyst_manual', 'manual', 'Added to Chemicals radar — ' || name from ins;");
lines.push("");

writeFileSync(OUT, lines.join("\n"));
console.log(`Wrote ${OUT}`);
console.log(`Universe: ${uRows.length} companies · Radar: ${cRows.length} deal companies`);
