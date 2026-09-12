# ADIF Explorer — working notes

Single-page Jekyll site that parses and visualizes an ADIF amateur radio log
entirely in the browser. No JavaScript dependencies and no front-end build step:
`_layouts/default.html` loads six plain scripts directly. `README.md` covers the
app from a user's point of view; this file covers the code.

```sh
bundle install
bundle exec jekyll serve        # http://127.0.0.1:4000/
```

Requires Ruby and Jekyll 4.4 or newer.

---

## Layout

```
.
├── _config.yml              site settings, en_US locale, Etc/UTC
├── index.html               the single page
├── _layouts/default.html    two-pane shell, loads the scripts in order
├── _includes/toolbar.html   file button, table / chart / time buttons
├── ON9BD_illw_2022.ADI      a real N1MM contest export, useful as a fixture
└── assets/
    ├── css/style.css        all styles
    └── js/
        ├── adif_enums.js    ADIF band list with frequency ranges, mode aliases
        ├── dxcc_prefixes.js callsign prefix → country table
        ├── adif_parser.js   the parser and the per-record field accessors
        ├── charts.js        pie and bar rendering, cross-filtering, tooltip
        ├── timeline.js      QSOs per hour, one stacked chart per dimension
        └── app.js           toolbar wiring, loading, the table view
```

The scripts must load in that order — `adif_parser.js` uses the two data
modules, `charts.js` and `app.js` use the parser, and `timeline.js` uses both the
parser and `charts.js` (for the dimension list and colours).
`_layouts/default.html` is the only place that order is expressed.

Each script is an IIFE hanging one global off `window`: `AdifEnums`,
`DxccPrefixes`, `AdifParser`, `AdifCharts`, `AdifTimeline`. `app.js` exports
nothing. The code is ES5-flavoured (`var`, no arrow functions, no modules) —
match that when editing.

---

## The parser

`AdifParser.parse(text)` returns:

```js
{
  header:  { adif_ver: "3.1.4", programid: "…" },  // {} when the file has no <EOH>
  records: [ { call: "ON4OSA", band: "20m", … } ], // field names lower-cased
  fields:  [ "call", "band", … ],                  // union, first-seen order
  types:   { qso_date: "D", freq: "N" },           // declared data types
  errors:  [ … ]                                   // recoverable problems
}
```

ADIF values are **length-prefixed, not delimiter-terminated**, so the scanner
skips exactly `LENGTH` characters after each tag rather than searching for the
next `<`. This is what lets a comment field containing `<` or `>` parse
correctly instead of derailing the rest of the file. Don't "simplify" the
scanner into a split on delimiters.

It also handles a missing header, a missing final `<EOR>`, a UTF-8 BOM, and
truncated fields — the last of these are collected into `errors` rather than
thrown, so the records around a damaged one still load.

Beside the parser live the per-record accessors (`country`, `continent`, `band`,
`mode`, `stationType`, `operator`, `timestamp`), so the views don't each
re-invent ADIF knowledge.

### Character encoding

`decodeAdif` in `app.js` reads the file as bytes and decodes it as UTF-8 with
`fatal: true`, falling back to Windows-1252 when that throws. Plenty of logging
software writes Latin-1/Windows-1252, so this keeps accented characters in
comment and name fields intact either way. The same path serves both the file
picker and URL loading.

### URL loading

`?adif=` / `?url=` are resolved against the page (`new URL(raw, location.href)`),
so relative paths work. Only `http:` and `https:` are fetched — anything else is
refused before a request is made, because this fetches and renders whatever it
gets. Requests go out with `credentials: "omit"`. A cross-site fetch the other
server does not allow surfaces as a bare `TypeError: Failed to fetch`, which is
why the catch block adds a CORS note for that case specifically and not for HTTP
status errors.

`?view=` is resolved once at startup into `startupView` and then applies to
every log opened in that page, not just the first. An unrecognised value is
ignored rather than treated as an error.

---

## How each dimension is derived

ADIF records are sparse, and contest exports in particular omit fields that
other software fills in. Each accessor falls back rather than giving up:

| Dimension | Source, in order |
|---|---|
| **Country** | `COUNTRY` → callsign prefix → `DXCC` entity number |
| **Continent** | `CONT` → `APP_N1MM_CONTINENT` → continent of the callsign prefix |
| **Band** | `BAND`, normalised (`20M`, `20 m`, `20meters` → `20m`) → derived from `FREQ` |
| **Mode** | `SUBMODE` if present, else `MODE`; `USB`/`LSB` fold into `SSB` |
| **Station type** | Callsign suffix: `/P`, `/M`, `/MM`, `/AM`, otherwise fixed |
| **Operator** | `OPERATOR` → `STATION_CALLSIGN` → `OWNER_CALLSIGN` |
| **Time** | `QSO_DATE` + `TIME_ON`, read as UTC |

