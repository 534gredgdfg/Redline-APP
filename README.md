# Redline Garage

Dirt bike maintenance, engine hours and lap times for a 2023 Honda CRF250R — a web app that lives on your phone.
No server, no account: it's a static site on GitHub Pages, and **all your data stays on the device** (works offline at the track).

- **Garage** — your bike, engine hours with one **Update hours** button, what's due next, the hour track
- **Service** — realistic trail schedule (Honda's race interval shown beside every item, with the reason), post-ride checklist, history
- **Timeline** — scrubbable hour track (swipe, zoom, jump to NOW) + list of what's coming and what's done
- **Laps** — tracks, sessions, lap times, progress chart, Honda's setting-record-sheet fields, trackside stopwatch
- **Stats** — specs with sources, dyno numbers, gearing calculator
- **Settings** — look (Honda / Yamaha / KTM), schedule (trail or Honda race), bike profile, hour log, backup

---

## Put it on GitHub Pages (same as Hippo)

1. Create a new **public** repo, e.g. `Redline`.
2. **Add file → Upload files**, and drag in everything *inside* this folder (select all, drag). Commit.
3. Repo **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
4. After a minute it's live at `https://<your-username>.github.io/Redline/`.

## Install on your iPhone — do this before entering any data

1. Open the link in **Safari** → Share → **Add to Home Screen**.
2. From then on, **only open it from the Home Screen icon.** iPhone keeps a Home Screen app's data separate from Safari's, so anything you enter in a Safari tab won't show up in the icon (and vice versa).

It works with no signal once it's been opened once.

## Your data

- Stored in the browser on that device (photos in IndexedDB, everything else in local storage). Nothing is uploaded anywhere — the GitHub repo only holds the app, never your data.
- **Back it up.** If the phone is lost/reset or its website data is cleared, it's gone. Settings → **Export backup** (on iPhone this opens the share sheet → *Save to Files* / iCloud). The Garage page reminds you if it's been more than 30 days.
- **Laptop:** open the same link, then Settings → **Restore backup** with the exported file. The two copies don't sync on their own — the phone is the main one; export → restore whenever you want the laptop up to date.

## Updating the app

Upload the changed files to the repo again. GitHub rebuilds in about a minute. The app picks up the new version the next time it's opened, and shows it the time after that (it starts from the offline copy so it opens instantly). Your data isn't touched.

---

## Looks and bike images

Settings → **Look**: Honda (red), Yamaha (blue), KTM (orange). Each look has its own image slot. Honda ships with a cut-out of your bike; the others show a plain outline until you upload a PNG/WebP with a transparent background (iPhone Photos: long-press the subject to lift it out).

## The schedule

**Trail** (default) uses realistic intervals for recreational riding; **Honda race** is the Owner's Manual schedule (pp. 34–36). Every item shows both and why they differ; you can set your own per item.

| Item | Trail (default) | Honda race |
|---|---|---|
| Engine oil level — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Throttle & controls — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Clutch freeplay — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Coolant level & hoses — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Drive chain — check & lube *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Brakes — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Suspension — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Wheels & tires — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Nuts, bolts, exhaust — check *(post-ride)* | every ride (≈2.5 h) | 2.5 h |
| Air filter — clean | 5 h | 2.5 h |
| Crankcase breather drain — check | 7.5 h | 2.5 h |
| Fuel line — check | 15 h | 2.5 h |
| Fuel line — replace | 24 mo | 30 h / 12 mo |
| Fuel pump filter — replace | 60 h / 24 mo | 30 h / 12 mo |
| Engine oil — replace | 15 h | 15 h |
| Engine oil filter — replace | 15 h | 15 h |
| Spark plug — check | 15 h | 2.5 h |
| Idle speed — check | 15 h | 2.5 h |
| Valve clearance — check | 25 h | 15 h |
| Leak-down test — check | 20 h | not listed |
| Piston & rings — replace | 60 h | 15 h |
| Piston pin & clips — replace | 60 h | 15 h |
| Control cables — lube | 15 h | 2.5 h |
| Radiator coolant — replace | 24 mo | 24 mo |
| Chain, sprockets, slider & rollers — check | 10 h | 2.5 h |
| Chain & sprockets — replace | 40 h | 7.5 h |
| Brake fluid — replace | 24 mo | 24 mo |
| Swingarm & linkage bearings — lube | 25 h | 7.5 h |
| Fork oil — replace | 40 h | 22.5 h |
| Shock service — replace | 60 h | not listed |
| Steering head bearings — check & lube | 40 h / 12 mo | 22.5 h |
| Wheel bearings — check | 15 h | not listed |
| Muffler packing — replace | 80 h | not listed |

### How the trail numbers were set
- **Oil & filter 15 h** — same as Honda. One litre also runs the clutch and gearbox; don't stretch it.
- **Valves 25 h** — trail/enduro guidance. If clearance has *tightened* since the last check, go back to 15 h; that's the early warning of valve/seat wear.
- **Piston 60 h + leak-down every 20 h** — recreational 250F top ends commonly run 50–80 h. KTM schedules its enduro 250's engine service at 135 h (70 h for competition), but that engine is milder. Replace on leak-down evidence; 60 h is a plan, not a deadline.
- **Chain & sprockets 40 h, measured every 10 h** — Honda's 7.5 h chain swap is a race number.
- **Fork oil 40 h, shock 60 h** — typical trail ranges are 30–60 h.
- **Linkage grease 25 h** — keep it there or shorter if you pressure-wash.
- **Fuel line by age (24 mo)** — rubber ages with time, not hours.
- **Coolant & brake fluid 24 mo** — same as Honda; they age whether you ride or not.

These are judgement calls from published guidance, not a Honda document. If something looks worn, measure it and log it — the app counts from the hours you actually did the work.

These are judgement calls from published guidance, not a Honda document. Measure, log what you find, and let the measurements win.

---

## Files

```
index.html, manifest.webmanifest, sw.js   app shell, install info, offline cache
css/  js/  js/pages/                      the app (Preact + htm, bundled in vendor/)
js/schedule.js                            intervals, reasons, specs
js/store.js                               on-device storage (replaces the old server)
bikes/  fonts/  icon*                     images, typefaces, icons
LICENSES.md, licenses/                    third-party notices
```
