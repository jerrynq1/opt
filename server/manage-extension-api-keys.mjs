#!/usr/bin/env node
import { createExtensionApiKeyStore, formatApiKeyForDisplay } from './extension-api-keys.mjs';

const store = createExtensionApiKeyStore({ filePath: process.env.EXTENSION_API_KEY_STORE_PATH || undefined });
const [command = 'help', ...args] = process.argv.slice(2);

function valueAfter(flag, fallback = undefined) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}
function printHelp() {
  console.log(`ICT QuantLab Extension API Key Manager\n\nCommands:\n  node manage-extension-api-keys.mjs create --name "Chrome Extension" [--rate-limit 60] [--expires-in-days 365]\n  node manage-extension-api-keys.mjs list\n  node manage-extension-api-keys.mjs revoke --id qak_xxxxx\n\nAllowed scope: market:read\nKey store: ${store.filePath}\nThe full key is printed only once during create.`);
}

try {
  if (command === 'create') {
    const name = valueAfter('--name');
    if (!name) throw new Error('Missing --name.');
    const rateLimitPerMinute = Number(valueAfter('--rate-limit', '60'));
    const expiryRaw = valueAfter('--expires-in-days', '');
    const expiresInDays = expiryRaw ? Number(expiryRaw) : null;
    const result = store.create({ name, rateLimitPerMinute, expiresInDays, scopes: ['market:read'] });
    console.log('\nAPI KEY CREATED. Copy the full key now; it cannot be retrieved later.\n');
    console.log(result.key);
    console.log('\nMetadata:');
    console.log(JSON.stringify(formatApiKeyForDisplay(result.record), null, 2));
    console.log(`\nStored only SHA-256 hash in: ${store.filePath}`);
    console.log('Keep this file private and outside ZIP/repository backups.');
  } else if (command === 'list') {
    const records = store.list().map(formatApiKeyForDisplay);
    console.log(JSON.stringify(records, null, 2));
  } else if (command === 'revoke') {
    const id = valueAfter('--id');
    if (!id) throw new Error('Missing --id.');
    if (!store.revoke(id)) throw new Error(`API key not found: ${id}`);
    console.log(`Revoked ${id}.`);
  } else {
    printHelp();
    if (command !== 'help') process.exitCode = 1;
  }
} catch (error) {
  console.error(`Error: ${error?.message || error}`);
  process.exitCode = 1;
}
