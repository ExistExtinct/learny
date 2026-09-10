import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import {
 hashPassword, verifyPassword, createSession, createEmailVerificationToken,
 createPasswordResetToken, setAuthCookie, clearAuthCookie, authRequired,
 consumeToken, markTokenUsed, revokeUserSessions, safeAuthUser, randomToken
} from './auth.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials:true }));
app.use(express.json({ limit:'100kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs:15*60*1000, limit:300, standardHeaders:true, legacyHeaders:false }));
const authLimiter = rateLimit({ windowMs:15*60*1000, limit:30, message:{error:'Too many authentication attempts. Try again later.'} });
const tutorLimiter = rateLimit({ windowMs:60*1000, limit:20, message:{error:'Tutor rate limit reached. Please wait a minute.'} });

const registerSchema = z.object({ username:z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/), email:z.string().trim().email().max(160), password:z.string().min(8).max(72), displayName:z.string().trim().min(2).max(50) });
const loginSchema = z.object({ identifier:z.string().trim().min(3).max(160), password:z.string().min(1).max(72) });
const themeSchema = z.object({ theme:z.enum(['dark','light','system']) });

const safeUser = safeAuthUser;
function frontendOrigin() { return process.env.CLIENT_ORIGIN || 'http://localhost:5173'; }
function smtpReady() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS); }
function mailer() { return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}); }
async function sendMail(to, subject, text) {
 if(!smtpReady()) return false;
 try {
  await mailer().sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to,subject,text});
  return true;
 } catch(e) {
  console.error('Email delivery failed', e);
  throw new Error('Email delivery failed. Check the SMTP configuration and server logs.');
 }
}
function requireSameOrigin(req,res,next) { const origin=req.get('origin'); if(origin && origin !== frontendOrigin()) return res.status(403).json({error:'Cross-site request blocked'}); next(); }
function cleanupAuthTokens(){ db.prepare("DELETE FROM auth_tokens WHERE expires_at <= CURRENT_TIMESTAMP OR used_at IS NOT NULL").run(); }
setInterval(cleanupAuthTokens, 60*60*1000).unref();
function logActivity(userId,type,label,xp=0) { db.prepare('INSERT INTO activity(user_id,type,label,xp) VALUES(?,?,?,?)').run(userId,type,label,xp); }

