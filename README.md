# Dokkuchat API

> Ask questions about your own documents and get cited answers in seconds.

Dokkuchat is an enterprise-grade Retrieval-Augmented Generation (RAG) backend. Users upload PDFs, text files and images; the platform extracts, chunks and embeds the text in the background; and users then ask questions in natural language. Every answer is grounded in the user's own documents and cites the document and page it came from. When nothing relevant exists, Dokkuchat says so instead of guessing.

It is built for knowledge workers and solopreneurs who lose hours each week hunting through their own files. See [docs/product-positioning.md](docs/product-positioning.md) for the problem, the evidence and the positioning, and [docs/technical-spec.md](docs/technical-spec.md) for the architecture.

## Features

- **Authentication**: register, login, rotating refresh tokens with reuse detection, logout (one or all sessions), forgot and reset password
- **Authorization**: roles, permissions and a role-permission mapping; permission checks on every protected route
- **User management**: self-service profile, admin user management, soft delete and permanent delete
- **Document management**: multi-file upload, content-based type detection, checksum de-duplication, signed download URLs, reprocessing, deletion that removes chunks and stored files
- **Ingestion pipeline** (background, BullMQ): text extraction, page-aware chunking, embedding generation, status tracking
- **Conversations**: scoped retrieval with cosine similarity, prompt construction, cited answers, per-tier token budgets and rate limits
- **Pluggable providers**: storage (local, Tigris, S3), embeddings (OpenAI, Ollama) and LLMs (OpenAI, Ollama) behind interfaces
- **Resilience**: axios with retries and opossum circuit breakers on every outbound call
- **Human-in-the-loop (HITL)**: tool calls requested by the model wait for the user's approval
- **MCP**: a client that lets the assistant use external tools, and a server that exposes the user's documents to MCP clients
- **Observability**: correlation id on every request, structured logs, Prometheus metrics, health and readiness probes, per-request cost and token tracking
- **Caching and rate limiting**: Redis, with tag-based invalidation and per-policy limits

## Technology stack and prerequisites

| Area                       | Choice                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Runtime and language       | Node.js 22+, TypeScript                                       |
| HTTP framework             | Express 5                                                     |
| Database                   | PostgreSQL 16+ with the pgvector extension                    |
| ORM                        | Prisma 7 (driver adapter `@prisma/adapter-pg`)                |
| Validation                 | Zod                                                           |
| Queues                     | BullMQ on Redis                                               |
| Cache and rate limits      | Redis (ioredis, rate-limiter-flexible)                        |
| HTTP client and resilience | axios, opossum                                                |
| Logging and metrics        | Winston, prom-client                                          |
| Object storage             | Tigris (S3-compatible), AWS S3, or local disk for development |
| Testing                    | Vitest, supertest                                             |
| API docs                   | OpenAPI 3.1 generated from Zod schemas, served by Swagger UI  |

**Prerequisites:** Node.js 22 or newer, PostgreSQL with `pgvector`, Redis 7+, and either an OpenAI API key or a local Ollama instance.

## Getting started

```bash
git clone <your-repository-url> dokkuchat-api
cd dokkuchat-api
npm install
cp .env.example .env          # then edit the values
npm run prisma:migrate        # create tables (pgvector extension and HNSW index are in the migration)
npm run prisma:generate
npx prisma db seed            # system roles, permissions and the first admin
npm run dev
```

The API listens on `http://localhost:18080`. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding to choose the first administrator.

### Scripts

| Script                                     | Purpose                    |
| ------------------------------------------ | -------------------------- |
| `npm run dev`                              | Start with file watching   |
| `npm run build` / `npm start`              | Production build and run   |
| `npm test`                                 | Run the test suite         |
| `npm run lint` / `npm run lint:fix`        | ESLint                     |
| `npm run format`                           | Prettier                   |
| `npm run typecheck`                        | TypeScript without emit    |
| `npm run prisma:migrate` / `prisma:deploy` | Create or apply migrations |

### Key configuration

All configuration is validated at startup with Zod; a bad value stops the process with a readable message. See `.env.example` for the full list.

