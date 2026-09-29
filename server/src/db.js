import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ensureCurriculum, ensurePracticeCatalog } from './curriculum.js';

const { Pool, types } = pg;
types.setTypeParser(20, value => Number(value));
const tablesWithoutIdentity = new Set(['progress', 'challenge_attempts']);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000
});
pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));

export function postgresSql(sql) {
  let index = 0;
  const ignoreConflicts = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  let statement = sql
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\bCOLLATE\s+NOCASE\b/gi, '')
    .replace(/MAX\(solved,\s*excluded\.solved\)/gi, 'GREATEST(solved, excluded.solved)')
    .replace(/\?/g, () => `$${++index}`);
  if (ignoreConflicts && !/\bON\s+CONFLICT\b/i.test(statement)) {
    statement = statement.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return statement;
}

export function createDatabase(queryExecutor, execExecutor = queryExecutor) {
  return {
    query: async (sql, params = []) => (await queryExecutor(postgresSql(sql), params)).rows,
    exec: async sql => { await execExecutor(sql); },
    prepare(sql) {
      return {
        all: (...params) => this.query(sql, params),
        get: async (...params) => (await this.query(sql, params))[0],
        run: async (...params) => {
          const statement = sql.trim().replace(/;$/, '');
          const insertTable = statement.match(/^\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([a-z_]+)/i)?.[1]?.toLowerCase();
          const insert = insertTable && !tablesWithoutIdentity.has(insertTable) && !/\bRETURNING\b/i.test(statement);
          const rows = await this.query(insert ? `${statement} RETURNING id` : statement, params);
          return { lastInsertRowid: rows[0]?.id, changes: rows.length };
        }
      };
    },
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const transactionDb = createDatabase(
          (sql, params) => client.query(sql, params),
          sql => client.query(sql)
        );
        const result = await callback(transactionDb);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

const db = createDatabase((sql, params) => pool.query(sql, params));

let initialization;
export function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Configure a managed PostgreSQL connection string.');
  }
  if (!initialization) initialization = initialize();
  return initialization;
}

async function initialize() {
  const migrationDirectories = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations'),
    path.join(process.cwd(), 'server', 'migrations'),
    path.join(process.cwd(), 'migrations')
  ];
  let directory;
  for (const candidate of migrationDirectories) {
    try {
      await fs.access(candidate);
      directory = candidate;
      break;
    } catch {}
  }
  if (!directory) throw new Error('PostgreSQL migrations directory was not found.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(8675309)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const migrations = (await fs.readdir(directory)).filter(name => name.endsWith('.sql')).sort();
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      await client.query(await fs.readFile(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    initialization = undefined;
    throw error;
  } finally {
    client.release();
  }
  try {
    await seedCatalog();
  } catch (error) {
    initialization = undefined;
    throw error;
  }
}

async function seedCatalog() {
  const courses = [
    ['javascript','JavaScript','Build a strong JS foundation with practical examples.','Beginner','JS','#f59e0b'],
    ['html','HTML','Structure real web pages with semantic HTML.','Beginner','HTML','#ef4444'],
    ['css','CSS','Style responsive interfaces from the ground up.','Beginner','CSS','#3b82f6'],
    ['python','Python','Learn Python syntax, data structures and problem solving.','Beginner','PY','#22c55e'],
    ['nodejs','Node.js','Understand backend JavaScript and APIs.','Beginner','ND','#8b5cf6'],
    ['web-fundamentals','Web Fundamentals','HTTP, browsers, APIs and developer workflow.','Beginner','WEB','#06b6d4'],
    ['typescript','TypeScript','Make JavaScript safer with types, interfaces and reusable contracts.','Moderate','TS','#3178c6'],
    ['react','React','Build interactive component-based user interfaces.','Moderate','R','#61dafb'],
    ['sql','SQL & Databases','Query, model and protect data with practical SQL.','Beginner','SQL','#22d3ee'],
    ['git','Git & GitHub','Collaborate confidently with version control and GitHub workflows.','Beginner','GIT','#f97316'],
    ['ai-engineering','AI & AI Tools','Use AI assistants, prompting, APIs and responsible AI workflows.','Beginner','AI','#ec4899']
  ];
  for (const course of courses) {
    await db.query(
      `INSERT INTO courses(slug,title,description,level,icon,accent)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(slug) DO NOTHING`,
      course
    );
  }
  await ensureCurriculum(db);
  await ensurePracticeCatalog(db);
}

export async function closeDb() {
  await pool.end();
}

export default db;