app.get('/api/health', (_req,res)=>res.json({ok:true,service:'Learny API',geminiConfigured:Boolean(process.env.GEMINI_API_KEY),geminiModel:process.env.GEMINI_MODEL||'gemini-3.6-flash',emailConfigured:smtpReady()}));
app.post('/api/auth/register', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=registerSchema.safeParse(req.body);
 if(!parsed.success) return res.status(400).json({error:'Use a valid username, email, display name and an 8–72 character password.'});
 const {username,email,password,displayName}=parsed.data;
 if(process.env.EMAIL_VERIFICATION_REQUIRED === 'true' && isProd && !smtpReady()) return res.status(503).json({error:'Email verification is enabled but SMTP is not configured.'});
 try {
  const exists=db.prepare('SELECT id,username,email FROM users WHERE username=? OR email=?').get(username,email);
  if(exists) return res.status(409).json({error:'Username or email is already registered'});
  const passwordHash=await hashPassword(password);
  const verified = process.env.EMAIL_VERIFICATION_REQUIRED === 'true' ? 0 : 1;
  const userId=db.prepare('INSERT INTO users(username,email,password_hash,display_name,email_verified) VALUES(?,?,?,?,?)')
    .run(username,email,passwordHash,displayName,verified).lastInsertRowid;
  const row=db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  logActivity(row.id,'welcome','Joined Learny',0);
  if(!verified){
   const token=createEmailVerificationToken(row.id);
   const link=`${frontendOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
   let sent=false;
   try { sent=await sendMail(row.email,'Verify your Learny email',`Welcome to Learny!\n\nVerify your email:\n${link}\n\nThis link expires in 24 hours.`); }
   catch(e) { if(isProd) return res.status(503).json({error:e.message}); }
   if(!sent && isProd) return res.status(503).json({error:'Email delivery is not configured. Please contact the administrator.'});
   if(!sent) return res.status(201).json({requiresVerification:true,devVerificationUrl:link});
   return res.status(201).json({requiresVerification:true});
  }
  const session=createSession(row.id); setAuthCookie(res,session);
  res.status(201).json({user:safeUser(row)});
 } catch(e) { console.error('Register error',e); res.status(500).json({error:'Could not create account'}); }
});
app.post('/api/auth/login', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=loginSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid login details'});
 const row=db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE').get(parsed.data.identifier,parsed.data.identifier);
 if(!row || !(await verifyPassword(parsed.data.password,row.password_hash))) return res.status(401).json({error:'Invalid username/email or password'});
 if(!row.email_verified && process.env.EMAIL_VERIFICATION_REQUIRED === 'true') return res.status(403).json({error:'Please verify your email before signing in.'});
 const session=createSession(row.id); setAuthCookie(res,session); res.json({user:safeUser(row)});
});
app.post('/api/auth/logout', requireSameOrigin, (req,res)=>{
 const raw=req.cookies.learny_session; const session=consumeToken(raw,'session'); if(session) markTokenUsed(session.id);
 clearAuthCookie(res); res.json({ok:true});
});
app.get('/api/auth/me', authRequired, (req,res)=>res.json({user:safeUser(req.user)}));

app.post('/api/auth/verify-email', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=z.object({token:z.string().min(20).max(300)}).safeParse(req.body);
 if(!parsed.success) return res.status(400).json({error:'Invalid verification token'});
 const row=consumeToken(parsed.data.token,'verify_email');
 if(!row) return res.status(400).json({error:'Verification link is invalid or expired.'});
 db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(row.user_id); markTokenUsed(row.id);
 const user=db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
 setAuthCookie(res,createSession(user.id)); res.json({user:safeUser(user)});
});
app.post('/api/auth/resend-verification', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=z.object({email:z.string().trim().email().max(160)}).safeParse(req.body);
 if(!parsed.success) return res.status(400).json({error:'Enter a valid email address'});
 const user=db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(parsed.data.email);
 if(user && !user.email_verified){
  db.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND type='verify_email' AND used_at IS NULL").run(user.id);
  const token=createEmailVerificationToken(user.id);
  const link=`${frontendOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
  let sent=false;
  try { sent=await sendMail(user.email,'Verify your Learny email',`Verify your email:\n${link}\n\nThis link expires in 24 hours.`); }
  catch(e) { if(isProd) return res.status(503).json({error:e.message}); }
  if(!sent) return res.json({ok:true,devVerificationUrl:link,message:'SMTP is not configured. Use the development verification link.'});
 }
 res.json({ok:true,message:'If that account needs verification, a new email has been sent.'});
});
app.post('/api/auth/forgot-password', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=z.object({email:z.string().trim().email().max(160)}).safeParse(req.body);
 if(!parsed.success) return res.status(400).json({error:'Enter a valid email address'});
 const user=db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(parsed.data.email);
 if(user){
  db.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND type='reset_password' AND used_at IS NULL").run(user.id);
  const token=createPasswordResetToken(user.id);
  const link=`${frontendOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  const sent=await sendMail(user.email,'Reset your Learny password',`Reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`);
  if(!sent && isProd) return res.status(503).json({error:'Password reset email is not configured.'});
  if(!sent && !isProd) return res.json({ok:true,devResetUrl:link});
 }
 res.json({ok:true,message:'If an account exists for that email, reset instructions have been sent.'});
});
app.post('/api/auth/reset-password', authLimiter, requireSameOrigin, async (req,res)=>{
 const parsed=z.object({token:z.string().min(20).max(300),password:z.string().min(8).max(72)}).safeParse(req.body);
 if(!parsed.success) return res.status(400).json({error:'Password must be 8–72 characters.'});
 const row=consumeToken(parsed.data.token,'reset_password');
 if(!row) return res.status(400).json({error:'Reset link is invalid or expired.'});
 const passwordHash=await hashPassword(parsed.data.password);
 db.prepare('UPDATE users SET password_hash=?,email_verified=1 WHERE id=?').run(passwordHash,row.user_id);
 markTokenUsed(row.id); revokeUserSessions(row.user_id);
 const user=db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
 setAuthCookie(res,createSession(user.id)); res.json({user:safeUser(user)});
});

app.get('/api/auth/google', authLimiter, (req,res)=>{
 const clientId=process.env.GOOGLE_CLIENT_ID;
 const redirectUri=process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
 if(!clientId || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google sign-in is not configured.');
 const state=randomToken(24);
 res.cookie('google_oauth_state',state,{...{httpOnly:true,sameSite:'lax',secure:isProd,path:'/'},maxAge:10*60*1000});
 const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 u.searchParams.set('client_id',clientId); u.searchParams.set('redirect_uri',redirectUri);
 u.searchParams.set('response_type','code'); u.searchParams.set('scope','openid email profile');
 u.searchParams.set('state',state); u.searchParams.set('prompt','select_account');
 res.redirect(u.toString());
});
app.get('/api/auth/google/callback', async (req,res)=>{
 try {
  const {code,state}=req.query; const expected=req.cookies.google_oauth_state;
  res.clearCookie('google_oauth_state',{httpOnly:true,sameSite:'lax',secure:isProd,path:'/'});
  if(!code || !state || !expected || state !== expected) return res.redirect(`${frontendOrigin()}/login?error=google_state`);
  const redirectUri=process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})});
  const tokens=await tokenResponse.json(); if(!tokenResponse.ok) throw new Error('Google token exchange failed');
  const infoResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
  const info=await infoResponse.json(); if(!infoResponse.ok || !info.sub || !info.email || info.email_verified !== true) throw new Error('Google profile lookup failed');
  let user=db.prepare('SELECT * FROM users WHERE google_id=? OR email=? COLLATE NOCASE').get(info.sub,info.email);
  if(user){
   db.prepare('UPDATE users SET google_id=?,auth_provider=CASE WHEN auth_provider=\"password\" THEN \"google\" ELSE auth_provider END,email_verified=1,display_name=? WHERE id=?').run(info.sub,info.name||user.display_name,user.id);
   user=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  } else {
   const base=(info.email.split('@')[0]||'learner').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,20)||'learner';
   let username=base, n=0;
   while(db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username)) username=`${base}_${++n}`;
   const randomPassword=await hashPassword(randomToken(32));
   const userId=db.prepare('INSERT INTO users(username,email,password_hash,auth_provider,google_id,email_verified,display_name) VALUES(?,?,?,?,?,?,?)')
     .run(username,info.email,randomPassword,'google',info.sub,1,info.name||username).lastInsertRowid;
   user=db.prepare('SELECT * FROM users WHERE id=?').get(userId); logActivity(user.id,'welcome','Joined Learny with Google',0);
  }
  setAuthCookie(res,createSession(user.id)); res.redirect(`${frontendOrigin()}/`);
 } catch(e){ console.error('Google OAuth error',e); res.redirect(`${frontendOrigin()}/login?error=google_failed`); }
});
app.get('/api/dashboard', authRequired, (req,res)=>{
 const user=req.user; const total=db.prepare('SELECT COUNT(*) c FROM lessons').get().c; const done=db.prepare('SELECT COUNT(*) c FROM progress WHERE user_id=? AND completed=1').get(user.id).c;
 const courses=db.prepare(`SELECT c.*, COUNT(l.id) lessons, SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END) completed FROM courses c LEFT JOIN lessons l ON l.course_id=c.id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? GROUP BY c.id ORDER BY c.id`).all(user.id);
 const activity=db.prepare('SELECT type,label,xp,created_at createdAt FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 8').all(user.id);
 const next=db.prepare(`SELECT l.*, c.slug courseSlug, c.title courseTitle FROM lessons l JOIN courses c ON c.id=l.course_id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? WHERE COALESCE(p.completed,0)=0 ORDER BY c.id,l.order_no LIMIT 1`).get(user.id);
 res.json({user:safeUser(user),stats:{totalLessons:total,completedLessons:done,progress:total?Math.round(done/total*100):0},courses,activity,next});
});

app.get('/api/courses', authRequired, (req,res)=>{ const courses=db.prepare(`SELECT c.*,COUNT(l.id) lessons,SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END) completed FROM courses c LEFT JOIN lessons l ON l.course_id=c.id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? GROUP BY c.id ORDER BY c.id`).all(req.user.id); res.json({courses}); });
app.get('/api/courses/:slug', authRequired, (req,res)=>{
 const c=db.prepare('SELECT * FROM courses WHERE slug=?').get(req.params.slug); if(!c) return res.status(404).json({error:'Course not found'});
 const lessons=db.prepare(`SELECT l.id,l.slug,l.title,l.summary,l.level,l.objectives,l.example,l.practice_prompt practicePrompt,l.order_no orderNo,l.xp,COALESCE(p.completed,0) completed,COALESCE(p.bookmarked,0) bookmarked FROM lessons l LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? WHERE l.course_id=? ORDER BY l.order_no`).all(req.user.id,c.id);
 res.json({course:c,lessons});
});
app.get('/api/lessons/:slug', authRequired, (req,res)=>{
 const l=db.prepare(`SELECT l.*,l.practice_prompt practicePrompt,c.slug courseSlug,c.title courseTitle,COALESCE(p.completed,0) completed,COALESCE(p.bookmarked,0) bookmarked FROM lessons l JOIN courses c ON c.id=l.course_id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? WHERE l.slug=?`).get(req.user.id,req.params.slug);
 if(!l) return res.status(404).json({error:'Lesson not found'}); res.json({lesson:l});
});
app.post('/api/lessons/:id/progress', authRequired, (req,res)=>{
 const id=Number(req.params.id); if(!Number.isInteger(id)) return res.status(400).json({error:'Invalid lesson'});
 const lesson=db.prepare('SELECT * FROM lessons WHERE id=?').get(id); if(!lesson) return res.status(404).json({error:'Lesson not found'});
 const current=db.prepare('SELECT completed FROM progress WHERE user_id=? AND lesson_id=?').get(req.user.id,id);
 db.prepare(`INSERT INTO progress(user_id,lesson_id,completed,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=1,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,id);
 if(!current?.completed){ db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(lesson.xp,req.user.id); logActivity(req.user.id,'lesson',`Completed ${lesson.title}`,lesson.xp); }
 res.json({ok:true});
});
app.post('/api/lessons/:id/bookmark', authRequired, (req,res)=>{
 const id=Number(req.params.id); const lesson=db.prepare('SELECT id FROM lessons WHERE id=?').get(id); if(!lesson) return res.status(404).json({error:'Lesson not found'});
 const existing=db.prepare('SELECT bookmarked FROM progress WHERE user_id=? AND lesson_id=?').get(req.user.id,id); const next=existing?.bookmarked?0:1;
 db.prepare(`INSERT INTO progress(user_id,lesson_id,bookmarked) VALUES(?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET bookmarked=excluded.bookmarked,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,id,next); res.json({bookmarked:Boolean(next)});
});
app.get('/api/practice', authRequired, (req,res)=>{
 const rows=db.prepare(`SELECT ch.*,c.slug courseSlug,c.title courseTitle,COALESCE(a.solved,0) solved,COALESCE(a.attempts,0) attempts FROM challenges ch JOIN courses c ON c.id=ch.course_id LEFT JOIN challenge_attempts a ON a.challenge_id=ch.id AND a.user_id=? ORDER BY ch.id`).all(req.user.id); res.json({challenges:rows});
});
app.post('/api/practice/:id/attempt', authRequired, (req,res)=>{
 const id=Number(req.params.id); const challenge=db.prepare('SELECT * FROM challenges WHERE id=?').get(id); if(!challenge) return res.status(404).json({error:'Challenge not found'});
 const parsed=z.object({solved:z.boolean().optional().default(false)}).safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid result'});
 const old=db.prepare('SELECT attempts,solved FROM challenge_attempts WHERE user_id=? AND challenge_id=?').get(req.user.id,id); const solved=Boolean(parsed.data.solved); const attempts=(old?.attempts||0)+1;
 db.prepare(`INSERT INTO challenge_attempts(user_id,challenge_id,solved,attempts,updated_at) VALUES(?,?,?, ?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,challenge_id) DO UPDATE SET solved=MAX(solved,excluded.solved),attempts=excluded.attempts,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,id,solved?1:0,attempts);
 if(solved && !old?.solved){db.prepare('UPDATE users SET xp=xp+30 WHERE id=?').run(req.user.id); logActivity(req.user.id,'practice',`Solved ${challenge.title}`,30);}
 res.json({solved,attempts});
});

