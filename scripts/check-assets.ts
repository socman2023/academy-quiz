import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quizData } from '../src/data';

const paths = new Set<string>(['/assets/academy.webp']);
for (const profile of Object.values(quizData.profiles)) {
  paths.add(profile.asset);
  paths.add(profile.shareAsset);
}

const missing = [...paths].filter((path) => !existsSync(join('public', path.replace(/^\/+/, ''))));
if (missing.length > 0) {
  throw new Error(`Missing public assets:\n${missing.join('\n')}`);
}
console.log(`Verified ${paths.size} public assets for ${Object.keys(quizData.profiles).length} profiles.`);
