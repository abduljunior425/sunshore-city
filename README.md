# Sunshore City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/abduljunior425/sunshore-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/abduljunior425/sunshore-city/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) — a sun-soaked coastal
city of your own, built with vanilla canvas JavaScript and zero network
requests. No Rockstar names, characters, maps or assets anywhere: this is
Sunshore City, and it is entirely ours.

## The game

Manny Reyes is out, and Luz the fixer has jobs across the city. Explore five
districts — Downtown, Marina, Old Town, Hills and Docks — on foot or behind
the wheel, steal cars, outrun the police, and run a five-job story arc.

- **On foot:** WASD to walk (Shift to run), E to enter or steal a car, F to
  punch, mouse aim + click to shoot the pistol.
- **Driving:** W/S accelerate and brake/reverse, A/D steer, Shift to drift.
  Five car models (sedan, taxi, van, sports, truck), damage and smoke.
- **A living city:** traffic that follows the roads and stops at red lights,
  pedestrians who stroll the sidewalks and flee gunfire, a day clock.
- **Wanted 0–5 stars:** stealing, assault and gunfire raise the heat. Police
  patrol, chase, ram and arrest — break line of sight to cool off, or get
  busted, fined and dumped at the precinct.
- **Five missions:** Wheels, The Pickup, Dockside, Getaway and The Big One —
  each pays cash. Spend it on ammo, health and cars at the shops.
- **HUD + minimap:** health, cash, ammo, wanted stars, mission objective,
  clock, and a live minimap with roads, the player arrow, mission and police
  blips, and shops.
- **Meta:** title screen, pause (P), save/load via localStorage, busted and
  wasted screens, synthesised WebAudio sound effects and music (M to mute).

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies, no network: every file the game loads lives
under `game/`.

## Layout

- `game/index.html` — the page; `game/src/main.js` — boot and the game loop
- `game/src/city.js` — map, roads, districts, buildings, shops
- `game/src/player.js` — Manny on foot and driving
- `game/src/vehicles.js` — car models, traffic, damage
- `game/src/pedestrians.js` — sidewalk crowds that flee trouble
- `game/src/police.js` — wanted level, chases, arrests
- `game/src/missions.js` — the five-job story arc
- `game/src/combat.js` — bullets, gunmen, punches, pickups
- `game/src/hud.js` — HUD and minimap; `game/src/render.js` — the camera and drawing
- `game/src/audio.js` — synthesised sound; `game/src/save.js` — localStorage saves
- `game/src/input.js`, `game/src/config.js`, `game/src/utils.js`, `game/src/shots.js`

## License

MIT — see [LICENSE](LICENSE).
