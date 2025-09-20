// 日本語メモ: ドット絵アバターのソース（*_src.png）を 128x128 に最近傍で整形して出力する。
// 入力:  web/public/avatars/default/src/*.png（例: idle_src.png, talk_src.png, celebrate_src.png）
// 出力:  web/public/avatars/default/*.png（例: idle.png, talk.png, celebrate.png）

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT, 'public', 'avatars', 'default', 'src');
const OUT_DIR = path.join(ROOT, 'public', 'avatars', 'default');
const SIZE = 128;

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function outName(inputName) {
  // *_src.png → *.png に変換
  const b = path.basename(inputName);
  const without = b.replace(/_src(?=\.png$)/i, '').replace(/\s+/g, '_');
  return without;
}

async function main() {
  await ensureDir(SRC_DIR);
  await ensureDir(OUT_DIR);
  const files = (await fs.readdir(SRC_DIR)).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    console.log(`No source images found in ${SRC_DIR}. Place *_src.png files first.`);
    return;
  }
  for (const f of files) {
    const srcPath = path.join(SRC_DIR, f);
    const outPath = path.join(OUT_DIR, outName(f));
    console.log(`→ ${path.relative(ROOT, outPath)} (from ${f})`);
    const img = sharp(srcPath, { limitInputPixels: false });
    // 透明背景で中央に収め、最近傍でリサイズ。余白を保つため contain + extent。
    await img
      .resize(SIZE, SIZE, { fit: 'contain', kernel: sharp.kernel.nearest, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toFile(outPath);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

