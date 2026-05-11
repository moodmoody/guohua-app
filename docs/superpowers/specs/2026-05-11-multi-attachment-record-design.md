# Multi-Attachment Per Record Design

Date: 2026-05-11
Project: guohua-app
Status: Approved by user in chat, pending implementation

## Goal

Change both domains (`paintings`, `materials`) from "one uploaded file creates one record" to "one record can own many attachments".

Also support attachment lifecycle operations on existing records:
- Append one or more attachments to an existing record
- Delete a specific attachment from a record

## Scope

In scope:
- Backend data model normalization and persistence changes
- New attachment append/delete APIs for both resources
- Existing create APIs changed to return one record with many attachments
- Frontend list/edit UI updates for multi-attachment preview and operations
- Tests for new behavior and backward compatibility with legacy data

Out of scope:
- Separate attachment table/collection
- Auth/permission model changes
- Bulk import/export migrations

## Current Problem

Current implementation maps each uploaded file into a separate record in:
- `POST /api/paintings`
- `POST /api/materials`

That behavior prevents representing one business record with many files.

## Data Model

### Unified attachment model

Both `painting` and `material` records will use:

```json
{
  "attachments": [
    {
      "id": "att_...",
      "url": "/uploads/xxx.jpg",
      "assetType": "image",
      "createdAt": "2026-05-11T00:00:00.000Z"
    }
  ]
}
```

Rules:
- `id`: generated unique string per attachment (timestamp + random suffix)
- `url`: uploaded file URL under `/uploads`
- `assetType`: `image` or `video`
- `createdAt`: server-side ISO timestamp

### Backward compatibility

On read/normalize:
- Legacy `painting.imageUrl` is converted into one `attachments` item (image)
- Legacy `material.assetUrl` + `material.assetType` is converted into one `attachments` item

On write:
- `attachments` is source of truth
- Legacy fields are backfilled from first attachment to avoid short-term breakage:
  - `painting.imageUrl`
  - `material.assetUrl`
  - `material.assetType`

## API Design

### Existing create APIs (changed behavior)

1. `POST /api/paintings`
- Input: metadata + multiple `image` files
- Output: single created painting object
- Behavior: create one record; all files become `attachments`

2. `POST /api/materials`
- Input: metadata + multiple `asset` files
- Output: single created material object
- Behavior: create one record; all files become `attachments`

### New attachment APIs

1. `POST /api/paintings/:id/attachments`
- Field: `image` (multiple)
- Append uploaded files to existing painting attachments

2. `DELETE /api/paintings/:id/attachments/:attachmentId`
- Delete one attachment from painting
- Also delete physical file

3. `POST /api/materials/:id/attachments`
- Field: `asset` (multiple)
- Append uploaded files to existing material attachments

4. `DELETE /api/materials/:id/attachments/:attachmentId`
- Delete one attachment from material
- Also delete physical file

### Attachment deletion guard

For both domains:
- If deleting target attachment would leave record with zero attachments, return `400`.
- Message should clearly indicate at least one attachment must remain.

### Existing patch APIs

`PATCH /api/paintings/:id` and `PATCH /api/materials/:id` remain for metadata (`title`, `category`, `description`).

Attachment replacement logic is removed from patch endpoints. Attachment changes go only through new attachment APIs.

## Frontend Design

## Record cards

- Show preview area + attachment strip/list
- Default preview uses first attachment
- Clicking an attachment item switches preview
- Mixed media preview based on `assetType`

## Edit operations

- Keep metadata edit form
- Add "append attachments" input (multiple)
- Add delete action per attachment item
- Append and delete call new APIs directly

## UX behavior

- Success messages:
  - "Appended N attachments"
  - "Attachment deleted"
- After append/delete, reload list while preserving current page

## Error Handling

- Invalid record id: 400
- Record not found: 404
- Invalid attachment id: 404
- Attempt to remove last attachment: 400
- Wrong file type / size / too many files: existing multer error behavior retained
- On validation failure after upload, remove uploaded temp files to avoid orphan files

## Testing Strategy (TDD)

Add/adjust tests to assert:
1. `POST /api/paintings` with multiple images returns one object with `attachments.length === N`
2. `POST /api/materials` with multiple files returns one object with `attachments.length === N`
3. `POST /api/*/:id/attachments` appends multiple attachments
4. `DELETE /api/*/:id/attachments/:attachmentId` deletes specified attachment and physical file
5. Deleting last attachment returns 400
6. Legacy records (`imageUrl` / `assetUrl`) are normalized to `attachments`

## Implementation Notes

- Keep normalization centralized in backend helpers to avoid divergent format handling.
- Use shared helper functions for attachment creation, append, remove, and legacy backfill.
- Avoid introducing schema split in this iteration for minimal risk and faster delivery.

## Risks and Mitigations

1. Risk: Frontend assumptions on singular media fields break rendering
- Mitigation: keep legacy fields backfilled and migrate rendering to attachments-first

2. Risk: Old data missing `attachments`
- Mitigation: normalization converts legacy fields on read and write

3. Risk: Orphan files due to partial failures
- Mitigation: reuse cleanup helpers and delete uploaded files on request validation failure
