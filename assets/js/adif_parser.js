/* ---------------------------------------------------------------------------
   ADIF parser — standalone, no dependencies.

   ADIF (Amateur Data Interchange Format) is a tag-delimited text format:

     <FIELD:LENGTH>value            length is a byte count, not delimiter based
     <FIELD:LENGTH:TYPE>value       TYPE is a single-letter data-type indicator
     <EOH>                          ends the optional header
     <EOR>                          ends one record

   Because every value is length-prefixed, values may legally contain "<" and
   ">". So the scanner always skips exactly LENGTH characters after a tag
   rather than searching for the next delimiter.

   Usage:
     var log = AdifParser.parse(text);
     log.records  -> [ { call: "ON4OSA", band: "20m", ... }, ... ]
     log.fields   -> [ "call", "band", ... ]  (union, in first-seen order)
     log.header   -> { adif_ver: "3.1.4", programid: "...", ... }
     log.types    -> { freq: "N", qso_date: "D", ... }  where declared
   --------------------------------------------------------------------------- */

(function (global) {
  "use strict";

  // Matches one "<...>" tag. The body is split on ":" afterwards so that
  // malformed or unusual tags degrade gracefully instead of failing to match.
  var TAG = /<([^<>]*)>/g;

  function parse(text) {
    if (typeof text !== "string") {
      throw new TypeError("AdifParser.parse expects a string");
    }

    // Strip a UTF-8 BOM; some logging programs emit one.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    var header = {};
    var types = {};
    var records = [];
    var fields = [];
    var seen = Object.create(null);

    var record = null;          // null until the first field after <EOH>
    var errors = [];

    // A header exists only if the file actually contains <EOH>. Without one
    // the very first tag is already record data, so don't swallow it.
    var inHeader = /<\s*eoh\s*>/i.test(text);

    TAG.lastIndex = 0;
    var match;

    while ((match = TAG.exec(text)) !== null) {
      var parts = match[1].split(":");
      var name = parts[0].trim().toLowerCase();
      if (!name) continue;

      if (name === "eoh") {
        inHeader = false;
        continue;
      }

      if (name === "eor") {
        inHeader = false;
        if (record) {
          records.push(record);
          record = null;
        }
        continue;
      }

      // Length is required on data fields. Treat a missing or bad one as zero
      // so a damaged file still yields the records around it.
      var length = parts.length > 1 ? parseInt(parts[1], 10) : NaN;
      if (isNaN(length) || length < 0) {
        errors.push("Field <" + match[1] + "> has no usable length");
        length = 0;
      }

      var value = text.substr(TAG.lastIndex, length);
      if (value.length < length) {
        errors.push("Field <" + name + "> is truncated at end of file");
      }
      // Skip the value so any "<" inside it is never read as a tag.
      TAG.lastIndex += value.length;

      var type = parts.length > 2 ? parts[2].trim().toUpperCase() : "";

      if (inHeader) {
        header[name] = value;
        continue;
      }

      if (type && !types[name]) types[name] = type;
      if (!seen[name]) {
        seen[name] = true;
        fields.push(name);
      }

      if (!record) record = {};
      record[name] = value;
    }

    // A final record whose <EOR> is missing still counts.
    if (record) records.push(record);

    return {
      header: header,
      records: records,
      fields: fields,
      types: types,
      errors: errors
    };
  }

  /* Formats an ADIF date ("YYYYMMDD") or time ("HHMM"/"HHMMSS") for display.
     Returns the input unchanged if it does not look like one. */
  function formatValue(name, value) {
    if (!value) return value;

    if (/^(qso_date|qso_date_off|.*_date)$/.test(name) && /^\d{8}$/.test(value)) {
      return value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8);
    }

    if (/^time_(on|off)$/.test(name) && /^\d{4}(\d{2})?$/.test(value)) {
      var out = value.slice(0, 2) + ":" + value.slice(2, 4);
      if (value.length === 6) out += ":" + value.slice(4, 6);
      return out;
    }

    return value;
  }

  /* --- field accessors ---------------------------------------------------
     ADIF knowledge, kept beside the parser so views don't each re-invent it. */

  /* The mode, resolved through the ADIF mode/submode rules (see adif_enums).
     Anything unrecognised is kept verbatim rather than dropped. */
  function mode(record) {
    if (global.AdifEnums) {
      var resolved = global.AdifEnums.resolveMode(record.mode, record.submode);
      if (resolved) return resolved;
    }

    var raw = (record.submode || record.mode || "").trim().toUpperCase();
    return raw || "Unknown";
  }

  /* The band. Falls back to deriving it from FREQ when BAND is absent, and
     keeps an unrecognised band string as written instead of discarding it. */
  function band(record) {
    var raw = (record.band || "").trim();

    if (global.AdifEnums) {
      var normalised = global.AdifEnums.normaliseBand(raw);
      if (normalised) return normalised;

      var derived = global.AdifEnums.bandForFrequency(record.freq);
      if (derived) return derived;
    }

    return raw ? raw.toLowerCase() : "Unknown";
  }

  /* When the QSO started, as a Date, or null when the record carries no usable
     date. ADIF dates and times are UTC: QSO_DATE is YYYYMMDD and TIME_ON is
     HHMM or HHMMSS. A record with a date but no time is placed at midnight. */
  function timestamp(record) {
    var date = (record.qso_date || "").trim();
    if (!/^\d{8}$/.test(date)) return null;

    var time = (record.time_on || "").trim();
    var hour = 0, minute = 0, second = 0;

    if (/^\d{4}$/.test(time) || /^\d{6}$/.test(time)) {
      hour = parseInt(time.slice(0, 2), 10);
      minute = parseInt(time.slice(2, 4), 10);
      if (time.length === 6) second = parseInt(time.slice(4, 6), 10);
    }

    var stamp = new Date(Date.UTC(
      parseInt(date.slice(0, 4), 10),
      parseInt(date.slice(4, 6), 10) - 1,
      parseInt(date.slice(6, 8), 10),
      hour, minute, second
    ));

    return isNaN(stamp.getTime()) ? null : stamp;
  }

  /* Who was at the key. OPERATOR is the individual; STATION_CALLSIGN is the
     callsign transmitted, which is the best stand-in when OPERATOR is absent. */
  function operator(record) {
    var value = (record.operator || record.station_callsign ||
                 record.owner_callsign || "").trim().toUpperCase();
    return value || "Unknown";
  }

  /* COUNTRY is optional and contest exports often omit it, so fall back
     through DXCC and finally the callsign prefix (see dxcc_prefixes.js). */
  function country(record) {
    var value = (record.country || "").trim();
    if (value) return value;

    if (global.DxccPrefixes) {
      var byPrefix = global.DxccPrefixes.lookup(record.call);
      if (byPrefix) return byPrefix;
    }

    var dxcc = (record.dxcc || "").trim();
    if (dxcc) return "DXCC " + dxcc;

    return "Unknown";
  }

  var CONTINENTS = {
    EU: "Europe", AS: "Asia", AF: "Africa", NA: "North America",
    SA: "South America", OC: "Oceania", AN: "Antarctica"
  };

  /* CONT is the ADIF field, but contest exports rarely fill it in. N1MM
     writes its own, and failing both the continent follows from the callsign
     prefix, which resolves for anything the country lookup resolves. */
  function continent(record) {
    var code = (record.cont || record.app_n1mm_continent || "").trim().toUpperCase();

    if (!code && global.DxccPrefixes) {
      var hit = global.DxccPrefixes.entity(record.call);
      if (hit) code = hit.continent;
    }

    if (!code) return "Unknown";
    return CONTINENTS[code] || code;
  }

  /* ADIF has no field for how the worked station was operating, so this is
     read from the callsign suffix, which is the convention operators use.
     Order matters: /MM and /AM must be tested before the bare /M. */
  var SUFFIXES = [
    [/\/MM$/i, "Maritime mobile"],
    [/\/AM$/i, "Aeronautical mobile"],
    [/\/M$/i, "Mobile"],
    [/\/P$/i, "Portable"],
    [/\/QRP$/i, "Portable"]
  ];

  function stationType(record) {
    var call = (record.call || "").trim();
    if (!call) return "Unknown";

    for (var i = 0; i < SUFFIXES.length; i++) {
      if (SUFFIXES[i][0].test(call)) return SUFFIXES[i][1];
    }
    return "Fixed";
  }

  global.AdifParser = {
    parse: parse,
    formatValue: formatValue,
    mode: mode,
    band: band,
    country: country,
    continent: continent,
    stationType: stationType,
    operator: operator,
    timestamp: timestamp
  };
})(window);
