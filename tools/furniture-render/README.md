# furniture-render

Pre-renders the office furniture sprites from 3D models.

Models: **Low Poly Office Set 2** by VNB (Leo) — https://vnbp.itch.io/ — used under the pack's licence (free for commercial and non-commercial projects; the models themselves are not redistributed here, only the rendered images in `src/assets/furniture/`).

```bash
npm install
VNB_PACK="/path/to/VNB Low Poly Office Set 2" npm run render   # optionally: npm run render -- desk sofa
```

Output: `src/assets/furniture/<type>-<rotation>.png` (2× resolution, anchor = footprint corner) and `src/rendering/furnitureSprites.json`. The camera matches the game projection (2:1 isometric, 64×32 px tiles); scale 0.75 m per tile. Requires Google Chrome (`CHROME` env var to override the path).
