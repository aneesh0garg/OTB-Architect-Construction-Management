import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Keycloak realm includes the platform authorization baseline', () => {
  const realm = JSON.parse(readFileSync('infra/keycloak/orbita-realm.json', 'utf8'));
  const roleNames = new Set(realm.roles.realm.map((role) => role.name));
  for (const role of [
    'organization_admin',
    'project_manager',
    'field_supervisor',
    'contractor',
    'owner',
  ]) {
    assert.equal(roleNames.has(role), true, `missing ${role}`);
  }
});
