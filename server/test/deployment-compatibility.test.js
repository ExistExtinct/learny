import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, postgresSql } from '../src/db.js';
import { simulateCode } from '../src/code-simulation.js';

test('PostgreSQL query conversion uses numbered placeholders and native conflict syntax', () => {
  assert.equal(
    postgresSql('INSERT OR IGNORE INTO progress(user_id,lesson_id) VALUES(?,?)'),
    'INSERT INTO progress(user_id,lesson_id) VALUES($1,$2) ON CONFLICT DO NOTHING'
  );
  assert.equal(
    postgresSql('SELECT * FROM users WHERE email=? COLLATE NOCASE'),
    'SELECT * FROM users WHERE email=$1 '
  );
  assert.equal(
    postgresSql('UPDATE challenge_attempts SET solved=MAX(solved,excluded.solved)'),
    'UPDATE challenge_attempts SET solved=GREATEST(solved, excluded.solved)'
  );
});

test('composite-key inserts do not request a nonexistent identity column', async () => {
  const statements = [];
  const db = createDatabase(async sql => {
    statements.push(sql);
    return { rows: [] };
  });

  await db.prepare('INSERT INTO progress(user_id,lesson_id) VALUES(?,?)').run(1, 2);
  await db.prepare('INSERT INTO users(username) VALUES(?)').run('learner');

  assert.equal(statements[0], 'INSERT INTO progress(user_id,lesson_id) VALUES($1,$2)');
  assert.equal(statements[1], 'INSERT INTO users(username) VALUES($1) RETURNING id');
});

test('simulation reports predicted output and never claims code executed', async () => {
  const replies = [
    { answer: '{"safe":true,"hasMistake":false,"feedback":"No blocking issues."}' },
    { answer: '{"stdout":"hello\\\\n","stderr":"","exitCode":0,"explanation":"Predicted from the source."}' }
  ];
  const calls = [];
  const result = await simulateCode(
    { language: 'javascript', files: [{ path: 'main.js', content: 'console.log("hello");' }], stdin: '' },
    { provider: 'gemini', callAI: async options => { calls.push(options); return replies.shift(); } }
  );

  assert.equal(calls.length, 2);
  assert.equal(result.stdout, 'hello\\n');
  assert.equal(result.executed, false);
  assert.equal(result.simulated, true);
  assert.match(result.simulationLabel, /not executed/i);
});

test('AI safety review blocks code with obvious mistakes before prediction', async () => {
  let calls = 0;
  const result = await simulateCode(
    { language: 'python', files: [{ path: 'main.py', content: 'print("unfinished")' }], stdin: '' },
    { provider: 'openai', callAI: async () => { calls += 1; return { answer: '{"safe":true,"hasMistake":true,"feedback":"Fix the issue first."}' }; } }
  );

  assert.equal(calls, 1);
  assert.equal(result.blocked, true);
  assert.equal(result.executed, false);
  assert.equal(result.exitCode, null);
});

test('unsafe source is blocked without calling an AI provider', async () => {
  let calls = 0;
  const result = await simulateCode(
    { language: 'javascript', files: [{ path: 'main.js', content: 'fetch("https://example.com")' }], stdin: '' },
    { provider: 'gemini', callAI: async () => { calls += 1; return { answer: '{}' }; } }
  );

  assert.equal(calls, 0);
  assert.equal(result.blocked, true);
  assert.equal(result.executed, false);
});

test('invalid paths are rejected before the AI provider is called', async () => {
  let calls = 0;
  await assert.rejects(
    simulateCode(
      { language: 'javascript', files: [{ path: '../main.js', content: 'console.log(1)' }], stdin: '' },
      { provider: 'gemini', callAI: async () => { calls += 1; return { answer: '{}' }; } }
    ),
    /Invalid file path/
  );
  assert.equal(calls, 0);
});
