import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function upsertEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const matcher = new RegExp(`^${key}=.*$`, 'm');
  return matcher.test(contents)
    ? contents.replace(matcher, line)
    : `${contents.replace(/\s*$/, '')}\n${line}\n`;
}

const docker = (args) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'keycloak', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

export function configureLocalInvitations() {
  const password = docker(['printenv', 'KC_BOOTSTRAP_ADMIN_PASSWORD']);
  if (!password) throw new Error('The Keycloak bootstrap administrator password is unavailable.');
  docker([
    '/opt/keycloak/bin/kcadm.sh', 'config', 'credentials', '--server', 'http://localhost:8080',
    '--realm', 'master', '--user', 'admin', '--password', password,
  ]);
  docker([
    '/opt/keycloak/bin/kcadm.sh', 'update', 'realms/orbita',
    '-s', 'smtpServer.host=mailpit', '-s', 'smtpServer.port=1025',
    '-s', 'smtpServer.from=no-reply@local.orbita', '-s', 'smtpServer.fromDisplayName=Orbita Local',
    '-s', 'smtpServer.auth=false', '-s', 'smtpServer.ssl=false', '-s', 'smtpServer.starttls=false',
  ]);
  let clients = JSON.parse(docker([
    '/opt/keycloak/bin/kcadm.sh', 'get', 'clients', '-r', 'orbita', '-q', 'clientId=orbita-provisioner',
  ]));
  if (!clients[0]?.id) {
    docker([
      '/opt/keycloak/bin/kcadm.sh', 'create', 'clients', '-r', 'orbita',
      '-s', 'clientId=orbita-provisioner', '-s', 'enabled=true', '-s', 'publicClient=false',
      '-s', 'serviceAccountsEnabled=true', '-s', 'standardFlowEnabled=false', '-s', 'directAccessGrantsEnabled=false',
    ]);
    docker([
      '/opt/keycloak/bin/kcadm.sh', 'add-roles', '-r', 'orbita',
      '--uusername', 'service-account-orbita-provisioner', '--cclientid', 'realm-management',
      '--rolename', 'view-users', '--rolename', 'manage-users',
    ]);
    clients = JSON.parse(docker([
      '/opt/keycloak/bin/kcadm.sh', 'get', 'clients', '-r', 'orbita', '-q', 'clientId=orbita-provisioner',
    ]));
  }
  const clientId = clients[0]?.id;
  if (!clientId) throw new Error('The orbita-provisioner client could not be created.');
  const secret = JSON.parse(docker([
    '/opt/keycloak/bin/kcadm.sh', 'get', `clients/${clientId}/client-secret`, '-r', 'orbita',
  ])).value;
  if (!secret) throw new Error('Keycloak did not return the provisioner client secret.');

  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) copyFileSync(resolve(root, '.env.example'), envPath);
  writeFileSync(envPath, upsertEnvValue(readFileSync(envPath, 'utf8'), 'KEYCLOAK_PROVISIONER_CLIENT_SECRET', secret));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    configureLocalInvitations();
    console.log('Local invitation provisioning is configured in .env. The secret was not displayed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Local invitation provisioning could not be configured.');
    process.exitCode = 1;
  }
}