const tutorEventSchema = z.object({ eventType:z.enum(['session_start','session_end','editor_change','run','error','hint_request','page_view']), payload:z.record(z.string(), z.any()).optional().default({}) });
const tutorAskSchema = z.object({ provider:z.enum(['gemini','openai']), mode:z.enum(['text','voice']), message:z.string().trim().min(1).max(4000), context:z.object({language:z.string().max(40).optional(),code:z.string().max(20000).optional(),error:z.string().max(3000).optional(),page:z.string().max(120).optional()}).optional().default({}) });

app.post('/api/tutor/events', authRequired, tutorLimiter, (req,res)=>{
 const parsed=tutorEventSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid tutor event'});
 const payload=JSON.stringify(parsed.data.payload||{});
 db.prepare('INSERT INTO tutor_events(user_id,event_type,payload) VALUES(?,?,?)').run(req.user.id,parsed.data.eventType,payload);
 db.prepare("DELETE FROM tutor_events WHERE user_id=? AND id NOT IN (SELECT id FROM tutor_events WHERE user_id=? ORDER BY id DESC LIMIT 300)").run(req.user.id,req.user.id);
 res.status(204).end();
});
app.get('/api/tutor/overview', authRequired, (req,res)=>{
 const total=db.prepare('SELECT COUNT(*) c FROM lessons').get().c;
 const completed=db.prepare('SELECT COUNT(*) c FROM progress WHERE user_id=? AND completed=1').get(req.user.id).c;
 const challenges=db.prepare('SELECT COUNT(*) c FROM challenge_attempts WHERE user_id=?').get(req.user.id).c;
 const solved=db.prepare('SELECT COUNT(*) c FROM challenge_attempts WHERE user_id=? AND solved=1').get(req.user.id).c;
 const recent=db.prepare('SELECT event_type eventType,payload,created_at createdAt FROM tutor_events WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id).map(x=>({...x,payload:JSON.parse(x.payload)}));
 const courses=db.prepare(`SELECT c.title,COUNT(l.id) lessons,SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END) completed FROM courses c LEFT JOIN lessons l ON l.course_id=c.id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? GROUP BY c.id ORDER BY c.id`).all(req.user.id);
 res.json({user:safeUser(req.user),progress:{totalLessons:total,completedLessons:completed,percent:total?Math.round(completed/total*100):0,challenges,solved},courses,recent});
});
const tutorActionSchema=z.object({
 provider:z.enum(['gemini','openai']).default('gemini'),
 mode:z.enum(['text','voice']).default('text'),
 action:z.enum(['ask','explain','summarize','note','quiz','code','review']).default('ask'),
 message:z.string().trim().min(1).max(6000),
 context:z.record(z.string(),z.any()).optional().default({})
});

async function callAI({provider,system,message}){
 if(provider==='gemini'){
  const apiKey=process.env.GEMINI_API_KEY?.trim();
  if(!apiKey) throw Object.assign(new Error('Gemini is not configured. Add GEMINI_API_KEY to server/.env.'),{statusCode:503});
  const model=process.env.GEMINI_MODEL?.trim()||'gemini-3.6-flash';
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),30000);
  let r;
  try{
   r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:message}]}],generationConfig:{temperature:.2,maxOutputTokens:1200}}),signal:controller.signal});
  }catch(e){
   if(e?.name==='AbortError') throw Object.assign(new Error('Gemini request timed out after 30 seconds.'),{statusCode:504});
   throw e;
  }finally{clearTimeout(timer)}
  const raw=await r.text(); let d={}; try{d=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok){
   console.error('[Gemini]',r.status,model,d?.error||raw);
   throw Object.assign(new Error(d?.error?.message||`Gemini returned HTTP ${r.status}`),{statusCode:502,providerStatus:r.status,providerCode:d?.error?.status||null,model});
  }
  const answer=d?.candidates?.[0]?.content?.parts?.map(x=>x?.text||'').join('').trim();
  if(!answer) throw Object.assign(new Error('Gemini returned an empty response.'),{statusCode:502,model});
  return {answer,model};
 }
 if(!process.env.OPENAI_API_KEY) throw Object.assign(new Error('OpenAI is not configured. Add OPENAI_API_KEY to server/.env.'),{statusCode:503});
 const model=process.env.OPENAI_MODEL||'gpt-5-mini';
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model,instructions:system,input:message,max_output_tokens:1200})});
 const raw=await r.text(); let d={}; try{d=raw?JSON.parse(raw):{}}catch{}
 if(!r.ok) throw Object.assign(new Error(d?.error?.message||`OpenAI returned HTTP ${r.status}`),{statusCode:502,providerStatus:r.status,model});
 const answer=d?.output_text||d?.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('').trim();
 if(!answer) throw Object.assign(new Error('OpenAI returned an empty response.'),{statusCode:502,model});
 return {answer,model};
}

