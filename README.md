# hexbattle-api

Data API of HexBattle Online: the armies, tiles, mechanics and markers of the board game Neuroshima Hex (edition 3.0, Portal Games) as versioned, validated JSON.

Work in progress – not published yet. Planned address: `https://api.hexbattle.online/v1/`.

## What the API serves

Static, read-only JSON files (GET only, CORS open to every origin). Game objects only: armies, tiles and their printed features, the mechanics vocabulary they point to, markers, skins and the board layout. Rules and game logic are not part of the API – a game app implements them.

| Path                                                      | Content                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/index.json`                                          | release metadata (`dataset_version`, complete languages, build time in UTC), the army list with completeness, links to every file, the image list |
| `/v1/mechanics.json`                                      | every mechanic (attacks, abilities, effects, army rules…) with its parameters and player-facing description                                       |
| `/v1/markers.json`                                        | marker types (Rana, Sieć, Inicjatywa…)                                                                                                            |
| `/v1/boards.json`                                         | board layouts: axial flat-top hexes, zones, ring order, HP track                                                                                  |
| `/v1/armies/<army_id>.json`                               | one army: display data, deck, tiles with features and `derived` values (HP, Inicjatywa, Moduł reach)                                              |
| `/v1/skins/index.json`, `/v1/skins/<skin_id>.json`        | army skins (replacement tile images)                                                                                                              |
| `/v1/board_skins/index.json`, `/v1/board_skins/<id>.json` | table backgrounds and the default one                                                                                                             |
| `/v1/schema/<file>.schema.json`                           | JSON Schema (draft 2020-12) of every file above and of the query responses                                                                        |
| `/v1/query/tiles?…`, `/v1/query/mechanics?…`              | server-side filtering (see Queries)                                                                                                               |
| `/v1/assets/…`                                            | images                                                                                                                                            |

### Images

An image named `moloch/klaun_front.png` in the data is served only as WebP variants: `/v1/assets/moloch/klaun_front@512.webp` (also `@256`, `@128`; board skins `@4096`, `@2048`, `@1024`; never larger than the original). `index.json → assets.files` lists the sizes of every image and its SHA-256, which changes when an image is replaced. SVG logos are served as they are.

### Descriptions

Mechanic descriptions may contain placeholders filled from a feature's values (`{amount@sign:Zwiększa,Zmniejsza}`, `{factor:Ruch,Ruchy,Ruchów}`, `{side}`…). `renderDescription()` in `@hexbattle/schema` renders them; every consumer should use it so texts read the same everywhere.

### Queries

Besides the static files, a small read-only query service filters the data on the server. GET only; lists are comma-separated; an unknown or invalid parameter answers `400` with `{"error":"bad_query","details":[{"param","message"}]}`. Every response has `query` (the parameters as understood), `total` (matches before paging) and `results`. Response schemas: `/v1/schema/query_<route>.schema.json`.

Every query takes `id` (a list of ids), `name` (part of the name in any language, ignoring case and Polish letters – `lowca` finds "Łowca"; with `exact=true` the whole name), `limit` and `offset` (paging, default 100, at most 500).

| Route                   | Results                           | More parameters                                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/query/tiles`       | tiles with their army id (`army`) | `army`, `category` (lists); `mechanic` (a feature anywhere on the tile, also inside Moduł features) refined by `min_strength` and `side`; `hp`, `min_hp`, `max_hp` (Sztab, Obiekt, Wojownik, Moduł); `initiative`, `min_initiative`; `copies`, `min_copies`; `fields` (only these fields, e.g. `id,name,copies,army`) |
| `/v1/query/armies`      | whole army files                  | `origin` (list), `official` (`true`/`false`), `fields` (e.g. `id,name,display`)                                                                                                                                                                                                                                       |
| `/v1/query/mechanics`   | mechanics                         | `kind`, `placement` (lists), `used_by` (army id)                                                                                                                                                                                                                                                                      |
| `/v1/query/markers`     | marker types                      | `placement` (list)                                                                                                                                                                                                                                                                                                    |
| `/v1/query/skins`       | army skins                        | `army` (list)                                                                                                                                                                                                                                                                                                         |
| `/v1/query/board_skins` | board skins                       | `default` (`true`/`false`)                                                                                                                                                                                                                                                                                            |

```bash
curl -s "https://api.hexbattle.online/v1/query/tiles?id=moloch.klaun"
curl -s "https://api.hexbattle.online/v1/query/tiles?name=oficer&exact=true&fields=id,army"
curl -s "https://api.hexbattle.online/v1/query/tiles?mechanic=modify_stat&side=enemy"
curl -s "https://api.hexbattle.online/v1/query/armies?id=hegemonia&fields=id,name,display"
curl -s "https://api.hexbattle.online/v1/query/mechanics?kind=effect&used_by=borgo"
```

### Versioning

- **`/v1/` never changes meaning.** Files and fields keep what they mean; new optional fields and new files may be added. A breaking change goes to `/v2/`, with `/v1/` kept for a deprecation period.
- **`dataset_version`** (semver) changes with every data release: minor for new content (an army, a skin), patch for corrections. Clients compare it to detect new data.
- Caching: `index.json` 60 s, other JSON and query answers 5 min, images 1 day, all with ETags.

## Repository

```
packages/schema/   @hexbattle/schema – Zod 4 schemas and types of every file (the single schema source), description templates
data/              source data: mechanics.json, markers.json, armies/, skins/, board_skins/
assets.manifest.json   every image the data uses: published path → master file, SHA-256, size
tools/             build, validation, image step, local server, manifest and editor-schema tools
tests/             tests and test-only fixtures (never API data)
```

Image masters are not in git. The build reads them from a private folder (`ASSETS_DIR`); without it, the data and the manifest are still checked but no images are written.

## Development

Requirements: Node 24, pnpm (version from `packageManager`).

```
pnpm install
cp .env.example .env      # set ASSETS_DIR to the masters folder (optional)
pnpm check                # typecheck, lint, format, tests under several time zones, release build
pnpm build                # dev build into dist/v1/ (drafts and incomplete armies allowed, with warnings)
pnpm build:release        # strict build: every army complete, every image in the manifest
pnpm serve                # serve dist/v1/ and the query service at http://localhost:8080/v1/
pnpm assets:manifest      # update assets.manifest.json after adding or replacing an image
pnpm schema:editor        # JSON Schemas for editor validation of data/ (VS Code picks them up)
```

Build issues have stable codes (`E_…` errors stop the build, `W_…` warnings don't); the full list with meanings is in `tools/lib/issues.ts`.

## Licence

HexBattle Online is a non-commercial, fan-made project. Neuroshima Hex, its names, texts, artwork and brand are the property of Portal Games – see [`NOTICE.md`](NOTICE.md).

- Code: MIT – [`LICENSE`](LICENSE)
- Data and images: [`LICENSE-DATA.md`](LICENSE-DATA.md) (our data structure under CC BY-NC 4.0; Portal Games content not licensed)
