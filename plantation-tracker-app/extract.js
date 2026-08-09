import fs from 'fs';
const logPath = '/.gemini/antigravity/brain/83cb8465-b646-48e9-ab6e-7a95f40ab0de/.system_generated/logs/overview.txt';
try {
  const content = fs.readFileSync(logPath, 'utf-8');
  const start = content.lastIndexOf('<!DOCTYPE html>');
  const end = content.lastIndexOf('</html>') + 7;
  if (start !== -1 && end !== -1 && end > start) {
    const html = content.substring(start, end);
    fs.writeFileSync('public/legacy-nursery.html', html, 'utf-8');
    console.log('Success, length:', html.length);
  } else {
    console.log('Not found');
  }
} catch (e) {
  console.error('Error:', e);
}
