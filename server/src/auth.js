import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from './db.js';

const SESSION_DAYS = 7;
const cookieBase = {
 httpOnly: true,
 sameSite: 'lax',
 secure: process.env.NODE_ENV === 'production',
 path: '/'
};

export function randomToken(bytes = 32) {
 return crypto.randomBytes(bytes).toString('base64url');
}
export function hashToken(token) {
 return crypto.createHash('sha256').update(token).digest('hex');
}
export function hashPassword(p) {
 return bcrypt.hash(p, 12);
}
export function verifyPassword(p, h) {
 return bcrypt.compare(p, h);
}
function expiry(days) {
 const d = new Date(Date.now() + days * 86400000);
 return d.toISOString().slice(0,19).replace('T',' ');
}
function issueToken(userId, type, days) {
 const raw = randomToken();
 db.prepare(`INSERT INTO auth_tokens(user_id,token_hash,type,expires_at) VALUES(?,?,?,?)`)
   .run(userId, hashToken(raw), type, expiry(days));
 return raw;
}
export function createSession(userId) { return issueToken(userId, 'session', SESSION_DAYS); }
export function createEmailVerificationToken(userId) { return issueToken(userId, 'verify_email', 24); }
export function createPasswordResetToken(userId) { return issueToken(userId, 'reset_password', 1); }

export function setAuthCookie(res, token) {
 res.cookie('learny_session', token, {...cookieBase, maxAge: SESSION_DAYS*86400000});
}
export function clearAuthCookie(res) {
 res.clearCookie('learny_session', cookieBase);
}
export function consumeToken(raw, type) {
 if (!raw) return null;
 const row = db.prepare(`
   SELECT * FROM auth_tokens
   WHERE token_hash=? AND type=? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
 `).get(hashToken(raw), type);
 return row || null;
}
export function markTokenUsed(id) {
 db.prepare('UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
}
export function revokeUserSessions(userId) {
 db.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND type='session' AND used_at IS NULL").run(userId);
}
export function authRequired(req,res,next) {
 try {
  const raw = req.cookies.learny_session;
  const token = consumeToken(raw, 'session');
  if (!token) return res.status(401).json({error:'Authentication required'});
  const user = db.prepare('SELECT id,username,email,display_name,avatar_color,xp,streak,theme,created_at,email_verified,auth_provider FROM users WHERE id=?').get(token.user_id);
  if (!user) return res.status(401).json({error:'Session is invalid'});
  req.user = user;
  req.sessionTokenId = token.id;
  next();
 } catch {
  return res.status(401).json({error:'Session is invalid or expired'});
 }
}
export function safeAuthUser(row) {
 return {
  id:row.id, username:row.username, email:row.email, displayName:row.display_name,
  avatarColor:row.avatar_color, xp:row.xp, streak:row.streak, theme:row.theme,
  createdAt:row.created_at, emailVerified:Boolean(row.email_verified),
  authProvider:row.auth_provider
 };
}
