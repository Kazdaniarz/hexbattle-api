# hexbattle-api

Data API of HexBattle Online: the armies, tiles, mechanics and markers of the board game Neuroshima Hex (edition 3.0, Portal Games) as versioned, validated JSON.

> **Status: the public API is not live yet.** It will be served at `https://api.hexbattle.online/v1/`. Until then, [run your own copy](#running-your-own-copy) – every example in this README works with both.

**Contents:** [Using the public API](#using-the-public-api) · [Running your own copy](#running-your-own-copy) · [What the API serves](#what-the-api-serves) · [Files and folders](#files-and-folders) · [Data structure](#data-structure) · [Images](#images) · [Descriptions](#descriptions) · [Using the API with curl](#using-the-api-with-curl) · [Versioning](#versioning) · [Development](#development) · [Licence](#licence)

## Using the public API

The official instance runs at **`https://api.hexbattle.online/v1/`** – free, no login, no key, read-only, open to requests from any website (CORS `*`). Start with `/v1/index.json`, which links to everything else, or ask the [query service](#queries) directly:

```bash
curl -s "https://api.hexbattle.online/v1/query/tiles?id=moloch.klaun"
```

Please cache what you load (responses carry `Cache-Control` and `ETag`, see [Headers, caching and errors](#headers-caching-and-errors)) and use `index.json → meta.dataset_version` to notice new data.

## Running your own copy

This repository builds and serves the same API. Requirements: Node 24 and pnpm. In the repository folder:

```bash
pnpm install
pnpm build:release
pnpm serve
```

It answers at `http://localhost:8080/v1/` – only from this computer – until you stop it with Ctrl+C. Another address or port:

| Option             | Default                          | Example                                                                     |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| `--port` or `PORT` | `8080`                           | `pnpm serve --port 9000`                                                    |
| `--host` or `HOST` | `127.0.0.1` (this computer only) | `pnpm serve --host 0.0.0.0` – reachable from other computers and containers |

Notes for your own copy:

- **Images:** they are not in this repository – see [Images for your copy](#images-for-your-copy) below.
- **Any address works:** every link inside the data is relative (`armies/moloch.json`, `assets/…`), so the files work from any host or folder without a rebuild.
- **Static files only:** `dist/v1/` can also be served by any web server; only `/v1/query/` needs `pnpm serve`.

### Images for your copy

The images (WebP variants and SVG logos) are made from private image masters and are not part of this repository. Download them from a running API instead – by default the public one:

```bash
pnpm images:fetch                                   # from https://api.hexbattle.online
pnpm images:fetch --from http://other-host:8080     # or from another copy
pnpm build:release                                  # copies them into dist/v1/assets/
pnpm serve
```

`images:fetch` reads the image list from `/v1/index.json`, downloads every file into `.cache/fetched/` and checks it (SVG by its SHA-256 in `index.json`, WebP by format and size). Files already there and correct are kept, so running it again only fetches what is new or changed; `--force` downloads everything again. Every `pnpm build` then copies the images from `.cache/fetched/`. The public API must be live for the default source (see the status line at the top).

## What the API serves

Read-only JSON over HTTP – GET only, no login, open to every origin (CORS `*`). It holds **game objects only**: armies, tiles and their printed features, the mechanics vocabulary those features point to, markers, skins and the board layout. Rules and game logic are not part of the API – a game app implements them.

There are two ways in:

- **Static files** – each file holds one kind of object (an army with its tiles, all mechanics, …). Best for apps that load everything once.
- **Query service** – `/v1/query/…` filters on the server and returns only what matches (by id, name, army, mechanic, HP…). Best for looking things up.

| Path                                                      | Content                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/v1/index.json` (also `/v1/`)                            | release metadata, the army list with completeness, links to every file, the image list                             |
| `/v1/armies/<army_id>.json`                               | one army: display data, deck, tiles with features and derived values                                               |
| `/v1/mechanics.json`                                      | every mechanic (attacks, defences, abilities, effects, army rules…) with parameters and player-facing description  |
| `/v1/markers.json`                                        | marker types (Rana, Sieć, Inicjatywa, Znacznik Sztabu)                                                             |
| `/v1/boards.json`                                         | board layouts: hexes, zones, ring order, HP track                                                                  |
| `/v1/skins/index.json`, `/v1/skins/<skin_id>.json`        | army skins (replacement tile images)                                                                               |
| `/v1/board_skins/index.json`, `/v1/board_skins/<id>.json` | table backgrounds and the default one                                                                              |
| `/v1/schema/<name>.schema.json`                           | JSON Schema (draft 2020-12) of every file and every query response                                                 |
| `/v1/query/<route>?…`                                     | server-side filtering: `tiles`, `armies`, `mechanics`, `markers`, `skins`, `board_skins` (see [queries](#queries)) |
| `/v1/assets/…`                                            | images: WebP variants and SVG logos (see [Images](#images))                                                        |

## Files and folders

### Published API (`/v1/`)

```
v1/
  index.json                      start here: version, armies, links, image list
  mechanics.json                  mechanics registry + shared word forms (terms)
  markers.json                    marker types
  boards.json                     board layouts
  armies/
    borgo.json  hegemonia.json  moloch.json  posterunek.json
  skins/
    index.json                    all army skins (none published yet)
  board_skins/
    index.json                    all board skins + the default
    zniszczone_miasto2013.json
  schema/
    index.schema.json  army.schema.json  mechanics.schema.json  markers.schema.json  boards.schema.json
    skin.schema.json  skins_index.schema.json  board_skin.schema.json  board_skins_index.schema.json
    query_tiles.schema.json  query_armies.schema.json  query_mechanics.schema.json
    query_markers.schema.json  query_skins.schema.json  query_board_skins.schema.json
  assets/
    moloch/klaun_front@512.webp   …@256.webp  …@128.webp   (one folder per army)
    moloch/logo.svg
    markers/rana@256.webp  …
    board_skins/zniszczone_miasto2013@4096.webp  …@2048.webp  …@1024.webp
  query/                          not files – the query service (tiles, armies, mechanics, markers, skins, board_skins)
```

### Repository

```
packages/schema/         @hexbattle/schema – Zod 4 schemas and TypeScript types of every file and query (the single
                         schema source), description templates (renderDescription)
data/                    source data: mechanics.json, markers.json, armies/, skins/, board_skins/
assets.manifest.json     every image the data uses: published name → private master file, SHA-256, size
tools/                   build, validation, image step, query service and server, manifest and editor-schema tools
tests/                   tests and test-only fixtures (never API data)
```

Image masters are not in git. The build reads them from a private folder (`ASSETS_DIR`).

## Data structure

Every object is strict: fields not listed here never appear. Field names are snake_case. The JSON Schemas in `/v1/schema/` describe every field exactly; this section explains them. Polish game terms are kept as they are (Sztab = HQ, Moduł = module, Inicjatywa = initiative, Rana = wound, Sieć = net, Wytrzymałość = toughness).

### Common types

| Type           | Form                                                                                                                                               | Example                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| id             | lowercase ASCII, `_` between words, Polish letters transliterated                                                                                  | `moloch`, `melee`, `zniszczone_miasto2013`  |
| army-scoped id | `<army_id>.<slug>` – tiles and skins                                                                                                               | `moloch.opancerzony_lowca`                  |
| text           | `{ "pl": "…", "en": "…" }` – Polish always, English optional (not added yet)                                                                       | `{ "pl": "Opancerzony Łowca" }`             |
| image name     | path below `/v1/assets/`; `.png` names are served as WebP (see [Images](#images))                                                                  | `moloch/klaun_front.png`, `moloch/logo.svg` |
| anchor (`at`)  | where a feature sits on a tile face: `{ "edge": 0–5, "i"?: n }`, `{ "corner": 0–5 }`, `{ "slot": "c0"…"c5" \| "e0"…"e5" }` or `{ "center": true }` | `{ "edge": 0 }`, `{ "slot": "c4" }`         |
| side           | who an effect applies to: `own` (only own tiles), `allied` (own + teammates), `enemy`, `all`                                                       | `"enemy"`                                   |

**Tile geometry.** Tiles are flat-top hexes shown unrotated, edge 0 up. Edges are numbered clockwise from the top: `0` N, `1` NE, `2` SE, `3` S, `4` SW, `5` NW. Corners: `0` upper right (between N and NE), `1` E, `2` lower right, `3` lower left, `4` W, `5` upper left. Badges take one of 12 positions at 30° steps, clockwise from the top: `e0 c0 e1 c1 e2 c2 e3 c3 e4 c4 e5 c5` (`e`k points at edge k, `c`k at corner k). `i` orders several icons on one edge.

### `index.json` – release

`meta` (`dataset_version` semver, `languages` complete in this release, `generated_at` UTC, `build` `dev`/`release`), `armies` (id, name, official, origin, `href`, `completeness`), `files` (links to the other files) and `assets` (image naming, sizes and per-image `sha256`, `width`, `height`, available `webp` sizes). Shortened example (one army, two images):

```json
{
	"meta": {
		"dataset_version": "0.1.0",
		"languages": ["pl"],
		"generated_at": "2026-11-08T10:51:59.606Z",
		"build": "release"
	},
	"armies": [
		{
			"id": "borgo",
			"name": { "pl": "Borgo" },
			"official": true,
			"origin": "base_game",
			"href": "armies/borgo.json",
			"completeness": {
				"tiles_recorded": 14,
				"copies_recorded": 35,
				"deck_size": 35,
				"draft_tiles": 0,
				"status": "complete"
			}
		}
	],
	"files": {
		"mechanics": "mechanics.json",
		"markers": "markers.json",
		"boards": "boards.json",
		"skins": "skins/index.json",
		"board_skins": "board_skins/index.json",
		"schemas": "schema/"
	},
	"assets": {
		"base": "assets/",
		"webp": {
			"quality": 88,
			"sizes": [512, 256, 128],
			"sizes_by_prefix": { "board_skins/": [4096, 2048, 1024] },
			"name": "{path without .png}@{size}.webp"
		},
		"files": {
			"borgo/back.png": {
				"sha256": "be28bcfecae49a18302c0c1d6586197f7a16abe3198bca6622b5a371d4ba79e7",
				"width": 891,
				"height": 771,
				"webp": [512, 256, 128]
			},
			"borgo/logo.svg": {
				"sha256": "71436de59d6baa393d4bddfca3970ea237631d3717365b0b7d6f4b573b1b0508",
				"webp": []
			}
		}
	}
}
```

<!-- schema: Index -->

### Army – `armies/<army_id>.json`

| Field                    | Meaning                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `official` | army id, name, official Portal Games army or not                                                                                                                                        |
| `origin`                 | `base_game` or `expansion`                                                                                                                                                              |
| `display`                | `colors` (`primary`, `secondary`, `layout` `solid`/`diagonal_split`), `logo.image` (SVG), `back` (tile back), `hp_markers` (one per Sztab), `manual` (PDF links per language, optional) |
| `rules`                  | army rules printed on no tile, as pointers to `army_rule` mechanics (absent = standard game)                                                                                            |
| `pools`                  | army marker pools (absent = none)                                                                                                                                                       |
| `deck`                   | `size` (35 or 36), optional `swap` rules                                                                                                                                                |
| `tiles`                  | the tile types (see below)                                                                                                                                                              |
| `derived`                | computed by the build: `mechanics_used`, `required_pools`, `board_roles`, `completeness`                                                                                                |

Example (Moloch, its 23 tiles left out):

```json
{
	"id": "moloch",
	"name": { "pl": "Moloch" },
	"official": true,
	"origin": "base_game",
	"display": {
		"colors": { "primary": "#8D2418", "secondary": "#4E0505", "layout": "solid" },
		"logo": { "image": "moloch/logo.svg" },
		"back": "moloch/back.png",
		"hp_markers": [{ "tile_id": "moloch.sztab", "image": "moloch/hp_marker.png" }]
	},
	"deck": { "size": 35 },
	"derived": {
		"mechanics_used": [
			"armor",
			"damage_area",
			"explosion",
			"extra_initiative",
			"gauss",
			"initiative",
			"medic",
			"melee",
			"modify_stat",
			"module_link",
			"move",
			"net",
			"push",
			"ranged",
			"ranged_plus1_aura",
			"start_battle",
			"toughness"
		],
		"required_pools": [],
		"board_roles": [],
		"completeness": {
			"tiles_recorded": 23,
			"copies_recorded": 35,
			"deck_size": 35,
			"draft_tiles": 0,
			"status": "complete"
		}
	}
}
```

<!-- schema: ReleaseArmy -->

### Tile, face and feature

A **tile** is one tile type of an army: `id`, `name`, `category` (`hq` Sztab, `warrior`, `module`, `instant`, `implant`, `ground`, `technology`, `object`, `swap`), `copies` in the deck, `setup_role` (`starting_hq` or `draw_pile`, …), `status` (`verified` = checked against the official image), `hp` (Sztab 20 / Obiekt 10 only), `faces` and `derived` (`hp` of tiles standing on the board, printed `initiative` values, `module_reach` of a Moduł).

A **face** is one printed side: `side`, `playable`, `image`, `features`.

A **feature** is one printed element: `mechanic` (id from `mechanics.json`), `at` (anchor), and as needed `params` (values such as `strength`, `value`, `range`), `category` (badge colour: `unit` gold, `hq` silver, `hidden`, `ambush`, `forced`, `power`), `side` (effects only), `flags` (`friendly_fire`, `zombie_only`), `riders` (`jad`, `paraliz`), `cost`, and nested `effects` / `options` for container mechanics.

Example – a warrior (Moloch Szturmowiec: Strzał on the top edge, two Inicjatywa badges, one Wytrzymałość):

```json
{
	"id": "moloch.szturmowiec",
	"name": { "pl": "Szturmowiec" },
	"category": "warrior",
	"copies": 1,
	"setup_role": "draw_pile",
	"status": "verified",
	"faces": [
		{
			"side": "front",
			"playable": true,
			"image": "moloch/szturmowiec_front.png",
			"features": [
				{ "mechanic": "ranged", "at": { "edge": 0 }, "params": { "strength": 1 } },
				{ "mechanic": "initiative", "at": { "slot": "c5" }, "params": { "value": 2 } },
				{ "mechanic": "initiative", "at": { "slot": "c4" }, "params": { "value": 1 } },
				{ "mechanic": "toughness", "at": { "slot": "c2" }, "category": "unit" }
			]
		}
	],
	"derived": { "hp": 2, "initiative": [2, 1] }
}
```

<!-- schema: ReleaseTile -->

A Moduł keeps its effect in the centre, with the side it applies to (Posterunek Dywersant: links on all six edges, −1 Inicjatywa for linked enemy units):

```json
{
	"id": "posterunek.dywersant",
	"name": { "pl": "Dywersant" },
	"category": "module",
	"copies": 1,
	"setup_role": "draw_pile",
	"status": "verified",
	"faces": [
		{
			"side": "front",
			"playable": true,
			"image": "posterunek/dywersant_front.png",
			"features": [
				{ "mechanic": "module_link", "at": { "edge": 0 }, "params": { "range": 1 } },
				{ "mechanic": "module_link", "at": { "edge": 1 }, "params": { "range": 1 } },
				{ "mechanic": "module_link", "at": { "edge": 2 }, "params": { "range": 1 } },
				{ "mechanic": "module_link", "at": { "edge": 3 }, "params": { "range": 1 } },
				{ "mechanic": "module_link", "at": { "edge": 4 }, "params": { "range": 1 } },
				{ "mechanic": "module_link", "at": { "edge": 5 }, "params": { "range": 1 } },
				{
					"mechanic": "modify_stat",
					"at": { "center": true },
					"params": { "stat": "initiative", "amount": -1 },
					"side": "enemy"
				}
			]
		}
	],
	"derived": {
		"hp": 1,
		"initiative": [],
		"module_reach": { "type": "linked", "edges": [0, 1, 2, 3, 4, 5], "range": 1 }
	}
}
```

<!-- schema: ReleaseTile -->

### Mechanic – `mechanics.json`

The file holds `terms` (shared word forms, e.g. `terms.side.enemy` = "wrogich") and `mechanics`. A mechanic: `id`, `kind` (`attack`, `defense`, `net`, `connector`, `trap`, `container`, `ability`, `initiative`, `effect`, `status`, `army_rule`), `name`, optional `name_plural`, `description` (player-facing, may be a [template](#descriptions)), `placement` (where it may appear: `edge`, `corner`, `slot`, `center`, `none`), `params` (each with `type`, `required`, `values`, `min`, `max`, `exclude`, `labels`, `signed`, `ref`), `allowed_categories`, `badge_count`, `scope` (army-specific), `official`.

Example (Modyfikator):

```json
{
	"id": "modify_stat",
	"kind": "effect",
	"name": { "pl": "Modyfikator" },
	"description": {
		"pl": "{amount@sign:Zwiększa,Zmniejsza} {stat} połączonych {side} jednostek o {amount@abs}. Efekty z kilku źródeł sumują się."
	},
	"placement": ["center"],
	"params": {
		"stat": {
			"type": "string",
			"required": true,
			"values": ["melee", "ranged", "initiative"],
			"labels": {
				"melee": { "pl": "siłę ciosu" },
				"ranged": { "pl": "siłę strzału" },
				"initiative": { "pl": "Inicjatywę" }
			}
		},
		"amount": { "type": "integer", "required": true, "exclude": [0], "signed": true }
	},
	"official": true
}
```

<!-- schema: Mechanic -->

### Marker – `markers.json`

`markers` lists marker types: `id`, `name`, `unlimited`, `two_sided`, `placement` (`unit`, `hex`, `hp_track`, …), `images` (`front`, `back`, or `blank` – a disc the app writes the value on), `size` (`standard`/`small`), `official_component`.

```json
{
	"id": "wound",
	"name": { "pl": "Rana" },
	"unlimited": true,
	"two_sided": false,
	"placement": "unit",
	"images": { "front": "markers/wound.png" },
	"size": "standard",
	"official_component": true
}
```

<!-- schema: MarkerType -->

### Board – `boards.json`

`boards` lists layouts; there are no images – the app draws hexes and trackers over a board skin. A board: `orientation` (`flat_top`), `coordinates` (`axial`, hex id `"q,r"`), `directions` (axial step per edge), `hexes` (`zone` `play`, `outer_side` or `outer_corner`), `zone_roles`, `virtual_links` (side hexes linked across a corner), `water_ring` (side hexes clockwise), `hp_track`. The standard board has 19 play hexes and an outer ring of 18. Shortened example (4 of 37 hexes):

```jsonc
{
	"id": "standard",
	"name": { "pl": "Plansza standardowa", "en": "Standard board" },
	"orientation": "flat_top",
	"coordinates": "axial",
	"directions": [
		{ "edge": 0, "dq": 0, "dr": -1 },
		{ "edge": 1, "dq": 1, "dr": -1 },
		{ "edge": 2, "dq": 1, "dr": 0 },
		{ "edge": 3, "dq": 0, "dr": 1 },
		{ "edge": 4, "dq": -1, "dr": 1 },
		{ "edge": 5, "dq": -1, "dr": 0 },
	],
	"hexes": [
		{ "id": "-2,0", "q": -2, "r": 0, "zone": "play" },
		{ "id": "0,0", "q": 0, "r": 0, "zone": "play" },
		{ "id": "0,-3", "q": 0, "r": -3, "zone": "outer_corner" },
		{ "id": "1,-3", "q": 1, "r": -3, "zone": "outer_side" },
		// … 33 more
	],
	"zone_roles": { "outer_side": ["water"], "outer_corner": ["water_link_marker", "technology"] },
	"virtual_links": [
		["-1,-2", "1,-3"],
		["2,-3", "3,-2"],
		["3,-1", "2,1"],
		["1,2", "-1,3"],
		["-2,3", "-3,2"],
		["-3,1", "-2,-1"],
	],
	"water_ring": ["1,-3", "2,-3", "3,-2", "3,-1", "2,1", "1,2", "-1,3", "-2,3", "-3,2", "-3,1", "-2,-1", "-1,-2"],
	"hp_track": { "min": 0, "max": 20 },
}
```

### Army skin – `skins/<skin_id>.json`

Replacement images for some or all tiles of one army: `id` (army-scoped), `name`, `official`, `army`, `tiles` (per tile id: `front`/`back` image, `front_art_only`/`back_art_only` for a face printed without icons), optional `back`. `skins/index.json` lists every skin with its `coverage` (tiles covered, whole army or not, Sztab included, own back). No skins are published yet; the example shows the form:

```json
{
	"id": "borgo.przykladowy",
	"name": { "pl": "Przykładowy" },
	"official": true,
	"army": "borgo",
	"tiles": { "borgo.sztab": { "front": "skins/borgo/przykladowy/sztab_front.png", "front_art_only": true } }
}
```

<!-- schema: Skin -->

### Board skin – `board_skins/<id>.json`

A table background: `id`, `name`, `official`, `image`, `default` (exactly one board skin is the default). `board_skins/index.json` lists them with `href` and names the `default`.

```json
{
	"id": "zniszczone_miasto2013",
	"name": { "pl": "Zniszczone miasto (2013)" },
	"official": true,
	"image": "board_skins/zniszczone_miasto2013.png",
	"default": true
}
```

<!-- schema: BoardSkin -->

### Query response and errors

Every query answers `query` (the parameters as understood, defaults filled in), `total` (matches before paging) and `results`. Tile results also carry their `army`:

```json
{
	"query": { "id": ["moloch.bomba"], "limit": 100, "offset": 0 },
	"total": 1,
	"results": [
		{
			"army": "moloch",
			"id": "moloch.bomba",
			"name": { "pl": "Bomba" },
			"category": "instant",
			"copies": 1,
			"setup_role": "draw_pile",
			"status": "verified",
			"faces": [
				{
					"side": "front",
					"playable": true,
					"image": "moloch/bomba_front.png",
					"features": [
						{ "mechanic": "damage_area", "at": { "center": true }, "params": { "template": "bomb" } }
					]
				}
			],
			"derived": { "initiative": [] }
		}
	]
}
```

<!-- schema: TileQueryResult -->

Errors have a status code and a JSON body; `400` also says which parameter is wrong and why:

```json
{ "error": "bad_query", "details": [{ "param": "colour", "message": "unknown parameter" }] }
```

<!-- schema: QueryError -->

| Status | Body `error`         | When                                         |
| ------ | -------------------- | -------------------------------------------- |
| 400    | `bad_query`          | unknown, repeated or invalid query parameter |
| 404    | `not_found`          | no such file or query route                  |
| 405    | `method_not_allowed` | anything but GET, HEAD, OPTIONS              |
| 503    | `no_data`            | the query service has no built data loaded   |

## Images

An image named `moloch/klaun_front.png` in the data is served only as WebP variants: `/v1/assets/moloch/klaun_front@512.webp` (also `@256`, `@128`; board skins `@4096`, `@2048`, `@1024`; never larger than the original, so a small image may have fewer sizes). `index.json → assets.files` lists the sizes of every image and its SHA-256, which changes when an image is replaced. SVG logos are served as they are (`/v1/assets/moloch/logo.svg`). Tile images are 891 × 771 at full size, flat-top, edge 0 up.

## Descriptions

Mechanic descriptions are player-facing Polish texts. Some are templates filled from a feature's values, so a tooltip shows the real numbers:

| Placeholder                       | Becomes                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `{param}`                         | the value, its label (e.g. `melee` → "siłę ciosu") or a mechanic name |
| `{param-1}`                       | the number with an offset                                             |
| `{param:Ruch,Ruchy,Ruchów}`       | "2 Ruchy" – number + Polish plural form (one, few, many)              |
| `{param@sign:Zwiększa,Zmniejsza}` | the first word for a positive number, the second for a negative one   |
| `{param@abs}`                     | the number without its sign                                           |
| `{side}`                          | the word form of the feature's side ("wrogich", "sojuszniczych"…)     |

Dywersant's Modyfikator (`amount: -1`, `stat: initiative`, `side: enemy`) renders as "Zmniejsza Inicjatywę połączonych wrogich jednostek o 1. Efekty z kilku źródeł sumują się." `renderDescription()` in `@hexbattle/schema` does this; every consumer should use it so texts read the same everywhere.

## Using the API with curl

Set the base address once – the public API or your own copy – and every example below works with it:

```bash
API=https://api.hexbattle.online      # bash (Linux, macOS, Git Bash)
API=http://localhost:8080             # or your own copy
```

```powershell
$API = "https://api.hexbattle.online"   # PowerShell
$API = "http://localhost:8080"          # or your own copy
```

On Windows PowerShell write `curl.exe` instead of `curl`. `-s` hides the progress bar, `-i` shows the response headers, `-I` shows only the headers.

### Files

```bash
curl -s "$API/v1/"
curl -s "$API/v1/armies/moloch.json"
curl -s "$API/v1/mechanics.json"
curl -s -o klaun.webp "$API/v1/assets/moloch/klaun_front@512.webp"
```

### Queries

Every query takes `id` (a comma-separated list of ids), `name` (part of the name in any language, ignoring case and Polish letters – `lowca` finds "Łowca"; with `exact=true` the whole name), `limit` and `offset` (paging, default 100, at most 500). Lists are comma-separated; each parameter may appear once. Put the URL in quotes so the shell does not read `&`.

| Route                   | Results                  | More parameters                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/v1/query/tiles`       | tiles with their army id | `army`, `category` (lists); `mechanic` (a feature anywhere on the tile, also inside Moduł features) refined by `min_strength` and `side`; `hp`, `min_hp`, `max_hp`; `initiative`, `min_initiative`; `copies`, `min_copies`; `fields` (only these fields, e.g. `id,name,copies,army`) |
| `/v1/query/armies`      | whole army files         | `origin` (list), `official` (`true`/`false`), `fields` (e.g. `id,name,display`)                                                                                                                                                                                                      |
| `/v1/query/mechanics`   | mechanics                | `kind`, `placement` (lists), `used_by` (army id)                                                                                                                                                                                                                                     |
| `/v1/query/markers`     | marker types             | `placement` (list)                                                                                                                                                                                                                                                                   |
| `/v1/query/skins`       | army skins               | `army` (list)                                                                                                                                                                                                                                                                        |
| `/v1/query/board_skins` | board skins              | `default` (`true`/`false`)                                                                                                                                                                                                                                                           |

By id or name:

```bash
curl -s "$API/v1/query/tiles?id=moloch.klaun"
curl -s "$API/v1/query/tiles?id=moloch.klaun,borgo.mutant&fields=id,name,army"
curl -s "$API/v1/query/tiles?name=lowca&fields=id,name"
curl -s "$API/v1/query/tiles?name=oficer&exact=true&fields=id,army"
curl -s "$API/v1/query/armies?id=hegemonia&fields=id,name,display"
curl -s "$API/v1/query/mechanics?id=net,armor"
curl -s "$API/v1/query/markers?name=siec"
```

By army, category and features:

```bash
curl -s "$API/v1/query/tiles?army=borgo&category=module&fields=id,name,copies"
curl -s "$API/v1/query/tiles?mechanic=armor&fields=id,name,army"
curl -s "$API/v1/query/tiles?mechanic=ranged&min_strength=2"
curl -s "$API/v1/query/tiles?mechanic=modify_stat&side=enemy"
curl -s "$API/v1/query/tiles?category=warrior,module&min_hp=2&fields=id,name"
curl -s "$API/v1/query/tiles?min_initiative=3&fields=id,name,army"
curl -s "$API/v1/query/mechanics?kind=effect&used_by=borgo"
curl -s "$API/v1/query/board_skins?default=true"
```

Paging – the first 10 tiles, then the next 10 (`total` says how many match):

```bash
curl -s "$API/v1/query/tiles?limit=10&fields=id"
curl -s "$API/v1/query/tiles?limit=10&offset=10&fields=id"
```

### Headers, caching and errors

```bash
curl -I "$API/v1/armies/moloch.json"
curl -I -H 'If-None-Match: "<etag from the line above>"' "$API/v1/armies/moloch.json"
curl -i "$API/v1/query/tiles?colour=red"
curl -i -X POST "$API/v1/index.json"
```

Every response has `Access-Control-Allow-Origin: *`, `Cache-Control` (`index.json` 60 s, other JSON and query answers 5 min, images 1 day) and an `ETag`; asking again with `If-None-Match` and the same ETag answers `304 Not Modified` without a body. The second-to-last example answers `400 bad_query`, the last `405 method_not_allowed`.

In PowerShell, `Invoke-RestMethod` turns an answer into objects:

```powershell
(Invoke-RestMethod "$API/v1/query/tiles?army=borgo").results | ForEach-Object { "$($_.copies) × $($_.name.pl)" }
```

## Versioning

- **`/v1/` never changes meaning.** Files, fields and query parameters keep what they mean; new optional fields, files and query parameters may be added. A breaking change goes to `/v2/`, with `/v1/` kept for a deprecation period.
- **`dataset_version`** (semver) changes with every data release: minor for new content (an army, a skin), patch for corrections. Clients compare it to detect new data. See [`CHANGELOG.md`](CHANGELOG.md).

## Development

Requirements: Node 24, pnpm (version from `packageManager`).

```
pnpm install
cp .env.example .env      # set ASSETS_DIR to the masters folder (optional)
pnpm check                # typecheck, lint, format, tests under several time zones, release build
pnpm build                # dev build into dist/v1/ (drafts and incomplete armies allowed, with warnings)
pnpm build:release        # strict build: every army complete, every image in the manifest
pnpm serve                # serve dist/v1/ and the query service at http://localhost:8080/v1/ (--host, --port)
pnpm assets:manifest      # update assets.manifest.json after adding or replacing an image
pnpm images:fetch         # download the published images instead of using masters (--from, --force)
pnpm schema:editor        # JSON Schemas for editor validation of data/ (VS Code picks them up)
```

Build issues have stable codes (`E_…` errors stop the build, `W_…` warnings don't); the full list with meanings is in `tools/lib/issues.ts`. The JSON examples in this README are checked against the schemas by the tests.

## Licence

HexBattle Online is a non-commercial, fan-made project. Neuroshima Hex, its names, texts, artwork and brand are the property of Portal Games – see [`NOTICE.md`](NOTICE.md).

- Code: MIT – [`LICENSE`](LICENSE)
- Data and images: [`LICENSE-DATA.md`](LICENSE-DATA.md) (our data structure under CC BY-NC 4.0; Portal Games content not licensed)
