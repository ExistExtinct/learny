# Learny 2.0 — AI Learning & Coding Workspace

Learny is a full-stack React/Vite + Express + managed PostgreSQL learning application with secure authentication, email verification, password reset, optional Google OAuth, an AI tutor, personal notes, quizzes, AI summaries/explanations/code generation, and a coding practice lab.

## Recommended versions

- Node.js **22.23.2 LTS**
- npm **10.9.x** or newer 10.x
- React 19.1.1
- Vite 7.1.3
- Express 5.1.0
- PostgreSQL (managed provider recommended for deployment)
- Gemini model: **gemini-3.6-flash**

Vite 7 requires Node 20.19+ or 22.12+. Learny pins the project to the Node 22 line to avoid mixing major Node versions.

## 1. Extract

Extract the ZIP so the structure is:

```text
learny-app/
  client/
  server/
  scripts/
  package.json
```

Do not run the commands from a parent folder containing another `package.json` or lockfile.

## 2. Check Node

PowerShell:

```powershell
node -v
npm -v
```

Recommended:

```text
v22.23.2
10.9.x
```

## 3. Install

Open PowerShell inside `learny-app`:

```powershell
npm install
npm run install:all
```

If you are upgrading from an older Learny copy, delete old `node_modules` folders first:

```powershell
Remove-Item -Recurse -Force node_modules,client\node_modules,server\node_modules -ErrorAction SilentlyContinue
npm install
npm run install:all
```

## 4. Configure environment

Copy:

```text
server\.env.example
```

to:

```text
server\.env
```

Configure a managed PostgreSQL connection and, optionally, an AI key. `DATABASE_URL` is required to run the API; frontend builds and the targeted tests do not connect to a database.

```env
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
EMAIL_VERIFICATION_REQUIRED=false
GEMINI_API_KEY=YOUR_KEY_HERE
GEMINI_MODEL=gemini-3.6-flash
```

Never put `GEMINI_API_KEY` in the client folder.

## 5. Email verification

Email verification is enabled by default.

### Development without SMTP

Local development skips email verification automatically when SMTP is not configured. Set `EMAIL_VERIFICATION_REQUIRED=false` in `server/.env` to make this explicit. Production still requires SMTP when email verification is enabled.

### Real email verification

For Gmail/SMTP or another provider, configure:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASS=your-password
MAIL_FROM=no-reply@example.com
```

For production, use a real transactional email provider and set `NODE_ENV=production`.

## 6. Start Learny

From `learny-app`:

```powershell
npm run dev
```

The built-in launcher starts both services:

```text
Frontend: http://127.0.0.1:5173
API:      http://127.0.0.1:4000
```

You can also run them separately if needed:

### Terminal 1

```powershell
cd server
npm run dev
```

### Terminal 2

```powershell
cd client
npm run dev
```

## 7. Health check

Open:

```text
http://127.0.0.1:4000/api/health
```

You should see JSON containing:

```json
{
  "ok": true,
  "geminiConfigured": true,
  "geminiModel": "gemini-3.6-flash"
}
```

If `geminiConfigured` is false, the API key is not loaded from `server/.env`.

## 8. AI features

The AI Tutor supports:

- normal questions
- topic explanations
- summaries
- structured study notes
- 5-question tests with answer keys
- code generation
- code review and debugging
- voice input where the browser supports Web Speech API
- browser speech output for voice mode
- saving AI responses as notes

The Notes page also has an **AI note maker**.

## 9. Code Studio and Docker sandbox

The Practice route is a VS Code-style Code Studio with:

- multi-file explorer and editor tabs
- HTML/CSS/JavaScript live preview in a sandboxed iframe
- terminal output and optional standard input
- Python, Java, C++, C, Go, Rust, Ruby and Node.js runners
- Run/Stop controls and execution status
- disposable Docker execution with no network, no host mounts, a non-root user, read-only root filesystem, CPU/memory/PID limits, timeouts and output limits

For local development, install and start Docker Desktop before using server-side languages. Learny runs those languages only inside disposable, resource-limited Docker containers and never directly on the host.

The first run may need the language images:

```powershell
docker pull python:3.12-alpine
docker pull node:22-alpine
docker pull eclipse-temurin:21-jdk-alpine
docker pull gcc:14
docker pull golang:1.23-alpine
docker pull rust:1.81-alpine
docker pull ruby:3.3-alpine
```

Vercel Functions cannot run Docker. On Vercel, server-side code is **not executed**: the API repeats the AI safety/quality preflight, asks the configured AI provider to predict likely output, and labels the response as simulated/not executed. Predictions can be inaccurate and are not a substitute for running tests. HTML preview remains in the browser's sandboxed iframe. For real server-side execution in production, use a separate isolated worker service with Docker daemon isolation, monitoring and quotas.

## 10. Authentication

Included:

- username/email + password
- bcrypt password hashing
- HttpOnly server-side sessions
- logout and session revocation
- email verification
- resend verification
- forgot password
- secure password reset tokens
- optional Google OAuth
- rate limiting
- input validation
- Origin checks
- Helmet security headers

## 11. Google OAuth (optional)

Configure:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:4000/api/auth/google/callback
```

