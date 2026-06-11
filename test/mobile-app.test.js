const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readText(filePath) {
  return await fs.readFile(path.join(process.cwd(), filePath), "utf8");
}

test("entry page exposes installable PWA metadata", async () => {
  const html = await readText("public/index.html");

  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<meta name="theme-color" content="#315f45"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/app-icon\.png"/);
});

test("web app registers the service worker after load", async () => {
  const app = await readText("public/app.js");

  assert.match(app, /function registerServiceWorker\(/);
  assert.match(app, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(app, /registerServiceWorker\(\)/);
});

test("manifest and service worker provide mobile app basics", async () => {
  const manifest = JSON.parse(await readText("public/manifest.webmanifest"));
  const sw = await readText("public/sw.js");
  const offline = await readText("public/offline.html");

  assert.equal(manifest.name, "墨舞丹青");
  assert.equal(manifest.short_name, "墨舞丹青");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.theme_color, "#315f45");
  assert.ok(manifest.icons.some((icon) => icon.src === "/assets/app-icon.png" && icon.type === "image/png" && /maskable/.test(icon.purpose)));

  assert.match(sw, /guohua-app-shell/);
  assert.match(sw, /\/offline\.html/);
  assert.match(sw, /self\.addEventListener\("fetch"/);
  assert.match(offline, /墨舞丹青/);
});

test("Capacitor Android shell targets the cloud app", async () => {
  const config = await readText("capacitor.config.json");
  const parsed = JSON.parse(config);

  assert.equal(parsed.appId, "com.guohua.app");
  assert.equal(parsed.appName, "墨舞丹青");
  assert.equal(parsed.webDir, "public");
  assert.equal(parsed.server.url, "http://124.220.36.240");
  assert.equal(parsed.server.cleartext, true);
});

test("Android Capacitor project is present", async () => {
  const settings = await readText("android/settings.gradle");
  const manifest = await readText("android/app/src/main/AndroidManifest.xml");

  assert.match(settings, /include ':app'/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /MainActivity/);
});

test("mobile app scripts and guide document the Android workflow", async () => {
  const packageJson = JSON.parse(await readText("package.json"));
  const guide = await readText("MOBILE_APP.md");

  assert.equal(packageJson.scripts["mobile:sync"], "npx cap sync android");
  assert.equal(packageJson.scripts["mobile:open"], "npx cap open android");
  assert.equal(packageJson.scripts["mobile:build:android"], "cd android && gradlew.bat assembleDebug");
  assert.match(guide, /npm run mobile:sync/);
  assert.match(guide, /npm run mobile:build:android/);
  assert.match(guide, /android\\app\\build\\outputs\\apk\\debug\\app-debug\.apk/);
  assert.match(guide, /JAVA_HOME/);
  assert.match(guide, /Android SDK/);
});
