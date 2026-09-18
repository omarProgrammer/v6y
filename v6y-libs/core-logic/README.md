# @v6y/core-logic

Shared server-side "core logic" library of the **Vitality (v6y)** platform.

`@v6y/core-logic` groups everything the v6y back-end services need to run: PostgreSQL
data access (Sequelize models + providers), authentication (JWT/passport), HTTP(S)/HTTP2
server helpers, structured logging, external integrations (GitLab/GitHub repositories,
Datadog monitoring), ZIP handling, and a set of domain utilities and reference data.

It is an **ESM TypeScript package** (`"type": "module"`, `"main": "src/index.ts"`) with no UI
of its own: every renderer/consumer imports it as an npm workspace dependency.

- [Role](#role)
- [Package entry points](#package-entry-points)
- [Source layout](#source-layout)
- [Dependencies and consumers](#dependencies-and-consumers)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Conventions and notes](#conventions-and-notes)

---

## Role

This package is the single source of server-side logic for v6y. Concretely it provides:

| Area | What it does |
| --- | --- |
| **Database** | A single `DataBaseManager` that connects to PostgreSQL, registers all Sequelize models, auto-syncs the schema (`sync({ alter: true })`) and seeds the default reference data. Persistence is done through one **Provider** per entity. |
| **Authentication** | Passport + JWT strategy wiring (`configureAuthenticationStrategy`), token generation, role checks (`ADMIN`, `SUPERADMIN`) and bcrypt password hashing. |
| **Servers** | `ServerUtils` creates plain HTTP or HTTPS servers (and a spdy/HTTP2 static server) from a `ServerConfig`. `ServerConfig` also exposes `getServerConfig` / `CorsOptions` and computes the public `serverUrl`. |
| **Logging** | `AppLogger` (winston) used by every file in the package/repo for consistent console + optional daily-rotated file output. |
| **External APIs** | `RepositoryApi` talks to GitLab/GitHub (repo details, file content, branches, merge requests, deployments, ZIP download URLs); `MonitoringApi` fetches Datadog events. |
| **Audit helpers** | `AuditUtils` finds/parses eligible source files (JS/TS) for static audit workers, detects front-end modules, package managers, bundlers; `SemverUtils` parses/compares versions; `PerformancesUtils` measures durations. |
| **Files / misc** | `ZipUtils` (download/unzip/delete ZIP), `CsvUtils` (export `;`-separated CSV), `Matcher`, `DateUtils`, `StringUtils` (base64 JSON helpers), `WorkerHelper` (worker threads for CPU-heavy tasks). |
| **Reference data** | Static catalogues in `src/config`: code-smell types/categories, security anti-patterns, DORA metrics, default `AuditHelp` / `EvolutionHelp` / `DependencyStatusHelp` entries, dependency statuses. |

## Package entry points

There is one public entry point: `src/index.ts` (the `main` field of `package.json`).
It re-exports:

- **All domain types** through `./types/index.ts` (`AccountType`, `ApplicationType`,
  `AuditType`, `DependencyType`, `EvolutionType`, `FaqType`, `KeywordType`,
  `NotificationType`, `RepositoryType`, `ServerConfigType`, `MonitoringType`, `ZipType`,
  `SearchQueryType`, ...).
- **Named configuration exports** from `src/config`: `AuditHelpConfig`, `CodeSmellConfig`,
  `DependencyHelpConfig`, `EvolutionHelpConfig`, `SecuritySmellConfig`, `ServerConfig`
  (`CorsOptions`, `getServerConfig`).
- **Named helpers** from `src/core/AuthenticationHelper.ts` (`createJwtOptions`,
  `generateAuthenticationToken`, `validateCredentials`, `configureAuthMiddleware`,
  `configureAuthenticationStrategy`, `isAdmin`, `isSuperAdmin`, ...) and from
  `src/utils/index.ts` (`Matcher`, `CsvUtils`, `DateUtils`).
- **Named object exports** — everything else: `AppLogger`, `AuditUtils`, `SemverUtils`,
  `StringUtils`, `ServerUtils`, `PerformancesUtils`, `WorkerHelper`, `ZipUtils`,
  `MonitoringUtils`, the 12 database providers (`AccountProvider`, `ApplicationProvider`,
  `AuditProvider`, `AuditHelpProvider`, `EvolutionProvider`, `EvolutionHelpProvider`,
  `DependencyProvider`, `DependencyStatusHelpProvider`, `DeprecatedDependencyProvider`,
  `FaqProvider`, `KeywordProvider`, `NotificationProvider`) plus the database manager
  `DataBaseManager`, and the two API clients: `RepositoryApi`, `MonitoringApi`.

There is no HTTP route or long-running process in this package; it is a library.
A secondary bootstrap script, `database_init.mjs` (referenced by the `init-db` npm script),
writes the Sequelize CLI configuration (`config/config.json`) used by `v6y-database` for
migrations (see `.sequelizerc`, which points migrations/seeders/models at
`../../v6y-database/psql`). The `env-template` file lists the `PSQL_DB_*` variables that
must be defined before running it.

Example of a real entry-point use (from `v6y-apps/bff/src/index.ts`):

```ts
import { AppLogger, DataBaseManager, ServerUtils, configureAuthMiddleware } from '@v6y/core-logic';

const { createServer } = ServerUtils;

app.use(configureAuthMiddleware());
const httpServer = createServer({ app, config: currentConfig });
// ...
await DataBaseManager.connect();
```

## Source layout

```
src/
├── index.ts                  # public entry point (re-exports everything below)
├── apis/                     # external HTTP integrations
│   ├── MonitoringApi.ts      #   Datadog events -> MonitoringEventType[]
│   └── RepositoryApi.ts      #   GitLab/GitHub: details, file content, branches, MRs, deployments, zip config
├── config/                   # static reference data + server config helpers
│   ├── AuditHelpConfig.ts    #   default AuditHelp rows + audit/score statuses
│   ├── CodeSmellConfig.ts    #   code smell types & categories
│   ├── DependencyHelpConfig.ts   # dependency statuses + default status help
│   ├── DevOpsConfig.ts       #   DORA metric types/categories
│   ├── EvolutionHelpConfig.ts    # default EvolutionHelp rows + statuses
│   ├── SecuritySmellConfig.ts    # security anti-pattern catalogue
│   └── ServerConfig.ts       #   CorsOptions + getServerConfig
├── core/                     # low-level server/domain utilities
│   ├── AppLogger.ts          #   winston logger (exported as AppLogger)
│   ├── AuditUtils.ts         #   file discovery/parsing for static audits
│   ├── AuthenticationHelper.ts   # passport/JWT wiring
│   ├── PasswordUtils.ts      #   bcrypt hash / validate
│   ├── PerformancesUtils.ts  #   performance.mark / measure
│   ├── SemverUtils.ts        #   parse / normalize / compare semver
│   ├── ServerUtils.ts        #   createServer / createStaticServer
│   ├── StringUtils.ts        #   base64 + JSON string helpers
│   ├── WorkerHelper.ts       #   worker_threads.forkWorker
│   └── ZipUtils.ts           #   download / unzip / delete ZIP archives
├── database/
│   ├── DataBaseManager.ts    # connect / registerModels / initDefaultData (single entry)
│   ├── models/               # Sequelize model definitions (one per table)
│   │   ├── AccountModel.ts ... NotificationModel.ts (12 files)
│   └── *Provider.ts          # per-entity data-access providers (12) + DataBaseManager
├── types/                    # TypeScript domain types (src/types/index.ts re-exports them)
└── utils/
    ├── CsvUtils.ts           # export to CSV (FileSaver)
    ├── DateUtils.ts          # date <-> string <-> timestamp conversions
    ├── Matcher.ts            # tiny functional pattern matcher
    ├── MonitoringUtils.ts    # convert Datadog events
    └── index.ts              # re-exports Matcher, CsvUtils, DateUtils
```

## Dependencies and consumers

**Runtime dependencies** (from `package.json`): `sequelize` + `@sequelize/core`, `pg`,
`pg-hstore`, `bcrypt`, `jsonwebtoken`, `passport` + `passport-jwt`, `winston` +
`winston-daily-rotate-file` + `winston-transport`, `axios`, `axios-retry`, `cors`, `spdy`,
`morgan`, `dotenv`, `fs-extra`, `globby`, `unixify`, `adm-zip`, `file-saver`,
`json-2-csv`, `lodash`, `semver` + `compare-versions`, `superagent`,
`package-manager-detector`. (Type-only `@types/*` packages — e.g. `@types/bcrypt`,
`@types/jsonwebtoken`, `@types/adm-zip`, `@types/lodash`, `@types/semver`, ... — are
declared in `dependencies` too, next to the code they type.)

**Dev dependencies**: `typescript`, `vitest` (+ coverage/UI), `eslint` +
`typescript-eslint`, `prettier` + `@trivago/prettier-plugin-sort-imports`, `sequelize-mock`,
`chai`.

**Consumers within the v6y workspace** (pnpm workspace packages that declare a dependency
on `@v6y/core-logic`):

- `v6y-apps/bff` (main back-end for front(s): GraphQL API, DB + auth bootstrap)
- `v6y-apps/bfb-main-analyzer`, `bfb-static-auditor`, `bfb-dynamic-auditor`,
  `bfb-devops-auditor` (the audit/analysis workers)
- `v6y-apps/front`, `v6y-apps/front-bo` (web renderers)
- `v6y-libs/ui-kit`

`core-logic` itself depends only on npm packages — it is a leaf of the workspace
dependency graph (no imports of other `@v6y/*` packages).

**Environment variables** read at runtime:

| Variable | Used by | Default |
| --- | --- | --- |
| `PSQL_DB_HOST` / `PSQL_DB_NAME` / `PSQL_DB_USER` / `PSQL_DB_PASSWORD` / `PSQL_DB_PORT` | `DataBaseManager.connect()` | `localhost` / `v6y` / `v6y` / `v6y` / `5432` |
| `JWT_SECRET` | `AuthenticationHelper` | `default_secret_key` in `createJwtOptions`; **required** (throws if missing) in `generateAuthenticationToken` |
| `GITHUB_PRIVATE_TOKEN` | `RepositoryApi.GithubConfig` | – |
| `GITLAB_PRIVATE_TOKEN` | `RepositoryApi.GitlabConfig` | – |

## Data model

`DataBaseManager.registerModels()` registers **12 Sequelize models** on a single PostgreSQL
connection. Because `connect()` calls `sequelize.sync({ alter: true })`, the authoritative
schema is the model definitions in `src/database/models/` (there are no checked-in
migration files in this package; migrate scripts are delegated to `v6y-database/psql` via
`.sequelizerc`). The connection uses `define: { underscored: true }`.

| Model | Table (modelName) | Key columns | Notes |
| --- | --- | --- | --- |
| `AccountModel` | `Account` | `username`, `email`, `password`, `role`, `applications` | username/email unique; `applications` is an ARRAY(INTEGER) |
| `ApplicationModel` | `Application` | `name`, `acronym`, `contactMail`, `description`, `repo`, `configuration`, `links` | name/acronym unique; `repo`/`configuration`/`links` are JSON |
| `AuditModel` | `AuditReport` | `appId`, `dateStart`, `dateEnd`, `type`, `category`, `subCategory`, `auditStatus`, `score` (FLOAT), `scoreStatus`, `scoreUnit`, `extraInfos`, `auditHelp`, `module` | `auditHelp`/`module` JSON |
| `DependencyModel` | `Dependency` | `appId`, `type`, `name`, `version`, `recommendedVersion`, `status`, `statusHelp`, `module` | `statusHelp`/`module` JSON |
| `EvolutionModel` | `Evolution` | `appId`, `category`, `evolutionHelp`, `module` | evolutionHelp/module JSON |
| `FaqModel` | `Faq` | `title`, `description`, `links` | title unique; links JSON |
| `KeywordModel` | `Keyword` | `appId`, `label`, `module` | module JSON |
| `NotificationModel` | `Notification` | `title`, `description`, `links` | title unique; links JSON |
| `DeprecatedDependencyModel` | `DeprecatedDependency` | `name` | name unique |
| `AuditHelpModel` | `AuditHelp` | `category`, `title`, `description`, `explanation` | unique(category,title) |
| `EvolutionHelpModel` | `EvolutionHelp` | `category`, `title`, `description`, `status`, `links` | unique(category,title,status); links JSON |
| `DependencyStatusHelpModel` | `DependencyStatusHelp` | `category`, `title`, `description`, `links` | unique(category,title); links JSON |

**Cross-entity relations** are not declared as foreign keys/associations: entities that
belong to an application carry an `appId`, and the descriptive payloads
(`auditHelp`/`evolutionHelp`/`statusHelp`/`module`) are embedded as JSON snapshots rather
than references. `RepositoryType` (inside `Application.repo`) and `DataDogConfigType`
(inside `Application.configuration.dataDog`) are likewise stored as JSON.

**Default data seeding**: after connecting, `initDefaultData()` inserts the rows coming
from `src/config` if the tables are empty — `EvolutionHelpProvider`,
`AuditHelpProvider` and `DependencyStatusHelpProvider` each expose `initDefaultData()`.

**Providers** wrap the models with CRUD plus `get*ListByPageAndParams` /
`get*DetailsByParams`, using a `SearchQueryType` (`searchText`, `start`, `limit`, `sort`).
Naming conventions observed:

- Batch insert: `insertAuditList`, `insertDependencyList`, `insertEvolutionList`,
  `insertKeywordList`.
- Extended queries: `KeywordProvider.getKeywordsStatsByParams`,
  `getApplicationsIdsByKeywords`; `ApplicationProvider` adds `getApplicationStatsByParams`,
  `getApplicationTotalByParams`, and per-section details
  (`...Evolutions/Dependencies/AuditReports/KeywordsByParams`, `getApplicationDetailsInfoByParams`).
- Help/data providers (`AuditHelp`, `EvolutionHelp`, `DependencyStatusHelp`) expose
  `initDefaultData()`.

## Getting started

Test/verification commands are defined per package in `v6y-libs/core-logic/package.json`
(and aggregated at the workspace root via Nx):

```bash
pnpm install            # install the pnpm workspace (run from repo root)
pnpm test               # vitest with coverage (core-logic only: cd v6y-libs/core-logic)
pnpm run check:tsc      # no-emit TypeScript check
pnpm run lint           # eslint (src/**/*.ts)
pnpm run format         # prettier --write ./src
pnpm run build:tsc      # emit declaration files to ./dist/types
```

Database bootstrap (requires a reachable PostgreSQL and env vars — see `env-template`):

```bash
cd v6y-libs/core-logic
node --env-file=./.env database_init.mjs   # writes v6y-database/psql/config/config.json
pnpm run migrate-db                         # sequelize-cli db:migrate
pnpm run init-db                            # init + config generation + migration
```

At runtime the library is consumed through its entry point, typically by calling
`DataBaseManager.connect()` once at application startup (see
`v6y-apps/bff/src/index.ts`).

## Conventions and notes

- **Language**: code comments and intra-repo docs are in English (project convention);
  some older log messages/format strings still contain French fragments and are left as-is.
- **Import style**: ESM imports with explicit `.ts` extensions
  (`import X from '../core/AppLogger.ts'`); default exports for singletons/objects
  (`AppLogger`, each `*Provider`, `*Utils`, `DataBaseManager`, `*Api`).
- **Lint profile** (`eslint.config.mjs`): `eslint:recommended` + `typescript-eslint`
  recommended + prettier, with `max-depth: 3`, `max-nested-callbacks: 3`,
  `max-params: 3`, `max-lines: 1000`, `max-lines-per-function: 200`, `max-statements: 50`.
- **Tests** live in `src/__tests__/*-test.ts` (Vitest + `sequelize-mock` + `chai`),
  wired by `vitest.config.mjs` (`environment: 'jsdom'`, `setupFiles: ['dotenv/config']`).
- **Logging discipline**: every function logs into `AppLogger` with a
  `[ClassName - methodName]` prefix; many catch-blocks return a safe default (`null`, `[]`,
  `false`) after logging instead of throwing.
- **Secrets handling**: repository/API tokens are read from environment variables
  (`GITHUB_PRIVATE_TOKEN`, `GITLAB_PRIVATE_TOKEN`, Datadog keys in
  `Application.configuration.dataDog`) and must never be committed.
