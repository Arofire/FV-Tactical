# FV-Tactical

A web-based node-driven design tool for tabletop wargaming spacecraft and military units. Organize ship, craft, troop, weapon, and technology designs under an Empire, then assign unique ship instances in the Fleet view.

## Features

### 🚀 **Ship & Craft Design**
- Modular component system for spacecraft design
- Dynamic node connections for weapon-magazine linkages
- Real-time power balance and performance calculations
- Support for various ship classifications from fighters to dreadnoughts
- Separate Design and Fleet views, with unique ships linked to their source class
- Hull Tiles diagrams and structured JSON exports

### 🔬 **Technology Tree**
- Visual tech tree with required tech and dependencies
- Research management with tech point system
- Option to ignore required tech for creative mode
- Component availability based on researched technologies

### 🎮 **Interactive Widgets**
- **Ships**: Design hull composition and allocate containment between Freight and Tankage with the Cargo/Remass slider
- **Outfit**: Select an operational core widget, then configure Emplacements, Utilities, and Systems. Category sections are collapsible and default to expanded only when their corresponding resources are available; subsections with no technology-eligible options are compacted and muted unless required-tech checks are ignored. Utilities include defensive weapons, selectable radiators, and defenses; Systems include general, entropy, and Quantum Systems. Targeting, Command, and Navigation Quantum Systems cost 60 each, consume System resources, and contribute to the Quantum statistics in Summary. Quantum Systems replace System hull tiles with Q tiles. Utilities/Systems show section cost subtotals in CV or Material. Radiator and entropy-system radiance, plus radiator offsets to the six entropy bands, appear in Hull Tiles. Outfit calculates entropy capacity from Emplacement hulls and installed Quantum Systems, then applies the selected core's manifold efficiency. Outfit hardpoint use includes connected operational Ship Loadouts; its hardpoint capacity remains the total supplied by the ship/core, as shown in Summary. Oversized emplacement weapons use the spinal slot. Selecting Turret uses one additional mount resource per weapon, regardless of the number of selected arcs. Each weapon row controls its own turret and arcs: non-turret weapons select at most one arc, with a new selection replacing the previous one; turrets may select multiple arcs, and disabling a multi-arc turret clears its arcs. Main weapons remain restricted to a single Port or Starboard arc. Gear burn analysis shows entropy, Remass per burn, and the maximum burns supported by the connected ship's Remass.
- **Ship Loadout**: Connect a Class to see available hardpoints, then add tech-eligible devices from `data/Hardpoints.json`. Adapters retain their own munition variants within 10 cells and one munition profile; Clamps retain craft within two bays. Fixtures provide mounts for single-arc, non-turret hardpoint weapons. Cradles, Grapples, Survey devices, zParticle Sails, and Laser Foci are listed by kind. Berths can contain operational troops. Connect a loadout to an Outfit to account for its hardpoint use and offer it as a Fleet build default.
- **Craft**: Create smaller fighters, bombers, and support vessels. Click the title to rename; set flags, role, and notes, then configure profile, roles, power, and loadout. Profile capacities appear as hardpoint, utility, and equipment counters in the loadout. Hardpoints use ship hardpoint weapons, and equipment includes craft weapons from `data/weapons.json`.
- **Troops**: Manage military units. Click the title to rename; choose training, features, formations (with berth requirements), and equipment. Troop gear comes from `data/troop.json` and troop weapons from the `Troops` category of `data/weapons.json`; both share one equipment capacity.
- **Custom design widgets**: New catalogue-driven configurable widgets should extend `DesignWidget`; Ship Class, Ship Core, Outfit, and Munition designs now share its title, flag, and section conventions, with catalogue-backed widgets using shared tech filtering where applicable, while retaining their specialized editors. Follow the [`design-widget-workflow` skill](./.github/skills/design-widget-workflow/SKILL.md) and the [create/migrate runbook](./docs/design-widget-workflow.md).
- **Munitions**: Design guided weapons from a profile (guided missile, light/medium/heavy torpedo, bomb), tech-gated guidance package, and payload warheads — all sourced from `data/munitions.json` — with a payload count limited by the profile's capacity, five accuracy-band sliders fed by a guidance-derived accuracy pool, an editable cost, and an operational flag. Profile attributes use the same compact chips as troop training. Payload choices show names without costs and only unlocked, compatible options unless Ignore Required Tech is enabled; disabling the override clears a locked payload selection. The munition form has no Role or Notes fields. Operational munitions fill magazine and hardpoint cells in the Fleet view.
- **Ship Core**: Pick reactor, engine, and manifold technologies from `data/ship-cores.json`, allocate pips between them, and configure up to four named gears with instability. Core cost is 5 per point of reactor threshold (rounded down), plus the engine's thrust demand (`T^(1/E) * H`, times 1/3 for engines flagged `reaction`), plus 1 per point of manifold entropy capacity. Cost needs a connected class for its hull count; the outfit adds its armour hulls.
- **Summary**: Show ship statistics and resource totals, including Initiative as a five-percent-step rating rounded down with the underlying percentage in parentheses (Core hulls divided by total hulls including Outfit armor), and Quantum statistics when an Outfit has Quantum Systems installed. Connect a Craft output to show that craft's combined statistics. Ship summaries can export JSON keyed to the build-sheet form fields, or download a filled PDF build sheet. Filled PDFs retain the template's embedded field formatting. The PDF maps Quantum hulls and up to seven individual system, emplacement-weapon, and utility lines to their named fields.
- **Hull Tiles**: Visualize hull allocation from connected Ship Outfit widgets.
- **Fleet unique ships**: Use each ship's detail **Export** menu to save a JSON record or a filled [Unique Ship Sheet](./data/Unique-Ship-Sheet.pdf). Filled PDFs retain the template's embedded field formatting. The export combines the ship's Fleet stores and contents with its linked class and outfit, including fixture-mounted and defensive utility-mounted weapons and hardpoint devices. Defensive weapon arcs export as `O`; spinal weapon arcs export as `F`. It maps the ship cost to CV in Skirmish or the sum of IP, MP, and EP in Campaign; the damage-grid rows are joined and aligned bottom-left, and unused weapon Type/Charge and entropy Level fields remain blank. The PDF displays up to five store rows, six weapon configurations, five troop entries, and the supported hull-grid rows; JSON retains all rows and reports overflow and unavailable fields. Specific-damage fields remain blank, and Jumpnium is omitted until Fleet tracks its current amount.

