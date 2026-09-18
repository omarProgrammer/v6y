# @v6y/core-logic

Shared backend business logic package for the **Vitality (v6y)** platform.

This package contains the core server-side building blocks used by the v6y
applications: database access, authentication, logging, utilities, and
integrations with external services (GitHub, GitLab, Datadog).

## Role

`core-logic` provides the domain and infrastructure layer shared across the
v6y services. It is organized around a few responsibilities:

- **Persistence**: Sequelize models and a provider layer that expose typed CRUD
  operations against the PostgreSQL database.
- **Integrations**: client APIs for external platforms (GitHub, GitLab, Datadog)
  used to collect repository data and monitoring events.
- **Infrastructure helpers**: logging, authentication (JWT via Passport),
  server creation (HTTP / HTTP/2 / SPDY), password hashing, version comparison,
  zip handling, and worker-thread support for CPU-intensive tasks.
- **Configuration**: static catalogues describing audit/evolution/dependency
  help categories and server configuration.

The package defines only business logic and persistence — it has no UI and no
network routes of its own.

## Entry Points

The package main entry point is `src/index.ts`. It is the public barrel that
exports:

- **Database providers** — `ApplicationProvider`, `AccountProvider`,
  `AuditProvider`, `AuditHelpProvider`, `DependencyProvider`,
  `DependencyStatusHelpProvider`, `DeprecatedDependencyProvider`,
  `EvolutionProvider`, `EvolutionHelpProvider`, `FaqProvider`, `KeywordProvider`,
  `NotificationProvider`, and `DataBaseManager`.
- **Integrations** — `RepositoryApi` (GitHub / GitLab) and `MonitoringApi`
  (Datadog events).
- **Utilities** — `AppLogger`, `AuditUtils`, `PerformancesUtils`, `SemverUtils`,
  `StringUtils`, `ServerUtils`, `WorkerHelper`, `ZipUtils`, `DateUtils`,
  `CsvUtils`, `MonitoringUtils`, `Matcher`.
- **Types and configuration** — all shared TypeScript types (`types/`) and the
  help/server configs (`config/`).

Other notable internal files (not part of the public API):

- `src/config/*` — default help catalogues and server configuration.
- `src/database/models/*` — Sequelize model definitions, each exposing an
  `initialize<Name>Model(sequelize)` function.
