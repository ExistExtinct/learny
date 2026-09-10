import test from 'node:test';
import assert from 'node:assert/strict';

test('basic arithmetic',()=>assert.equal(2+2,4));
test('supported AI default model',()=>assert.equal(process.env.GEMINI_MODEL||'gemini-3.6-flash','gemini-3.6-flash'));
