import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve('public');
const ASSETS_DIR = path.resolve('assets');
const RES_DIR = path.resolve('android/app/src/main/res');

async function run() {
  try {
    console.log('Locating plantation-tracker app icon in src/assets/images...');
    const imgDir = path.resolve('src/assets/images');
    let sourceImgPath = null;
    
    if (fs.existsSync(imgDir)) {
      const files = fs.readdirSync(imgDir);
      const matched = files.find(f => f.startsWith('plantation_app_icon_'));
      if (matched) {
        sourceImgPath = path.join(imgDir, matched);
      }
    }
    
    if (!sourceImgPath) {
      console.warn('Could not dynamically find a plantation_app_icon_ file in src/assets/images.');
      // fallback to any fallback image or default
      sourceImgPath = path.join(imgDir, 'plantation_app_icon_1781539370524.jpg');
    }
    
    if (!fs.existsSync(sourceImgPath)) {
      throw new Error(`Source branding image not found at: ${sourceImgPath}`);
    }
    
    console.log(`Using branding source image: ${sourceImgPath}`);

    // Ensure folders exist
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    // A. Generate Web / PWA Assets in /public
    
    // 1. Create a high-quality 512x512 base PNG to convert to base64 SVG
    const svgBaseBuffer = await sharp(sourceImgPath)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    const base64Png = svgBaseBuffer.toString('base64');
    
    // SVG wrapper template
    const embeddedSvgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${base64Png}" width="512" height="512" />
</svg>`;

    // 1a. Write logo.svg, favicon.svg, pwa-192x192.svg, pwa-512x512.svg
    fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.svg'), embeddedSvgContent);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), embeddedSvgContent);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.svg'), embeddedSvgContent);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.svg'), embeddedSvgContent);
    console.log('Generated SVG assets in public/ (logo.svg, favicon.svg, pwa-192/512.svg)');

    // 2. logo.png (512x512)
    await sharp(sourceImgPath)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'logo.png'));
    console.log('Created public/logo.png');

    // 3. apple-touch-icon.png (180x180)
    await sharp(sourceImgPath)
      .resize(180, 180, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
    console.log('Created public/apple-touch-icon.png');

    // 4. og-image.png (512x512)
    await sharp(sourceImgPath)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
    console.log('Created public/og-image.png');

    // 5. og-image-large.png (1200x630) on custom #15803d brand backdrop
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: { r: 21, g: 128, b: 61, alpha: 1 } // #15803d brand background
      }
    })
      .composite([
        { 
          input: await sharp(sourceImgPath).resize(420, 420).png().toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toFile(path.join(PUBLIC_DIR, 'og-image-large.png'));
    console.log('Created public/og-image-large.png');

    // 6. favicon-32x32.png, favicon-16x16.png, favicon.ico
    const fav32 = await sharp(sourceImgPath).resize(32, 32, { fit: 'cover' }).png().toBuffer();
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), fav32);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), fav32);
    
    await sharp(sourceImgPath)
      .resize(16, 16, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));
    console.log('Created public favicon assets: favicon-32x32.png, favicon-16x16.png, favicon.ico');


    // B. Generate Universal assets in /assets
    
    // 1. icon.png (1024x1024)
    await sharp(sourceImgPath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('Created assets/icon.png');

    // 2. splash.png (2732x2732)
    await sharp({
      create: {
        width: 2732,
        height: 2732,
        channels: 4,
        background: { r: 21, g: 128, b: 61, alpha: 1 } // #15803d brand background
      }
    })
      .composite([
        { 
          input: await sharp(sourceImgPath).resize(1024, 1024).png().toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash.png'));
    console.log('Created assets/splash.png');


    // C. Generate and overwrite Android Launcher Resources in /android/app/src/main/res
    if (fs.existsSync(RES_DIR)) {
      console.log('Updating Android launcher resource mipmaps...');
      
      const androidMips = [
        { name: 'mipmap-ldpi', size: 36, adaptiveSize: 81 },
        { name: 'mipmap-mdpi', size: 48, adaptiveSize: 108 },
        { name: 'mipmap-hdpi', size: 72, adaptiveSize: 162 },
        { name: 'mipmap-xhdpi', size: 96, adaptiveSize: 216 },
        { name: 'mipmap-xxhdpi', size: 144, adaptiveSize: 324 },
        { name: 'mipmap-xxxhdpi', size: 192, adaptiveSize: 432 }
      ];

      for (const mip of androidMips) {
        const mipFolder = path.join(RES_DIR, mip.name);
        if (fs.existsSync(mipFolder)) {
          // Generate square ic_launcher.png
          await sharp(sourceImgPath)
            .resize(mip.size, mip.size)
            .png()
            .toFile(path.join(mipFolder, 'ic_launcher.png'));

          // Generate round ic_launcher_round.png
          // Cut circle-scoped boundary for perfect modern android rounding support
          const circleMask = Buffer.from(
            `<svg width="${mip.size}" height="${mip.size}"><circle cx="${mip.size / 2}" cy="${mip.size / 2}" r="${mip.size / 2}" fill="#ffffff"/></svg>`
          );
          const iconResized = await sharp(sourceImgPath)
            .resize(mip.size, mip.size)
            .png()
            .toBuffer();

          await sharp(circleMask)
            .composite([{ input: iconResized, blend: 'in' }])
            .png()
            .toFile(path.join(mipFolder, 'ic_launcher_round.png'));

          // Generate adaptive background (solid brand green) to fix potential corruption
          await sharp({
            create: {
              width: mip.adaptiveSize,
              height: mip.adaptiveSize,
              channels: 4,
              background: { r: 21, g: 128, b: 61, alpha: 1 } // #15803d brand backdrop
            }
          })
            .png()
            .toFile(path.join(mipFolder, 'ic_launcher_background.png'));

          // Generate adaptive foreground: centered source logo with safe zone padding on transparent background
          const fgIconSize = Math.round(mip.adaptiveSize * 0.66);
          const fgIconBuffer = await sharp(sourceImgPath)
            .resize(fgIconSize, fgIconSize, { fit: 'contain' })
            .png()
            .toBuffer();

          await sharp({
            create: {
              width: mip.adaptiveSize,
              height: mip.adaptiveSize,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent
            }
          })
            .composite([{ input: fgIconBuffer, gravity: 'center' }])
            .png()
            .toFile(path.join(mipFolder, 'ic_launcher_foreground.png'));
        }
      }
      console.log('Successfully completed Android Launcher icon mipmap compiles!');
    }

    console.log('All icons and branding assets successfully compiled and resynced!');
  } catch (error) {
    console.error('Error compiling plantation-tracker branding logo:', error);
    process.exit(1);
  }
}

run();
