# N-Tech SEO/GEO Operations System

A deterministic SEO and GEO operations app for onboarding sites, running audits, prioritizing fixes, tracking launch readiness, planning content, and generating client-ready reporting.

## Purpose

This project is designed to help me run SEO and GEO like an operating system, not a collection of one-off tasks. It gives me a structured way to onboard new sites, audit what exists, identify what to fix next, and plan what to build for growth.

The long-term goal is to turn this into a repeatable system I can use internally for my agency and eventually productize for clients.

## What it does

This app helps me:

- Register a new site and homepage.
- Run deterministic audits against the homepage.
- Track onboarding stage and launch readiness.
- Maintain a launch checklist.
- Prioritize audit fixes.
- Create and manage open fix tasks.
- Identify content opportunities.
- Prepare site launch reports.
- Move from diagnosis to execution.

## How it works

The app is built around a simple workflow:

1. Add a site.
2. Run an initial audit.
3. Review launch readiness.
4. Review prioritized fixes.
5. Complete launch checklist items.
6. Plan content opportunities.
7. Refresh and improve the site over time.

The system is intentionally rule-based and deterministic. It uses stored state, audit results, and checklist data to guide decisions instead of trying to guess.

## Core concepts

### Site onboarding
A site begins in an onboarding stage and moves through the system as audits run and launch items are completed.

### Audit runs
Homepage audits check the current site state and produce structured results that can be reviewed in the UI.

### Launch checklist
Each site has a fixed launch checklist that must be completed manually. Checklist items are not auto-marked complete.

### Fix queue
Failed audit checks can become open fix tasks. These tasks are deduplicated and tracked manually.

### Content planning
The system can identify content opportunities and help plan what should be published next for SEO and GEO growth.

## UI/UX goals

The interface should feel like an operations dashboard:

- Clear.
- Fast to scan.
- Easy to understand.
- Focused on next actions.
- Useful without needing AI to interpret everything.

The UI should help me answer:
- What is the status?
- What is broken?
- What needs to be done next?
- Is the site ready to launch?
- What should be built next?

## Local setup

### Requirements
- Node.js
- npm or pnpm
- PostgreSQL or SQLite, depending on the current setup
- Prisma
- Next.js

### Install
```bash
npm install
```

### Environment variables
Create a `.env` file and add the required database and app variables.

### Database setup
```bash
npx prisma generate
npx prisma db push
```

### Run locally
```bash
npm run dev
```

## Working with the app

### Add a new site
Use the onboarding flow to register a site and generate its initial launch checklist.

### Run an audit
Use the site detail page to run an audit and review the results.

### Review readiness
Check the readiness summary to see whether the site is not ready, nearly ready, or ready.

### Review fixes
Use the prioritized fix list and open task queue to decide what to work on next.

### Plan content
Use the content opportunity planner to identify what the site should publish or improve next.

## Project philosophy

This project is built on a few simple rules:

- Deterministic first.
- Manual confirmation for important state changes.
- Stored state over hidden logic.
- Clear priority over cleverness.
- Useful on a real site before anything else.

## Current status

The core onboarding, audit, launch checklist, fix queue, readiness summary, and reporting views are in place. The next phase is testing the UI/UX and tightening the workflow so it feels great to use on a real site.

## Roadmap

Possible future improvements include:

- Better content planning.
- Refresh automation.
- Client-facing reporting.
- White-label portal views.
- Productized service packaging.
