import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImgPath = 'src/assets/images/plantation_app_icon_1781539370524.jpg';
const publicDir = path.resolve('public');

async function processIcons() {
  if (!fs.existsSync(sourceImgPath)) {
    console.error('Source image not found:', sourceImgPath);
    // Let's search inside /src/assets/images for any file starting with plantation_app_icon
    const imgDir = path.resolve('src/assets/images');
    if (fs.existsSync(imgDir)) {
      const files = fs.readdirSync(imgDir);
      const matched = files.find(f => f.startsWith('plantation_app_icon_'));
      if (matched) {
        console.log('Found alternative match:', matched);
        runWithSource(path.join(imgDir, matched));
        return;
      }
    }
    process.exit(1);
  }

  await runWithSource(sourceImgPath);
}

async function runWithSource(srcPath) {
  console.log('Using source image:', srcPath);

  // 1. Create apple-touch-icon.png (180x180)
  await sharp(srcPath)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png');

  // 2. Create high-res og-image.png (512x512) for WhatsApp/Messenger sharing
  await sharp(srcPath)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('Generated public/og-image.png');

  // 3. Create favicon-32x32.png (32x32)
  await sharp(srcPath)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated public/favicon-32x32.png');

  // 4. Create favicon-16x16.png (16x16)
  await sharp(srcPath)
    .resize(16, 16, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('Generated public/favicon-16x16.png');

  // 5. Also overwrite pwa-192x192.svg or similar png, let's also create og-image-large.png (1200x630) with green background
  // to make sure it displays beautifully in messenger/whatsapp cards
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 21, g: 128, b: 61, alpha: 1 } // #15803d brand bg
    }
  })
    .composite([
      { 
        input: await sharp(srcPath).resize(400, 400).png().toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'og-image-large.png'));
  console.log('Generated public/og-image-large.png');
}

processIcons().catch(err => {
  console.error('Error processing icons:', err);
  process.exit(1);
});
