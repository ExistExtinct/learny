# Learny 2.0 Security Notes

- AI provider keys are read only by the Express server.
- Authentication uses random server-side sessions in HttpOnly cookies; raw tokens are not stored in the database.
- Passwords are hashed with bcrypt.
- Email verification and password-reset tokens are random, hashed, short-lived and single-use.
- Auth and tutor routes are rate limited.
- Mutating requests check the browser Origin when supplied.
- Helmet is enabled.
- Request JSON bodies are size-limited.
- Zod validates authentication, tutor and notes inputs.
- The browser practice lab does not execute arbitrary Python/Node code on the server.
- JavaScript/HTML preview uses a sandboxed iframe.
- Do not add `child_process`, `eval`, `exec`, or server-side execution of untrusted student code.
- Production deployments should use HTTPS, real SMTP, secure secrets, a reverse proxy and an isolated code-execution service if server-side execution is ever added.
