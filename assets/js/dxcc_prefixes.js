/* ---------------------------------------------------------------------------
   Callsign prefix -> country.

   A fallback for logs that carry no COUNTRY or DXCC field (contest exports
   often don't). This is an approximation of the DXCC entity list covering the
   common allocations, not the full 340-entity list with its exceptions: a
   handful of split entities and special-event prefixes will land on the parent
   country. Where the log has a real COUNTRY field, that always wins.

   Lookup is longest-prefix-first, so "OH0" (Aland) beats "OH" (Finland).
   To correct or extend: add the prefix to the right line below.
   --------------------------------------------------------------------------- */

(function (global) {
  "use strict";

  var TABLE = Object.create(null);

  /* Each prefix maps to its country and the continent code ADIF uses for it
     (EU, AS, AF, NA, SA, OC), following the DXCC list where that differs from
     plain geography: Madeira and the Canaries are AF, Turkey and Cyprus AS,
     Greenland NA, Hawaii OC. */
  function add(prefixes, country, continent) {
    prefixes.split(/\s+/).forEach(function (prefix) {
      if (prefix) TABLE[prefix] = { country: country, continent: continent };
    });
  }

  /* Numeric-leading prefixes */
  add("1A", "S.M.O.M.", "EU");
  add("3A", "Monaco", "EU");
  add("3B8", "Mauritius", "AF"); add("3B9", "Rodrigues Island", "AF"); add("3C", "Equatorial Guinea", "AF");
  add("3D2", "Fiji", "OC"); add("3DA", "Eswatini", "AF"); add("3V", "Tunisia", "AF"); add("3W", "Vietnam", "AS");
  add("3X", "Guinea", "AF"); add("3Y", "Bouvet Island", "AF");
  add("4J 4K", "Azerbaijan", "AS"); add("4L", "Georgia", "AS"); add("4O", "Montenegro", "EU");
  add("4S", "Sri Lanka", "AS"); add("4U", "United Nations", "EU"); add("4W", "Timor-Leste", "OC");
  add("4X 4Z", "Israel", "AS");
  add("5A", "Libya", "AF"); add("5B", "Cyprus", "AS"); add("5H", "Tanzania", "AF"); add("5N", "Nigeria", "AF");
  add("5R", "Madagascar", "AF"); add("5T", "Mauritania", "AF"); add("5U", "Niger", "AF"); add("5V", "Togo", "AF");
  add("5W", "Samoa", "OC"); add("5X", "Uganda", "AF"); add("5Z", "Kenya", "AF");
  add("6W", "Senegal", "AF"); add("6Y", "Jamaica", "NA");
  add("7O", "Yemen", "AS"); add("7P", "Lesotho", "AF"); add("7Q", "Malawi", "AF"); add("7X", "Algeria", "AF");
  add("8P", "Barbados", "NA"); add("8Q", "Maldives", "AS"); add("8R", "Guyana", "SA");
  add("9A", "Croatia", "EU"); add("9G", "Ghana", "AF"); add("9H", "Malta", "EU"); add("9J", "Zambia", "AF");
  add("9K", "Kuwait", "AS"); add("9L", "Sierra Leone", "AF"); add("9M2 9M4 9W2", "West Malaysia", "AS");
  add("9M6 9M8 9W6 9W8", "East Malaysia", "OC"); add("9M 9W", "Malaysia", "AS"); add("9N", "Nepal", "AS");
  add("9Q 9O", "DR Congo", "AF"); add("9U", "Burundi", "AF"); add("9V", "Singapore", "AS");
  add("9X", "Rwanda", "AF"); add("9Y 9Z", "Trinidad & Tobago", "SA");

  /* A */
  add("A2", "Botswana", "AF"); add("A3", "Tonga", "OC"); add("A4", "Oman", "AS"); add("A5", "Bhutan", "AS");
  add("A6", "United Arab Emirates", "AS"); add("A7", "Qatar", "AS"); add("A9", "Bahrain", "AS");
  add("AA AB AC AD AE AF AG AI AJ AK", "United States", "NA");
  add("AL", "Alaska", "NA"); add("AP AQ AR AS", "Pakistan", "AS");

  /* B - D */
  add("B BA BD BG BH BI BT BY BZ", "China", "AS"); add("BM BO BU BV BX", "Taiwan", "AS");
  add("C3", "Andorra", "EU"); add("C5", "The Gambia", "AF"); add("C6", "Bahamas", "NA");
  add("C9", "Mozambique", "AF"); add("CA CB CC CD CE", "Chile", "SA"); add("CM CO", "Cuba", "NA");
  add("CN 5C 5D 5E 5F 5G", "Morocco", "AF"); add("CP", "Bolivia", "SA");
  add("CQ CR CS CT", "Portugal", "EU"); add("CU", "Azores", "EU"); add("CT3 CQ3 CR3", "Madeira", "AF");
  add("CX CV CW", "Uruguay", "SA"); add("CY0", "Sable Island", "NA"); add("CY9", "St. Paul Island", "NA");
  add("D2 D3", "Angola", "AF"); add("D4", "Cape Verde", "AF"); add("D6", "Comoros", "AF");
  add("DA DB DC DD DE DF DG DH DJ DK DL DM DN DO DP DQ DR", "Germany", "EU");
  add("DU DV DW DX DY DZ 4D 4E 4F 4G 4H 4I", "Philippines", "OC");

  /* E */
  add("E2 HS", "Thailand", "AS"); add("E3", "Eritrea", "AF"); add("E4", "Palestine", "AS");
  add("E5", "Cook Islands", "OC"); add("E7", "Bosnia-Herzegovina", "EU");
  add("EA6 EB6 EC6 ED6 EE6 EF6 EG6 EH6", "Balearic Islands", "EU");
  add("EA8 EB8 EC8 ED8 EE8 EF8 EG8 EH8", "Canary Islands", "AF");
  add("EA9 EB9 EC9 ED9 EE9 EF9 EG9 EH9", "Ceuta & Melilla", "AF");
  add("EA EB EC ED EE EF EG EH AM AN AO", "Spain", "EU");
  add("EI EJ", "Ireland", "EU"); add("EK", "Armenia", "AS"); add("EL", "Liberia", "AF");
  add("EP EQ", "Iran", "AS"); add("ER", "Moldova", "EU"); add("ES", "Estonia", "EU");
  add("ET", "Ethiopia", "AF"); add("EU EV EW", "Belarus", "EU"); add("EX", "Kyrgyzstan", "AS");
  add("EY", "Tajikistan", "AS"); add("EZ", "Turkmenistan", "AS");

  /* F - H */
  add("F TM HW HX HY", "France", "EU"); add("FG", "Guadeloupe", "NA"); add("FH", "Mayotte", "AF");
  add("FJ", "Saint Barthelemy", "NA"); add("FK", "New Caledonia", "OC"); add("FM", "Martinique", "NA");
  add("FO", "French Polynesia", "OC"); add("FP", "St. Pierre & Miquelon", "NA");
  add("FR", "Reunion Island", "AF"); add("FS", "Saint Martin", "NA"); add("FY", "French Guiana", "SA");
  add("G M 2E", "England", "EU"); add("GD MD 2D", "Isle of Man", "EU");
  add("GI MI 2I", "Northern Ireland", "EU"); add("GJ MJ 2J", "Jersey", "EU");
  add("GM MM 2M", "Scotland", "EU"); add("GU MU 2U", "Guernsey", "EU"); add("GW MW 2W", "Wales", "EU");
  add("H4", "Solomon Islands", "OC"); add("HA HG", "Hungary", "EU"); add("HB0", "Liechtenstein", "EU");
  add("HB HE", "Switzerland", "EU"); add("HC HD", "Ecuador", "SA"); add("HH", "Haiti", "NA");
  add("HI", "Dominican Republic", "NA"); add("HJ HK 5J 5K", "Colombia", "SA");
  add("HL DS DT 6K 6L 6M 6N", "South Korea", "AS"); add("HO HP", "Panama", "NA");
  add("HQ HR", "Honduras", "NA"); add("HV", "Vatican City", "EU"); add("HZ 7Z 8Z", "Saudi Arabia", "AS");

  /* I - L */
  add("IS0 IM0", "Sardinia", "EU"); add("I IK IZ IW IN IQ IR IU IO", "Italy", "EU");
  add("J2", "Djibouti", "AF"); add("J3", "Grenada", "NA"); add("J5", "Guinea-Bissau", "AF");
  add("J6", "Saint Lucia", "NA"); add("J7", "Dominica", "NA"); add("J8", "St. Vincent", "NA");
  add("JD1", "Ogasawara", "AS");
  add("JA JB JC JD JE JF JG JH JI JJ JK JL JM JN JO JP JQ JR JS 7J 7K 7L 7M 7N 8J 8N", "Japan", "AS");
  add("JT JU JV", "Mongolia", "AS"); add("JW", "Svalbard", "EU"); add("JX", "Jan Mayen", "EU");
  add("JY", "Jordan", "AS");
  add("KH2", "Guam", "OC"); add("KH6 KH7", "Hawaii", "OC"); add("KH8", "American Samoa", "OC");
  add("KL", "Alaska", "NA"); add("KP2", "US Virgin Islands", "NA"); add("KP3 KP4", "Puerto Rico", "NA");
  add("K N W", "United States", "NA");
  add("LA LB LC LD LE LF LG LH LI LJ LK LL LM LN", "Norway", "EU");
  add("LO LP LQ LR LS LT LU LV LW AY AZ", "Argentina", "SA");
  add("LX", "Luxembourg", "EU"); add("LY", "Lithuania", "EU"); add("LZ", "Bulgaria", "EU");

  /* O - P */
  add("OA OB OC", "Peru", "SA"); add("OD", "Lebanon", "AS"); add("OE", "Austria", "EU");
  add("OH0", "Aland Islands", "EU"); add("OJ0", "Market Reef", "EU"); add("OF OG OH OI", "Finland", "EU");
  add("OK OL", "Czech Republic", "EU"); add("OM", "Slovakia", "EU");
  add("ON OO OP OQ OR OS OT", "Belgium", "EU");
  add("OX XP", "Greenland", "NA"); add("OY", "Faroe Islands", "EU"); add("OU OV OZ 5P 5Q", "Denmark", "EU");
  add("P2", "Papua New Guinea", "OC"); add("P4", "Aruba", "SA"); add("P5", "North Korea", "AS");
  add("PA PB PC PD PE PF PG PH PI", "Netherlands", "EU");
  add("PJ2", "Curacao", "SA"); add("PJ4", "Bonaire", "SA"); add("PJ5 PJ6", "Saba & St. Eustatius", "NA");
  add("PJ7", "Sint Maarten", "NA");
  add("PP PQ PR PS PT PU PV PW PX PY ZV ZW ZX ZY ZZ", "Brazil", "SA");
  add("PZ", "Suriname", "SA");

  /* R - S */
  var RUSSIA = "R RA RC RD RG RJ RK RL RM RN RO RQ RT RU RV RW RX RY RZ UA UB UC UD UE UF UG UH UI";
  add(RUSSIA, "European Russia", "EU");
  // Call areas 8, 9 and 0 are Asiatic Russia: a separate DXCC entity on
  // another continent. Longest-match lets "UA9" beat "UA".
  RUSSIA.split(" ").forEach(function (prefix) {
    add(prefix + "8 " + prefix + "9 " + prefix + "0", "Asiatic Russia", "AS");
    // ...except the 9-area regions that lie west of the Urals, which DXCC
    // keeps in European Russia: Perm (F, G), Orenburg (S, T),
    // Bashkortostan (W) and Komi (X).
    add(prefix + "9F " + prefix + "9G " + prefix + "9S " + prefix + "9T " +
        prefix + "9W " + prefix + "9X", "European Russia", "EU");
  });
  add("S0", "Western Sahara", "AF"); add("S2", "Bangladesh", "AS"); add("S5", "Slovenia", "EU");
  add("S7", "Seychelles", "AF"); add("S9", "Sao Tome & Principe", "AF");
  add("SA SB SC SD SE SF SG SH SI SJ SK SL SM 7S 8S", "Sweden", "EU");
  add("SN SO SP SQ SR 3Z HF", "Poland", "EU"); add("ST", "Sudan", "AF"); add("SU", "Egypt", "AF");
  add("SV5 SV9 J45 J49", "Crete & Dodecanese", "EU");
  add("SV SW SX SY SZ J4", "Greece", "EU");

  /* T - V */
  add("T30", "Western Kiribati", "OC"); add("T7", "San Marino", "EU"); add("T8", "Palau", "OC");
  add("T9", "Bosnia-Herzegovina", "EU"); add("TA TB TC YM", "Turkey", "AS"); add("TF", "Iceland", "EU");
  add("TG TD", "Guatemala", "NA"); add("TI TE", "Costa Rica", "NA"); add("TJ", "Cameroon", "AF");
  add("TK", "Corsica", "EU"); add("TL", "Central African Republic", "AF"); add("TN", "Congo", "AF");
  add("TR", "Gabon", "AF"); add("TT", "Chad", "AF"); add("TU", "Ivory Coast", "AF"); add("TY", "Benin", "AF");
  add("TZ", "Mali", "AF");
  add("UN UO UP UQ", "Kazakhstan", "AS"); add("UR US UT UU UV UW UX UY UZ EM EN EO", "Ukraine", "EU");
  add("V2", "Antigua & Barbuda", "NA"); add("V3", "Belize", "NA"); add("V4", "St. Kitts & Nevis", "NA");
  add("V5", "Namibia", "AF"); add("V6", "Micronesia", "OC"); add("V7", "Marshall Islands", "OC");
  add("V8", "Brunei", "AS"); add("VA VE VO VY CF CG CJ CK CY CZ XJ XK XL XM XN XO", "Canada", "NA");
  add("VK AX VI", "Australia", "OC"); add("VK9", "Australian External Territory", "OC");
  add("VP2", "British West Indies", "NA"); add("VP5", "Turks & Caicos", "NA");
  add("VP8", "Falkland Islands", "SA"); add("VP9", "Bermuda", "NA"); add("VQ9", "Chagos Islands", "AF");
  add("VR", "Hong Kong", "AS"); add("VU AT AU AV AW 8T 8U 8V 8W 8Y", "India", "AS");

  /* X - Z */
  add("XA XB XC XD XE XF 4A 4B 4C 6D 6E 6F 6G 6H 6I 6J", "Mexico", "NA");
  add("XT", "Burkina Faso", "AF"); add("XU", "Cambodia", "AS"); add("XW", "Laos", "AS");
  add("XX9", "Macao", "AS"); add("XZ", "Myanmar", "AS");
  add("YA T6", "Afghanistan", "AS"); add("YB YC YD YE YF YG YH 7A 7B 7C 7D 8A 8B 8C", "Indonesia", "OC");
  add("YI", "Iraq", "AS"); add("YJ", "Vanuatu", "OC"); add("YK", "Syria", "AS"); add("YL", "Latvia", "EU");
  add("YN H6 H7 HT", "Nicaragua", "NA"); add("YO YP YQ YR", "Romania", "EU");
  add("YS HU", "El Salvador", "NA"); add("YT YU", "Serbia", "EU"); add("YV YW YX YY 4M", "Venezuela", "SA");
  add("Z2", "Zimbabwe", "AF"); add("Z3", "North Macedonia", "EU"); add("Z6", "Kosovo", "EU");
  add("Z8", "South Sudan", "AF"); add("ZA", "Albania", "EU"); add("ZB", "Gibraltar", "EU");
  add("ZD7", "St. Helena", "AF"); add("ZD8", "Ascension Island", "AF"); add("ZD9", "Tristan da Cunha", "AF");
  add("ZF", "Cayman Islands", "NA"); add("ZK", "Cook Islands", "OC");
  add("ZL ZM", "New Zealand", "OC"); add("ZP", "Paraguay", "SA");
  add("ZR ZS ZT ZU", "South Africa", "AF");

  var LONGEST = 4;

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

  global.DxccPrefixes = { lookup: lookup, entity: entity, table: TABLE };
})(window);
