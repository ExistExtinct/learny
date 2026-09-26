# Learny 2.0 — AI Learning & Coding Workspace

Learny is a full-stack React/Vite + Express + SQLite learning application with secure authentication, email verification, password reset, optional Google OAuth, an AI tutor, personal notes, quizzes, AI summaries/explanations/code generation, and a browser-safe coding practice lab.

## Recommended versions

- Node.js **22.23.2 LTS**
- npm **10.9.x** or newer 10.x
- React 19.1.1
- Vite 7.1.3
- Express 5.1.0
- better-sqlite3 13.0.3
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

At minimum put your Gemini key in:

```env
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
EMAIL_VERIFICATION_REQUIRED=true
GEMINI_API_KEY=YOUR_KEY_HERE
GEMINI_MODEL=gemini-3.6-flash
```

Never put `GEMINI_API_KEY` in the client folder.

## 5. Email verification

Email verification is enabled by default.

### Development without SMTP

You can leave SMTP empty. Registration will show a one-time development verification URL in the Learny UI. Open that link to verify the account.

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

The Practice route is now a VS Code-style Code Studio with:

- multi-file explorer and editor tabs
- HTML/CSS/JavaScript live preview in a sandboxed iframe
- terminal output and optional standard input
- Python, Java, C++, C, Go, Rust, Ruby and Node.js container runners
- Run/Stop controls and execution status
- disposable Docker execution with no network, no host mounts, a non-root user, read-only root filesystem, CPU/memory/PID limits, timeouts and output limits

Install and start Docker Desktop before using server-side languages. Learny intentionally fails closed when Docker is unavailable; it never runs submitted server-side code directly on the host.

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

For public deployment, use a separate execution worker host with Docker daemon isolation, monitoring and quotas.

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

## 12. Tests and build

Run:

```powershell
npm test
```

This runs the server test and the Vite production build.

Build only:

```powershell
npm run build
```

## 13. Important Gemini troubleshooting

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

## 14. Security

AI keys are server-side only. User code is not executed on the Node server. JavaScript/HTML practice is placed in a sandboxed iframe. For production code execution, use an isolated sandbox/container with resource limits, no host filesystem access, no privileged execution, no default outbound network, and automatic cleanup.
