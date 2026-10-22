# DIGITAL-FUTURE.AI — Backend security integration

## Important repository finding
The current repository default branch contains a static `index.html`; it does not currently contain `package.json`, a Next.js/Express server, authentication routes, a PostgreSQL schema/ORM, or a Stripe webhook route. The files in this folder are secure integration modules/examples only. They do not become active until a backend is built, dependencies are installed, and these handlers are mounted.

## Install in the separate Node backend
```sh
npm install express helmet cors express-rate-limit zod bcryptjs stripe pg
npm install -D typescript @types/express @types/cors @types/bcryptjs @types/pg
```

## Required integration
- Mount `security/express-security.ts` middleware on the real Express app, with stricter `authLimiter` on every login, registration, reset-password and OTP route.
- Configure trusted reverse proxy hops explicitly; never trust arbitrary `X-Forwarded-For` values. The sample in-memory rate limiter is not sufficient for multi-instance deployment; use a shared Redis-backed limiter and provider WAF/DDoS protection.
- Mount `stripeWebhookRouter` before `express.json()`. Use Stripe's raw request body for signature verification. Add reviewed event handlers tied to locally-created pending orders before accepting live payments.
- Apply `schema.sql` using a reviewed database migration. Use parameterized SQL or a safe ORM, least-privilege DB role, TLS certificate validation and managed backups.
- Store secrets in the hosting provider's encrypted environment-variable manager, not Git. Rotate keys if any secret was ever committed.
- Enforce HTTPS at the edge, secure PostgreSQL TLS, storage/backups encryption at rest, access controls, audit logs and tested backups.
- Add CSRF protection for cookie-authenticated mutations; HttpOnly cookies alone do not prevent CSRF.
- Test CSP against the actual app's script, font, image, OAuth and payment providers. Deploy in staging and run dependency, integration and penetration tests.

No implementation can guarantee zero vulnerabilities. These modules require integration and validation before production.
