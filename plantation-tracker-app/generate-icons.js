import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14532d" />
      <stop offset="100%" stop-color="#15803d" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  
  <g>
    <!-- Leaves / Plant Graphic -->
    <path d="M512,240 C512,240 360,280 320,500 C280,720 512,784 512,784 C512,784 744,720 704,500 C664,280 512,240 512,240 Z" fill="#4ade80" />
    <path d="M512,240 C512,240 360,280 320,500 C280,720 512,784 512,784 L512,240 Z" fill="#22c55e" />
    
    <!-- Inner Leaf Details -->
    <path d="M512,360 C512,360 400,400 380,560 C360,720 512,740 512,740 L512,360 Z" fill="#16a34a" />
    <path d="M512,360 C512,360 624,400 644,560 C664,720 512,740 512,740 L512,360 Z" fill="#15803d" />
    
    <!-- Plant Stem -->
    <path d="M512,784 C512,784 490,860 512,920" fill="none" stroke="#bbf7d0" stroke-width="32" stroke-linecap="round" />
  </g>
</svg>
`;

async function generateAssets() {
  const assetsDir = path.resolve('assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
  }

  // Create Icon (1024x1024)
  await sharp(Buffer.from(svgContent))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
    
  console.log('Created assets/icon.png');

  // Create identical Icon for splash (with larger background if wanted, but simpler to just center it)
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 21, g: 128, b: 61, alpha: 1 } // #15803d bg
    }
  })
    .composite([
      { input: Buffer.from(svgContent), gravity: 'center' }
    ])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
    
  console.log('Created assets/splash.png');
}

generateAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
