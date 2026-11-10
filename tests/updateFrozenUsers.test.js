import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProbeResult,
  buildOutput,
  classifyFxPayload,
  normalizePreviousFrozen,
  readPreviousState
} from '../script/updateFrozenUsers.js';

test('明示的な凍結だけをsuspendedに分類する', () => {
  assert.equal(classifyFxPayload({ code: 404, reason: 'suspended' }, 404, 'target').status, 'suspended');
  assert.equal(classifyFxPayload({ code: 404, message: 'User not found' }, 404, 'target').status, 'not_found');
  assert.equal(classifyFxPayload({ code: 429, message: 'rate limited' }, 429, 'target').status, 'unknown');
  assert.equal(classifyFxPayload({ code: 500 }, 500, 'target').status, 'unknown');
  assert.equal(classifyFxPayload({ code: 404, message: 'User not found' }, 200, 'target').status, 'unknown');
  assert.equal(classifyFxPayload({ code: 404, reason: 'protected', message: 'User not found' }, 404, 'target').status, 'unknown');
});

test('見つからない新規アカウントは異なる日本時間の2日で確認してから非表示にする', () => {
  const state = readPreviousState();
  const missing = { status: 'not_found' };
  applyProbeResult(state, 'Missing_User', missing, '2026-11-10');
  applyProbeResult(state, 'missing_user', missing, '2026-11-10');
  assert.equal(state.hidden.size, 0);
  assert.equal(state.history.get('missing_user').status, 'not_found_pending');
  applyProbeResult(state, 'missing_user', { status: 'unknown' }, '2026-11-11');
  assert.equal(state.hidden.size, 0);
  applyProbeResult(state, 'missing_user', missing, '2026-11-12');
  assert.equal(state.hidden.get('missing_user'), 'missing_user');
  assert.equal(state.history.get('missing_user').status, 'not_found');
  assert.deepEqual(state.history.get('missing_user').events.map(e => e.status), ['not_found_pending', 'not_found']);
});

test('復活を確認すれば非表示を解除し、履歴を残す', () => {
  const state = readPreviousState({ updated: '2026-11-01', frozen_users: ['Old_User'] });
  applyProbeResult(state, 'old_user', { status: 'unknown' }, '2026-11-10');
  assert.equal(state.hidden.has('old_user'), true);
  applyProbeResult(state, 'old_user', { status: 'active' }, '2026-11-11');
  assert.equal(state.hidden.has('old_user'), false);
  assert.deepEqual(state.history.get('old_user').events.map(e => e.status), ['previously_listed', 'active']);
});

test('一時的に見つからない既存ユーザーは確認中も保持し、生存確認で候補を取り消す', () => {
  const state = readPreviousState({ updated: '2026-11-01', frozen_users: ['old'] });
  applyProbeResult(state, 'old', { status: 'not_found' }, '2026-11-10');
  assert.equal(state.hidden.has('old'), true);
  applyProbeResult(state, 'old', { status: 'active' }, '2026-11-10');
  assert.equal(state.hidden.has('old'), false);
  assert.equal(state.history.get('old').not_found_since, undefined);
  applyProbeResult(state, 'old', { status: 'not_found' }, '2026-11-11');
  assert.equal(state.hidden.has('old'), false);
});

test('履歴が破損していると更新を中止する', () => {
  assert.throws(() => readPreviousState(null));
  for (const account_history of [null, [{}], [{ screen_name: 'name', status: 'not_found_pending', events: [] }]]) {
    assert.throws(() => readPreviousState({ frozen_users: [], account_history }));
  }
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
