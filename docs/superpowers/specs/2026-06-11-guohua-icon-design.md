# Guohua Icon Design

## Goal

Redesign the app icon so the Web/PWA and Android launcher surfaces feel closer to the app's guohua and xuanzhi visual identity.

## Direction

Use the provided `D:\国画.webp` image as the logo source. Replace its flat white background with a warmer xuanzhi texture while preserving the original black wordmark, vertical Latin text, and red seal.

## Scope

- Keep a project copy at `public/assets/guohua-logo-source.webp`.
- Generate `public/assets/app-icon.png`.
- Point the manifest and Apple touch icon at `app-icon.png`.
- Regenerate Android launcher PNG assets from the same processed source.
- Add a focused asset test that catches accidental removal of the source, PNG icon, or Android launcher assets.

## Non-Goals

- No app name change.
- No broader UI restyling.
- No release signing or Play Store packaging.