- **`SUBMODE` wins over `MODE`** because that is how ADIF expresses specific
  digital modes: FT4 is logged as `MODE=MFSK` with `SUBMODE=FT4`, as are JS8 and
  Q65. A record with `MODE=MFSK` and no submode is shown as MFSK.
- **Station type is inferred**, not read. ADIF has no field for how the worked
  station was operating, so the callsign suffix — the convention operators
  actually use — is what this reads. Order matters in `SUFFIXES`: `/MM` and `/AM`
  must be tested before the bare `/M`.
- **Continent follows the DXCC list, not plain geography**, where the two
  differ: Madeira and the Canaries are Africa, Turkey and Cyprus Asia, Greenland
  North America, Hawaii Oceania. Russia is split into European and Asiatic
  Russia by call area, including the 9-area regions west of the Urals (Perm,
  Komi, Orenburg, Bashkortostan) that DXCC keeps in Europe. Checked against
  N1MM's own continent field on a real contest log: no disagreements.
- **Country from the callsign prefix** is an approximation of the DXCC entity
  list covering the common allocations, not all ~340 entities with their
  exceptions. Lookup is longest-match, so `OH0` (Åland) beats `OH` (Finland).
  `entity()` distinguishes a DX prefix from an operating suffix: `DL/ON4ABC` and
  `ON4ABC/DL` both resolve to Germany, while `/MM`, `/LH` and bare call-area
  suffixes like `/15` are ignored. The `OPERATING_SUFFIX` list exists precisely
  because several of those collide with real prefixes — `/MM` looks like
  Scotland, `/LH` like Norway. A real `COUNTRY` field always wins.

---

## Invariants worth not breaking

- **Colours are fixed once from the unfiltered ranking** (`computeColors`) and
  looked up by value thereafter, so filtering never repaints the categories that
  remain — a band keeps its colour as things above it drop out.
- **A chart is drawn ignoring its own selection.** `matchingIndices(exceptKey)`
  skips that dimension's filter so the card keeps showing all of its values,
  the selected one lit and the rest dimmed, and you can switch selection without
  first clearing it.
- **`AdifCharts.dimensions` is the single dimension list.** The time view reads
  it, so adding a chart there adds a timeline chart too.
- **Every QSO has exactly one value in every dimension.** That is what lets the
  time view share one vertical scale across all its charts and claim the bars are
  directly comparable. Any dimension that could produce zero or two values per
  record would quietly break that.
- **Empty time bins are kept.** `bin()` builds a contiguous run first-QSO to
  last. A time axis that closes up its quiet periods misreports the pace of a
  session — an overnight break should look like one.
- **Records that can't be placed are counted, not dropped** — parse errors in
  the table view heading, undated records in the time view heading.
- `session.values` precomputes each record's value in every dimension once, so a
  filter click re-tallies indices rather than re-deriving from records.
- Returning to the charts from the table keeps filters and per-card chart types
  (`sameLog` compares the `records` array identity); loading a different log
  starts clean.

---

## Extending it

- **Correct or add a country prefix** — one `add("PREFIX", "Country", "EU")`
  line in `assets/js/dxcc_prefixes.js`, the third argument being the ADIF
  continent code. Longest-match means a more specific prefix beats a shorter one
  automatically. If you add a prefix longer than four characters, raise
  `LONGEST`.
- **Add a band or a mode alias** — the `BANDS` table (name plus frequency range)
  or `MODE_ALIASES` in `assets/js/adif_enums.js`.
- **Add a chart dimension** — write an accessor in `adif_parser.js`, export it,
  and add one entry to the `CHARTS` array in `charts.js`. Everything else —
  colours, the type selector, filtering, tooltips, and the matching timeline
  chart — follows from that.

### Tuning constants

| Constant | File | Meaning |
|---|---|---|
| `DEFAULT_TYPE` | charts.js | `"pie"`; the chart type a card starts on |
| `LABEL_MIN_PCT` | charts.js | percentage below which a slice is not labelled directly |
| `distinct > 12` | charts.js `renderCard` | gives a long-tailed dimension a full-width row |
| `SERIES` | charts.js | the eight validated categorical colours; past eight, hue rotates by 137.5° |
| `SURFACE` | charts.js | pane background, used as the slice separator colour |
| `MAX_BARS` | timeline.js | 5000; above this the bucket widens from an hour to a day |
| `PLOT_HEIGHT`, `AXIS_WIDTH`, `TOP_PAD`, `LABEL_BAND` | timeline.js | time-view geometry |

---

## Known limits

- `renderTable` in `app.js` renders every record at once. A log of tens of
  thousands of QSOs builds a very large DOM and feels sluggish; that function is
  the single place to add windowing.
- A pie with dozens of slices is complete but not readable. The `distinct > 12`
  full-width rule helps the layout, not the legibility — bar is the answer.
- Light theme only; the page does not follow `prefers-color-scheme`.
- No test suite. `AdifCharts.tally`, `AdifCharts.state()` and `AdifTimeline.bin`
  are exposed with tests in mind but nothing consumes them yet.
