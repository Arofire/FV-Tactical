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
- **Outfit**: Select an operational core widget, then configure Emplacements, Utilities, and Systems. Category sections are collapsible and default to expanded only when their corresponding resources are available; subsections with no technology-eligible options are compacted and muted unless required-tech checks are ignored. Utilities include defensive weapons, selectable radiators, and defenses; Systems include general and entropy systems. Each utility or system device uses one corresponding resource, technology-gated options follow researched tech, and Utilities/Systems show section cost subtotals in CV, industry, or Materiel. Radiator and entropy-system radiance, plus radiator offsets to the six entropy bands, appear in Hull Tiles. Hardpoints are reserved for Fleet view and oversized emplacement weapons use the spinal slot. Multi-arc weapons use one additional resource per weapon; main weapons are restricted to a single Port or Starboard arc. Gear burn analysis shows entropy, Remass per burn, and the maximum burns supported by the connected ship's Remass.
- **QSystems**: Consume System resources and replace the same number of System hulls with Quantum hulls in Hull Tiles
- **Craft**: Create smaller fighters, bombers, and support vessels. Click the title to rename; set flags, role, and notes, then configure profile, roles, power, and loadout. Profile capacities appear as hardpoint, utility, and equipment counters in the loadout. Hardpoints use ship hardpoint weapons, and equipment includes craft weapons from `data/weapons.json`.
- **Troops**: Manage military units. Click the title to rename; choose training, features, formations (with berth requirements), and equipment. Troop gear comes from `data/troop.json` and troop weapons from the `Troops` category of `data/weapons.json`; both share one equipment capacity.
- **Custom design widgets**: New catalogue-driven configurable widgets should extend `DesignWidget`; Ship Class, Ship Core, Outfit, and Munition designs now share its title, flag, and section conventions, with catalogue-backed widgets using shared tech filtering where applicable, while retaining their specialized editors. Follow the [`design-widget-workflow` skill](./.github/skills/design-widget-workflow/SKILL.md) and the [create/migrate runbook](./docs/design-widget-workflow.md).
- **Munitions**: Design guided weapons from a profile (guided missile, light/medium/heavy torpedo, bomb), tech-gated guidance package, and payload warheads — all sourced from `data/munitions.json` — with a payload count limited by the profile's capacity, five accuracy-band sliders fed by a guidance-derived accuracy pool, an editable cost, and an operational flag. Operational munitions fill magazine and hardpoint cells in the Fleet view.
- **Ship Core**: Pick reactor, engine, and manifold technologies from `data/ship-cores.json`, allocate pips between them, and configure up to four named gears with instability. Core cost is 5 per point of reactor threshold (rounded down), plus the engine's thrust demand (`T^(1/E) * H`, times 1/3 for engines flagged `reaction`), plus 1 per point of manifold entropy capacity. Cost needs a connected class for its hull count; the outfit adds its armour hulls.
- **Summary**: Show ship statistics and resource totals. Connect a Craft output to show that craft's combined statistics. Ship summaries can export JSON keyed to the build-sheet form fields, or download a filled PDF build sheet. Filled PDFs retain the template's embedded field formatting. The PDF maps Quantum hulls and up to seven individual system, emplacement-weapon, and utility lines to their named fields.
- **Hull Tiles**: Visualize hull allocation from connected Ship Outfit widgets.
- **Fleet unique ships**: Use each ship card's **Export** menu to save a JSON record or a filled [Unique Ship Sheet](./data/Unique-Ship-Sheet.pdf). Filled PDFs retain the template's embedded field formatting. The export combines the ship's Fleet stores and contents with its linked class and outfit, including defensive utility-mounted weapons. Defensive weapon arcs export as `O`; spinal weapon arcs export as `F`. It maps the ship cost to CV in Skirmish or the sum of IP, MP, and EP in Campaign; the damage-grid rows are joined and aligned bottom-left, and unused weapon Type/Charge and entropy Level fields remain blank. The PDF displays up to five store rows, six weapon configurations, five troop entries, and the supported hull-grid rows; JSON retains all rows and reports overflow and unavailable fields. Specific-damage fields remain blank, and Jumpnium is omitted until Fleet tracks it.

### 🛰️ **Fleet Management**
- Two-panel Fleet view: task forces group unique ships in the main panel, while the secondary panel lists the whole-of-Empire ship inventory with assignment status
- **Build Ships** constructs one ship or a batch from an operational class connected to an operational outfit with an operational core; names and roles are assigned per ship, and a selection of ships in a batch can be configured together
- Per-ship contents fill the class's fixed capacities: troops into berths, munitions into magazine cells, craft into hangar bays, and tech-gated weapons into hardpoints — all drawn from operational designs, with a running Materiel total shown before confirmation
- Ships track cargo and remass stores against their design maxima; stores can be reset to full per ship or for a whole task force
- Ships whose outfit includes the Tending system can redistribute cargo and remass across their task force: remass refills ships by highest gear-burn demand, cargo equalizes endurance across ships, and per-ship sliders with lock checkboxes fine-tune the final allocation before confirming

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
- Backup and restore capabilities
- Cross-platform compatibility

Imports and backup restores accept the current empire file format only; older files are not migrated.

The bundled weapon catalogue is imported from the [published weapons CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vQWHExCdUgGcby87ZzTN-FlKwLEjWvg1pNlr6DpSeNo31j4gwvk1Tpty1K7DJ2CgWxMteNzgigWXq-A/pub?gid=923591294&single=true&output=csv&range=A2:R328). Run `python3 scripts/import_weapons.py` to refresh it. CSV `H`, `U`, and `E` mount codes count against the new Hardpoints, Utilities, and Emplacements resources respectively; `E` mounts larger than 04 also occupy the single spinal slot. Hardpoints use is tallied, but its available capacity remains unknown until the freight/tankage formula is defined. Troop, craft, and other entries without a recognized ship mount remain in the catalogue but are not offered as ship-outfit weapons. The importer assigns troop weapon costs (light and heavy 1, nuclear 2, other troop weapons 1); troop and craft widgets read their weapons from this catalogue. Warheads are excluded from the import and live in `data/munitions.json` as munition payloads.