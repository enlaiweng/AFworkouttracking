-- AF Conditioning Challenge schema (D1 / SQLite)

CREATE TABLE IF NOT EXISTS members (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  team TEXT NOT NULL CHECK (team IN ('Blue', 'Red'))
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES members(slug),
  date TEXT NOT NULL,          -- YYYY-MM-DD
  type TEXT NOT NULL CHECK (type IN ('cardio', 'strength', 'stretching')),
  min REAL NOT NULL,
  pts REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_slug_date ON entries (slug, date);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries (date);

INSERT OR IGNORE INTO members (slug, name, team) VALUES
  ('aidan-duarte', 'Aidan Duarte', 'Blue'),
  ('alisa-revi', 'Alisa Revi', 'Blue'),
  ('anoush-krochian', 'Anoush Krochian', 'Blue'),
  ('cathleen-avalos', 'Cathleen Avalos', 'Blue'),
  ('chris-blank', 'Chris Blank', 'Blue'),
  ('chris-retama', 'Chris Retama', 'Blue'),
  ('dan-varney', 'Dan Varney', 'Blue'),
  ('dave-reveley', 'Dave Reveley', 'Blue'),
  ('debbie-bushong', 'Debbie Bushong', 'Blue'),
  ('enlai-weng', 'Enlai Weng', 'Blue'),
  ('evelyn-delgado', 'Evelyn Delgado', 'Blue'),
  ('ge-wu', 'Ge Wu', 'Blue'),
  ('greg-crouse', 'Greg Crouse', 'Blue'),
  ('heidi-stone', 'Heidi Stone', 'Blue'),
  ('jana-remy', 'Jana Remy', 'Blue'),
  ('jason-teh-mitchell', 'Jason Teh-Mitchell', 'Blue'),
  ('jeff-kiesel', 'Jeff Kiesel', 'Blue'),
  ('jeff-liu', 'Jeff Liu', 'Blue'),
  ('jen-woo', 'Jen Woo', 'Blue'),
  ('jim-tiao', 'Jim Tiao', 'Blue'),
  ('joel-centeno', 'Joel Centeno', 'Blue'),
  ('josie-badeaux', 'Josie Badeaux', 'Blue'),
  ('judy-lee', 'Judy Lee', 'Blue'),
  ('julius-schram', 'Julius Schram', 'Blue'),
  ('karin-monroe', 'Karin Monroe', 'Red'),
  ('katie-vuong', 'Katie Vuong', 'Red'),
  ('laurel-terreri', 'Laurel Terreri', 'Red'),
  ('lisa-korney', 'Lisa Korney', 'Red'),
  ('lynda-razo', 'Lynda Razo', 'Red'),
  ('manny-santoyo', 'Manny Santoyo', 'Red'),
  ('mary-swetka-yu', 'Mary Swetka Yu', 'Red'),
  ('mauricio-centeno', 'Mauricio Centeno', 'Red'),
  ('michael-johnson', 'Michael Johnson', 'Red'),
  ('michael-yu', 'Michael Yu', 'Red'),
  ('mica-palomares', 'Mica Palomares', 'Red'),
  ('nea-tatupu', 'Nea Tatupu', 'Red'),
  ('nick-pon', 'Nick Pon', 'Red'),
  ('rachelle-reyes', 'Rachelle Reyes', 'Red'),
  ('robyn-utu', 'Robyn Utu', 'Red'),
  ('roldan-reyes', 'Roldan Reyes', 'Red'),
  ('sally-flowers', 'Sally Flowers', 'Red'),
  ('sergent-buenaventura', 'Sergent Buenaventura', 'Red'),
  ('skip-marler', 'Skip Marler', 'Red'),
  ('steve-kashynski', 'Steve Kashynski', 'Red'),
  ('tom-harvey', 'Tom Harvey', 'Red'),
  ('vahe-krochian', 'Vahe Krochian', 'Red');
