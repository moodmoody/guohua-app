const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

async function readAuthFiles() {
  return await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);
}

test("auth screen defaults to login and keeps register as a secondary flow", async () => {
  const [html] = await readAuthFiles();

  assert.match(html, /id="login-form"/);
  assert.match(html, /id="register-form" class="auth-form auth-form-register hidden"/);
  assert.match(html, /id="show-register-btn"/);
  assert.match(html, /id="show-login-btn"/);
  assert.doesNotMatch(html, /<div class="auth-grid">/);
});

test("registration form keeps invite code and login return controls", async () => {
  const [html, app] = await readAuthFiles();

  assert.match(html, /name="inviteCode"/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(app, /inviteCode:\s*registerForm\.elements\.inviteCode\.value/);
  assert.match(app, /function showRegisterView\(\)/);
  assert.match(app, /function showLoginView\(/);
  assert.match(app, /showLoginBtn\.addEventListener\("click"/);
});

test("register submit returns the user to the login view instead of opening the app", async () => {
  const [, app] = await readAuthFiles();

  assert.match(app, /registerForm\.reset\(\)/);
  assert.match(app, /registerForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*showLoginView\("注册成功，请登录"\)/);
  assert.doesNotMatch(app, /registerForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*await showApp\(payload\.user\)/);
});
