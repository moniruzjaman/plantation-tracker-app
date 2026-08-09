import fs from 'fs';
import path from 'path';

// Safely concatenate legacy nursery HTML parts if they exist.
// This is a legacy build step — silently skips if source files are absent.
const PUBLIC_DIR = path.resolve('public');
const PARTS = ['part1.txt', 'part2.txt', 'part3.txt', 'part4.txt', 'part5.txt', 'part6.txt', 'part7.txt'];

try {
  const contents = PARTS.map(p => {
    const fp = path.join(PUBLIC_DIR, p);
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf8');
  });

  const missing = PARTS.filter((_, i) => contents[i] === null);
  if (missing.length > 0) {
    console.log(`map.js: skipping legacy-nursery.html — missing files: ${missing.join(', ')}`);
    process.exit(0);
  }

  fs.writeFileSync(path.join(PUBLIC_DIR, 'legacy-nursery.html'), contents.join(''));
  console.log('Done mapping.');
} catch (err) {
  console.warn('map.js: error during legacy HTML assembly, skipping:', err.message);
  process.exit(0);
}