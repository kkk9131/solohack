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
const TRIM = true; // 透明背景の外周をトリミング
const PADDING = 4; // 仕上がり128pxの内側に均等余白（px）

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
    try {
      console.log(`→ ${path.relative(ROOT, outPath)} (from ${f})`);
      let img = sharp(srcPath, { limitInputPixels: false });
      if (TRIM) {
        // 透明背景（左上ピクセル）を基準に外周をトリミング
        img = img.trim();
      }
      // 最終128pxに対して、内側に均等余白を確保
      const inner = Math.max(1, SIZE - PADDING * 2);
      await img
        .resize(inner, inner, {
          fit: 'contain',
          kernel: sharp.kernel.nearest,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .extend({
          top: PADDING,
          bottom: PADDING,
          left: PADDING,
          right: PADDING,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, palette: true })
        .toFile(outPath);
    } catch (e) {
      console.warn(`! Skip ${f}: ${e?.message ?? e}`);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
