import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'learny.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 auth_provider TEXT NOT NULL DEFAULT 'password',
 google_id TEXT UNIQUE,
 email_verified INTEGER NOT NULL DEFAULT 0,
 display_name TEXT NOT NULL,
 avatar_color TEXT NOT NULL DEFAULT '#7c3aed',
 xp INTEGER NOT NULL DEFAULT 0,
 streak INTEGER NOT NULL DEFAULT 0,
 theme TEXT NOT NULL DEFAULT 'dark',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 slug TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 level TEXT NOT NULL,
 icon TEXT NOT NULL,
 accent TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 slug TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 summary TEXT NOT NULL,
 content TEXT NOT NULL,
 order_no INTEGER NOT NULL,
 xp INTEGER NOT NULL DEFAULT 20,
 level TEXT NOT NULL DEFAULT 'Beginner',
 objectives TEXT NOT NULL DEFAULT '',
 example TEXT NOT NULL DEFAULT '',
 practice_prompt TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 completed INTEGER NOT NULL DEFAULT 0,
 bookmarked INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS challenges (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 starter_code TEXT NOT NULL,
 expected TEXT NOT NULL,
 difficulty TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_attempts (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
 solved INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id, challenge_id)
);
CREATE TABLE IF NOT EXISTS activity (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL,
 label TEXT NOT NULL,
 xp INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tutor_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tutor_events_user_time ON tutor_events(user_id, id DESC);
CREATE TABLE IF NOT EXISTS notes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'manual',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_user_time ON notes(user_id, updated_at DESC);
`)

function addColumnIfMissing(table, column, definition) {
 const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
 if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing('users', 'auth_provider', "TEXT NOT NULL DEFAULT 'password'");
addColumnIfMissing('users', 'google_id', "TEXT");
addColumnIfMissing('users', 'email_verified', "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing('lessons', 'level', "TEXT NOT NULL DEFAULT 'Beginner'");
addColumnIfMissing('lessons', 'objectives', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('lessons', 'example', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('lessons', 'practice_prompt', "TEXT NOT NULL DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS auth_tokens (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 type TEXT NOT NULL CHECK(type IN ('session','verify_email','reset_password')),
 expires_at TEXT NOT NULL,
 used_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id,type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON auth_tokens(expires_at);
`);
;

const courseCount = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
if (courseCount === 0) seed();
enrichCatalog();

