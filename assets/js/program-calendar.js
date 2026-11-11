// Program calendar: reads the school's public Google Calendar on every page load
// and shows it with FullCalendar, colouring each event by its speaker.
//
// Speaker = the text in the last parentheses of the event title,
//   e.g. "Redes Neuronales (Edith Villegas)" -> "Edith Villegas".
// Each speaker has the colour used in the original Google Calendar; events without a speaker are red.
//
// Settings come from data-* attributes on #program-calendar (see _includes/program_calendar.liquid).
// Events are read from assets/json/program-events.json (updated hourly by a GitHub workflow).

(function () {
  const NO_SPEAKER_COLOR = "#c2291c"; // red (TBD, welcome, career session, diplomas, ...)

  // Colours copied from the original Google Calendar.
  // Keys are speaker names written without accents, in lower case (see speakerKey).
  const SPEAKER_COLORS = {
    "edith villegas": "#5383ec", // blue
    "alex rodriguez": "#606060", // grey
    "carlos soto": "#4350ae", // dark blue
    "daniela pinto": "#d88176", // salmon
    "javier aguilar": "#c63360", // raspberry
    "juan calderon": "#e29835", // orange
    "benjamin rodriguez": "#c2291c", // red
    "matteo marsili": "#822da3", // purple
    "elena villalobos": "#edc04c", // yellow
    "alvaro carbonero & ana rivera": "#5eb47e", // green
    "joshua lemus": "#87b252", // light green
    "edgar carrera": "#b09ed7", // lavender
    // Invited talks (Ponencias)
    "eleonora bergamin": "#c1c950",
    "arshed nabeel": "#c1c950",
    "manuel vasquez": "#c1c950",
    "alesio ansuini": "#c1c950",
    "alessio ansuini": "#c1c950",
    "irene rubia-rodriguez": "#c1c950",
    "vora arhan jesal": "#c1c950",
  };

  // Speakers added later that are not in the list above get one of these.
  const FALLBACK_PALETTE = ["#039be5", "#0b8043", "#f4511e", "#7986cb", "#795548", "#009688", "#e67c73", "#3f51b5"];

  const HONDURAS_OFFSET_HOURS = -6; // America/Tegucigalpa, no daylight saving time

  function speakerOf(title) {
    const m = (title || "").match(/\(([^()]*)\)\s*$/);
    if (!m) return null;
    // "(Clustering, Alex Rodriguez)" -> "Alex Rodriguez": the speaker is the part after the last comma.
    const s = m[1].split(",").pop().trim().replace(/\s+/g, " ");
    return s || null;
  }

  // Normalise so "Vásquez"/"Vasquez", extra spaces or case don't create two colours.
  function speakerKey(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Convert an instant to Honduras wall-clock time (as a "floating" ISO string),
  // so everyone sees the program in Honduras time wherever they are.
  function toHondurasTime(googleTime) {
    if (googleTime.date) return googleTime.date; // all-day event
    const ms = Date.parse(googleTime.dateTime) + HONDURAS_OFFSET_HOURS * 3600 * 1000;
    return new Date(ms).toISOString().slice(0, 19);
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  // Events come from a file saved by the "Update program calendar" GitHub workflow
  // (bin/update_program_calendar.py), which downloads the public Google Calendar every hour.
  async function fetchEvents(cfg) {
    const res = await fetch(cfg.eventsUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()).items || [];
  }

  function buildEvents(items) {
    const speakers = new Map(); // key -> display name
    items.forEach((it) => {
      const s = speakerOf(it.summary);
      if (s && !speakers.has(speakerKey(s))) speakers.set(speakerKey(s), s);
    });
    const colorFor = new Map();
    let next = 0;
    [...speakers.keys()].sort().forEach((k) => {
      colorFor.set(k, SPEAKER_COLORS[k] || FALLBACK_PALETTE[next++ % FALLBACK_PALETTE.length]);
    });

    const events = items
      .filter((it) => it.status !== "cancelled" && it.start)
      .map((it) => {
        const s = speakerOf(it.summary);
        const color = s ? colorFor.get(speakerKey(s)) : NO_SPEAKER_COLOR;
        return {
          title: (it.summary || "").trim(),
          start: toHondurasTime(it.start),
          end: toHondurasTime(it.end),
          allDay: !!it.start.date,
          backgroundColor: color,
          borderColor: color,
        };
      });

    return events;
  }

  function showDetails(event) {
    const box = document.getElementById("program-event-details");
    if (!box) return;
    const fmt = (d) => d.toLocaleString("es-HN", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
    box.innerHTML =
      `<button type="button" class="btn-close float-end" aria-label="Cerrar" onclick="this.parentElement.hidden=true"></button>` +
      `<h5 style="color:${event.backgroundColor}">${escapeHtml(event.title)}</h5>` +
      `<p class="mb-0">${fmt(event.start)}${event.end ? " – " + event.end.toISOString().slice(11, 16) : ""} (hora de Honduras)</p>`;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function init() {
    const el = document.getElementById("program-calendar");
    if (!el || !window.FullCalendar) return;
    const cfg = {
      eventsUrl: el.dataset.events,
      start: el.dataset.start, // YYYY-MM-DD, first day shown
      end: el.dataset.end, // YYYY-MM-DD, last day shown
    };
    const status = document.getElementById("program-calendar-status");

    let items;
    try {
      items = await fetchEvents(cfg);
    } catch (err) {
      if (status) status.textContent = "No se pudo cargar el calendario: " + err.message;
      return;
    }
    if (status) status.remove();

    const events = buildEvents(items);

    const endExclusive = new Date(Date.parse(cfg.end + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
    const isNarrow = window.matchMedia("(max-width: 767px)").matches;

    const calendar = new FullCalendar.Calendar(el, {
      timeZone: "UTC", // event times were already converted to Honduras time
      locale: "es",
      initialView: isNarrow ? "listWeek" : "timeGridWeek",
      initialDate: cfg.start,
      validRange: { start: cfg.start, end: endExclusive },
      firstDay: 1,
      weekends: false,
      headerToolbar: { left: "prev,next", center: "title", right: "timeGridWeek,listWeek" },
      buttonText: { timeGridWeek: "Semana", listWeek: "Lista" },
      allDayText: "Todo el día",
      noEventsText: "No hay eventos",
      slotMinTime: "08:00:00",
      slotMaxTime: "17:00:00",
      slotEventOverlap: false,
      expandRows: true,
      height: "auto",
      nowIndicator: false,
      events,
      eventClick: (info) => showDetails(info.event),
    });
    calendar.render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
