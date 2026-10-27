# furniture-render

Pre-renders the office furniture and character sprites from 3D models.

- Furniture: **Low Poly Office Set 2** by VNB (Leo) — https://vnbp.itch.io/ — used under the pack's licence (free for commercial and non-commercial projects; the models themselves are not redistributed here, only the rendered images in `src/assets/furniture/`).
- Characters: built in code (`render.html` → `buildPerson`, `pose`) as simple low-poly figures; appearance comes from the game's roster (`src/domain/content/people.ts`), shirt colour from the specialization (`characters.mjs`).

```bash
npm install
VNB_PACK="/path/to/VNB Low Poly Office Set 2" npm run render   # optionally: npm run render -- desk characters
```

Output:

- `src/assets/furniture/<type>-<rotation>.png` (2× resolution, anchor = footprint corner) and `src/rendering/furnitureSprites.json`; the desk chair is a separate layer (`deskChair-<rotation>`).
- `src/assets/rooms/<room id>-back.png` / `-front.png` (target `rooms`, specs in `rooms.mjs`) and `src/rendering/roomSprites.json` — whole rooms (floor, walls, doors, wall decor) rendered on the game grid; rules for new rooms in [ROOMS.md](ROOMS.md).
- `src/assets/characters/<person id>.webp` — one atlas per person (1× resolution): rows = facing (`px`, `py`, `nx`, `ny`), columns = frames of `idle`, `walk`, `sitChair`, `typing`, `sitSofa`, `coffee` (sipping from a cup); layout in `src/rendering/characterSprites.json`.

The camera matches the game projection (2:1 isometric, 64×32 px tiles); scale 0.75 m per tile. Requires Google Chrome (`CHROME` env var to override the path).