- `src/core/*` — infrastructure helpers (see [Utilities](#utilities)).

## Dependencies

### External (runtime)

Declared in `package.json`:

| Purpose | Packages |
| --- | --- |
| ORM / database | `sequelize`, `@sequelize/core`, `pg`, `pg-hstore` |
| Authentication | `jsonwebtoken`, `passport`, `passport-jwt`, `bcrypt` |
| HTTP / server | `spdy`, `cors`, `morgan` |
| Downloads / files | `adm-zip`, `file-saver`, `fs-extra`, `axios`, `axios-retry`, `superagent` |
| Utilities | `lodash`, `globby`, `semver`, `compare-versions`, `unixify`, `json-2-csv`, `dotenv`, `package-manager-detector`, `winston`, `winston-daily-rotate-file`, `winston-transport` |

### Dev only

`typescript`, `eslint` (+ `typescript-eslint`, `eslint-config-prettier`,
`eslint-plugin-prettier`), `vitest` (+ `@vitest/coverage-v8`, `@vitest/ui`),
`chai`, `sequelize-mock`, and the relevant `@types/*` packages.

### Internal (monorepo)

Runtime dependencies on other v6y packages were checked at the documented
baseline: none found — `core-logic` does not import other `v6y-libs` packages.

## Data Model

Persistence is handled by Sequelize models declared under
`src/database/models/` and registered by `DataBaseManager.registerModels()`.
The database is PostgreSQL (`dialect: 'postgres'`), with `underscored: true` in
the global definition. Models are synchronized with `sync({ alter: true })`
during `DataBaseManager.connect()`.

Common conventions: each model has a numeric surrogate key `_id`
(`autoIncrement`, primary key) and free-form `links` stored as `JSON`.

| Model | Main fields | Unique / notes |
| --- | --- | --- |
| `Account` | `_id`, `username`, `email`, `password`, `role`, `applications` | used by JWT authentication |
| `Application` | `_id`, `name`, `acronym`, `description`, `contactMail`, `repo`, `configuration`, `links` | the central entity; `repo` holds Git/GitHub info, `configuration` holds Datadog keys |
| `Audit` | `_id`, `appId`, `dateStart`, `dateEnd`, `type`, `category`, `subCategory`, `auditStatus`, `score`, `scoreStatus`, `scoreUnit`, `extraInfos`, `auditHelp`, `module` | audited app health report |
| `Dependency` | `_id`, `appId`, `type`, `name`, `version`, `recommendedVersion`, `status`, `statusHelp`, `module` | dependency of a tracked app |
| `Evolution` | `_id`, `appId`, `category`, `evolutionHelp`, `module` | evolution recommendation for an app |
| `Keyword` | `_id`, `appId` (+ keyword data) | used for app search/stats |
| `Faq` | `_id`, `title`, `description`, `links` | FAQ entry; unique `title` |
| `Notification` | `_id`, `title`, `description`, `links` | notification entry; unique `title` |
| `DeprecatedDependency` | `_id`, `name` | deprecated dependency names; unique `name` |
| `AuditHelp` | `_id`, `category`, `title`, `description`, `explanation`, `links` | unique `category` |
| `EvolutionHelp` | `_id`, `category`, `title`, `description`, `status`, `links` | unique combo `category` + `title` + `status` |
| `DependencyStatusHelp` | `_id`, `category` (`outdated` / `deprecated` / `up-to-date`), `title`, `description`, `links` | unique `category` |

### Domain types

Shared types live in `src/types/` and are re-exported from `src/types/index.ts`.
Key ones:

- `ApplicationType` / `ApplicationInputType` — the application entity and its
  form input shape (Git URLs, Datadog keys, links).
- `AccountType` / `AccountInputType` — user accounts with a `role`
  (`ADMIN`, `SUPERADMIN`, …) and a list of accessible application ids.
- `AuditType`, `DependencyType`, `EvolutionType`, `KeywordType` — audit and
  dependency domain objects, each optionally carrying a help entry and a
  `ModuleType` (app module position/version).
- `RepositoryType` — GitHub / GitLab repository descriptors + config builders
  (`GithubConfigType`, `GitlabConfigType`).
- `MonitoringType` — Datadog event shapes and monitoring options.
- `ServerConfigType` / `ServerEnvConfigType` — server binding and routing
  configuration.
- `LinkType` — { label, value, description } used for app URLs.
- `ZipType` — zip download options used by `ZipUtils` / `RepositoryApi`.

## Utilities

Infrastructure helpers under `src/core/` and `src/utils/`:

- `AppLogger` — global Winston logger (console + optional daily-rotate file).
- `AuthenticationHelper` — JWT helpers, Passport strategy builder and
  `validateCredentials` middleware.
- `PasswordUtils` — bcrypt password hashing / validation.
- `ServerUtils` — HTTP, HTTPS and SPDY server creation.
- `AuditUtils` — audit file parsing helpers (source file discovery, anti-pattern
  checks).
- `PerformancesUtils` — `performance.mark` / `measure` around long tasks.
- `SemverUtils` — semantic-version compare / normalize / parse.
- `StringUtils` — base64 encode/decode and JSON parsing helpers.
- `WorkerHelper` — forking Node `worker_threads`.
- `ZipUtils` — download, unzip and clean of git-branch archives.
- `DateUtils`, `CsvUtils`, `MonitoringUtils`, `Matcher` — formatting, CSV export,
  Datadog event conversion and a small pattern-matching helper.

## Getting Started

The package is part of the v6y monorepo, so install at the workspace root:

```sh
pnpm install
```

Database connection is configured through environment variables (see
`env-template` at the package root):

```sh
PSQL_DB_NAME=v6y PSQL_DB_USER=v6y PSQL_DB_PASSWORD=v6y \
PSQL_DB_HOST=localhost PSQL_DB_PORT=5432
psql
```

Useful scripts (see `package.json`):

- `pnpm test` — run the Vitest suite with coverage.
- `pnpm check:tsc` — type-check the package.
- `pnpm lint` — lint the package with ESLint.
- `pnpm build:tsc` — compile with `tsc`.