### 🛰️ **Fleet Management**
- The left Empire Inventory panel groups **Unassigned Ships** and **Task Forces** into expandable supercategories, with an expandable category for each task force. Entries show class/outfit, ship name, and CV. Use a task force's pop-out button to show its ship list and summaries in the main view.
- Drag ships between inventory categories or between the main task-force list and the inventory, including empty or collapsed destinations. Transfers append ships to their destination's membership order; assigning a ship to its existing force does not reorder it.
- Ctrl-click (Cmd-click on macOS) toggles individual ships in a shared selection spanning inventory groups and the main list. Shift-click adds the visible range from the last selection in that surface, preserving earlier distinct selections; main-list ranges follow the current sort order. A plain click selects only that ship. Dragging any selected ship transfers the entire selection together.
- The main ship list shows each used amount beside its capacity (`Bays`/`Bays cap`, `Cells`/`Cells cap`, and so on). Jumpium consumption is not tracked yet, so `Jumpium` equals `Jumpium cap`. Each row's actions configure contents (**Hardpoints**), open details, show the ship's hull tiles diagram beside the cursor on hover/focus of **Tiles**, or delete the ship with the × button after confirmation. Hovering a ship in the inventory panel shows the same diagram just right of the panel, vertically centred on the cursor; diagrams always stay within the viewport.
- Sort task-force columns by class, outfit, name, cargo/remass amounts or capacities, bays, cells, and other displayed statistics. Each sort cycles through ascending, descending, and neutral. Numbered priorities apply in sequence (1 first), with subsequent columns breaking ties. Removing a sort re-numbers the remaining priorities. **Clear Sorting** restores the order ships were added to that task force; remaining ties always use that membership order.
- **Build Ships** constructs one ship or a batch from an operational class connected to an operational outfit with an operational core; names and roles are assigned per ship, and a selection of ships in a batch can be configured together
- Per-ship contents fill the Outfit's remaining berths, magazine, hangar, and hardpoint capacities. Fleet builds can start from a connected operational Ship Loadout (or None), then configure each ship independently; Adapter/Clamp contents use operational munitions/craft and Fixtures mount tech-eligible single-arc weapons. A running Materiel total appears before confirmation
- Build and contents dialogs keep their title and confirmation/subtotal footer visible while only the body scrolls. The build quantity control stays in place as the ship list grows. Their top-right close buttons match Design widgets.
- Adapter and Clamp summaries aggregate installed counts and capacities for display, but each instance has its own compact contents picker and capacity limit. Capacity cannot be borrowed from another instance. Fixture mounts are pooled across installed Fixtures; fixture weapon controls appear only when a Fixture is installed.
- Usable hardpoint capacity is `min(armour hits, generated hardpoints)`. Armour establishes that capacity; it does not occupy those slots. Outfit and Summary subtract actual weapon/device usage, including connected operational Ship Loadouts. Fleet counts a copied loadout's devices in the ship's contents once, rather than also deducting the design loadout from capacity. Add a Fixture before mounting its hardpoint weapon.
- Ships track cargo and remass stores against their design maxima; stores can be reset to full per ship or for a whole task force
- Ships whose outfit includes the Tending system can redistribute cargo and remass across their task force: remass refills ships by highest gear-burn demand, cargo equalizes endurance across ships, and per-ship sliders with lock checkboxes fine-tune the final allocation before confirming
- Task-force summaries count actual unique-ship contents, including Adapter munitions and Clamp craft, rather than default design loadouts. With Tending, endurance is pooled current cargo plus berthing cargo divided by combined consumption, rounded down; without Tending, it is the lowest individual endurance.
- Quantum capabilities appear per ship only where installed. In the current distance model, any ship with Navigation has jump distance 2; task-force maximum range uses only ships with at least two Navigation systems, not the shortest-range member. Jumpium capacity uses the Outfit's capacity (one per Navigation system), plus Cradles in the unique ship's actual loadout. Cradles do not increase range.

