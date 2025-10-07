# FV-Tactical

A web-based node-driven design tool for tabletop wargaming spacecraft and military units. Create and manage ship designs, fighter craft, troop units, weapons, and industrial facilities for your empire.

## Features

### 🚀 **Ship & Craft Design**
- Modular component system for spacecraft design
- Dynamic node connections for weapon-magazine linkages
- Real-time power balance and performance calculations
- Support for various ship classifications from fighters to dreadnoughts

### 🔬 **Technology Tree**
- Visual tech tree with prerequisites and dependencies
- Research management with tech point system
- Option to ignore tech requirements for creative mode
- Component availability based on researched technologies

### 🎮 **Interactive Widgets**
- **Ships**: Design large spacecraft with hull, engines, weapons, and reactors
- **Outfit**: Configure ship hardpoints, systems modules, and role profiles
- **Craft**: Create smaller fighters, bombers, and support vessels
- **Troops**: Manage military units with equipment and specializations
- **Missiles**: Design guided weapons with warheads and guidance systems
- **Loadouts**: Create equipment configurations for ships and troops
- **Powerplants**: Design power generation systems
- **Factories**: Manage industrial production capabilities
- **Shipyards**: Plan ship construction facilities

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

2. Open `index.html` in a modern web browser
   - Chrome, Firefox, Safari, or Edge recommended
   - No build process required - pure HTML/CSS/JavaScript

### 🎯 **Quick Start Guide**
1. **Create Your Empire**: Click on "New Empire" to set your empire name
2. **Research Technology**: Expand the tech tree panel and click technologies to research them
3. **Design Ships**: Click "Ship" in the toolbar to create your first spacecraft
4. **Add Components**: Select hull, engines, weapons, and reactors from the component library
5. **Connect Systems**: Drag between nodes to create power and weapon connections
6. **Check Status**: Monitor the preflight panel for warnings and requirements
7. **Save & Export**: Use the empire controls to save your designs locally or export to JSON

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
│   │   └── OtherWidgets.js # Other specialized widgets
│   └── main.js             # Application initialization
└── README.md
```

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