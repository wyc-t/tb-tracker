# TB Tracker

A minimal, offline-first Progressive Web App for logging and tracking [Tactical Barbell](https://www.tacticalbarbell.com) strength sessions and user-defined running programs. All data are stored locally. 

The tracker is created with Claude on 27 Mar 2026.

---

## Features

### Strength Program
- Supports four TB templates: **Operator**, **Zulu**, **Fighter**, and **Mass**
- Auto-fills sets, reps, and load from your 1RM and selected week/day
- Optional 90% Training Max mode
- Per-session day exercise customisation
- Plate calculator with per-side breakdown
- Floating stopwatch with rest timer

### Running Program
- **General mode** — log distance, duration, and average HR
- **Program mode** — structured interval logging with set groups, lap time or total duration, rest periods, and auto-calculated pace and total work time
  - Distances ≥ 400 m: enter a 400 m lap time, pace is extrapolated
  - Distances < 400 m: enter the rep duration directly
- Run types: Easy, LSD, Tempo, Interval, Race

### Dashboard
- Active block at a glance
- Days since last lift and last run
- Weekly km total
- 1RM PRs with % change from previous log entry
- Recent sessions from the last 7 days

### Progress
- Strength chart (best set per session) and full PR history per exercise
- Weekly mileage bar chart and pace trend line
- Bodyweight chart and full measurement history table

### Logbook
- Filterable by type (Strength / Run / Body / PR)
- Tap any entry to view detail or delete
- Scrollable list with log buttons always anchored at the bottom of the screen

### Data
- Full JSON export and import
- 30-day backup reminder on app launch
- All data stored locally via IndexedDB (via [idb](https://github.com/jakearchibald/idb))

---

## Installation

TB Tracker is a PWA — no app store required.

1. Open the app URL in your browser
2. **iOS:** tap the Share button → *Add to Home Screen*
3. **Android:** tap the browser menu → *Install App* (or *Add to Home Screen*)

Once installed, the app works fully offline.

---

**Platform notes:**
- **Android (installed PWA, Chrome):** fully supported
- **iOS (installed to Home Screen, iOS 16.4+):** supported; Apple caps SW lifetime, so the notification may not fire if the device has been fully idle for an extended period
- **iOS Safari (browser tab, not installed):** notifications are blocked by Apple

---

## File Structure

```
index.html       Main HTML shell and all view templates
app.js           Application logic (routing, DB, forms, charts)
styles.css       Dark theme stylesheet
sw.js            Service Worker (caching, background notifications)
manifest.json    PWA manifest (name, icons, display mode)
```

---

## Data Storage

All data is stored in an IndexedDB database named `tb-tracker` with the following object stores:

| Store | Contents |
|---|---|
| `blocks` | Training blocks (template, 1RMs, start date) |
| `sessions` | Strength session logs |
| `runs` | Run logs |
| `bodyMeasurements` | Bodyweight and circumference logs |
| `prLog` | 1RM PR entries |
| `settings` | App settings (reserved) |

Export produces a single JSON file containing all stores. Import replaces all existing data — back up first.

---

## Dependencies

Loaded via CDN; both are cached by the Service Worker for offline use.

- [idb@8](https://github.com/jakearchibald/idb) — IndexedDB wrapper
- [Chart.js@4](https://www.chartjs.org) — Progress charts

---

## License

See `LICENSE`.
