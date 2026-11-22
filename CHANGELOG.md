# Changelog

Data releases of the HexBattle Online data API (`dataset_version` in `/v1/index.json`). Dates are Europe/Warsaw dates.

## 0.2.0 – 2026-11-22

- Moloch: nowe domyślne obrazy żetonów (zestaw grafik z instrukcji armii, skórka „Domyślny”); dane żetonów odczytane z nich na nowo – Szerszeń i Wartownik obrócone (Inicjatywa prosto), miejsca odznak u Działka Gaussa, Hybrydy, Juggernauta, Opancerzonego Łowcy, Opancerzonego Wartownika i Szturmowca
- Pierwsza skórka armii: `moloch.rok_molocha` („Rok Molocha”) – dotychczasowe obrazy 3.0 wszystkich 23 żetonów i rewers, z własnym obrotem (`turn`) i miejscami odznak (`badges`) tam, gdzie grafika różni się od danych (`@hexbattle/schema` 0.6.1)

## 0.1.2 – 2026-11-21

- Obraz mechaniki Nadanie cechy: wariant z Mobilnością (Transport Hegemonii); obrazy 24 innych mechanik weszły z wersją 0.1.1

## 0.1.1 – 2026-11-21

- Aktualizacja nazw mechanik

## 0.1.0 – unreleased

First version of the API built on the Zod 4 schema.

- Armies: Moloch, Posterunek, Borgo, Hegemonia (35 tiles each, all verified).
- 27 mechanics, 4 marker types, 1 board skin (Zniszczone miasto (2013)), the standard board layout.
- Polish texts complete; English not yet.
- Images as WebP (tiles 512/256/128, board 4096/2048/1024), logos as SVG.
- JSON Schemas of every file in `/v1/schema/`.
- Mechanics may name the tile types that may carry them (`tile_categories`; e.g. attacks only on fighting tiles, Bitwa only on Natychmiastowe and Wszczepy); the build refuses a feature on another type (`E_MECH_TILE`); every mechanic has them (`@hexbattle/schema` 0.4.0).
- Mechanics may carry pictures of how they look on a tile (`images`: the image in the tile frame, `params` for a variant such as Obrażenia obszarowe with `template: bomb`, `mono` for plain black glyphs); 24 mechanics have them (`@hexbattle/schema` 0.5.0).
- `index.json` → `meta.schema_version`: the `@hexbattle/schema` version the release was built with; army `origin` may also be `mini_expansion` (minidodatek) (`@hexbattle/schema` 0.3.0).
- Badges may carry an exact drawn position `pos` (x, y from the tile centre in units of the hex's outer radius, on the unturned face) where the drawing matters; the game meaning stays the badge's slot (`@hexbattle/schema` 0.2.0).
- `pnpm images:fetch` downloads the published images for a copy built without the image masters.
- Query service: `/v1/query/tiles`, `armies`, `mechanics`, `markers`, `skins`, `board_skins` – every one by `id` and `name` (part or `exact`), plus their own filters (tiles: army, category, mechanic with strength and side, HP, Inicjatywa, copies, fields), paging.