function seed() {
 const courses = [
  ['javascript','JavaScript','Build a strong JS foundation with practical examples.','Beginner','JS','#f59e0b'],
  ['html','HTML','Structure real web pages with semantic HTML.','Beginner','HTML','#ef4444'],
  ['css','CSS','Style responsive interfaces from the ground up.','Beginner','CSS','#3b82f6'],
  ['python','Python','Learn Python syntax, data structures and problem solving.','Beginner','PY','#22c55e'],
  ['nodejs','Node.js','Understand backend JavaScript and APIs.','Beginner','ND','#8b5cf6'],
  ['web-fundamentals','Web Fundamentals','HTTP, browsers, APIs and developer workflow.','Beginner','WEB','#06b6d4']
 ];
 const insertCourse = db.prepare('INSERT INTO courses(slug,title,description,level,icon,accent) VALUES(?,?,?,?,?,?)');
 const courseIds = {};
 for (const c of courses) courseIds[c[0]] = insertCourse.run(...c).lastInsertRowid;
 const lessonRows = [
  ['javascript','js-variables','Variables & Data Types','Learn let, const, primitives and type checks.','Use `const` by default, `let` when reassignment is required. JavaScript has primitive values such as string, number, boolean, null, undefined, bigint and symbol.','1',25],
  ['javascript','js-functions','Functions & Arrow Functions','Write reusable logic with classic and arrow functions.','Functions package reusable behavior. Arrow functions provide a compact syntax and lexical `this`.','2',25],
  ['javascript','js-arrays','Arrays: map, filter & reduce','Transform collections with the methods used constantly in real projects.','`map` transforms every item, `filter` keeps matching items, and `reduce` combines items into one result.','3',30],
  ['javascript','js-async','Promises & async/await','Handle asynchronous work without callback chaos.','A Promise represents a future result. `async/await` makes Promise-based code easier to read while retaining asynchronous behavior.','4',30],
  ['html','html-structure','HTML Page Structure','Build a semantic page using headings, sections and links.','Use semantic elements such as `header`, `nav`, `main`, `section`, `article` and `footer` to describe page structure.','1',20],
  ['html','html-forms','Forms & Accessibility','Create useful, accessible form controls.','Associate labels with inputs, choose appropriate input types, and provide meaningful button text.','2',25],
  ['css','css-box','The Box Model','Understand content, padding, border and margin.','Every element is laid out as a box. `box-sizing: border-box` makes sizing more predictable.','1',20],
  ['css','css-flex','Flexbox & Responsive Layout','Build layouts that adapt to screen width.','Flexbox aligns items along a main and cross axis. Combine it with fluid widths and media queries for responsive UI.','2',25],
  ['python','py-basics','Python Basics','Variables, conditionals and loops.','Python uses indentation for blocks. Learn names, values, conditions and iteration before moving to functions and data structures.','1',25],
  ['python','py-collections','Lists & Dictionaries','Work with Python’s everyday collections.','Lists are ordered collections; dictionaries map keys to values. Both are central to practical Python.','2',25],
  ['nodejs','node-http','Node.js & HTTP','Understand servers, requests and responses.','Node.js runs JavaScript outside the browser. HTTP APIs receive requests and return structured responses such as JSON.','1',25],
  ['nodejs','node-security','Backend Security Basics','Learn why validation, authentication and safe execution matter.','Validate untrusted input, hash passwords, protect cookies, rate-limit sensitive routes and never execute arbitrary user code directly on your server.','2',35],
  ['web-fundamentals','web-http','HTTP Essentials','Requests, responses, methods and status codes.','GET reads data, POST creates or triggers actions, PUT/PATCH updates, DELETE removes. Status codes communicate outcome.','1',20],
  ['web-fundamentals','web-api','APIs & JSON','Connect frontends to backend services.','A JSON API commonly returns objects/arrays and uses HTTP status codes to communicate success or failure.','2',25]
 ];
 const insertLesson = db.prepare('INSERT INTO lessons(course_id,slug,title,summary,content,order_no,xp) VALUES(?,?,?,?,?,?,?)');
 for (const r of lessonRows) insertLesson.run(courseIds[r[0]], ...r.slice(1));
 const challenges = [
  ['javascript','Sum an Array','Return the sum of all numbers in an array.','const numbers = [2, 4, 6, 8];\n\nfunction sumArray(arr) {\n  // your code\n}\n\nconsole.log(sumArray(numbers));','20','Easy'],
  ['javascript','Count Vowels','Count vowels in a string.','function countVowels(text) {\n  // your code\n}\n\nconsole.log(countVowels("Learn JavaScript"));','5','Easy'],
  ['html','Semantic Card','Create a card using semantic HTML and a heading.','<article>\n  <!-- build your card -->\n</article>','semantic article','Easy'],
  ['css','Responsive Stack','Make three cards stack on small screens.','/* write responsive CSS */\n.card-list { }','media query','Medium']
 ];
 const insertChallenge = db.prepare('INSERT INTO challenges(course_id,title,description,starter_code,expected,difficulty) VALUES(?,?,?,?,?,?)');
 for (const c of challenges) insertChallenge.run(courseIds[c[0]], ...c.slice(1));
}

