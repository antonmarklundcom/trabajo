# Keyword Library

A small local program for Google Keyword Planner data. It runs on your own
computer (http://localhost:5178), uses no AI and sends nothing anywhere. It
merges exports, removes duplicates, suggests typos for you to confirm, groups
phrases by theme and place, searches across all your projects, and writes a
short `summary.md` per project that Codex or Claude can read.

## Install (once)

1. Needs **Node.js** (LTS) — the same thing your other local programs use.
   Check with `node -v` in a terminal; if missing, install it from nodejs.org.
2. Put these four files in one folder, e.g. `C:\Claude 1\Google KWP\`:
   `server.mjs`, `lib.mjs`, `index.html`, `Start Keyword Library.cmd`.
3. Right-click `Start Keyword Library.cmd` → **Send to → Desktop (create
   shortcut)**. Rename the shortcut to "Keyword Library" if you like.

## Use

1. Double-click the shortcut. A black window opens (that is the program —
   leave it open) and the browser opens the library. Closing the window stops it.
2. **+ New project** → name (e.g. `trabajo.com.py`), country/location (the one
   you chose in Keyword Planner, e.g. Paraguay or "Worldwide"), language.
   One project = one country: Paraguay volumes and worldwide volumes are
   different numbers, so make two projects if you research both.
3. Drop the Keyword Planner CSVs (download → "Keyword ideas (.csv)") on the
   project. Add more any time — the project is rebuilt each time.
4. **Copy for AI** puts the paths to `summary.md` and `keywords.csv` on the
   clipboard for Codex / Claude Code on this computer. For a cloud chat, attach
   `summary.md` (Open folder → drag it in).

## What it stores

```
C:\Claude 1\Google KWP\
  INDEX.md                          all projects with their paths (for AI)
  projects\<project>\
    project.json                    name, country, language, notes
    config.json                     themes, places, exclusions, confirmed typos
    raw\*.csv                       your exports, exactly as downloaded
    keywords.csv                    merged: phrase, monthly_searches, low_cpc, high_cpc
    summary.md                      short AI-ready summary (~5k tokens)
```

## How it works (no AI)

- **Reading:** detects Keyword Planner's format (UTF-16/UTF-8, tabs/commas,
  Swedish/English/Spanish headers) and takes 4 columns: phrase, average monthly
  searches, top-of-page bid low and high.
- **Duplicates:** every phrase gets a key — lower-case, accents removed, spaces
  and punctuation removed. "Selección de personal", "seleccion de personal" and
  "seleccióndepersonal" share one key, so they become one row; the wording with
  the most searches is kept and the others are listed as "also: …". Volumes are
  not added together (Keyword Planner already groups close variants).
- **Typos:** phrases whose keys are exactly one letter apart ("trabjo en luque"
  / "trabajo en luque") are *suggested* in "Possible typos". You click Merge or
  Different; nothing is merged automatically, because many one-letter
  differences are real, different searches. Plurals and different numbers
  ("2025"/"2026") are never suggested.
- **Themes and places:** each theme is a pattern ("remot|online|desde casa");
  the totals add the searches of every phrase that matches, long tail included.
- **Top words and pairs:** counts every word and two-word pair, weighted by
  searches, to surface themes nobody listed.
