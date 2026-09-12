# ADIF Explorer

Interactive web application for visualizing an [ADIF](https://adif.org/) amateur
radio log. Everything runs in the browser — the log is never uploaded anywhere.

Three views:

- **Table** — every record, every field, with a sticky header.
- **Charts** — country, continent, band, station type, mode and operator, each as
  a pie or a ranked bar chart, all of them cross-filtering each other.
- **Time** — QSOs per hour as stacked bar charts, one per dimension.

## Running it

```sh
bundle install
bundle exec jekyll serve
```

Then open <http://127.0.0.1:4000/>. Requires Ruby and Jekyll 4.4 or newer.

## Loading a log

Press **Choose ADIF file** in the toolbar. Nothing leaves your machine.

You can also point the page at a hosted log with `?adif=`:

```
http://127.0.0.1:4000/?adif=https://example.com/logs/station.adi
http://127.0.0.1:4000/?adif=/logs/2026/field-day.adi        (same site)
```

| Parameter | Purpose |
|---|---|
| `adif` | URL of the ADIF file to load |
| `url`  | Alias for `adif`, in case that is what you reach for first |
| `view` | Which view to open once the log is in: `table`, `chart` or `time` |

Without `view`, a loaded log stops at a "233 records loaded" message and waits
for you to press a toolbar button. `view` skips straight to a view, and works on
its own too — opening `?view=chart` with no log sets the preference for that
page, so a file you then pick with the toolbar button opens directly into the
charts.

A few things worth knowing:

- **Percent-encode the URL** if it contains `&` or `#`, or the parameter will be
  cut short: `?adif=https://example.com/log.adi%3Fkey%3Dabc%26id%3D7`.
- **Only `http:` and `https:` URLs are fetched.** Anything else is refused.
- **A log on another site needs CORS.** The browser only hands the response to
  this page if that server allows it, and many file hosts and cloud-storage
  share links do not — the request then fails with "Failed to fetch". That is a
  restriction of the other server, not of this tool. A log served from the same
  site as the page is never affected.
- **Requests are sent without credentials**, so a URL that depends on a login
  session or cookie will not work.
- Files are read as UTF-8 and fall back to Windows-1252, so accented characters
  survive whichever your logging software wrote.

## The chart view

Each card has a **pie / bar selector** in its top-right corner. The choice is per
card and survives switching to another view and back.

Clicking any value — a pie slice, a legend row or a bar — filters by it:

- The chart you clicked keeps showing **all** of its values, with the selected
  one lit and the rest dimmed, so you can switch selection without clearing.
- Every **other** chart re-decomposes only the matching QSOs.
- Selections in **different** dimensions combine. `Mode = SSB` plus `Band = 20m`
  shows SSB contacts made on 20m.
- Clicking the same value again clears it. Active filters also appear as
  removable chips above the charts, with a **Clear all**.

A value keeps its colour as you filter, so a band stays the same colour even as
the categories above it drop out.

Legend rows and bar rows respond to Enter and Space. Pie slices are mouse-only;
the legend beside them is the keyboard route to the same values.

## The time view

The clock button plots **QSOs per hour** as a stacked bar chart — one chart per
dimension, stacked down the page.

Every chart shows the same bars. Each QSO has exactly one country, one band, one
mode and so on, so the hourly totals are identical across the charts and only the
segmentation differs — which is what makes them comparable at a glance. For the
same reason they share one vertical scale, hovering an hour highlights that hour
in every chart, and their horizontal scrolling is synchronised.

- **Times are UTC**, as ADIF stores them. A record with a date but no time lands
  at 00:00 that day.
- **Quiet hours are drawn as gaps, not skipped** — an overnight break should look
  like one. Day boundaries get a rule and a date label.
- **Records with no usable date** cannot be placed on the axis. They are excluded
  and counted in the heading rather than silently dropped.
- **Very long logs bucket by day.** Past 5000 bars an hourly axis stops being
  drawable, so the bucket widens and the heading says so.

Hovering a column gives the hour, its total, and that chart's breakdown of it.

## Where the numbers come from

ADIF records are sparse, and contest exports in particular omit fields that other
software fills in. Rather than give up, each dimension falls back:

| Dimension | Source, in order |
|---|---|
| **Country** | `COUNTRY` → callsign prefix → `DXCC` entity number |
| **Continent** | `CONT` → `APP_N1MM_CONTINENT` → continent of the callsign prefix |
| **Band** | `BAND`, normalised (`20M`, `20 m`, `20meters` → `20m`) → derived from `FREQ` |
| **Mode** | `SUBMODE` if present, else `MODE`; `USB`/`LSB` fold into `SSB` |
| **Station type** | Callsign suffix: `/P` portable, `/M` mobile, `/MM` maritime mobile, `/AM` aeronautical mobile, otherwise fixed |
| **Operator** | `OPERATOR` → `STATION_CALLSIGN` → `OWNER_CALLSIGN` |

Three of these are worth reading with a pinch of salt:

- **Country from a callsign prefix is an approximation** of the DXCC entity list.
  It covers the common allocations and handles split entities (`OH0` Åland vs
  `OH2` Finland, `EA8` Canary Islands vs `EA4` Spain, `GM` Scotland vs `G`
  England), but not all ~340 entities with their exceptions. A real `COUNTRY`
  field in your log always wins over it.
- **Station type is inferred**, not read. ADIF has no field for how the worked
  station was operating, so this reads the callsign suffix — the convention
  operators actually use.
- **Continent follows the DXCC list, not plain geography**: Madeira and the
  Canaries are Africa, Turkey and Cyprus Asia, Greenland North America, Hawaii
  Oceania, and Russia is split into European and Asiatic Russia by call area.

## Known limits

- The table view renders every record at once. A log of tens of thousands of
  QSOs will build a very large DOM and feel sluggish.
- A pie with dozens of slices is complete but not readable — most wedges become
  hairlines. Switch that card to **bar** for a long-tailed dimension such as
  country.
- Light theme only; the page does not follow `prefers-color-scheme`.