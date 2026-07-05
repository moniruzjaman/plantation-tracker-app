import { spawn } from 'child_process';
import path from 'path';

const androidDir = path.join(process.cwd(), 'android');

function runGradleTask(task) {
  return new Promise((resolve, reject) => {
    console.log(`\n==================================================`);
    console.log(`Starting Android Gradle Task: ${task}`);
    console.log(`==================================================\n`);

    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const child = spawn(gradlew, [task], {
      cwd: androidDir,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\nTask completed successfully: ${task}\n`);
        resolve();
      } else {
        reject(new Error(`Gradle task ${task} failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function build() {
  try {
    // 1. Build Debug APK (For direct test installation)
    await runGradleTask('assembleDebug');

    // 2. Build Release Bundle (AAB for Google Play Store upload)
    await runGradleTask('bundleRelease');

    console.log(`\n==================================================`);
    console.log(`✨ ANDROID BUILD SUCCESSFUL!`);
    console.log(`==================================================`);
    console.log(`\nOutputs generated:`);
    console.log(`1. Test APK: android/app/build/outputs/apk/debug/app-debug.apk`);
    console.log(`2. Play Store Bundle (AAB): android/app/build/outputs/bundle/release/app-release.aab`);
    console.log(`\nThese files are ready for testing and Google Play Store publication.`);
  } catch (error) {
    console.error('\n❌ Android build failed:', error);
    process.exit(1);
  }
}

build();
