# furniture-render

Pre-renders the office furniture and character sprites from 3D models.

- Furniture: **Low Poly Office Set 2** by VNB (Leo) — https://vnbp.itch.io/ — used under the pack's licence (free for commercial and non-commercial projects; the models themselves are not redistributed here, only the rendered images in `src/assets/furniture/`).
- Characters: **Mini Characters** by Kenney — https://kenney.nl/assets/mini-characters — CC0. Rendered atlases in `src/assets/characters/`.

```bash
npm install
VNB_PACK="/path/to/VNB Low Poly Office Set 2" \
KENNEY_PACK="/path/to/kenney_mini-characters" npm run render   # optionally: npm run render -- desk characters
```

Output:

- `src/assets/furniture/<type>-<rotation>.png` (2× resolution, anchor = footprint corner) and `src/rendering/furnitureSprites.json`; the desk chair is a separate layer (`deskChair-<rotation>`).
- `src/assets/characters/<look>.webp` — one atlas per character look: rows = facing (`px`, `py`, `nx`, `ny`), columns = frames of `idle`, `walk`, `sitChair`, `typing`, `sitSofa`, `coffee`; layout in `src/rendering/characterSprites.json`.

The camera matches the game projection (2:1 isometric, 64×32 px tiles); scale 0.75 m per tile. Requires Google Chrome (`CHROME` env var to override the path).
