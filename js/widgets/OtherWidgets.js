// Missiles widget for designing missile systems
class MissilesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('missiles', 'New Missile', x, y, 280); // Remove fixed height
        this.missileData = {
            name: 'New Missile',
            warhead: null,
            guidance: null,
            propulsion: null,
            ignoreTechRequirements: false
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Design section
        const designSection = this.createSection('design', 'Missile Design');
        designSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Missile Name</label>
                <input type="text" id="${this.id}-name" value="${this.missileData.name}">
            </div>
            <div class="input-group">
                <label>Warhead Type</label>
                <select id="${this.id}-warhead">
                    <option value="kinetic">Kinetic</option>
                    <option value="explosive">High Explosive</option>
                    <option value="nuclear">Nuclear</option>
                </select>
            </div>
            <div class="input-group">
                <label>
                    <input type="checkbox" id="${this.id}-ignore-tech" ${this.missileData.ignoreTechRequirements ? 'checked' : ''}>
                    Ignore Tech Requirements
                </label>
            </div>
        `;
        sectionsContainer.appendChild(designSection.section);
        
        // Create Stats section
        const statsSection = this.createSection('stats', 'Statistics');
        statsSection.contentContainer.innerHTML = `
            <div class="widget-stats" id="${this.id}-stats"></div>
        `;
        sectionsContainer.appendChild(statsSection.section);
        
        this.setupMissileListeners();
    }

    setupMissileListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.missileData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.missileData.name || 'New Missile';
        }
    }

    createNodes() {
        this.addNode('output', 'weapon', 'Missile Data', 1, 0.5, {
            sectionId: 'stats'
        });
    }

    getSerializedData() { return this.missileData; }
    loadSerializedData(data) { this.missileData = data; this.updateTitle(); }
}

// Loadouts widget for equipment configurations
class LoadoutsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('loadouts', 'New Loadout', x, y, 280); // Remove fixed height
        this.loadoutData = {
            name: 'New Loadout',
            items: []
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Configuration section
        const configSection = this.createSection('config', 'Configuration');
        configSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Loadout Name</label>
                <input type="text" id="${this.id}-name" value="${this.loadoutData.name}">
            </div>
            <button class="add-component-btn" id="${this.id}-add-item">Add Item</button>
            <div class="component-list" id="${this.id}-items-list"></div>
        `;
        sectionsContainer.appendChild(configSection.section);
        
        this.setupLoadoutListeners();
    }

    setupLoadoutListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.loadoutData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.loadoutData.name || 'New Loadout';
        }
    }

    createNodes() {
        this.addNode('input', 'magazine', 'Magazine Input', 0, 0.5, {
            sectionId: 'config'
        });
        this.addNode('output', 'data', 'Loadout Data', 1, 0.5, {
            sectionId: 'config'
        });
    }

    getSerializedData() { return this.loadoutData; }
    loadSerializedData(data) { this.loadoutData = data; this.updateTitle(); }
}

