# Learny 2.0 Verification Checklist

## Runtime
- [x] Node 22.23.2 recommended via `.nvmrc`
- [x] Vite client pinned to 7.1.3
- [x] Client proxy explicitly targets `127.0.0.1:4000`
- [x] Express explicitly listens on `127.0.0.1:4000`
- [x] Root dev launcher uses Node's built-in child_process API
- [x] Favicon included

## Authentication
- [x] Username/email login
- [x] bcrypt password hashing
- [x] HttpOnly session cookies
- [x] Email verification tokens
- [x] Development verification link when SMTP is not configured
- [x] Resend verification route
- [x] Password reset
- [x] Optional Google OAuth
- [x] Rate limiting and validation

## AI Tutor
- [x] Gemini server-side API key
- [x] `gemini-3.6-flash` default
- [x] Upstream Gemini status/message exposed on failures
- [x] Explain, summarize, notes, quiz, code generation and code review actions
- [x] Voice input when supported by browser
- [x] Browser speech output
- [x] AI responses can be saved as notes

## Learning tools
- [x] Personal notes CRUD
- [x] AI note maker
- [x] Course/lesson progress
- [x] Bookmarks
- [x] Practice challenges
- [x] Resizable editor/terminal split
- [x] Desktop sidebar collapse and mobile navigation drawer
- [x] Sandboxed JavaScript/HTML practice
- [x] Python/Node server execution disabled for safety
