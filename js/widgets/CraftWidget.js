// Craft design widget - similar to ship but for smaller vessels
class CraftWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('craft', 'New Craft', x, y, 300, 350);
        this.craftData = {
            name: 'New Craft',
            type: 'fighter',
            components: [],
            description: '',
            ignoreTechRequirements: false
        };
        this.init();
    }

    createContent(contentElement) {
        contentElement.innerHTML = `
            <div class="input-group">
                <label>Craft Name</label>
                <input type="text" id="${this.id}-name" value="${this.craftData.name}" placeholder="Enter craft name">
            </div>
            
            <div class="input-group">
                <label>Type</label>
                <select id="${this.id}-type">
                    <option value="fighter" selected>Fighter</option>
                    <option value="bomber">Bomber</option>
                    <option value="interceptor">Interceptor</option>
                    <option value="shuttle">Shuttle</option>
                    <option value="drone">Drone</option>
                </select>
            </div>
            
            <div class="input-group">
                <label>
                    <input type="checkbox" id="${this.id}-ignore-tech" ${this.craftData.ignoreTechRequirements ? 'checked' : ''}>
                    Ignore Tech Requirements
                </label>
            </div>
            
            <div class="input-group">
                <label>Add Component</label>
                <div style="display: flex; gap: 8px;">
                    <select id="${this.id}-component-category" style="flex: 1;">
                        <option value="hulls">Hull</option>
                        <option value="engines">Engine</option>
                        <option value="weapons">Weapon</option>
                    </select>
                    <button class="add-component-btn" id="${this.id}-add-component">Add</button>
                </div>
            </div>
            
            <div class="component-list" id="${this.id}-component-list">
                <!-- Components will be added here -->
            </div>
            
            <div class="widget-stats" id="${this.id}-stats">
                <!-- Stats will be calculated here -->
            </div>
        `;
        
        this.setupCraftEventListeners();
        this.updateStats();
    }

    setupCraftEventListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        const typeSelect = document.getElementById(`${this.id}-type`);
        const addButton = document.getElementById(`${this.id}-add-component`);
        
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.craftData.name = e.target.value;
                this.updateTitle();
            });
        }
        
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.craftData.type = e.target.value;
            });
        }
        
        if (addButton) {
            addButton.addEventListener('click', () => {
                this.addComponent();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.craftData.name || 'New Craft';
        }
        this.title = this.craftData.name || 'New Craft';
    }

    addComponent() {
        const categorySelect = document.getElementById(`${this.id}-component-category`);
        if (!categorySelect) return;
        
        const category = categorySelect.value;
        // Fallback to all components if empire is not available
        const availableComponents = window.empire 
            ? ComponentLibrary.getAvailableComponents(category, window.empire)
            : ComponentLibrary.getComponentsByCategory(category);
        const componentIds = Object.keys(availableComponents);
        
        if (componentIds.length === 0) return;
        
        // For demo, add first available component
        const componentId = componentIds[0];
        const component = availableComponents[componentId];
        
        const craftComponent = {
            id: `${componentId}-${Date.now()}`,
            componentId: componentId,
            category: category,
            ...component
        };
        
        this.craftData.components.push(craftComponent);
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
    }

    removeComponent(componentId) {
        this.craftData.components = this.craftData.components.filter(c => c.id !== componentId);
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
    }

    updateComponentList() {
        const componentList = document.getElementById(`${this.id}-component-list`);
        if (!componentList) return;
        
        componentList.innerHTML = '';
        
        for (const component of this.craftData.components) {
            const componentItem = document.createElement('div');
            componentItem.className = 'component-item';
            componentItem.innerHTML = `
                <div>
                    <div class="component-name">${component.name}</div>
                    <div class="component-details">${component.mass || 0} mass</div>
                </div>
                <button class="component-remove" onclick="window.widgetManager.widgets.get('${this.id}').removeComponent('${component.id}')">×</button>
            `;
            componentList.appendChild(componentItem);
        }
    }

    updateStats() {
        const statsContainer = document.getElementById(`${this.id}-stats`);
        if (!statsContainer) return;
        
        let totalMass = 0;
        let totalThrust = 0;
        
        for (const component of this.craftData.components) {
            if (component.mass) totalMass += component.mass;
            if (component.thrust) totalThrust += component.thrust;
        }
        
        statsContainer.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Mass:</span>
                <span class="stat-value">${totalMass} units</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Thrust:</span>
                <span class="stat-value">${totalThrust} units</span>
            </div>
        `;
    }

    createNodes() {
        this.addNode('input', 'power', 'Power', 0, 0.3);
        this.addNode('output', 'component', 'Craft Data', 1, 0.3);
    }

    getSerializedData() {
        return this.craftData;
    }

    loadSerializedData(data) {
        this.craftData = data;
        this.updateTitle();
        this.updateComponentList();
        this.updateStats();
    }
}