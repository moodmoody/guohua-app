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
  assert.match(html, /id="login-free-benefit"/);
  assert.match(html, /<div class="auth-note">[\s\S]*id="login-free-benefit"[\s\S]*<\/div>/);
  assert.match(html, /id="register-form" class="auth-form auth-form-register hidden"/);
  assert.match(html, /id="show-register-btn"/);
  assert.match(html, /id="show-login-btn"/);
  assert.doesNotMatch(html, /<div class="auth-grid">/);
});

test("registration form keeps invite code and login return controls", async () => {
  const [html, app] = await readAuthFiles();

  assert.match(html, /name="inviteCode"/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /免费试用：200M 空间/);
  assert.equal((html.match(/免费试用：200M 空间/g) || []).length, 1);
  assert.match(app, /inviteCode:\s*registerForm\.elements\.inviteCode\.value/);
  assert.match(app, /function showRegisterView\(\)/);
  assert.match(app, /function showLoginView\(/);
  assert.match(app, /showLoginBtn\.addEventListener\("click"/);
});

test("app shell exposes quota usage without exposing admin wording", async () => {
  const [html, app] = await readAuthFiles();

  assert.match(html, /id="membership-summary"/);
  assert.match(app, /const membershipSummary = document\.getElementById\("membership-summary"\)/);
  assert.match(app, /currentUsage = payload\.usage \|\| null/);
  assert.match(app, /function getVisibleUsage\(\)/);
  assert.match(app, /Math\.max\(Number\(usage\.paintingCount \|\| 0\), Number\(paintingState\.total \|\| 0\)\)/);
  assert.match(app, /Math\.max\(Number\(usage\.materialCount \|\| 0\), Number\(materialState\.total \|\| 0\)\)/);
  assert.match(app, /空间 \$\{formatBytes\(usage\.storageBytes\)\} \/ \$\{formatBytes\(quota\.storageBytes\)\}/);
  assert.match(app, /作品 \$\{usage\.paintingCount \|\| 0\}\/\$\{formatLimit\(quota\.paintingLimit\)\}/);
  assert.match(app, /素材 \$\{usage\.materialCount \|\| 0\}\/\$\{formatLimit\(quota\.materialLimit\)\}/);
  assert.match(app, /空间 \$\{formatBytes\(usage\.storageBytes\)\}/);
  assert.doesNotMatch(app, /默认用户|完全权限|AI 已开放/);
});

test("admin user management UI is available only as a gated profile section", async () => {
  const [html, app] = await readAuthFiles();

  assert.doesNotMatch(html, /id="tab-btn-admin-users"/);
  assert.doesNotMatch(html, /id="tab-pane-admin-users"/);
  assert.match(html, /id="tab-pane-profile"[\s\S]*id="admin-user-management"/);
  assert.match(html, /id="admin-user-management"/);
  assert.match(html, /id="admin-users"/);
  assert.match(html, /id="admin-user-template"/);
  assert.match(html, /admin-user-open/);
  assert.match(html, /class="admin-user-detail hidden"/);
  assert.doesNotMatch(app, /adminUsersTabButton/);
  assert.match(app, /const adminUserManagement = document\.getElementById\("admin-user-management"\)/);
  assert.match(app, /function isAdminUser\(/);
  assert.match(app, /adminUserManagement\.classList\.toggle\("hidden", !isAdminUser\(currentUser\)\)/);
  assert.match(app, /users\.filter\(\(user\) => user\.username !== "lulia" && user\.id !== currentUser\?\.id\)/);
  assert.match(app, /暂无其他用户/);
  assert.match(app, /fetchJson\("\/api\/admin\/users"\)/);
  assert.match(app, /\/api\/admin\/users\/\$\{user\.id\}\/quota/);
  assert.match(app, /function closeOtherAdminUserDetails\(/);
  assert.match(app, /detail\.classList\.toggle\("hidden", !willOpen\)/);
  assert.match(app, /\/api\/admin\/users\/\$\{user\.id\}/);
});

test("register submit returns the user to the login view instead of opening the app", async () => {
  const [, app] = await readAuthFiles();

  assert.match(app, /registerForm\.reset\(\)/);
  assert.match(app, /registerForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*showLoginView\("注册成功，请登录"\)/);
  assert.doesNotMatch(app, /registerForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*await showApp\(payload\.user\)/);
});