app.post('/api/tutor/ask', authRequired, tutorLimiter, async (req,res)=>{
 const parsed=tutorActionSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid tutor request',details:parsed.error.issues?.[0]?.message});
 const {provider,mode,action,message,context}=parsed.data;
 const overview=db.prepare('SELECT COUNT(*) total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) completed FROM progress WHERE user_id=?').get(req.user.id);
 const actionInstruction={
  ask:"Answer the student's question clearly with a practical example.",
  explain:'Explain the requested topic from beginner to practical level. Use a tiny example and a short recap.',
  summarize:'Summarize the supplied topic/content into clear study notes with headings and bullet points.',
  note:'Create a polished study note for the requested topic. Include definition, key ideas, example, common mistakes and a quick recap.',
  quiz:'Create a short test with 5 questions. Mix multiple-choice and short-answer questions. Put the answer key after the questions.',
  code:'Generate production-minded code for the requested task. State assumptions, include the code in a fenced block, and briefly explain how to use it.',
  review:'Review the supplied code or learning context. Identify real issues, explain why they occur, and show the smallest useful fix.'
 }[action];
 const system=`You are Learny AI Tutor, a patient coding and study mentor.
Student: ${req.user.display_name}.
Lesson progress: ${overview.completed||0}/${overview.total||0}.
Task: ${actionInstruction}
Never claim access to the device, camera, microphone, unrelated files or other apps. Only use the context supplied below. Be accurate, concise, and actionable.
Context: ${JSON.stringify(context||{})}`;
 try{
  const result=await callAI({provider,system,message});
  const answer=result.answer;
  db.prepare('INSERT INTO tutor_events(user_id,event_type,payload) VALUES(?,?,?)').run(req.user.id,'tutor_response',JSON.stringify({provider,mode,action,message,answer:answer.slice(0,6000)}));
  res.json({answer,provider,mode,action,model:result.model});
 }catch(e){
  console.error('Tutor provider error:',e);
  res.status(e?.statusCode||502).json({error:provider==='gemini'?'Gemini request failed':'AI provider request failed',details:e?.message||'Provider unavailable',providerStatus:e?.providerStatus||null,providerCode:e?.providerCode||null,model:e?.model||null});
 }
});

