/* ---------------------------------------------------------------------------
   ADIF Explorer — QSOs over time.

   One stacked bar chart per dimension: QSOs per hour, segmented by country,
   band, station type, mode and operator in turn. The dimensions come from
   AdifCharts.dimensions, so the two views never drift apart, and the colours
   from the same ranking the chart view uses — a mode or a band wears one
   colour throughout the app.

   Every series shares one time axis and one vertical scale. That is not a
   coincidence worth hiding: each QSO has exactly one value in every
   dimension, so the bars are the same height in all five charts and only the
   segmentation differs. Their horizontal scrolling is synchronised for the
   same reason.

   Hours with no contacts are drawn as gaps rather than skipped: a time axis
   that silently closes up its quiet periods misreports the pace of a session.
   --------------------------------------------------------------------------- */

(function (global) {
  "use strict";

  var HOUR = 3600000;

  /* Above this many bars an hourly axis stops being drawable - a log spanning
     years would be tens of thousands of them - so the bucket widens to a day
     and the heading says so. */
  var MAX_BARS = 5000;

  var PLOT_HEIGHT = 190;
  var AXIS_WIDTH = 46;
  var TOP_PAD = 10;
  var LABEL_BAND = 40;          // room under the plot for hour and day labels

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function dayLabel(date) {
    return pad2(date.getUTCDate()) + " " + MONTHS[date.getUTCMonth()];
  }

  /* --- scales -------------------------------------------------------------- */

  /* A round step - 1, 2, 5 or 10 times a power of ten - so the axis reads in
     numbers a person would choose. */
  function niceStep(rough) {
    var exp = Math.pow(10, Math.floor(Math.log10(rough)));
    var frac = rough / exp;
    var nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * exp;
  }

  function yScale(maxValue) {
    var step = Math.max(1, niceStep(Math.max(1, maxValue) / 4));
    var top = Math.max(step, Math.ceil(maxValue / step) * step);
    var ticks = [];
    for (var v = 0; v <= top + 0.5; v += step) ticks.push(v);
    return { top: top, ticks: ticks };
  }

  /* --- binning ------------------------------------------------------------- */

  /* Buckets records into equal time slots, counting every dimension in one
     pass. Returns contiguous bins, empty ones included, first QSO to last. */
  function bin(records, dimensions) {
    var stamped = [];
    var undated = 0;
    var i, d;

    for (i = 0; i < records.length; i++) {
      var when = AdifParser.timestamp(records[i]);
      if (!when) { undated++; continue; }

      var values = {};
      for (d = 0; d < dimensions.length; d++) {
        values[dimensions[d].key] = AdifParser[dimensions[d].accessor](records[i]);
      }
      stamped.push({ at: when.getTime(), values: values });
    }

    if (!stamped.length) return { bins: [], undated: undated, size: HOUR };

    var min = Infinity, max = -Infinity;
    for (i = 0; i < stamped.length; i++) {
      if (stamped[i].at < min) min = stamped[i].at;
      if (stamped[i].at > max) max = stamped[i].at;
    }

    var size = HOUR;
    var span = Math.floor(max / size) - Math.floor(min / size) + 1;
    if (span > MAX_BARS) {
      size = HOUR * 24;
      span = Math.floor(max / size) - Math.floor(min / size) + 1;
    }

    var first = Math.floor(min / size);
    var bins = [];
    for (i = 0; i < span; i++) {
      var counts = {};
      for (d = 0; d < dimensions.length; d++) counts[dimensions[d].key] = Object.create(null);
      bins.push({ start: (first + i) * size, total: 0, counts: counts });
    }

    for (i = 0; i < stamped.length; i++) {
      var slot = bins[Math.floor(stamped[i].at / size) - first];
      for (d = 0; d < dimensions.length; d++) {
        var key = dimensions[d].key;
        var value = stamped[i].values[key];
        slot.counts[key][value] = (slot.counts[key][value] || 0) + 1;
      }
      slot.total++;
    }

    return { bins: bins, undated: undated, size: size };
  }

  /* --- rendering ----------------------------------------------------------- */

  function renderAxis(scale) {
    var html = ['<svg class="timeline__axis" width="' + AXIS_WIDTH + '" height="' +
                (PLOT_HEIGHT + TOP_PAD + LABEL_BAND) + '" aria-hidden="true">'];

    scale.ticks.forEach(function (value) {
      var y = TOP_PAD + PLOT_HEIGHT - (value / scale.top) * PLOT_HEIGHT;
      html.push('<text class="timeline__tick" x="' + (AXIS_WIDTH - 8) + '" y="' +
                y.toFixed(1) + '" text-anchor="end" dominant-baseline="middle">' +
                value + "</text>");
    });

    html.push("</svg>");
    return html.join("");
  }

  /* One chart: the same bars every time, segmented by `series`. */
  function renderPlot(data, scale, series, layout) {
    var bins = data.bins;
    var barWidth = layout.barWidth;
    var gap = layout.gap;
    var width = Math.max(1, bins.length * (barWidth + gap));
    var height = PLOT_HEIGHT + TOP_PAD + LABEL_BAND;
    var hourly = data.size === HOUR;

    var html = ['<svg class="timeline__plot" width="' + width + '" height="' + height +
                '" role="img" aria-label="QSOs per ' + (hourly ? "hour" : "day") +
                ', stacked by ' + escapeHtml(series.title.toLowerCase()) + '">'];

    // Gridlines first, so the bars sit on top of them.
    scale.ticks.forEach(function (value) {
      var y = TOP_PAD + PLOT_HEIGHT - (value / scale.top) * PLOT_HEIGHT;
      html.push('<line class="timeline__grid" x1="0" x2="' + width + '" y1="' +
                y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>');
    });

    // One hour label every `every` bars, chosen so they never collide.
    var every = Math.max(1, Math.ceil(56 / (barWidth + gap)));
    var previousDay = null;

    bins.forEach(function (slot, index) {
      var x = index * (barWidth + gap);
      var date = new Date(slot.start);

      // A day boundary gets a rule and a date, which is what makes a run of
      // hour numbers readable.
      var day = dayLabel(date);
      if (day !== previousDay) {
        if (previousDay !== null) {
          html.push('<line class="timeline__daybreak" x1="' + (x - gap / 2).toFixed(1) +
                    '" x2="' + (x - gap / 2).toFixed(1) + '" y1="' + TOP_PAD +
                    '" y2="' + (TOP_PAD + PLOT_HEIGHT + 22) + '"/>');
        }
        html.push('<text class="timeline__day" x="' + (x + 2) + '" y="' +
                  (TOP_PAD + PLOT_HEIGHT + 34) + '">' + escapeHtml(day) + "</text>");
        previousDay = day;
      }

      if (hourly && index % every === 0) {
        html.push('<text class="timeline__hour" x="' + (x + barWidth / 2).toFixed(1) +
                  '" y="' + (TOP_PAD + PLOT_HEIGHT + 15) + '" text-anchor="middle">' +
                  pad2(date.getUTCHours()) + "</text>");
      }

      // Hover target spanning the full column height, so a one-QSO hour is
      // still easy to hit.
      html.push('<rect class="timeline__hit" x="' + x.toFixed(1) + '" y="' + TOP_PAD +
                '" width="' + (barWidth + gap) + '" height="' + PLOT_HEIGHT +
                '" data-bin="' + index + '"/>');

      if (!slot.total) return;

      var counts = slot.counts[series.key];
      var y = TOP_PAD + PLOT_HEIGHT;

      series.order.forEach(function (name) {
        if (!counts[name]) return;

        var full = (counts[name] / scale.top) * PLOT_HEIGHT;
        // A 1px surface gap separates touching segments - but only where the
        // segment is tall enough to still be visible afterwards.
        var drawn = full > 3 ? full - 1 : full;
        y -= full;
        html.push('<rect class="timeline__seg" x="' + x.toFixed(1) + '" y="' +
                  y.toFixed(1) + '" width="' + barWidth + '" height="' +
                  Math.max(0.8, drawn).toFixed(1) + '" fill="' + series.colors[name] +
                  '" data-bin="' + index + '"/>');
      });
    });

    html.push("</svg>");
    return html.join("");
  }

  function renderLegend(series) {
    var html = ['<ul class="timeline__legend">'];

    series.order.forEach(function (name) {
      html.push('<li class="timeline__legend-item">' +
                '<span class="pie__swatch" style="background:' + series.colors[name] + '"></span>' +
                escapeHtml(name) +
                '<span class="timeline__legend-count">' + series.totals[name] + "</span></li>");
    });

    html.push("</ul>");
    return html.join("");
  }

  function renderCard(data, scale, series, layout) {
    var unit = data.size === HOUR ? "hour" : "day";
    var html = ['<section class="timeline-card" data-dim="' + series.key + '">'];

    html.push('<div class="chart-card__head"><div>');
    html.push('<h2 class="chart-card__title">' + escapeHtml(series.title) + "</h2>");
    html.push('<p class="chart-card__sub">' + series.order.length + " distinct · stacked per " +
              unit + "</p>");
    html.push("</div></div>");

    html.push(renderLegend(series));

    html.push('<div class="timeline__chart">');
    html.push(renderAxis(scale));
    html.push('<div class="timeline__scroll">' +
              renderPlot(data, scale, series, layout) + "</div>");
    html.push("</div>");

    html.push("</section>");
    return html.join("");
  }

  /* --- tooltip ------------------------------------------------------------- */

  function attachTooltip(root, data, seriesByKey) {
    var tip = document.createElement("div");
    tip.className = "chart-tip chart-tip--stack";
    tip.hidden = true;
    root.appendChild(tip);

    var hourly = data.size === HOUR;

    function show(event) {
      var target = event.target.closest("[data-bin]");
      if (!target || !root.contains(target)) return;

      var card = target.closest("[data-dim]");
      var series = card && seriesByKey[card.getAttribute("data-dim")];
      var slot = data.bins[parseInt(target.getAttribute("data-bin"), 10)];
      if (!series || !slot) return;

      var date = new Date(slot.start);
      var heading = dayLabel(date) + (hourly ? " " + pad2(date.getUTCHours()) + ":00" : "");

      var html = ['<div class="chart-tip__head">' + escapeHtml(heading) +
                  '<span class="chart-tip__total">' + slot.total + " QSO" +
                  (slot.total === 1 ? "" : "s") + "</span></div>"];

      var counts = slot.counts[series.key];
      var shown = 0;

      // Commonest first, and only what is actually in this hour.
      series.order.forEach(function (name) {
        if (!counts[name]) return;
        shown++;
        html.push('<div class="chart-tip__row">' +
                  '<span class="pie__swatch" style="background:' + series.colors[name] + '"></span>' +
                  '<span class="chart-tip__name">' + escapeHtml(name) + "</span>" +
                  '<span class="chart-tip__value">' + counts[name] + "</span></div>");
      });

      if (!shown) {
        html.push('<div class="chart-tip__row chart-tip__row--quiet">No QSOs</div>');
      }

      tip.innerHTML = html.join("");
      tip.hidden = false;

      // Highlight the same hour in every chart, so the eye can carry a moment
      // in time down the column of series.
      root.querySelectorAll(".is-active").forEach(function (el) {
        el.classList.remove("is-active");
      });
      root.querySelectorAll('[data-bin="' + target.getAttribute("data-bin") + '"]')
          .forEach(function (el) {
            if (el.classList.contains("timeline__hit")) el.classList.add("is-active");
          });

      position(event);
    }

    function position(event) {
      if (tip.hidden) return;

      var pad = 14;
      var box = tip.getBoundingClientRect();
      var x = event.clientX + pad;
      var y = event.clientY + pad;

      if (x + box.width > window.innerWidth - 8) x = event.clientX - box.width - pad;
      if (y + box.height > window.innerHeight - 8) y = event.clientY - box.height - pad;

      tip.style.left = Math.max(8, x) + "px";
      tip.style.top = Math.max(8, y) + "px";
    }

    function hide() {
      tip.hidden = true;
      root.querySelectorAll(".is-active").forEach(function (el) {
        el.classList.remove("is-active");
      });
    }

    root.addEventListener("mouseover", show);
    root.addEventListener("mousemove", position);
    root.addEventListener("mouseleave", hide);
  }

  /* Every chart shares one time axis, so scrolling one scrolls them all -
     otherwise comparing the same hour across series means lining up five
     scrollbars by hand. */
  function syncScrolling(root) {
    var scrollers = [].slice.call(root.querySelectorAll(".timeline__scroll"));
    if (scrollers.length < 2) return;

    var settling = false;

    scrollers.forEach(function (scroller) {
      scroller.addEventListener("scroll", function () {
        if (settling) return;
        settling = true;

        scrollers.forEach(function (other) {
          if (other !== scroller) other.scrollLeft = scroller.scrollLeft;
        });

        // Cleared on the next frame: assigning scrollLeft fires scroll events
        // of its own, which would otherwise bounce back and forth.
        global.requestAnimationFrame(function () { settling = false; });
      });
    });
  }

  /* --- entry point --------------------------------------------------------- */

  function render(pane, log, fileName) {
    var records = log.records;
    var dimensions = AdifCharts.dimensions;

    if (!records.length) {
      pane.innerHTML = '<div class="placeholder"><p class="placeholder__text ' +
        'placeholder__text--error">No records to plot.</p></div>';
      return;
    }

    // Colours and stacking order per dimension, from the unfiltered ranking -
    // the same one the chart view paints from.
    var seriesByKey = Object.create(null);
    var seriesList = dimensions.map(function (spec) {
      var tallied = AdifCharts.tally(records, AdifParser[spec.accessor]);
      var series = {
        key: spec.key,
        title: spec.title,
        order: [],
        colors: Object.create(null),
        totals: Object.create(null)
      };

      tallied.slices.forEach(function (slice) {
        series.order.push(slice.name);
        series.colors[slice.name] = slice.color;
        series.totals[slice.name] = slice.count;
      });

      seriesByKey[spec.key] = series;
      return series;
    });

    var data = bin(records, dimensions);

    if (!data.bins.length) {
      pane.innerHTML = '<div class="placeholder"><p class="placeholder__text ' +
        'placeholder__text--error">No record carries a usable QSO_DATE, so there ' +
        'is nothing to place on a time axis.</p></div>';
      return;
    }

    // Every dimension counts the same QSOs, so one scale serves them all and
    // the bars stay directly comparable down the page.
    var peak = data.bins.reduce(function (most, slot) {
      return Math.max(most, slot.total);
    }, 0);
    var scale = yScale(peak);

    var available = Math.max(240, pane.clientWidth - AXIS_WIDTH - 68);
    var gap = data.bins.length > 400 ? 0 : 1;
    var layout = {
      gap: gap,
      barWidth: Math.max(2, Math.min(64, Math.floor(available / data.bins.length) - gap))
    };

    var unit = data.size === HOUR ? "hour" : "day";
    var html = ['<div class="timeline">'];

    html.push('<div class="chart-view__meta"><strong>' + escapeHtml(fileName) +
              "</strong><span>" + records.length.toLocaleString() + " record" +
              (records.length === 1 ? "" : "s") + "</span><span>" +
              data.bins.length.toLocaleString() + " " + unit +
              (data.bins.length === 1 ? "" : "s") + "</span><span>peak " +
              peak.toLocaleString() + " per " + unit + "</span>");
    if (data.size !== HOUR) {
      html.push('<span class="timeline__note">bucketed by day — the log spans ' +
                'too many hours to draw one bar each</span>');
    }
    if (data.undated) {
      html.push('<span class="table-view__warn">' + data.undated +
                " record" + (data.undated === 1 ? "" : "s") +
                " without a date, not plotted</span>");
    }
    html.push("</div>");

    seriesList.forEach(function (series) {
      html.push(renderCard(data, scale, series, layout));
    });

    html.push("</div>");
    pane.innerHTML = html.join("");

    var root = pane.querySelector(".timeline");
    attachTooltip(root, data, seriesByKey);
    syncScrolling(root);
  }

  global.AdifTimeline = { render: render, bin: bin };
})(window);
