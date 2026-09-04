import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../src/data/moffyPersonas.json');
const DEST_DIR = path.join(__dirname, '../public/moffies');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

export async function syncImages() {
  if (!fs.existsSync(DATA_FILE)) return;
  const personas = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  for (const [mbti, info] of Object.entries(personas)) {
    const filename = `${mbti.toLowerCase()}.jpg`;
    const destPath = path.join(DEST_DIR, filename);

    if (!fs.existsSync(destPath) && info.imageUrl) {
      console.log(`Downloading ${mbti} image from ${info.imageUrl}...`);
      try {
        const res = await fetch(info.imageUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(destPath, buffer);
          console.log(`  Saved ${filename} (${buffer.length} bytes)`);
        }
      } catch (err) {
        console.error(`  Failed to download ${mbti}:`, err.message);
      }
    }
  }
}

syncImages();
