# ui-kit — Architecture

## Role
Reusable UI component library shared across the v6y front-end apps (front, front-bo).

## Dependencies
Declared in `v6y-libs/ui-kit/package.json` (React + TypeScript; peer deps on the app runtimes).

## Entrypoints
The package `main`/`exports` field in `package.json` (component barrel export).

## Data model
Stateless presentational components; data flows in through typed TypeScript props, no local persistence.