Use the exact callback URL in Google Cloud Console.

## 12. Deploy to Vercel

Learny keeps its React/Vite frontend and Express API; it does not require a Next.js migration. The Vercel deployment uses the root `vercel.json` to build `client/dist`, route `/api/*` to the Express function, and serve the Vite SPA for frontend routes.

1. Provision a **managed PostgreSQL** database with your preferred provider. Copy its serverless/pooler connection URL if offered. The URL must be available to Vercel Functions and use TLS; do not commit credentials.
2. Import this repository into Vercel with the repository root as the project root. Use the configured build command `npm run build` and output directory `client/dist` (already in `vercel.json`).
3. Add Vercel environment variables for **Production** (and Preview if wanted):

   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   DATABASE_SSL_REJECT_UNAUTHORIZED=true
   CLIENT_ORIGIN=https://your-project.vercel.app
   GEMINI_API_KEY=...
   GEMINI_MODEL=gemini-3.6-flash
   EMAIL_VERIFICATION_REQUIRED=true
   SMTP_HOST=...
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASS=...
   MAIL_FROM=...
   ```

   Add `OPENAI_API_KEY`/`OPENAI_MODEL` only if using OpenAI. Configure the email variables if verification or password reset emails are enabled. `DATABASE_URL`, AI keys and SMTP credentials belong only in server-side Vercel environment settings—never in Vite/client variables.
4. If enabling Google sign-in, configure both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then register the exact callback URL `https://your-project.vercel.app/api/auth/google/callback` in Google Cloud and set `GOOGLE_REDIRECT_URI` to that URL. Vercel deployment URLs are accepted for origin checks automatically; set `CLIENT_ORIGIN` to your production custom domain if you use one. Google OAuth still requires an exact registered callback URL.
5. Deploy. On the first API request, the server applies versioned SQL migrations and seeds the course/practice catalog idempotently. Check `https://your-project.vercel.app/api/health` and then test registration, email delivery and OAuth as configured.

Schema initialization is automatic and repeatable; it does not copy data from a local SQLite database. The ignored `server/data/learny.sqlite` file, if present from earlier local development, is not read or migrated. Treat any data migration as a separate, explicitly backed-up operation.

Vercel builds and the targeted server tests do not require a live database URL. Local API runtime and live database integration checks do require `DATABASE_URL`; the Vercel code-run endpoint also needs at least one configured AI provider. No Docker daemon is available inside Vercel Functions, so returned server-language output is an AI prediction, never an execution result.

## 13. Tests and build

Run:

```powershell
npm test
```

This runs the server test and the Vite production build.

Build only:

```powershell
npm run build
```

## 14. Important Gemini troubleshooting

If Tutor says `Gemini request failed`, do not immediately replace the API key.

First check:

```powershell
cd server
node -e "require('dotenv').config(); console.log('Key exists:', !!process.env.GEMINI_API_KEY); console.log('Model:', process.env.GEMINI_MODEL)"
```

Expected:

```text
Key exists: true
Model: gemini-3.6-flash
```

Then check the server terminal. Learny now logs the upstream Gemini HTTP status and provider message instead of hiding the reason behind a generic 502.

## 15. Security

AI keys and database credentials are server-side only. Vercel code-run requests are AI-simulated and never execute submitted server-side code. Locally, submitted server-side code runs only in a Docker container with resource limits, no host filesystem access, no privileged execution, no default outbound network, and automatic cleanup. JavaScript/HTML preview is placed in a sandboxed iframe.