Cargo, remass, jumpium, and other resources are standalone numeric values, not quantities measured in physical units. Labels such as bays, cells, and berths identify resource categories or capacity counters; they do not imply a physical measurement. CV and Campaign cost labels retain their economy meanings.

### 💰 **Economy Modes**
- **Skirmish** keeps option costs in CV
- **Campaign** presents option costs as Industry and Materiel by category
- Campaign category rules can be adjusted from the Empire title bar

### 🔗 **Visual Node System**
- Drag-and-drop connections between components
- Color-coded node types (power, weapons, magazines, data)
- Dynamic node creation based on widget contents
- Connection validation and compatibility checking

### ⚠️ **Preflight Validation**
- Real-time error detection and warnings
- Required tech checking
- Component compatibility validation
- Power balance analysis
- Missing component alerts

### 💾 **Data Management**
- Local storage with auto-save functionality
- JSON export/import for sharing designs
- Empire saves, imports, and backups use file version `2.1`, including task-force membership order and device-based hardpoint contents. Only the current format is accepted; older files are rejected rather than migrated.
- Backup and restore capabilities
- Cross-platform compatibility

Imports and backup restores accept the current empire file format only; older files are not migrated.

To run Fleet browser regressions, serve the repository locally and open [`scripts/test_fleet.html`](./scripts/test_fleet.html). It checks membership-order persistence, prioritized sorting, current-format imports, task-force endurance and jump rules, per-device capacities, and contents-editor controls without requiring Node.js.

