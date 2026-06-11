# Tag System Design

Date: 2026-06-07
Project: guohua-app

## Goal

Add a lightweight tag system for paintings and materials. The feature should make mobile filtering faster while preserving the current guohua/xuan-paper visual tone.

## Confirmed Direction

Use an A+B hybrid:

- A: show tags directly on each painting/material card.
- B: add a horizontally scrollable tag filter strip in the list toolbar.

Do not add a separate tag management backend in this phase.

## Data Model

Each painting and material record may include:

```json
{
  "tags": ["写意", "临摹", "待装裱"]
}
```

Existing records without `tags` are treated as `[]`.

Tags are normalized on create/update:

- Accept a plain text field from forms.
- Split by comma, Chinese comma, dunhao, semicolon, slash, or whitespace.
- Trim each tag.
- Remove empty values.
- Remove duplicates.
- Keep the first occurrence order.
- Limit to a small practical count per item to protect mobile layouts.

## API

Painting list:

- `GET /api/paintings?tag=<tag>` filters by exact tag.
- `q` search also matches tags.
- Response records include normalized `tags`.

Material list:

- `GET /api/materials?tag=<tag>` filters by exact tag.
- `q` search also matches tags.
- Response records include normalized `tags`.

Tag summaries:

- `GET /api/tags/paintings` returns unique tags from the current user's paintings.
- `GET /api/tags/materials` returns unique tags from the current user's materials.
- Results are sorted for stable UI display.

Create/update:

- `POST /api/paintings`, `PATCH /api/paintings/:id`
- `POST /api/materials`, `PATCH /api/materials/:id`
- Accept a `tags` field as text or array and store normalized tags.

## Frontend Behavior

Forms:

- Add a "标签" input to painting and material create forms.
- Add the same input to painting and material edit forms.
- Placeholder example: `写意 临摹 待装裱`.

List toolbar:

- Add a tag strip below each existing category/search toolbar.
- Include an "全部标签" pill to clear the tag filter.
- User can tap a tag pill to filter.
- The strip scrolls horizontally on mobile.

Cards:

- Show item tags under metadata or description.
- Tapping a card tag applies that tag filter and reloads the list.

Search:

- Search keyword highlights can remain focused on title/category/description/comment for this phase.
- Matching by tag is required even if tag text is not highlighted.

## Styling

Use small seal-like pills:

- restrained paper/ink colors already used by the app;
- compact hit areas for mobile;
- no bright SaaS-style blue chips;
- no large cards or nested card structures.

## Testing

Add focused tests for:

- server tag normalization and persistence for paintings/materials;
- filtering by `tag`;
- keyword search matching tags;
- tag endpoints scoped to the current user;
- frontend markup and JavaScript hooks for tag input, tag strip, and card tags.

## Out Of Scope

- Dedicated tag CRUD admin page.
- Tag colors or per-tag metadata.
- Bulk retagging.
- Analytics by tag.
- Public share-page tag display unless it falls out naturally from existing rendering.
