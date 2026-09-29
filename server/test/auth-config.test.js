import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRequireEmailVerification } from '../src/auth-config.js';

test('email verification is skipped locally when SMTP is unavailable', () => {
  assert.equal(shouldRequireEmailVerification({
    required: true,
    smtpConfigured: false,
    isProduction: false
  }), false);
});

test('email verification remains enabled locally when SMTP is configured', () => {
  assert.equal(shouldRequireEmailVerification({
    required: true,
    smtpConfigured: true,
    isProduction: false
  }), true);
});

test('production still requires email verification even without SMTP', () => {
  assert.equal(shouldRequireEmailVerification({
    required: true,
    smtpConfigured: false,
    isProduction: true
  }), true);
});
