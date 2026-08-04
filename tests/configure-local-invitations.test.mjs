import assert from 'node:assert/strict';
import test from 'node:test';
import { missingRoleNames, upsertEnvValue } from '../scripts/configure-local-invitations.mjs';

test('upsertEnvValue adds and replaces a secret without duplicating it', () => {
  assert.equal(upsertEnvValue('A=1\n', 'KEYCLOAK_PROVISIONER_CLIENT_SECRET', 'first'), 'A=1\nKEYCLOAK_PROVISIONER_CLIENT_SECRET=first\n');
  assert.equal(upsertEnvValue('KEYCLOAK_PROVISIONER_CLIENT_SECRET=first\n', 'KEYCLOAK_PROVISIONER_CLIENT_SECRET', 'second'), 'KEYCLOAK_PROVISIONER_CLIENT_SECRET=second\n');
});

test('missingRoleNames limits the provisioner to only missing required permissions', () => {
  assert.deepEqual(
    missingRoleNames([{ name: 'view-users' }, { name: 'manage-users' }], ['view-users', 'manage-users', 'view-realm']),
    ['view-realm'],
  );
  assert.deepEqual(
    missingRoleNames([{ name: 'view-users' }, { name: 'manage-users' }, { name: 'view-realm' }], ['view-users', 'manage-users', 'view-realm']),
    [],
  );
});