function enrichCatalog() {
 const insertCourse = db.prepare('INSERT OR IGNORE INTO courses(slug,title,description,level,icon,accent) VALUES(?,?,?,?,?,?)');
 const courses = [
  ['typescript','TypeScript','Make JavaScript safer with types, interfaces and reusable contracts.','Moderate','TS','#3178c6'],
  ['react','React','Build interactive component-based user interfaces.','Moderate','R','#61dafb'],
  ['sql','SQL & Databases','Query, model and protect data with practical SQL.','Beginner','SQL','#22d3ee'],
  ['git','Git & GitHub','Collaborate confidently with version control and GitHub workflows.','Beginner','GIT','#f97316'],
  ['ai-engineering','AI & AI Tools','Use AI assistants, prompting, APIs and responsible AI workflows.','Beginner','AI','#ec4899']
 ];
 for (const course of courses) insertCourse.run(...course);
 const courseIds = Object.fromEntries(db.prepare('SELECT slug,id FROM courses').all().map(row => [row.slug, row.id]));
 const updateLesson = db.prepare(`UPDATE lessons SET level=?,objectives=?,example=?,practice_prompt=? WHERE slug=?`);
 const enriched = [
  ['Beginner','Declare predictable values, inspect types and avoid accidental reassignment.','const learner = { name: "Maya", lessons: 3 };\nconsole.log(learner.name);','Create a learner object with your name and completed lesson count, then print both values.','js-variables'],
  ['Beginner','Turn repeated logic into named, testable functions.','function greet(name) {\n  return \`Hello, \${name}!\`;\n}\nconsole.log(greet("Maya"));','Write a function that accepts a topic and returns a sentence saying you are learning it.','js-functions'],
  ['Moderate','Choose the right collection method and chain transformations clearly.','const scores = [72, 91, 64];\nconst passed = scores.filter(score => score >= 70).map(score => score + 5);','Use filter and map to add 10 points only to scores that are at least 70.','js-arrays'],
  ['Moderate','Model asynchronous work and handle failures explicitly.','async function loadProfile() {\n  const response = await fetch("/api/profile");\n  return response.json();\n}','Describe what should happen when an async request fails, then ask AI Tutor for a robust error-handling example.','js-async'],
  ['Beginner','Use semantic elements to give a page meaningful structure.','<main>\n  <h1>My learning plan</h1>\n  <section><h2>Today</h2></section>\n</main>','Build a semantic article with a heading, paragraph and link. Preview it in Practice Lab.','html-structure'],
  ['Beginner','Connect labels, controls and helpful validation messages.','<label for="email">Email</label>\n<input id="email" type="email" required>','Add a name field and a submit button to an accessible form.','html-forms'],
  ['Beginner','Predict dimensions by combining content, padding, border and margin.','* { box-sizing: border-box; }\n.card { padding: 16px; border: 1px solid; }','Create a card with padding, a border and a fixed max-width.','css-box'],
  ['Moderate','Align components and make layouts adapt to smaller screens.','.cards { display: flex; gap: 16px; }\n@media (max-width: 600px) { .cards { flex-direction: column; } }','Write a media query that changes a row of cards into a column below 700px.','css-flex'],
  ['Beginner','Use variables, conditions and loops to solve small problems.','name = "Maya"\nfor lesson in ["HTML", "CSS"]:\n    print(name, "is learning", lesson)','Write a loop that prints each topic in your own learning plan.','py-basics'],
  ['Moderate','Select and update nested data with lists and dictionaries.','learner = {"name": "Maya", "skills": ["HTML", "CSS"]}\nlearner["skills"].append("Python")','Add a new skill to a dictionary and print the complete skills list.','py-collections'],
  ['Beginner','Understand request methods, routes, status codes and JSON responses.','app.get("/api/health", (_req, res) => res.json({ ok: true }));','Design a GET endpoint that returns a list of lesson titles.','node-http'],
  ['Advanced','Protect backend boundaries with validation, auth and safe defaults.','const parsed = schema.safeParse(req.body);\nif (!parsed.success) return res.status(400).json({ error: "Invalid input" });','List three untrusted inputs your app receives and how you would validate each one.','node-security'],
  ['Beginner','Create type annotations that document and check JavaScript data.','type Lesson = { title: string; xp: number };\nconst lesson: Lesson = { title: "Types", xp: 20 };','Define a type for a practice challenge with a title, difficulty and solved flag.','ts-types'],
  ['Moderate','Compose typed components and props that are easy to refactor.','type GreetingProps = { name: string };\nfunction Greeting({ name }: GreetingProps) { return <h1>Hello {name}</h1>; }','Design props for a reusable lesson card and explain which fields are required.','ts-react'],
  ['Beginner','Think in components, props and state when building interfaces.','function Welcome({ name }) { return <h1>Welcome, {name}</h1>; }','Sketch three components for a lesson page and describe the data each receives.','react-components'],
  ['Moderate','Update state immutably and respond to user events.','const [done, setDone] = useState(false);\n<button onClick={() => setDone(true)}>Complete</button>','Describe the state needed for a practice editor with code, output and status.','react-state'],
  ['Beginner','Read rows with filters, ordering and clear conditions.','SELECT title, level FROM lessons WHERE level = "Beginner" ORDER BY title;','Write a query that returns completed lessons for one learner, newest first.','sql-select'],
  ['Moderate','Combine related tables without losing the relationships between them.','SELECT c.title, COUNT(l.id) AS lessons\nFROM courses c LEFT JOIN lessons l ON l.course_id = c.id\nGROUP BY c.id;','Write a join that shows each course and its number of lessons.','sql-joins'],
  ['Beginner','Create small, reviewable commits and move safely between branches.','git switch -c feature/lesson-practice\ngit add .\ngit commit -m "Add lesson practice"','Plan the three commits you would make for a new lesson feature.','git-workflow'],
  ['Moderate','Use pull requests, reviews and conflict resolution to collaborate.','git fetch origin\ngit rebase origin/main','Explain when you would use a pull request instead of pushing directly to main.','git-collaboration'],
  ['Beginner','Write precise prompts that specify role, context, constraints and output.','Role: patient tutor\nContext: I am learning map()\nTask: explain with one example\nFormat: bullets + practice task','Rewrite a vague prompt into a structured prompt for learning an unfamiliar API.','ai-prompting'],
  ['Moderate','Use AI tools to learn faster while checking outputs and protecting data.','const answer = await tutor.ask({ topic, level: "beginner", includePractice: true });','Create a checklist for verifying an AI-generated code answer before using it.','ai-tools'],
  ['Advanced','Design reliable AI features with evaluation, privacy and fallback behavior.','const result = await callAI({ system, message });\nif (!result.answer) throw new Error("Empty AI response");','Describe one metric for evaluating an AI tutor and one privacy boundary it must respect.','ai-apps']
 ];
 for (const [level, objectives, example, practicePrompt, slug] of enriched) updateLesson.run(level, objectives, example, practicePrompt, slug);
 const insertLesson = db.prepare('INSERT OR IGNORE INTO lessons(course_id,slug,title,summary,content,order_no,xp,level,objectives,example,practice_prompt) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 const newLessons = [
  ['typescript','ts-types','Types, Interfaces & Unions','Describe JavaScript data with expressive TypeScript types.','Types catch mismatches before runtime and make editor tooling more useful. Start with primitives, object types and unions.','1',30,'Beginner','Declare predictable values and model small objects.','type User = { name: string; active: boolean };','Define a User type and create one valid user.'],
  ['typescript','ts-react','Typed React Props','Make component contracts clear and refactor-friendly.','Typed props document what a component needs and prevent many UI bugs before the browser runs.','2',35,'Moderate','Type props and optional values.','type Props = { title: string; done?: boolean };','Design props for a lesson card.'],
  ['react','react-components','Components & Props','Compose a page from focused, reusable components.','React components receive data through props and return UI. Keep each component responsible for one clear concern.','1',30,'Beginner','Split a page into components and pass data down.','function LessonTitle({ title }) { return <h1>{title}</h1>; }','Sketch the components for a lesson page.'],
  ['react','react-state','State & Events','Make interfaces respond to learner actions.','State represents values that change over time. Update it in response to events rather than mutating it directly.','2',35,'Moderate','Model state and event handlers.','const [done, setDone] = useState(false);','List the state needed for a practice editor.'],
  ['sql','sql-select','SELECT, WHERE & ORDER BY','Read exactly the rows and columns you need.','SQL statements become easier to reason about when filtering and ordering are explicit.','1',25,'Beginner','Filter, select and order rows.','SELECT title FROM lessons WHERE level = "Beginner" ORDER BY title;','Query beginner lessons alphabetically.'],
  ['sql','sql-joins','Joins & Aggregates','Combine related records and calculate useful totals.','Joins connect normalized tables; GROUP BY and COUNT turn rows into progress summaries.','2',35,'Moderate','Join tables and aggregate results.','SELECT c.title, COUNT(l.id) FROM courses c LEFT JOIN lessons l ON l.course_id = c.id GROUP BY c.id;','Count lessons in every course.'],
  ['git','git-workflow','Everyday Git Workflow','Create focused commits and branches.','A clean history makes collaboration and debugging easier. Branch for a change, commit one idea, and write a useful message.','1',25,'Beginner','Branch, stage, commit and inspect changes.','git switch -c feature/practice\ngit add .\ngit commit -m "Add practice flow"','Plan three focused commits for a lesson feature.'],
  ['git','git-collaboration','Pull Requests & Reviews','Collaborate through reviewable changes.','Pull requests create a place to discuss tests, trade-offs and safer merges before code reaches the main branch.','2',30,'Moderate','Explain review and conflict workflows.','git fetch origin\ngit rebase origin/main','Explain when a pull request is safer than a direct push.'],
  ['ai-engineering','ai-prompting','Prompting for Learning','Turn vague questions into useful tutor requests.','Good prompts include your level, context, desired output and constraints. Ask for an example and a practice task, not only an answer.','1',25,'Beginner','Write prompts with role, context, task and format.','Role: patient tutor\nTask: explain closures\nFormat: example + practice','Rewrite a vague API question as a structured prompt.'],
  ['ai-engineering','ai-tools','AI Tools & Responsible Use','Use AI coding tools without outsourcing your judgment.','AI can explain, draft, test and review. You still need to verify claims, run code, protect secrets and understand the result.','2',30,'Moderate','Choose the right AI tool and verify its output.','Ask for a small change, inspect the diff, run tests, then refine.','Create a checklist for checking an AI-generated answer.'],
  ['ai-engineering','ai-apps','Building AI Features','Add reliable AI behavior to real applications.','Production AI features need clear system instructions, input limits, privacy boundaries, timeouts, error handling and evaluation.','3',40,'Advanced','Design safe, observable AI workflows.','const result = await callAI({ system, message });','Name an evaluation metric and a privacy boundary for an AI tutor.']
 ];
 for (const row of newLessons) insertLesson.run(courseIds[row[0]], ...row.slice(1));
}

export default db;