// Powerplants widget for power generation
class PowerplantsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('powerplants', 'New Powerplant', x, y, 280); // Remove fixed height
        this.powerplantData = {
            name: 'New Powerplant',
            reactorType: 'fusion',
            output: 1000,
            ignoreTechRequirements: false
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Design section
        const designSection = this.createSection('design', 'Powerplant Design');
        designSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Powerplant Name</label>
                <input type="text" id="${this.id}-name" value="${this.powerplantData.name}">
            </div>
            <div class="input-group">
                <label>Reactor Type</label>
                <select id="${this.id}-reactor">
                    <option value="fusion">Fusion</option>
                    <option value="fission">Fission</option>
                    <option value="antimatter">Antimatter</option>
                </select>
            </div>
            <div class="input-group">
                <label>
                    <input type="checkbox" id="${this.id}-ignore-tech" ${this.powerplantData.ignoreTechRequirements ? 'checked' : ''}>
                    Ignore Tech Requirements
                </label>
            </div>
        `;
        sectionsContainer.appendChild(designSection.section);
        
        // Create Stats section
        const statsSection = this.createSection('stats', 'Performance');
        statsSection.contentContainer.innerHTML = `
            <div class="widget-stats" id="${this.id}-stats">
                <div class="stat-row">
                    <span class="stat-label">Power Output:</span>
                    <span class="stat-value">${this.powerplantData.output} MW</span>
                </div>
            </div>
        `;
        sectionsContainer.appendChild(statsSection.section);
        
        this.setupPowerplantListeners();
    }

    setupPowerplantListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.powerplantData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.powerplantData.name || 'New Powerplant';
        }
    }

    createNodes() {
        this.addNode('output', 'power', 'Power Output', 1, 0.5, {
            sectionId: 'stats'
        });
    }

    getSerializedData() { return this.powerplantData; }
    loadSerializedData(data) { this.powerplantData = data; this.updateTitle(); }
}

// Factories widget for production management
class FactoriesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('factories', 'New Factory', x, y, 280); // Remove fixed height
        this.factoryData = {
            name: 'New Factory',
            productionLines: [],
            efficiency: 100
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Configuration section
        const configSection = this.createSection('config', 'Factory Configuration');
        configSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Factory Name</label>
                <input type="text" id="${this.id}-name" value="${this.factoryData.name}">
            </div>
            <div class="input-group">
                <label>Production Efficiency</label>
                <input type="range" id="${this.id}-efficiency" min="50" max="150" value="${this.factoryData.efficiency}">
                <span>${this.factoryData.efficiency}%</span>
            </div>
        `;
        sectionsContainer.appendChild(configSection.section);
        
        // Create Production section
        const productionSection = this.createSection('production', 'Production Lines');
        productionSection.contentContainer.innerHTML = `
            <div class="component-list" id="${this.id}-production-list"></div>
        `;
        sectionsContainer.appendChild(productionSection.section);
        
        this.setupFactoryListeners();
    }

    setupFactoryListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.factoryData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.factoryData.name || 'New Factory';
        }
    }

    createNodes() {
        this.addNode('input', 'component', 'Components', 0, 0.5, {
            sectionId: 'production'
        });
        this.addNode('output', 'component', 'Products', 1, 0.5, {
            sectionId: 'production'
        });
    }

    getSerializedData() { return this.factoryData; }
    loadSerializedData(data) { this.factoryData = data; this.updateTitle(); }
}

// Shipyards widget for ship construction
class ShipyardsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipyards', 'New Shipyard', x, y, 280); // Remove fixed height
        this.shipyardData = {
            name: 'New Shipyard',
            capabilities: [],
            constructionQueue: []
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Configuration section
        const configSection = this.createSection('config', 'Shipyard Configuration');
        configSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Shipyard Name</label>
                <input type="text" id="${this.id}-name" value="${this.shipyardData.name}">
            </div>
            <div class="input-group">
                <label>Construction Capacity</label>
                <select id="${this.id}-capacity">
                    <option value="small">Small Craft</option>
                    <option value="medium">Medium Ships</option>
                    <option value="large">Large Ships</option>
                    <option value="capital">Capital Ships</option>
                </select>
            </div>
        `;
        sectionsContainer.appendChild(configSection.section);
        
        // Create Production section
        const productionSection = this.createSection('production', 'Construction');
        productionSection.contentContainer.innerHTML = `
            <div class="widget-stats" id="${this.id}-stats">
                <div class="stat-row">
                    <span class="stat-label">Queue:</span>
                    <span class="stat-value">${this.shipyardData.constructionQueue.length} ships</span>
                </div>
            </div>
        `;
        sectionsContainer.appendChild(productionSection.section);
        
        this.setupShipyardListeners();
    }

    setupShipyardListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipyardData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.shipyardData.name || 'New Shipyard';
        }
    }

    createNodes() {
        this.addNode('input', 'component', 'Ship Designs', 0, 0.3, {
            sectionId: 'config'
        });
        this.addNode('input', 'component', 'Materials', 0, 0.7, {
            sectionId: 'production'
        });
        this.addNode('output', 'component', 'Completed Ships', 1, 0.5, {
            sectionId: 'production'
        });
    }

    getSerializedData() { return this.shipyardData; }
    loadSerializedData(data) { this.shipyardData = data; this.updateTitle(); }
}