/* ---------------------------------------------------------------------------
   ADIF enumerations: bands and modes.

   Kept separate from the parser so the lists can be extended as ADIF grows
   without touching parsing logic.
   --------------------------------------------------------------------------- */

(function (global) {
  "use strict";

  /* Every band in the ADIF specification, with its frequency range in MHz.
     The range lets a band be recovered from FREQ when the BAND field is
     missing, which happens in exports from some rig-control software. */
  var BANDS = [
    ["2190m", 0.1357, 0.1378], ["630m", 0.472, 0.479], ["560m", 0.501, 0.504],
    ["160m", 1.8, 2.0], ["80m", 3.5, 4.0], ["60m", 5.06, 5.45],
    ["40m", 7.0, 7.3], ["30m", 10.1, 10.15], ["20m", 14.0, 14.35],
    ["17m", 18.068, 18.168], ["15m", 21.0, 21.45], ["12m", 24.89, 24.99],
    ["10m", 28.0, 29.7], ["8m", 40.0, 45.0], ["6m", 50.0, 54.0],
    ["5m", 54.000001, 69.9], ["4m", 70.0, 71.0], ["2m", 144.0, 148.0],
    ["1.25m", 222.0, 225.0], ["70cm", 420.0, 450.0], ["33cm", 902.0, 928.0],
    ["23cm", 1240.0, 1300.0], ["13cm", 2300.0, 2450.0], ["9cm", 3300.0, 3500.0],
    ["6cm", 5650.0, 5925.0], ["3cm", 10000.0, 10500.0],
    ["1.25cm", 24000.0, 24250.0], ["6mm", 47000.0, 47200.0],
    ["4mm", 75500.0, 81000.0], ["2.5mm", 119980.0, 123000.0],
    ["2mm", 134000.0, 149000.0], ["1mm", 241000.0, 250000.0]
  ];

  var BAND_NAMES = Object.create(null);
  var BAND_ORDER = Object.create(null);
  BANDS.forEach(function (entry, index) {
    BAND_NAMES[entry[0]] = entry[0];
    BAND_ORDER[entry[0]] = index;
  });

  /* Normalises the spelling of a BAND value: "20M", "20 m", "20metres" all
     become "20m". Returns "" when the value is not a recognised band. */
  function normaliseBand(value) {
    if (!value) return "";
    var text = String(value).trim().toLowerCase().replace(/\s+/g, "");

    if (BAND_NAMES[text]) return text;

    // "20meters" / "20metres" / "70centimeters"
    text = text.replace(/met(er|re)s?$/, "m").replace(/centimet(er|re)s?$/, "cm")
               .replace(/millimet(er|re)s?$/, "mm");
    return BAND_NAMES[text] || "";
  }

  /* Recovers the band from a frequency in MHz. */
  function bandForFrequency(mhz) {
    var freq = parseFloat(mhz);
    if (!isFinite(freq)) return "";

    for (var i = 0; i < BANDS.length; i++) {
      if (freq >= BANDS[i][1] && freq <= BANDS[i][2]) return BANDS[i][0];
    }
    return "";
  }

  function bandRank(band) {
    var rank = BAND_ORDER[band];
    return rank === undefined ? BANDS.length : rank;
  }

  /* Modes that logging programs write in place of the ADIF mode. Voice
     sidebands are the common case: ADIF defines SSB, but plenty of software
     logs USB or LSB. Nothing else is collapsed - an unrecognised mode is
     shown as it appears rather than being discarded. */
  var MODE_ALIASES = {
    USB: "SSB", LSB: "SSB", DSB: "SSB", J3E: "SSB",
    A1A: "CW", CWR: "CW",
    F3E: "FM", NFM: "FM", FMN: "FM",
    A3E: "AM",
    PKT: "PACKET", PSK31: "PSK31", DIGITALVOICE: "DIGITAL VOICE"
  };

  /* MODE plus SUBMODE is how ADIF expresses the specific mode: FT4 is logged
     as MODE=MFSK with SUBMODE=FT4, JS8 and Q65 likewise. The submode is the
     name an operator recognises, so it wins when present. */
  function resolveMode(modeValue, submodeValue) {
    var submode = String(submodeValue || "").trim().toUpperCase();
    var mode = String(modeValue || "").trim().toUpperCase();

    var chosen = submode || mode;
    if (!chosen) return "";

    return MODE_ALIASES[chosen] || chosen;
  }

  global.AdifEnums = {
    bands: BANDS,
    normaliseBand: normaliseBand,
    bandForFrequency: bandForFrequency,
    bandRank: bandRank,
    resolveMode: resolveMode,
    modeAliases: MODE_ALIASES
  };
})(window);
