import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertEnvValue } from '../scripts/configure-local-invitations.mjs';

test('upsertEnvValue adds and replaces a secret without duplicating it', () => {
  assert.equal(upsertEnvValue('A=1\n', 'KEYCLOAK_PROVISIONER_CLIENT_SECRET', 'first'), 'A=1\nKEYCLOAK_PROVISIONER_CLIENT_SECRET=first\n');
  assert.equal(upsertEnvValue('KEYCLOAK_PROVISIONER_CLIENT_SECRET=first\n', 'KEYCLOAK_PROVISIONER_CLIENT_SECRET', 'second'), 'KEYCLOAK_PROVISIONER_CLIENT_SECRET=second\n');
});