| Variable                             | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`          | Backing services                                          |
| `JWT_ACCESS_SECRET`                  | At least 32 characters; `openssl rand -base64 48`         |
| `STORAGE_PROVIDER`                   | `local`, `tigris` or `s3` (with bucket and credentials)   |
| `EMBEDDING_PROVIDER`, `LLM_PROVIDER` | `openai` or `ollama`                                      |
| `RUN_WORKERS`                        | `false` on API-only instances once workers run separately |
| `METRICS_TOKEN`                      | Bearer token required to scrape `/metrics`                |
| `MCP_CLIENT_SERVERS`                 | JSON list of external MCP servers the assistant may use   |

## Project structure

```
src/
├── apps/            one folder per module, each with route, controller, service, schema (+ repository)
│   ├── auth/  users/  admins/  rbac/  document/  chat/  ai/  approvals/  mcp/  health/
├── config/          environment validation, tier limits
├── database/        Prisma schema, migrations, seeds, client
├── docs/            OpenAPI document builder and Swagger UI
├── infrastructure/  redis, cache, queue, http (resilient client), storage, observability
├── shared/          errors, middleware, logger, events, request context, utilities
└── workers/         setupWorkers() and background workers
```

Rule of thumb: routes call controllers, controllers call services, services call repositories. Only repositories talk to the database.

## API documentation

Interactive documentation is served by Swagger UI:

| URL                             | What                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/docs`                         | Swagger UI (enabled by default outside production; set `ENABLE_API_DOCS=true` to expose it in production) |
| `/docs/openapi.json`            | The raw OpenAPI 3.1 document                                                                              |
| `/health/live`, `/health/ready` | Liveness and readiness probes                                                                             |
| `/metrics`                      | Prometheus metrics (bearer token)                                                                         |
| `/mcp`                          | MCP server endpoint (Streamable HTTP, bearer token)                                                       |

Request schemas in the documentation are generated from the same Zod schemas that validate requests, so they cannot drift. Each route's documentation lives next to its module in `<module>.docs.ts`.

All endpoints are under `/api/v1` and share one response envelope:

```json
{ "success": true, "data": {}, "meta": {}, "correlationId": "..." }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} }, "correlationId": "..." }
```

Quote the `correlationId` (also returned as the `x-correlation-id` header) when reporting an issue.

## Authentication and authorization

**Authentication.** Log in to receive a short-lived access token (JWT, 15 minutes by default) and a refresh token. Send the access token as `Authorization: Bearer <token>`. Refresh tokens are single-use: each refresh returns a new pair, and presenting an already-used token revokes the whole session family. Passwords are hashed with argon2id. Password reset links are single-use and expire after 30 minutes.

**Authorization.** Users have one role; roles hold permissions (for example `documents:read`, `users:delete`). Routes declare the permission they need. The `USER` role gets everyday permissions; `ADMIN` holds every permission. Admins can create custom roles and edit permissions through `/api/v1/rbac`. Usage limits (documents, monthly tokens, chat rate) depend on the user's tier: `FREE`, `PRO` or `ENTERPRISE`.

## Testing and code quality

```bash
npm test            # unit and integration tests (Vitest, supertest)
npm run lint        # ESLint (flat config, typescript-eslint)
npm run typecheck
```

- Services are tested with mocked repositories; HTTP behaviour is tested with supertest.
- Provider interfaces (storage, embeddings, LLM) have in-memory or fake implementations for tests.
- Run lint, typecheck and tests in CI on every pull request.

## Contribution

1. Fork the repository and create a branch: `feat/<short-description>` or `fix/<short-description>`.
2. Follow the module layout: `<module>.route.ts`, `.controller.ts`, `.service.ts`, `.schema.ts`, `.repository.ts`.
3. Validate every input with Zod, add the route's OpenAPI entry in `<module>.docs.ts`, and add tests.
4. Never access the database outside a repository, and never log secrets or tokens.
5. Run `npm run lint && npm run typecheck && npm test`, then open a pull request describing what changed and why.

Use Conventional Commits for messages (for example `feat(document): add reprocess endpoint`).

## License

Released under the MIT License.

## Support

- Bugs and feature requests: open an issue in the repository.
- Security issues: please do not open a public issue; email the maintainers at `getsuperscript@gmail.com`.
- Questions: use the repository's discussions or email `support@your-domain.example`.
