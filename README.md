# RuneBorne

A free, all-in-one toolkit for running D&D (2024 rules) at the table. Built for a DM and their players sharing one laptop, with online play planned.

Everything runs in the browser and saves automatically. No accounts, no subscriptions.

**Play now: https://runeborne.vercel.app**

## What's inside

| Tab | What it does |
| --- | --- |
| **Dice** | d4 to d100, any weird die (`1d7`), advantage/disadvantage, exploding dice (`1d6!`), Fudge dice (`4dF`), keep/drop (`4d6dl1`), saved roll buttons |
| **Characters** | Creator with rolled stats (+ DM-controlled rerolls), point buy or standard array, class/species/background from the SRD, homebrew **bloodlines** and a 3-card **Tarot of Fate**. Full sheet with clickable checks, saves, skills, HP, mana and level-ups. Real **inventory** with coins, carrying weight, and items you can use (potions heal, scrolls cast, wands spend charges), read (books, maps, letters), equip or hand to someone else |
| **Spell Forge** | DM approves a new spell → player rolls to learn it → rolls its power tier → rolls its mana cost. Learned spells appear on the sheet with a Cast button |
| **NPCs** | Random NPC generator (name, quirk, want, secret), attitude tracker, first-impression and social rolls that shift attitude, interaction log |
| **Combat** | Initiative, turn order, rounds, HP, conditions, an attack helper (crits double the dice) that applies damage for you. Pull foes straight from your enemy list, and **Loot** a downed foe to roll treasure for its CR |
| **Items** | A library of about 120 items (SRD potions, scrolls, gear, weapons, armor, magic items, plus books, maps and trinkets) with search and filters. Make your own items, give items to a character or the party stash, and roll treasure by CR |
| **Map** | **World map:** one click generates a whole continent with realms, rivers, coasts, mountains and roads. Scroll to zoom smoothly from the continent into a walled city plan (wards, streets, market square, farmland, bridges, harbour), then double-click any building or dungeon to open its floor plan with rooms and furniture. Shops, libraries, temples and townsfolk are on the map, and the GM can rename anything and change its state (closed, destroyed, hostile, dead…). Shops have **stock to buy** that fits the shop and the town, and remembers what sold. The world is saved with the campaign. **Battle map:** paint a ready-to-play map in one click (forest clearing, road ambush, river crossing, ruins, cave, dungeon, tavern, snowy woods), upload your own, or send a building/dungeon from the world map. Build enemies with full stat blocks (or start from 10 SRD-based ones), drop them on the grid, and run the fight from the map: HP rings, turn highlight, conditions, one-click attacks, a 5 ft ruler, zoom and snap-to-grid |
| **Notes** | Searchable campaign notes with tags |
| **Generators** | Names, taverns, loot, plot hooks, weather, quirks and a yes/no oracle |
| **Saves** | Save slots, export/import campaign files, DM settings and house rules |

Every roll goes into the shared **Roll Log** on the right, tagged with who rolled it. Pick who is rolling from **Rolling as** at the top.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the link it prints (usually http://localhost:5173). Edit any file in `src/` and the page updates instantly.

Other commands:

```bash
npm test         # dice engine tests
npm run build    # production build into dist/
npm run preview  # serve the production build
```

### Play from a link (free hosting)

The repo includes a GitHub Actions workflow that publishes the app to GitHub Pages on every push to `main`. Turn it on once in **Settings → Pages → Source: GitHub Actions**. The app then lives at `https://<your-username>.github.io/RuneBorne/`.

## Make it yours

- **Items** (the item library, shop stock, loot by CR): `src/data/items.ts`, or the **New item** button in the Items tab
- **Homebrew lists** (tarot cards, bloodlines, NPC names and quirks, loot, plot hooks, spell power tiers): `src/data/homebrew.ts`
- **Rules data** (classes, species, backgrounds, skills, conditions): `src/data/srd.ts`
- **DM knobs** (stat rerolls, tarot redraws, spell learn DC, power and mana dice, house rules): the Saves tab in the app
- Every class, species, background and bloodline picker has a **✏ Homebrew…** option to type your own.

## Project layout

```
src/
  App.tsx              tabs and layout
  store/game.ts        all campaign data (Zustand, auto-saved to localStorage)
  lib/dice.ts          dice notation parser and roller (+ dice.test.ts)
  data/                SRD and homebrew content
  features/            one file or folder per tab
  features/items/      item library, inventory, shops
  features/atlas/      map engine: Voronoi continent, city plans, interiors, canvas viewer
  components/          shared UI pieces
```

## Roadmap

- Online play: a small Python (FastAPI) server or peer-to-peer sync so players can join from their own devices
- Player view vs DM view (hide NPC secrets and monster HP)
- Monster stat blocks from the SRD
- Spell slots for standard 5e casters alongside the mana system

## Credits and license

Code is MIT licensed (see `LICENSE`).

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Tarot of Fate, bloodlines, the mana system, the Spell Forge and the world generator are original RuneBorne work. Icons are from [Lucide](https://lucide.dev) (ISC license).
