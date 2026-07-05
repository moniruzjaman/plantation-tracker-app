import fs from 'fs';
import path from 'path';
import https from 'https';

const jarDest = path.join(process.cwd(), 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');

// Official reliable URLs to get an uncorrupted standard gradle-wrapper.jar
const jarUrls = [
  'https://raw.githubusercontent.com/gradle/gradle/v8.14.3/gradle/wrapper/gradle-wrapper.jar',
  'https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar',
  'https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect recursively
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
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
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function fix() {
  console.log('Attempting to download a fresh gradle-wrapper.jar...');
  
  // Ensure directory exists
  const dir = path.dirname(jarDest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const url of jarUrls) {
    try {
      console.log(`Downloading from: ${url}`);
      await downloadFile(url, jarDest);
      const stats = fs.statSync(jarDest);
      console.log(`Successfully downloaded. File size: ${stats.size} bytes.`);
      if (stats.size > 10000) {
        console.log('✨ gradle-wrapper.jar is successfully restored!');
        return;
      } else {
        throw new Error('File is too small, check if it is a placeholder or redirect.');
      }
    } catch (err) {
      console.error(`Failed with url ${url}:`, err.message);
    }
  }
  console.error('Could not restore gradle-wrapper.jar from any of the URLs.');
  process.exit(1);
}

fix();
