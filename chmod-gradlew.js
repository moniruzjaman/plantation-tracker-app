import fs from 'fs';
import path from 'path';

const gradlewPath = path.join(process.cwd(), 'android', 'gradlew');

try {
  if (fs.existsSync(gradlewPath)) {
    fs.chmodSync(gradlewPath, '755');
    console.log('Successfully changed permissions of android/gradlew to executable (755).');
  } else {
    console.error('android/gradlew not found at path:', gradlewPath);
  }
} catch (err) {
  console.error('Error changing permissions:', err);
}
