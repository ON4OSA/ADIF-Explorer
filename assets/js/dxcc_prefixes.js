/* ---------------------------------------------------------------------------
   Callsign prefix -> DXCC entity.

   A fallback for logs that carry no COUNTRY or DXCC field (contest exports
   often don't). Where the log has a real COUNTRY field, that always wins.

   The table itself is generated into dxcc_data.js from cty.dat, the mapping
   most logging software uses — see tools/build_dxcc_data.py. This file holds
   only the lookup, which is longest-prefix-first, so "OH0" (Aland) beats "OH"
   (Finland).

   Two classes of entity cannot be expressed as a leading prefix and so resolve
   to their parent: sub-entities told apart by a suffix rather than a prefix
   (Austral Is. FO/A inside French Polynesia, Conway Reef 3D2/C inside Fiji),
   and individual stations operating away from home (cty.dat's exact-callsign
   overrides). Both are rare in a normal log.
   --------------------------------------------------------------------------- */

(function (global) {
  "use strict";

  var TABLE = Object.create(null);
  var NAMES = Object.create(null);
  var LONGEST = 1;

  /* A country name reduced to the part that carries meaning, so that the same
     entity written two ways lands on one key: case, accents, punctuation and
     "&" vs "and" all stop mattering. Deliberately conservative — it never
     drops a word, because words are what tell entities apart ("Congo" and
     "Dem. Rep. of the Congo" are two countries, as are the two Koreas). */
  function normaliseName(value) {
    var text = String(value == null ? "" : value);

    if (text.normalize) {
      text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    return text.toUpperCase()
               .replace(/&/g, " AND ")
               .replace(/[^A-Z0-9]+/g, " ")
               .trim();
  }

  /* dxcc_data.js carries one string per entity: NAME|CONTINENT|PFX PFX PFX */
  (function build() {
    var data = global.DxccData || [];

    for (var i = 0; i < data.length; i++) {
      var parts = data[i].split("|");
      var entity = { country: parts[0], continent: parts[1] };
      var prefixes = parts[2].split(" ");

      NAMES[normaliseName(entity.country)] = entity;

      for (var p = 0; p < prefixes.length; p++) {
        TABLE[prefixes[p]] = entity;
        if (prefixes[p].length > LONGEST) LONGEST = prefixes[p].length;
      }
    }
  })();

  /* The entity a free-text country name refers to, or null when the text is
     not a name this list knows. "CANADA", "Canada" and "canada" all resolve to
     the one entity, so a log that shouts its COUNTRY field and a name derived
     from a callsign stop being two different countries. */
  function byName(value) {
    return NAMES[normaliseName(value)] || null;
  }

  /* Suffixes that describe how or where someone is operating rather than the
     country they are in. Several collide with real prefixes, so they are
     matched exactly and only ever in a trailing segment. */
  var OPERATING_SUFFIX =
    /^(P|M|MM|AM|A|B|R|J|T|N|QRP|QRPP|LH|LGT|BCN|SK|AG|AE|KT|MOBILE|PORTABLE)$/;

  function match(call) {
    for (var len = Math.min(LONGEST, call.length); len > 0; len--) {
      var hit = TABLE[call.slice(0, len)];
      if (hit) return hit;
    }
    return null;
  }

  /* Returns the { country, continent } entry for a callsign, or null when the
     prefix is not in the table.

     Callsigns arrive with slashed segments that mean different things:
       ON4ABC/P    an operating suffix - ignore it
       ON4ABC/LH   a special-activity suffix - ignore it
       OI1MPK/15   a call-area suffix - ignore it
       DL/ON4ABC   a DX prefix - the operator is in Germany, not Belgium
       ON4ABC/DL   the same thing written the other way round

     A trailing segment is treated as a DX prefix only when it is shorter than
     the base call, is not a known operating suffix, and resolves to a country.
     The suffix list is needed because several of them are also valid prefixes:
     /MM (maritime mobile) looks like Scotland, /LH (lighthouse) like Norway. */
  function entity(callsign) {
    if (!callsign) return null;

    var call = String(callsign).trim().toUpperCase();

    // A segment with no letter (a bare call area, "/15") is never a prefix.
    var parts = call.split("/").filter(function (part) {
      return part.length && /[A-Z]/.test(part);
    });
    if (!parts.length) return null;

    var base = parts[0];

    for (var i = 1; i < parts.length; i++) {
      if (parts[i].length >= base.length) continue;
      if (OPERATING_SUFFIX.test(parts[i])) continue;
      var asPrefix = match(parts[i]);
      if (asPrefix) return asPrefix;
    }

    return match(base);
  }

  /* Returns a country name, or "" when the prefix is not in the table. */
  function lookup(callsign) {
    var hit = entity(callsign);
    return hit ? hit.country : "";
  }

  global.DxccPrefixes = {
    lookup: lookup,
    entity: entity,
    byName: byName,
    table: TABLE
  };
})(window);
