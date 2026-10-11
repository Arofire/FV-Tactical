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
- Visual tech tree with prerequisites and dependencies
- Research management with tech point system
- Option to ignore tech requirements for creative mode
- Component availability based on researched technologies

### 🎮 **Interactive Widgets**
- **Ships**: Design hull composition and allocate containment between Freight and Tankage with the Cargo/Remass slider
- **Outfit**: Select an operational core widget, then configure Emplacements, Utilities, and Systems; Hardpoints are reserved for Fleet view, defensive weapons are listed under Utilities, and oversized emplacement weapons use the spinal slot. Multi-arc weapons use one additional resource per weapon; main weapons are restricted to a single Port or Starboard arc.
- **QSystems**: Consume System resources and replace the same number of System hulls with Quantum hulls in the Hull Plan
- **Craft**: Create smaller fighters, bombers, and support vessels
- **Troops**: Manage military units with equipment and specializations
- **Missiles**: Design guided weapons with warheads and guidance systems
- **Ship Core**: Configure power technology, efficiencies, and gearing
- **Hull Plan**: Visualize and export hull allocation

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
- Technology requirement checking
- Component compatibility validation
- Power balance analysis
- Missing component alerts

### 💾 **Data Management**
- Local storage with auto-save functionality
- JSON export/import for sharing designs
- Backup and restore capabilities
- Cross-platform compatibility

## Getting Started

### 🌐 **Online Access**
Visit the live application at: `https://arofire.github.io/FV-Tactical/`

### 💻 **Local Development**
1. Clone the repository:
   ```bash
   git clone https://github.com/Arofire/FV-Tactical.git
   cd FV-Tactical
   ```

2. Serve the project over HTTP and open it in a modern web browser so its JSON catalogues can load
   - Chrome, Firefox, Safari, or Edge recommended
   - No build process required - pure HTML/CSS/JavaScript

### 🎯 **Quick Start Guide**
1. **Create Your Empire**: Set your Empire name and choose an economy mode
2. **Research Technology**: Expand the tech tree panel and click technologies to research them
3. **Choose Design**: Create ship, craft, troop, outfit, and core designs in the Design view
4. **Add Components**: Select hull, engines, weapons, and reactors from the component library
5. **Connect Systems**: Drag between nodes to create power and weapon connections
6. **Check Status**: Monitor preflight and the per-widget technology tree
7. **Build a Fleet**: Switch to Fleet and add unique ships based on a ship-class design
8. **Save & Export**: Save designs and fleet assignments locally or export them to JSON

## Controls

### 🎮 **Widget Manipulation**
- **Drag**: Click and drag widget headers to move
- **Resize**: Drag the resize handle in the bottom-right corner
- **Minimize**: Click the "−" button to collapse widgets
- **Close**: Click the "×" button to delete widgets
- **Select**: Click anywhere on a widget to select it

### 🔗 **Node Connections**
- **Connect**: Click and drag from an output node to an input node
- **Disconnect**: Right-click a connection line and select "Delete"
- **Validate**: Connections automatically check type compatibility

### ⌨️ **Keyboard Shortcuts**
- `Ctrl+S`: Save empire
- `Ctrl+O`: Load empire
- `Ctrl+E`: Export empire
- `Delete`: Remove selected widgets

## Architecture

### 📁 **Project Structure**
```
FV-Tactical/
├── index.html              # Main application page
├── css/
│   ├── styles.css          # Core application styles
│   ├── widgets.css         # Widget-specific styles
│   └── nodes.css           # Node system styles
├── js/
│   ├── core/
│   │   ├── Empire.js       # Empire management system
│   │   ├── TechTree.js     # Technology tree and components
│   │   ├── Widget.js       # Base widget class
│   │   ├── NodeSystem.js   # Visual node connection system
│   │   ├── DataManager.js  # Save/load functionality
│   │   └── PreflightCheck.js # Validation system
│   ├── widgets/
│   │   ├── ShipWidget.js   # Ship design widget
│   │   ├── OutfitWidget.js # Ship outfit planner
│   │   ├── CraftWidget.js  # Craft design widget
│   │   ├── TroopsWidget.js # Troops management widget
│   │   ├── ShipCoreWidget.js # Core and gearing widget
│   │   └── ShipHullsWidget.js # Hull visualization and export
│   └── main.js             # Application initialization
├── data/
│   ├── tech-tree.json      # Technology definitions
│   ├── weapons.json        # Imported weapon catalogue
│   └── *.json              # Craft and troop catalogues
├── scripts/
│   └── import_weapons.py   # Refresh the weapon catalogue from its published CSV
└── README.md
```

The bundled weapon catalogue is imported from the [published weapons CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vQWHExCdUgGcby87ZzTN-FlKwLEjWvg1pNlr6DpSeNo31j4gwvk1Tpty1K7DJ2CgWxMteNzgigWXq-A/pub?gid=923591294&single=true&output=csv&range=A2:R328). Run `python3 scripts/import_weapons.py` to refresh it. CSV `H`, `U`, and `E` mount codes count against the new Hardpoints, Utilities, and Emplacements resources respectively; `E` mounts larger than 04 also occupy the single spinal slot. Hardpoints use is tallied, but its available capacity remains unknown until the freight/tankage formula is defined. Troop, craft, warhead, and other entries without a recognized ship mount remain in the catalogue but are not offered as ship-outfit weapons.

### 🏗️ **Technical Details**
- **Framework**: Vanilla JavaScript ES6+ with modern web APIs
- **Storage**: LocalStorage for persistence, JSON for import/export
- **Graphics**: SVG for connection rendering, CSS for styling
- **Architecture**: Modular class-based design with event-driven updates

## Technology Tree

The game includes a comprehensive technology tree with multiple categories:

- **Hull Technologies**: Basic to advanced ship construction
- **Propulsion**: Chemical rockets to fusion drives
- **Weapons**: Kinetic weapons to plasma cannons
- **Power Systems**: Fission to antimatter reactors
- **Electronics**: Basic sensors to AI systems
- **Manufacturing**: Industrial production capabilities

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### 🛠️ **Development**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in multiple browsers
5. Submit a pull request

## License

This project is open source. Please check the repository for license details.

## Support

For questions, bug reports, or feature requests, please open an issue on the GitHub repository.

---

**FV-Tactical** - Design the future of space warfare! 🚀