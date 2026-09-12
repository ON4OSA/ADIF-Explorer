/* ---------------------------------------------------------------------------
   ADIF Explorer — toolbar wiring and the table view.
   Parsing lives in adif_parser.js; this file only handles UI and loading.

   A log arrives either from the file picker or from the page's own URL:

     index.html?adif=https://example.com/station.adi
     index.html?adif=/logs/2026/field-day.adi      (same site)

   Both paths end in adopt(), so everything downstream behaves identically.

   A `view` parameter opens straight into one of the views once the log is in:

     index.html?adif=/logs/field-day.adi&view=chart
     index.html?view=table                          (applies to a picked file)

   Valid views: table, chart (or charts), time (or timeline).
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  var input = document.getElementById("adif-file");
  var fileLabel = document.getElementById("adif-file-name");
  var tableButton = document.getElementById("show-table");
  var chartButton = document.getElementById("show-charts");
  var timeButton = document.getElementById("show-timeline");
  var pane = document.getElementById("work-pane");
  if (!input || !fileLabel || !tableButton || !chartButton || !timeButton ||
      !pane) return;

  var wrap = input.closest(".file-select");
  var PROMPT = fileLabel.textContent;

  // The parsed log currently in memory, or null.
  var state = null;

  // The view asked for by ?view=, resolved once at startup.
  var startupView = "";

  /* --- helpers ---------------------------------------------------------- */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setViewsEnabled(enabled) {
    tableButton.disabled = !enabled;
    chartButton.disabled = !enabled;
    timeButton.disabled = !enabled;
  }

  function showMessage(text, isError) {
    pane.innerHTML =
      '<div class="placeholder">' +
      '<p class="placeholder__text' + (isError ? " placeholder__text--error" : "") +
      '">' + escapeHtml(text) + "</p></div>";
  }

  /* --- table view ------------------------------------------------------- */

  function renderTable() {
    if (!state) return;

    var fields = state.log.fields;
    var records = state.log.records;

    if (!records.length) {
      showMessage("No records found in " + state.name + ".", true);
      return;
    }

    // Built as one HTML string: far faster than per-cell DOM calls on logs
    // with thousands of QSOs.
    var html = [];

    html.push('<div class="table-view">');
    html.push('<div class="table-view__meta">');
    html.push("<strong>" + escapeHtml(state.name) + "</strong>");
    html.push("<span>" + records.length.toLocaleString() + " record" +
              (records.length === 1 ? "" : "s") + "</span>");
    html.push("<span>" + fields.length + " field" +
              (fields.length === 1 ? "" : "s") + "</span>");
    if (state.log.errors.length) {
      html.push('<span class="table-view__warn">' + state.log.errors.length +
                " parse warning" + (state.log.errors.length === 1 ? "" : "s") +
                "</span>");
    }
    html.push("</div>");

    html.push('<div class="table-view__scroll"><table class="adif-table"><thead><tr>');
    html.push('<th class="adif-table__index" scope="col">#</th>');
    for (var f = 0; f < fields.length; f++) {
      html.push('<th scope="col">' + escapeHtml(fields[f].toUpperCase()) + "</th>");
    }
    html.push("</tr></thead><tbody>");

    for (var r = 0; r < records.length; r++) {
      var record = records[r];
      html.push('<tr><td class="adif-table__index">' + (r + 1) + "</td>");
      for (var c = 0; c < fields.length; c++) {
        var name = fields[c];
        var raw = record[name];
        if (raw === undefined || raw === "") {
          html.push('<td class="adif-table__empty"></td>');
        } else {
          html.push("<td>" + escapeHtml(AdifParser.formatValue(name, raw)) + "</td>");
        }
      }
      html.push("</tr>");
    }

    html.push("</tbody></table></div></div>");

    pane.innerHTML = html.join("");
  }

  function showCharts() {
    if (state) AdifCharts.render(pane, state.log, state.name);
  }

  function showTimeline() {
    if (state) AdifTimeline.render(pane, state.log, state.name);
  }

  /* --- loading ---------------------------------------------------------- */

  /* Shows a name in the toolbar button, whether it came from a picked file or
     from a URL. `title` carries the full path, which the fixed-width button
     would otherwise clip away. */
  function setFileName(name, title) {
    fileLabel.textContent = name || PROMPT;
    fileLabel.title = name ? (title || name) : "";
    if (wrap) wrap.classList.toggle("file-select--set", Boolean(name));
  }

  /* ADIF is a byte-oriented format and plenty of logging software writes
     Windows-1252 rather than UTF-8. Decode strictly as UTF-8 first and fall
     back, so an accented name in a comment field survives either way. */
  function decodeAdif(buffer) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch (err) {
      return new TextDecoder("windows-1252").decode(buffer);
    }
  }

  /* The single place a log becomes the current log. */
  function adopt(text, name) {
    try {
      var log = AdifParser.parse(text);
      state = { name: name, log: log };
      setViewsEnabled(true);

      // ?view= makes a link land on a view instead of the "loaded" message.
      // It applies to every log opened in this page, not just the first.
      if (startupView) {
        VIEWS[startupView]();
        return;
      }

      showMessage(
        log.records.length.toLocaleString() + " record" +
        (log.records.length === 1 ? "" : "s") +
        " loaded. Use the table or chart button to view them."
      );
    } catch (err) {
      state = null;
      setViewsEnabled(false);
      showMessage("Could not parse " + name + ": " + err.message, true);
    }
  }

  function fail(text) {
    state = null;
    setViewsEnabled(false);
    showMessage(text, true);
  }

  function loadFile(file) {
    var reader = new FileReader();

    reader.onload = function () {
      adopt(decodeAdif(reader.result), file.name);
    };

    reader.onerror = function () {
      fail("Could not read " + file.name + ".");
    };

    reader.readAsArrayBuffer(file);
  }

  /* --- loading from the URL --------------------------------------------- */

  var URL_PARAMS = ["adif", "url"];

  /* Views a `view=` parameter may ask for. "charts" is accepted alongside
     "chart" because both readings of the button are natural. */
  var VIEWS = {
    table: renderTable,
    chart: showCharts,
    charts: showCharts,
    time: showTimeline,
    timeline: showTimeline
  };

  function param(name) {
    if (!window.URLSearchParams) return "";
    var value = new URLSearchParams(window.location.search).get(name);
    return value ? value.trim() : "";
  }

  /* The view to open once a log is loaded, or "" for the default message.
     An unrecognised value is ignored rather than treated as an error: the log
     itself is fine, only the shortcut was mistyped. */
  function requestedView() {
    var value = param("view").toLowerCase();
    return VIEWS[value] ? value : "";
  }

  function requestedUrl() {
    for (var i = 0; i < URL_PARAMS.length; i++) {
      var value = param(URL_PARAMS[i]);
      if (value) return value;
    }
    return null;
  }

  /* A name for the toolbar button: the last path segment, or the host when
     the URL ends in a slash. */
  function nameFromUrl(url) {
    var last = url.pathname.split("/").filter(Boolean).pop();
    try {
      last = last ? decodeURIComponent(last) : "";
    } catch (err) {
      /* a malformed escape - keep the raw segment */
    }
    return last || url.hostname;
  }

  function loadFromUrl(raw) {
    var target;
    try {
      // Resolved against the page, so a same-site relative path works too.
      target = new URL(raw, window.location.href);
    } catch (err) {
      fail("The adif parameter is not a valid URL: " + raw);
      return;
    }

    // Only real network schemes: this fetches and renders whatever it gets.
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      fail("Only http and https URLs can be loaded, but the adif parameter is " +
           target.protocol + " — ignoring it.");
      return;
    }

    var name = nameFromUrl(target);
    setFileName(name, target.href);
    setViewsEnabled(false);
    showMessage("Loading " + target.href + " …");

    fetch(target.href, { credentials: "omit" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("the server answered " + response.status + " " +
                          response.statusText);
        }
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        adopt(decodeAdif(buffer), name);
      })
      .catch(function (err) {
        // A cross-site fetch the other server does not allow surfaces as a
        // bare "Failed to fetch", which on its own tells the user nothing.
        // An HTTP status error is a different problem and gets no such note.
        var note = err.name === "TypeError"
          ? " A file hosted on another site can only be read if that site sends " +
            "an Access-Control-Allow-Origin header."
          : "";

        fail("Could not load " + target.href + " — " + err.message + "." + note);
      });
  }

  /* --- events ----------------------------------------------------------- */

  input.addEventListener("change", function () {
    var file = input.files && input.files[0];

    setFileName(file ? file.name : "");
    if (!file) return;

    setViewsEnabled(false);
    loadFile(file);
  });

  tableButton.addEventListener("click", renderTable);

  chartButton.addEventListener("click", showCharts);
  timeButton.addEventListener("click", showTimeline);

  /* Read once, before anything can load a log. */
  startupView = requestedView();

  /* Picking a file always wins over the URL, so this only runs at startup. */
  var startupUrl = requestedUrl();
  if (startupUrl) loadFromUrl(startupUrl);
})();
