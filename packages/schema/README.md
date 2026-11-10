# @hexbattle/schema

Zod 4 schemas, TypeScript types and the description renderer of the [HexBattle Online data API](https://github.com/Kazdaniarz/hexbattle-api) – the Neuroshima Hex armies, tiles, mechanics and markers served at `https://api.hexbattle.online/v1/`.

```
npm install @hexbattle/schema zod
```

```ts
import { ReleaseArmy, renderDescription } from '@hexbattle/schema';

const army = ReleaseArmy.parse(await (await fetch('https://api.hexbattle.online/v1/armies/moloch.json')).json());
```

- Every published file and every query answer has a schema (`Index`, `ReleaseArmy`, `MechanicsFile`, …) and a type of the same name; `Army`, `Tile` and `Feature` describe the source records the build starts from.
- `renderDescription` fills a mechanic's description template with a feature's numbers, exactly as the API build does.
- The schemas describe API version `v1`; a breaking change goes to `v2`.

Code: MIT (see `LICENSE`). The game content the API describes (names, texts, art) belongs to Portal Games and is not covered by this licence – see the API repository's `NOTICE.md`.
