# Changelog

Data releases of the HexBattle Online data API (`dataset_version` in `/v1/index.json`). Dates are Europe/Warsaw dates.

## 0.1.0 – unreleased

First version of the API built on the Zod 4 schema.

- Armies: Moloch, Posterunek, Borgo, Hegemonia (35 tiles each, all verified).
- 27 mechanics, 4 marker types, 1 board skin (Zniszczone miasto (2013)), the standard board layout.
- Polish texts complete; English not yet.
- Images as WebP (tiles 512/256/128, board 4096/2048/1024), logos as SVG.
- JSON Schemas of every file in `/v1/schema/`.
- Badges may carry an exact drawn position `pos` (x, y from the tile centre in units of the hex's outer radius, on the unturned face) where the drawing matters; the game meaning stays the badge's slot (`@hexbattle/schema` 0.2.0).
- `pnpm images:fetch` downloads the published images for a copy built without the image masters.
- Query service: `/v1/query/tiles`, `armies`, `mechanics`, `markers`, `skins`, `board_skins` – every one by `id` and `name` (part or `exact`), plus their own filters (tiles: army, category, mechanic with strength and side, HP, Inicjatywa, copies, fields), paging.
