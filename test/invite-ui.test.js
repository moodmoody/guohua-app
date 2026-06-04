const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

test("registration form collects and submits an invitation code", async () => {
  const [html, app] = await Promise.all([
    fs.readFile("public/index.html", "utf8"),
    fs.readFile("public/app.js", "utf8"),
  ]);

  assert.match(html, /name="inviteCode"/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(app, /inviteCode:\s*registerForm\.elements\.inviteCode\.value/);
});
