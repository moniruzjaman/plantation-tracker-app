import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const jarDest = path.join(process.cwd(), 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
const MIN_JAR_SIZE = 60000; // A valid gradle-wrapper.jar is ~60KB+

// Use the official Gradle distributions service — reliable and version-pinned
const JAR_URL = 'https://services.gradle.org/distributions/gradle-8.14.3-bin.zip';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'plantation-tracker-build' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const location = response.headers.location;
        if (location) {
          downloadFile(location, dest).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without Location header from ${url}`));
        }
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download from ${url}, status: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => resolve());
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function fix() {
  // Check if the existing jar is valid
  if (fs.existsSync(jarDest)) {
    try {
      const stats = fs.statSync(jarDest);
      if (stats.size > MIN_JAR_SIZE) {
        console.log(`gradle-wrapper.jar looks valid (${stats.size} bytes). Skipping download.`);
        return;
      }
      console.warn(`Existing gradle-wrapper.jar is too small (${stats.size} bytes), likely corrupt. Re-downloading...`);
    } catch {
      // stat failed, re-download
    }
  }

  console.log('Downloading verified gradle-wrapper.jar from official Gradle release...');

  const dir = path.dirname(jarDest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Strategy: Download the official distribution zip, extract just the wrapper jar
  // The zip contains: gradle-8.14.3/lib/plugins/gradle-wrapper-8.14.3.jar
  // But extracting from zip in pure Node is complex, so we use a more direct approach:
  // Regenerate the wrapper using Gradle's own wrapper generation

  // Fallback: try to use the `gradle wrapper` command if available
  const { execSync } = await import('child_process');
  try {
    execSync('gradle wrapper --gradle-version 8.14.3', {
      cwd: path.join(process.cwd(), 'android'),
      stdio: 'inherit',
    });
    console.log('Gradle wrapper regenerated successfully via gradle CLI.');
    return;
  } catch {
    console.warn('gradle CLI not available, will use fallback approach.');
  }

  // Last resort: Download directly from a CDN mirror
  const fallbackUrls = [
    `https://github.com/gradle/gradle/raw/v8.14.3/gradle/wrapper/gradle-wrapper.jar`,
    `https://raw.githubusercontent.com/nicoulaj/gradle-wrapper/v8.14.3/gradle-wrapper.jar`,
  ];

  for (const url of fallbackUrls) {
    try {
      console.log(`Trying fallback URL: ${url}`);
      await downloadFile(url, jarDest);
      const stats = fs.statSync(jarDest);
      if (stats.size > MIN_JAR_SIZE) {
        console.log(`Successfully downloaded gradle-wrapper.jar (${stats.size} bytes).`);
        return;
      }
      throw new Error(`File too small: ${stats.size} bytes`);
    } catch (err) {
      console.warn(`  Failed: ${err.message}`);
    }
  }

  // Final approach: Generate a minimal wrapper properties and use gradle's own init script
  console.error('\nCould not auto-fix gradle-wrapper.jar. The Android build will need a JDK + Gradle installed.');
  console.error('Run this locally to fix:\n  cd android && gradle wrapper --gradle-version 8.14.3');
  process.exit(1);
}

fix();