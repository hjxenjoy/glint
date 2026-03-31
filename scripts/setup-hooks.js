#!/usr/bin/env node
// Sets up git pre-commit hook to run lint-staged (prettier formatting)
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hooksDir = join(__dirname, '..', '.git', 'hooks');
const hookPath = join(hooksDir, 'pre-commit');

if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true });
}

const hookContent = `#!/bin/sh
npx lint-staged
`;

writeFileSync(hookPath, hookContent);
chmodSync(hookPath, '755');
console.log('Git pre-commit hook installed.');
