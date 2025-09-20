// ソース画像のフォーマットを検査し、sharpが読めるかをテストするユーティリティ。
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT, 'public', 'avatars', 'default', 'src');

async function main() {
  const files = await fs.readdir(SRC_DIR);
  for (const f of files) {
    const p = path.join(SRC_DIR, f);
    try {
      const s = await fs.stat(p);
      if (!s.isFile()) continue;
      const meta = await sharp(p, { limitInputPixels: false }).metadata();
      console.log(`${f} -> OK (${meta.format} ${meta.width}x${meta.height})`);
    } catch (e) {
      console.log(`${f} -> NG (${e?.message ?? e})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

