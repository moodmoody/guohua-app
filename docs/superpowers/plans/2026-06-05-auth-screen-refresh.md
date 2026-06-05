# Auth Screen Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the login experience so it keeps the current ink-and-paper mood, shows login by default, reveals registration only on request, and returns to login after a successful registration.

**Architecture:** Keep the existing auth page and app shell structure, but split the auth area into view-specific panels controlled by lightweight client-side state. Cover the flow with small regression tests that verify the new markup and registration behavior before adjusting styling.

**Tech Stack:** Static HTML, vanilla JavaScript, existing CSS, Node test runner

---

### Task 1: Add regression tests for auth view flow

**Files:**
- Modify: `test/invite-ui.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test("auth screen defaults to login and exposes a secondary register entry", async () => {
  const html = await fs.readFile("public/index.html", "utf8");

  assert.match(html, /id="login-form"/);
  assert.match(html, /id="register-form"/);
  assert.match(html, /id="show-register-btn"/);
  assert.match(html, /id="show-login-btn"/);
  assert.match(html, /class="auth-form auth-form-register hidden"/);
});

test("register submit returns the user to the login view", async () => {
  const app = await fs.readFile("public/app.js", "utf8");

  assert.match(app, /function showRegisterView\(\)/);
  assert.match(app, /function showLoginView\(/);
  assert.match(app, /registerForm\.reset\(\)/);
  assert.match(app, /showLoginView\(/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test\\invite-ui.test.js`
Expected: FAIL because the toggle buttons, hidden register form class, and register-to-login flow do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
const showRegisterBtn = document.getElementById("show-register-btn");
const showLoginBtn = document.getElementById("show-login-btn");

function showLoginView(message = "", isError = false) {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  setMessage(authMessage, message, isError);
}

function showRegisterView() {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  setMessage(authMessage, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test\\invite-ui.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js test/invite-ui.test.js
git commit -m "feat: add auth screen view switching"
```

### Task 2: Restructure auth markup for a login-first flow

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Write the failing test**

```js
test("register form keeps invite code and secondary navigation controls", async () => {
  const html = await fs.readFile("public/index.html", "utf8");

  assert.match(html, /name="inviteCode"/);
  assert.match(html, /id="show-register-btn"/);
  assert.match(html, /id="show-login-btn"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test\\invite-ui.test.js`
Expected: FAIL until the new controls and classes are present.

- [ ] **Step 3: Write minimal implementation**

```html
<div class="auth-stage">
  <form id="login-form" class="auth-form auth-form-login">...</form>
  <form id="register-form" class="auth-form auth-form-register hidden">...</form>
</div>
```

```js
showRegisterBtn.addEventListener("click", showRegisterView);
showLoginBtn.addEventListener("click", () => showLoginView());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test\\invite-ui.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js test/invite-ui.test.js
git commit -m "feat: make auth flow login first"
```

### Task 3: Polish the auth panel styling without changing the site identity

**Files:**
- Modify: `public/style.css`
- Test: `test/responsive-css.test.js`

- [ ] **Step 1: Write the failing test**

```js
test("auth screen uses the new stage layout and mobile-safe actions", async () => {
  const css = await fs.readFile("public/style.css", "utf8");

  assert.match(css, /\.auth-stage/);
  assert.match(css, /\.auth-aside/);
  assert.match(css, /@media \(max-width: 860px\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test\\responsive-css.test.js test\\invite-ui.test.js`
Expected: FAIL until the new layout selectors and mobile rules exist.

- [ ] **Step 3: Write minimal implementation**

```css
.auth-stage { display: grid; }
.auth-aside { display: grid; gap: 14px; }
.auth-form.hidden { display: none; }
@media (max-width: 860px) { .auth-stage { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test\\responsive-css.test.js test\\invite-ui.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/style.css test/responsive-css.test.js test/invite-ui.test.js
git commit -m "style: refine ink-inspired auth screen"
```

### Task 4: Run the full regression suite and prepare deployment

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`
- Modify: `test/invite-ui.test.js`
- Modify: `test/responsive-css.test.js`

- [ ] **Step 1: Run focused auth tests**

Run: `node --test test\\invite-ui.test.js`
Expected: PASS

- [ ] **Step 2: Run broader regression coverage**

Run: `node --test test\\auth.test.js test\\file-selection.test.js test\\invite-ui.test.js test\\multi-upload.test.js test\\ownership.test.js test\\pagination.test.js test\\responsive-css.test.js test\\static-cache.test.js`
Expected: PASS with 0 failures

- [ ] **Step 3: Run syntax checks**

Run: `node --check public\\app.js`
Expected: no output

Run: `node --check server.js`
Expected: no output

- [ ] **Step 4: Review staged diff**

Run: `git -c safe.directory=C:/Users/weife/Documents/Codex/guohua-app diff --stat`
Expected: auth markup, auth script, auth styling, and tests only

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js public/style.css test/invite-ui.test.js test/responsive-css.test.js
git commit -m "feat: refresh login-first auth experience"
```
