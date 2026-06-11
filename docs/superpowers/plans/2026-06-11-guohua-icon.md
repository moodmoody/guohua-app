# Guohua Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the supplied guohua logo image as the app icon across PWA and Android launcher assets.

**Architecture:** Keep `public/assets/guohua-logo-source.webp` as the canonical source copy. Generate `public/assets/app-icon.png` and Android PNG launcher assets from a shared Pillow script so desktop/PWA and APK icons stay visually aligned.

**Tech Stack:** WebP/PNG, Pillow, Node.js tests, Android resource directories.

---

### Task 1: Lock Icon Semantics With A Test

**Files:**
- Create: `test/icon-assets.test.js`
- Read: `public/assets/guohua-logo-source.webp`
- Read: `public/assets/app-icon.png`
- Read: `android/app/src/main/res/mipmap-*/ic_launcher.png`

- [ ] Add a Node test that asserts the source WebP exists and `app-icon.png` is 512x512.
- [ ] Add the same test to verify Android launcher PNGs exist for mdpi, hdpi, xhdpi, xxhdpi, and xxxhdpi.
- [ ] Run `node --test test\icon-assets.test.js` and confirm it fails before the generated PNG exists.

### Task 2: Generate Canonical PNG

**Files:**
- Create: `tools/generate_guohua_icons.py`
- Create: `public/assets/guohua-logo-source.webp`
- Create: `public/assets/app-icon.png`

- [ ] Copy the supplied source image into `public/assets/guohua-logo-source.webp`.
- [ ] Generate `public/assets/app-icon.png` with a 512x512 xuanzhi-textured background.
- [ ] Run `node --test test\icon-assets.test.js` and confirm the source and PNG assertions pass.

### Task 3: Generate Android Launcher PNGs

**Files:**
- Modify: `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
- Modify: `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- Modify: `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
- Modify: `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
- Modify: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
- Modify matching `ic_launcher_round.png` and `ic_launcher_foreground.png` assets.

- [ ] Resize the generated PNG to launcher PNG sizes: 48, 72, 96, 144, and 192.
- [ ] Use the same visual for round and foreground assets to keep the launcher consistent.
- [ ] Run `node --test test\icon-assets.test.js` and confirm all icon asset assertions pass.

### Task 4: Verify Build

**Files:**
- Read: `android/app/build/outputs/apk/debug/app-debug.apk`

- [ ] Run `node --check public\app.js`.
- [ ] Run `node --test test\icon-assets.test.js`.
- [ ] Run `node --test test`.
- [ ] Run `npm run mobile:sync`.
- [ ] Run `npm run mobile:build:android`.
- [ ] Confirm `android/app/build/outputs/apk/debug/app-debug.apk` is regenerated.
