# User Management Design

## Goal

Add local user management to the Guohua app so each user can register, log in, log out, manage their own profile, upload an avatar, and manage only their own paintings and materials.

## Chosen Approach

Use the existing JSON-file storage style and add cookie-based sessions. This keeps deployment consistent with the current `/var/www/guohua-app` setup and avoids introducing a database for this phase.

## Data Model

Extend `data/paintings.json` with:

```json
{
  "userLastId": 0,
  "users": [],
  "sessions": [],
  "paintingLastId": 0,
  "materialLastId": 0,
  "paintings": [],
  "materials": []
}
```

User records:

```json
{
  "id": 1,
  "username": "legacy",
  "passwordHash": "pbkdf2...",
  "displayName": "legacy",
  "bio": "",
  "avatarUrl": "",
  "createdAt": "2026-05-28T00:00:00.000Z",
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

Session records:

```json
{
  "id": "random-token",
  "userId": 1,
  "createdAt": "2026-05-28T00:00:00.000Z",
  "expiresAt": "2026-06-27T00:00:00.000Z"
}
```

Painting and material records gain `ownerUserId`. All existing records without `ownerUserId` are assigned to a generated `legacy` user during normalization.

## Authentication

Add endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Registration accepts `username`, `password`, and optional `displayName`. Usernames are unique and normalized by trimming. Passwords are stored as salted `crypto.pbkdf2` hashes. Registration logs the user in automatically.

Login creates a session and sets an HTTP-only cookie named `guohua_session`. Logout deletes the current session and clears the cookie. Expired sessions are ignored and pruned when the DB is written.

## Authorization

All painting and material APIs require a logged-in user. Unauthenticated requests return `401`.

The current user can only see and mutate records where `ownerUserId` matches their user id:

- `GET /api/paintings`
- `GET /api/paintings/:id`
- `POST /api/paintings`
- `PATCH /api/paintings/:id`
- `DELETE /api/paintings/:id`
- Painting attachment and comment routes
- Equivalent material routes
- Painting and material category routes

Create endpoints set `ownerUserId` from the session. Mutating another user's item returns `404` to avoid leaking the existence of other users' records.

## Legacy Data

When old records have no owner:

1. Ensure a `legacy` user exists.
2. Assign missing `ownerUserId` fields to the legacy user.
3. Use `LEGACY_USER_PASSWORD` for the legacy user's initial password.
4. If `LEGACY_USER_PASSWORD` is not provided, generate a random temporary password and print it once during startup.

This keeps existing paintings and materials available without exposing them to newly registered users.

## Profile

Add endpoints:

- `PATCH /api/profile`
- `POST /api/profile/avatar`
- `POST /api/profile/password`

Profile fields are `displayName` and `bio`. Avatar uploads allow JPG, PNG, and WEBP up to 5MB and store files in `uploads/`, returning an `/uploads/...` URL. Password changes require the current password and a new password.

`GET /api/auth/me` returns safe user fields only: `id`, `username`, `displayName`, `bio`, `avatarUrl`, `createdAt`, and `updatedAt`.

## Frontend

Unauthenticated users see an auth screen with login and registration forms. Authenticated users see the current management app.

The main app keeps the existing tabs and adds a third tab:

- Works
- Materials
- Profile

The header displays current user avatar, display name, username, and a logout button. Profile tab lets the user update display name, bio, avatar, and password.

After login or registration, the frontend loads user-scoped categories, paintings, and materials. After logout, it clears local state and returns to the auth screen.

## Error Handling

Return JSON errors with stable messages:

- `400` for invalid input, duplicate username, unsupported avatar type, or weak passwords.
- `401` for missing or invalid sessions.
- `404` for missing records or records owned by another user.

The frontend shows auth/profile errors in local message areas and preserves existing painting/material message behavior.

## Tests

Add server tests for:

- Register creates a user and sets a session cookie.
- Duplicate username is rejected.
- Login accepts the correct password and rejects the wrong password.
- Logout invalidates the session.
- `GET /api/auth/me` returns safe profile fields.
- Profile update and avatar upload work for the current user.
- Password change requires the current password.
- Paintings and materials are isolated by user.
- Legacy records are assigned to the legacy user.

Add frontend helper tests where logic can be isolated. Keep existing upload tests passing.

## Deployment Notes

The app remains a Node/Express service under PM2. No database service is required. Before deploying, set `LEGACY_USER_PASSWORD` on the server if legacy data exists and the password should be deterministic.
