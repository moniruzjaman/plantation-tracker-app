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

    // Favicon / app-icon source is intentionally separate from the OG-share
    // campaign badge above: this is "the icon you see and tap" (browser tab,
    // home screen, taskbar), while sourceImgPath above continues to drive
    // og-share.png (the fuller illustrated social-sharing banner).
    const faviconSrcPath = path.join(imgDir, 'favicon-master.png');
    const FAVICON_SRC = fs.existsSync(faviconSrcPath) ? faviconSrcPath : sourceImgPath;
    console.log(`Using favicon/app-icon source image: ${FAVICON_SRC}`);

    // Ensure folders exist
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    // A. Generate Web / PWA Assets in /public
    // NOTE: source is a circle badge inscribed in a square canvas with an
    // opaque (non-transparent) background -- a plain resize leaves visible
    // white square corners around the circle. Browser tabs, the Windows
    // taskbar, and desktop PWA icons don't auto-round corners (unlike
    // iOS/Android app icons), so every "any"-purpose icon below is masked
    // to the logo's inscribed circle instead.
    async function circularMask(size, srcPath = FAVICON_SRC) {
      const resized = await sharp(srcPath).resize(size, size, { fit: 'cover' }).png().toBuffer();
      const circleSvg = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
      );
      return sharp(resized).composite([{ input: circleSvg, blend: 'dest-in' }]).png().toBuffer();
    }

    // 1. Create a high-quality 512x512 circular base PNG to embed as base64 SVG
    const svgBaseBuffer = await circularMask(512);
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
    console.log('Generated SVG assets in public/ (logo.svg, favicon.svg, pwa-192/512.svg) -- circular');

    // 2. logo.png (512x512, circular)
    fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.png'), svgBaseBuffer);
    console.log('Created public/logo.png (circular)');

    // 3. apple-touch-icon.png (180x180) -- intentionally OPAQUE/square: iOS
    // renders transparent pixels as solid black and rounds the corners itself,
    // so this one must NOT be circular-masked.
    await sharp(FAVICON_SRC)
      .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
    console.log('Created public/apple-touch-icon.png (opaque square)');

    // 4. favicon-16/32/48 (circular) + a REAL multi-resolution favicon.ico
    // (previously just the 32x32 PNG bytes saved with a .ico extension).
    const fav16 = await circularMask(16);
    const fav32 = await circularMask(32);
    const fav48 = await circularMask(48);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), fav16);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), fav32);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-48x48.png'), fav48);
    try {
      const pngToIco = (await import('png-to-ico')).default;
      const icoBuffer = await pngToIco([
        path.join(PUBLIC_DIR, 'favicon-16x16.png'),
        path.join(PUBLIC_DIR, 'favicon-32x32.png'),
        path.join(PUBLIC_DIR, 'favicon-48x48.png'),
      ]);
      fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
      console.log('Created public favicon assets: favicon-16/32/48x, favicon.ico (real multi-size stack, circular)');
    } catch (icoErr) {
      // Fallback: at least ship a valid single-size ico rather than failing the build
      fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), fav32);
      console.warn('png-to-ico unavailable, wrote single-size favicon.ico instead:', icoErr.message);
    }

    // 5. og-share.png (1200x1200) -- SQUARE, full logo visible, never cropped.
    // Previously this file wasn't generated by this script at all, and used
    // `fit: cover` on a rectangular canvas elsewhere, which zooms a square
    // source until it fills a wider frame and crops the top/bottom off the
    // circular ring text.
    const ogLogo = await circularMask(1080, sourceImgPath);
    await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 21, g: 128, b: 61, alpha: 1 } } })
      .composite([{ input: ogLogo, gravity: 'center' }])
      .flatten({ background: '#15803d' })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'og-share.png'));
    console.log('Created public/og-share.png (1200x1200, square, uncropped)');


    // B. Generate Universal assets in /assets
    
    // 1. icon.png (1024x1024)
    await sharp(FAVICON_SRC)
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
          input: await sharp(FAVICON_SRC).resize(1024, 1024).png().toBuffer(),
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
          await sharp(FAVICON_SRC)
            .resize(mip.size, mip.size)
            .png()
            .toFile(path.join(mipFolder, 'ic_launcher.png'));

          // Generate round ic_launcher_round.png
          // Cut circle-scoped boundary for perfect modern android rounding support
          const circleMask = Buffer.from(
            `<svg width="${mip.size}" height="${mip.size}"><circle cx="${mip.size / 2}" cy="${mip.size / 2}" r="${mip.size / 2}" fill="#ffffff"/></svg>`
          );
          const iconResized = await sharp(FAVICON_SRC)
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
          const fgIconBuffer = await sharp(FAVICON_SRC)
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
