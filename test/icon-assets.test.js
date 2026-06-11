const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readFile(filePath) {
  return await fs.readFile(path.join(process.cwd(), filePath));
}

function readPngSize(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("app icon is generated from the provided guohua source image", async () => {
  const source = await fs.stat(path.join(process.cwd(), "public", "assets", "guohua-logo-source.webp"));
  const icon = await readFile("public/assets/app-icon.png");
  const size = readPngSize(icon);

  assert.ok(source.size > 0, "source WebP should be kept for regeneration");
  assert.equal(size.width, 512);
  assert.equal(size.height, 512);
  assert.ok(icon.length > 10_000, "generated icon should contain the source logo and paper texture");
});

test("Android launcher icons exist at all generated densities", async () => {
  const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
  const iconNames = ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"];

  for (const density of densities) {
    for (const iconName of iconNames) {
      const filePath = path.join(process.cwd(), "android", "app", "src", "main", "res", `mipmap-${density}`, iconName);
      const stat = await fs.stat(filePath);
      assert.ok(stat.size > 0, `${iconName} should be present for ${density}`);
    }
  }
});
