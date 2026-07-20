# Atomic Habits Tracker

A mobile-first PWA for identity-based habit tracking, built on the Four Laws of
Behavior Change from James Clear's *Atomic Habits*.

**Habits** — identity-grouped cards or a time rail; streak-ring checkboxes that
fill toward the next milestone badge; cues, environment prompts, temptation
bundles, two-minute starters, and rewards on every habit; a full-screen Focus
mode; explicit missed state with never-miss-twice warnings.

**Tasks** — a simple High/Medium/Low list with a Big 5 (five most important
tasks per day), defer-to-tomorrow, and automatic midnight rollover.

## Stack

React 18 + Vite, Firebase (Google auth + Firestore), Firebase Hosting.
Single-file app: all UI lives in `src/App.jsx`.

## Setup

```bash
npm install
cp .env.example .env   # fill in your Firebase web app config
npm run dev
```

## Deploy

```bash
npm run build
firebase deploy        # hosting (dist/) + firestore.rules
```

Security: per-user Firestore isolation (`firestore.rules`), CSP/HSTS headers
(`firebase.json`), env-based config (never committed).
