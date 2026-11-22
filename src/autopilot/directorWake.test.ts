import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorWakeHandler } from './directorWake';

const secret = 'a'.repeat(48);
const path = 'https://example.supabase.co/functions/v1/autopilot-director-wake';
const make = (token = secret, method = 'POST', url = path) =>
  new Request(url, { method, headers: { 'x-autopilot-wake-token': token } });

test('unconfigured wake cannot run even with a supplied token', async () => {
  const reply = await createDirectorWakeHandler({ token: undefined })(make());
  assert.equal(reply.status, 503);
});
test('wake rejects wrong token and short token without side effects', async () => {
  const handler = createDirectorWakeHandler({ token: secret });
  for (const token of ['bad', 'b'.repeat(48), '']) {
    const response = await handler(make(token));
    assert.equal(response.status, 401);
  }
});
test('wake denies wrong route and unsupported methods', async () => {
  const handler = createDirectorWakeHandler({ token: secret });
  assert.equal((await handler(make(secret, 'GET'))).status, 405);
  assert.equal((await handler(make(secret, 'POST', path + '/dispatch'))).status, 404);
});
test('valid wake is only an authenticated preflight, never an execution receipt', async () => {
  const handler = createDirectorWakeHandler({
    token: secret,
    now: () => new Date('2026-11-22T05:00:00Z'),
  });
  const result = await handler(make());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    state: 'wake_preflight_authenticated',
    executed: false,
    tasksClaimed: 0,
    noSend: true,
    at: '2026-11-22T05:00:00.000Z',
  });
});
