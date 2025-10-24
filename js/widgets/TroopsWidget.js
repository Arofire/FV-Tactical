// Troops widget for managing military units
class TroopsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('troops', 'New Troop Unit', x, y, 280); // Remove fixed height
        this.troopData = {
            name: 'New Troop Unit',
            type: 'infantry',
            size: 100,
            equipment: [],
            morale: 100
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Meta section
        const metaSection = this.createSection('meta', 'Unit Information');
        this.setSectionContent(metaSection, `
            <div class="input-group">
                <label>Unit Name</label>
                <input type="text" id="${this.id}-name" value="${this.troopData.name}" placeholder="Enter unit name">
            </div>
            
            <div class="input-group">
                <label>Unit Type</label>
                <select id="${this.id}-type">
                    <option value="infantry" selected>Infantry</option>
                    <option value="marines">Marines</option>
                    <option value="engineers">Engineers</option>
                    <option value="pilots">Pilots</option>
                    <option value="crew">Ship Crew</option>
                </select>
            </div>
            
            <div class="input-group">
                <label>Unit Size</label>
                <input type="number" id="${this.id}-size" value="${this.troopData.size}" min="1" max="10000">
            </div>
        `);
        sectionsContainer.appendChild(metaSection.section);
        
        // Create Equipment section
        const equipmentSection = this.createSection('equipment', 'Equipment');
        this.setSectionContent(equipmentSection, `
            <div class="input-group">
                <label>Equipment</label>
                <button class="add-component-btn" id="${this.id}-add-equipment">Add Equipment</button>
            </div>
            
            <div class="component-list" id="${this.id}-equipment-list">
                <!-- Equipment will be added here -->
            </div>
        `);
        sectionsContainer.appendChild(equipmentSection.section);
        
        // Create Stats section
        const statsSection = this.createSection('stats', 'Statistics');
        this.setSectionContent(statsSection, `
            <div class="widget-stats" id="${this.id}-stats">
                <!-- Stats will be calculated here -->
            </div>
        `);
        sectionsContainer.appendChild(statsSection.section);
        
        this.setupTroopEventListeners();
        this.updateStats();
    }

    setupTroopEventListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        const typeSelect = document.getElementById(`${this.id}-type`);
        const sizeInput = document.getElementById(`${this.id}-size`);
        const addButton = document.getElementById(`${this.id}-add-equipment`);
        
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.troopData.name = e.target.value;
                this.updateTitle();
            });
        }
        
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.troopData.type = e.target.value;
            });
        }
        
        if (sizeInput) {
            sizeInput.addEventListener('input', (e) => {
                this.troopData.size = parseInt(e.target.value) || 0;
                this.updateStats();
            });
        }
        
        if (addButton) {
            addButton.addEventListener('click', () => {
                this.addEquipment();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.troopData.name || 'New Troop Unit';
        }
        this.title = this.troopData.name || 'New Troop Unit';
    }

    addEquipment() {
        const equipmentTypes = [
            { name: 'Personal Armor', cost: 5, mass: 2 },
            { name: 'Assault Rifle', cost: 10, mass: 3 },
            { name: 'Heavy Weapon', cost: 25, mass: 8 },
            { name: 'Communications Gear', cost: 15, mass: 1 }
        ];
        
        const equipment = equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
        
        const troopEquipment = {
            id: `equipment-${Date.now()}`,
            ...equipment
        };
        
        this.troopData.equipment.push(troopEquipment);
        this.updateEquipmentList();
        this.updateStats();
    }

    removeEquipment(equipmentId) {
        this.troopData.equipment = this.troopData.equipment.filter(e => e.id !== equipmentId);
        this.updateEquipmentList();
        this.updateStats();
    }

    updateEquipmentList() {
        const equipmentList = document.getElementById(`${this.id}-equipment-list`);
        if (!equipmentList) return;
        
        equipmentList.innerHTML = '';
        
        for (const equipment of this.troopData.equipment) {
            const equipmentItem = document.createElement('div');
            equipmentItem.className = 'component-item';
            equipmentItem.innerHTML = `
                <div>
                    <div class="component-name">${equipment.name}</div>
                    <div class="component-details">${equipment.cost} credits each</div>
                </div>
                <button class="component-remove" onclick="window.widgetManager.widgets.get('${this.id}').removeEquipment('${equipment.id}')">×</button>
            `;
            equipmentList.appendChild(equipmentItem);
        }
    }

    updateStats() {
        const statsContainer = document.getElementById(`${this.id}-stats`);
        if (!statsContainer) return;
        
        let totalCost = 0;
        for (const equipment of this.troopData.equipment) {
            totalCost += (equipment.cost || 0) * this.troopData.size;
        }
        
        statsContainer.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Unit Size:</span>
                <span class="stat-value">${this.troopData.size} personnel</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Equipment Cost:</span>
                <span class="stat-value">${totalCost} credits</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Morale:</span>
                <span class="stat-value">${this.troopData.morale}%</span>
            </div>
        `;
    }

    createNodes() {
        this.clearNodes();
        this.addNode('output', 'troop', 'Troop', 1, 0.4, {
            sectionId: 'meta',
            anchorId: `${this.id}-meta`
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return this.troopData;
    }

    loadSerializedData(data) {
        this.troopData = data;
        this.updateTitle();
        this.updateEquipmentList();
        this.updateStats();
    }
}