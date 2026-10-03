import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOutput,
  classifyFxPayload,
  normalizePreviousFrozen
} from '../script/updateFrozenUsers.js';

test('明示的な凍結だけをsuspendedに分類する', () => {
  assert.equal(classifyFxPayload({ code: 404, reason: 'suspended' }, 404, 'target').status, 'suspended');
  assert.equal(classifyFxPayload({ code: 404, message: 'User not found' }, 404, 'target').status, 'not_found');
  assert.equal(classifyFxPayload({ code: 429, message: 'rate limited' }, 429, 'target').status, 'unknown');
  assert.equal(classifyFxPayload({ code: 500 }, 500, 'target').status, 'unknown');
});

test('鍵アカウントは生存として扱う', () => {
  const result = classifyFxPayload({
    code: 200,
    user: { screen_name: 'Target', protected: true }
  }, 200, 'target');
  assert.equal(result.status, 'active');
  assert.equal(result.protected, true);
});

test('別アカウントの応答を生存根拠にしない', () => {
  const result = classifyFxPayload({
    code: 200,
    user: { screen_name: 'someone_else', protected: false }
  }, 200, 'target');
  assert.equal(result.status, 'unknown');
});

test('旧形式と新形式の前回データを読み込める', () => {
  assert.deepEqual([...normalizePreviousFrozen([{ screenName: 'Old_User' }])], ['old_user']);
  assert.deepEqual([...normalizePreviousFrozen({ frozen_users: ['New_User'] })], ['new_user']);
});

test('公開JSONは指定されたスキーマと日本時間の日付を使う', () => {
  const output = buildOutput(['z_user', 'A_user', 'z_user'], new Date('2026-10-03T18:30:00Z'));
  assert.deepEqual(output, {
    updated: '2026-10-04',
    source: 'togetter-ranking-top5',
    frozen_users: ['A_user', 'z_user']
  });
});