const noteSchema=z.object({title:z.string().trim().min(1).max(160),content:z.string().trim().min(1).max(30000),source:z.enum(['manual','ai']).default('manual')});
app.get('/api/notes',authRequired,(req,res)=>{res.json({notes:db.prepare('SELECT id,title,content,source,created_at createdAt,updated_at updatedAt FROM notes WHERE user_id=? ORDER BY updated_at DESC,id DESC').all(req.user.id)})});
app.post('/api/notes',authRequired,(req,res)=>{const p=noteSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid note'});const id=db.prepare('INSERT INTO notes(user_id,title,content,source) VALUES(?,?,?,?)').run(req.user.id,p.data.title,p.data.content,p.data.source).lastInsertRowid;res.status(201).json({note:db.prepare('SELECT id,title,content,source,created_at createdAt,updated_at updatedAt FROM notes WHERE id=?').get(id)})});
app.patch('/api/notes/:id',authRequired,(req,res)=>{const id=Number(req.params.id);const p=noteSchema.partial().safeParse(req.body);if(!Number.isInteger(id)||!p.success)return res.status(400).json({error:'Invalid note'});const old=db.prepare('SELECT * FROM notes WHERE id=? AND user_id=?').get(id,req.user.id);if(!old)return res.status(404).json({error:'Note not found'});db.prepare('UPDATE notes SET title=?,content=?,source=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(p.data.title??old.title,p.data.content??old.content,p.data.source??old.source,id,req.user.id);res.json({note:db.prepare('SELECT id,title,content,source,created_at createdAt,updated_at updatedAt FROM notes WHERE id=?').get(id)})});
app.delete('/api/notes/:id',authRequired,(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({error:'Invalid note'});db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(id,req.user.id);res.status(204).end()});

app.get('/api/profile', authRequired,(req,res)=>res.json({user:safeUser(req.user),bookmarks:db.prepare(`SELECT l.slug,l.title,c.title courseTitle FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN courses c ON c.id=l.course_id WHERE p.user_id=? AND p.bookmarked=1 ORDER BY p.updated_at DESC`).all(req.user.id)}));
app.patch('/api/settings', authRequired,(req,res)=>{
 const parsed=themeSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid setting'}); db.prepare('UPDATE users SET theme=? WHERE id=?').run(parsed.data.theme,req.user.id); const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); res.json({user:safeUser(u)});
});

const __filename=fileURLToPath(import.meta.url); const __dirname=path.dirname(__filename); const clientDist=path.join(__dirname,'../../client/dist');
if(isProd){ app.use(express.static(clientDist)); app.use((req,res,next)=>{if(req.path.startsWith('/api/')) return next(); res.sendFile(path.join(clientDist,'index.html'));}); }
app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({error:'Unexpected server error'}); });
const port=Number(process.env.PORT||4000); const host='127.0.0.1'; app.listen(port,host,()=>console.log(`Learny API listening on http://${host}:${port}`));