The bundled weapon catalogue is imported from the [published weapons CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vQWHExCdUgGcby87ZzTN-FlKwLEjWvg1pNlr6DpSeNo31j4gwvk1Tpty1K7DJ2CgWxMteNzgigWXq-A/pub?gid=923591294&single=true&output=csv&range=A2:R328). Run `python3 scripts/import_weapons.py` to refresh it. CSV `H`, `U`, and `E` mount codes count against Hardpoints, Utilities, and Emplacements respectively; `E` mounts larger than 04 also occupy the single spinal slot. Ship Loadout hardpoint capacity is derived from Class containment as `floor(containmentHulls^(2/3))`; the connected Outfit still reports total capacity in Summary. Troop, craft, and other entries without a recognized ship mount remain in the catalogue but are not offered as ship-outfit weapons. The importer assigns troop weapon costs (light and heavy 1, nuclear 2, other troop weapons 1); troop and craft widgets read their weapons from this catalogue. Warheads are excluded from the import and live in `data/munitions.json` as munition payloads.

### Editing the weapon catalogue

[`data/weapons.json`](./data/weapons.json) uses `schemaVersion: 1` with indented weapon objects and inline stat/technology arrays:

```json
{
  "id": "example-weapon",
  "name": "Example Weapon",
  "accuracy": [3, 1, -2, null, null],
  "damage": [4, 4, 2, null, null],
  "tagsDescription": "Projectile, Expendable(4)",
  "hp": "E02",
  "cost": 31,
  "requiredTech": [],
  "sourceRow": 3
}
```

- Keep exactly five positions in each stat array: **Short, Medium, Long, Far, Extreme**. Keep blank bands as `null`, including trailing blanks. Zero, negative numbers, and string expressions such as `"10: -4"` are actual values. Accuracy and damage may independently be null.
- Keep IDs stable; saved selections refer to them. Keep `requiredTech` as an explicit array of technology IDs, even when empty. `sourceRow` identifies the original CSV row.
- Edit tags only in `tagsDescription`, using comma-separated names and optional parenthesized values. Do not duplicate them in a `notes` array.
- Edit the mount only in `hp`; do not store `resourceType` or `resourceCount` alongside it. Unknown codes such as `AHP` remain descriptive data, not ship-resource mounts.
- Set `isMain`, `isSpinal`, or `isPointDefense` to `true` when applicable. Missing flags mean false. Keep special spinal flags even on small or unrecognized mounts; mount size alone does not determine spinal status.
- Empty `tagsDescription`, `implied`, and `reasoning` may be omitted. Omitted `tier`, `hp`, and `cost` mean no value, not zero. Preserve nonempty explanatory text and explicit numeric zeroes.

The shared [`WeaponCatalogue`](./js/core/WeaponCatalogue.js) loader validates and caches these compact records **without expanding them into the old format**. Widgets, capacity calculations, generated munition weapon definitions, and exports use the arrays and shared mount/tag queries directly. Invalid catalogues produce load errors rather than successful empty catalogues.

Refresh from the published sheet or an offline CSV with:

```sh
python3 scripts/import_weapons.py
python3 scripts/import_weapons.py --source /path/to/weapons.csv --output /path/to/weapons.json
```

The importer maintains the compact formatting and validates data before replacing the output. [`tmp_weapon_parser.py`](./tmp_weapon_parser.py) forwards to the same importer and accepts the same arguments; it no longer writes an embedded older dataset. Imports replace catalogue content, so retain manual content edits separately if they must survive a sheet refresh. Existing technology-name mappings are retained when still valid. The compact conversion preserves the bundled Warheads category to avoid deleting existing data; a CSV refresh still excludes Warheads under the existing import policy.

Fleet JSON exports use `fv-tactical.unique-ship/v2`; each weapon's `details` contains `accuracy` and `damage` arrays instead of `ranges` objects. Hull/Summary JSON retains its existing schema where its device/selection summaries are unchanged. Both PDF exports retain their existing fields, range order, blank values, formatting, and overflow limits. The Empire save format is unchanged.

Run the focused regressions with `python3 -m unittest discover -s scripts -p 'test_import_weapons.py'` and `node --test scripts/test_weapon_catalogue.cjs scripts/test_weapon_exports.cjs`.