#!/usr/bin/env python3
"""Generate assets/js/dxcc_data.js from cty.dat.

cty.dat is the maintained callsign-prefix -> DXCC entity mapping published by
Jim Reisert AD1C at https://www.country-files.com/ and used by most logging
software. Hand-maintaining an equivalent table is a losing game: prefixes are
reassigned, and entities are added and deleted.

The generated file carries prefixes only. Two things in cty.dat are dropped:

  * WAE-only entities, marked with a leading "*" on their primary prefix
    (Sicily, African Italy, Shetland, European Turkey, Bear Island, Vienna
    Intl Ctr). These are not DXCC entities, so their prefixes must fall
    through to the DXCC parent -- IT9 is Italy, TA1 is Turkey.
  * Compound forms such as "FO/a" (Austral Is.) and "3D2/c" (Conway Reef),
    which are real DXCC entities but cannot be expressed as a leading
    prefix: they share a base prefix with their parent and are told apart by
    a suffix on the call. They resolve to the parent instead.

The 22,910 exact-callsign overrides ("=EA1AK/8") are also dropped. They cover
individual stations operating away from home, not prefix assignment.

Redundant prefixes are pruned: any prefix whose longest surviving shorter
prefix already resolves to the same entity is dropped, because the
longest-match lookup in dxcc_prefixes.js reaches the same answer without it.
This is verified exhaustively, not assumed -- every prefix cty.dat defines is
checked against the pruned table before the file is written.

Usage:
    python3 tools/build_dxcc_data.py                  # fetch the current cty.dat
    python3 tools/build_dxcc_data.py path/to/cty.dat  # use a local copy
"""

import hashlib
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "https://www.country-files.com/bigcty/cty.dat"
LICENSE = "https://www.country-files.com/copyright/"

# cty.dat is MIT licensed. The licence requires this notice to travel with any
# copy or substantial portion, and a 1,600-prefix table derived from it is a
# substantial portion — so it is reproduced in full in the generated file, not
# merely linked. Verbatim from the copyright page; the holder line is short an
# end year and a name there, so the attribution AD1C publishes elsewhere on the
# site is filled in.
MIT_NOTICE = """Copyright (c) 1994- Jim Reisert, AD1C <https://www.country-files.com/>

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to
   deal in the Software without restriction, including without limitation the
   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
   sell copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
   DEALINGS IN THE SOFTWARE."""
OUT = Path(__file__).resolve().parent.parent / "assets" / "js" / "dxcc_data.js"

# Zone/coordinate/timezone annotations attached to an alias.
NOISE = re.compile(r"\(\d+\)|\[\d+\]|\{\w\w\}|<[^>]*>|~[^~]*~")
CONTINENT_OVERRIDE = re.compile(r"\{(\w\w)\}")


def fetch():
    if len(sys.argv) > 1:
        data = Path(sys.argv[1]).read_bytes()
        origin = sys.argv[1]
        stamp = ""
    else:
        with urllib.request.urlopen(SOURCE, timeout=60) as response:
            data = response.read()
            stamp = response.headers.get("Last-Modified", "")
        origin = SOURCE
    return data, origin, stamp


def parse(text):
    """cty.dat -> {prefix: (entity, continent)}, skipping what a prefix table
    cannot express. Returns the full map, before pruning."""
    table = {}
    for record in text.split(";"):
        record = record.strip()
        if not record:
            continue

        head, _, aliases = record.partition("\n")
        fields = [f.strip() for f in head.split(":")]
        if len(fields) < 8:
            continue

        name, continent, primary = fields[0], fields[3], fields[7]
        if primary.startswith("*"):      # WAE entity, not DXCC
            continue

        for alias in [primary] + aliases.replace("\n", "").split(","):
            alias = alias.strip()
            if not alias:
                continue

            here = continent
            override = CONTINENT_OVERRIDE.search(alias)
            if override:
                here = override.group(1)

            alias = NOISE.sub("", alias).strip()
            if not alias or alias.startswith("=") or not alias.isalnum():
                continue        # exact callsign, or a compound like "FO/a"

            table[alias] = (name, here)

    return table


def prune(table):
    """Drop prefixes a longest-match lookup would reach anyway."""
    kept = {}

    def resolve(prefix):
        for length in range(len(prefix), 0, -1):
            if prefix[:length] in kept:
                return kept[prefix[:length]]
        return None

    for prefix in sorted(table, key=len):
        if resolve(prefix) != table[prefix]:
            kept[prefix] = table[prefix]

    unreachable = [p for p in table if resolve(p) != table[p]]
    if unreachable:
        raise SystemExit(f"pruning changed {len(unreachable)} lookups: {unreachable[:5]}")

    return kept


def emit(kept, full, origin, stamp, digest):
    groups = {}
    for prefix, entity in kept.items():
        groups.setdefault(entity, []).append(prefix)

    lines = []
    for (name, continent) in sorted(groups, key=lambda e: (e[0], e[1])):
        prefixes = sorted(groups[(name, continent)])
        lines.append(f'    "{name}|{continent}|{" ".join(prefixes)}"')

    longest = max(len(p) for p in kept)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return f"""/* ---------------------------------------------------------------------------
   GENERATED FILE — do not edit by hand.

   Rebuild with:  python3 tools/build_dxcc_data.py

   Callsign prefix -> DXCC entity, derived from cty.dat, the maintained mapping
   most logging software uses. This file is a pruned copy of its prefix half.

   ---------------------------------------------------------------------------
   cty.dat is distributed under the MIT licence ({LICENSE}):

   {MIT_NOTICE}
   ---------------------------------------------------------------------------

     source:        {origin}
     last-modified: {stamp or "n/a"}
     sha256:        {digest}
     generated:     {generated}

   {len(groups)} entities, {len(kept)} prefixes (pruned from {len(full)}: a prefix is
   omitted when the longest-match lookup reaches the same entity without it).
   Longest prefix: {longest} characters — keep LONGEST in dxcc_prefixes.js at
   least this high.

   Each line is  ENTITY|CONTINENT|PREFIX PREFIX PREFIX...
   --------------------------------------------------------------------------- */

(function (global) {{
  "use strict";

  global.DxccData = [
{",".join(chr(10) + line for line in lines)[1:]}
  ];
}})(window);
"""


def main():
    data, origin, stamp = fetch()
    digest = hashlib.sha256(data).hexdigest()
    text = data.decode("utf-8", errors="replace")

    full = parse(text)
    kept = prune(full)

    OUT.write_text(emit(kept, full, origin, stamp, digest), encoding="utf-8")

    print(f"source   {origin}")
    print(f"sha256   {digest}")
    print(f"parsed   {len(full)} prefixes")
    print(f"pruned   {len(full) - len(kept)} redundant")
    print(f"wrote    {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT}"
          f"  ({len(kept)} prefixes, {OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
