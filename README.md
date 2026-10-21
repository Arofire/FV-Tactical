# FV-Tactical

A web-based node-driven design tool for tabletop wargaming spacecraft and military units. Organize ship, craft, troop, weapon, and technology designs under an Empire, then assign unique ship instances in the Fleet view.

## Features

### 🚀 **Ship & Craft Design**
- Modular component system for spacecraft design
- Dynamic node connections for weapon-magazine linkages
- Real-time power balance and performance calculations
- Support for various ship classifications from fighters to dreadnoughts
- Separate Design and Fleet views, with unique ships linked to their source class
- Hull Plan diagrams and structured JSON exports

### 🔬 **Technology Tree**
- Visual tech tree with required tech and dependencies
- Research management with tech point system
- Option to ignore required tech for creative mode
- Component availability based on researched technologies

### 🎮 **Interactive Widgets**
- **Ships**: Design hull composition and allocate containment between Freight and Tankage with the Cargo/Remass slider
- **Outfit**: Select an operational core widget, then configure Emplacements, Utilities, and Systems. Category sections are collapsible and default to expanded only when their corresponding resources are available; subsections with no technology-eligible options are compacted and muted unless required-tech checks are ignored. Utilities include defensive weapons, selectable radiators, and defenses; Systems include general and entropy systems. Each utility or system device uses one corresponding resource, technology-gated options follow researched tech, and Utilities/Systems show section cost subtotals in CV, industry, or Materiel. Radiator and entropy-system radiance, plus radiator offsets to the six entropy bands, appear in the Hull Plan. Hardpoints are reserved for Fleet view and oversized emplacement weapons use the spinal slot. Multi-arc weapons use one additional resource per weapon; main weapons are restricted to a single Port or Starboard arc. Gear burn analysis shows entropy, Remass per burn, and the maximum burns supported by the connected ship's Remass.
- **QSystems**: Consume System resources and replace the same number of System hulls with Quantum hulls in the Hull Plan
- **Craft**: Create smaller fighters, bombers, and support vessels
- **Troops**: Manage military units with equipment and specializations
- **Missiles**: Design guided weapons with warheads and guidance systems
- **Ship Core**: Pick reactor, engine, and manifold technologies from `data/ship-cores.json`, allocate pips between them, and configure up to four named gears with instability. Core cost is 5 per point of reactor threshold (rounded down), plus the engine's thrust demand (`T^(1/E) * H`, times 1/3 for engines flagged `reaction`), plus 1 per point of manifold entropy capacity. Cost needs a connected class for its hull count; the outfit adds its armour hulls.
- **Hull Plan**: Visualize hull allocation, export JSON keyed to the build-sheet form fields, or download a filled PDF build sheet

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

The bundled weapon catalogue is imported from the [published weapons CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vQWHExCdUgGcby87ZzTN-FlKwLEjWvg1pNlr6DpSeNo31j4gwvk1Tpty1K7DJ2CgWxMteNzgigWXq-A/pub?gid=923591294&single=true&output=csv&range=A2:R328). Run `python3 scripts/import_weapons.py` to refresh it. CSV `H`, `U`, and `E` mount codes count against the new Hardpoints, Utilities, and Emplacements resources respectively; `E` mounts larger than 04 also occupy the single spinal slot. Hardpoints use is tallied, but its available capacity remains unknown until the freight/tankage formula is defined. Troop, craft, warhead, and other entries without a recognized ship mount remain in the catalogue but are not offered as ship-outfit weapons.