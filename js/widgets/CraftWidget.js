// Craft design widget - similar to ship but for smaller vessels
class CraftWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('craft', 'New Craft', x, y, null);
        this.craftData = {
            name: 'New Craft',
            type: 'fighter',
            components: [],
            description: '',
            ignoreTechRequirements: false
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Meta section
        const metaSection = this.createSection('meta', 'Craft Information');
        this.setSectionContent(metaSection, `
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
        `);
        sectionsContainer.appendChild(metaSection.section);
        
        // Create Components section
        const componentsSection = this.createSection('components', 'Components');
        this.setSectionContent(componentsSection, `
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
        `);
        sectionsContainer.appendChild(componentsSection.section);
        
        // Create Stats section
        const statsSection = this.createSection('stats', 'Statistics');
        this.setSectionContent(statsSection, `
            <div class="widget-stats" id="${this.id}-stats">
                <!-- Stats will be calculated here -->
            </div>
        `);
        sectionsContainer.appendChild(statsSection.section);
        
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
                this.refreshSummary();
            });
        }
        
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.craftData.type = e.target.value;
                this.refreshSummary();
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
        this.refreshSummary();
    }

    removeComponent(componentId) {
        this.craftData.components = this.craftData.components.filter(c => c.id !== componentId);
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
        this.refreshSummary();
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
        this.clearNodes();
        this.addNode('output', 'craft', 'Craft', 1, 0.4, {
            sectionId: 'meta',
            anchorId: `${this.id}-meta`
        });
        this.reflowNodes();
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

    renderSummary(container) {
        if (!container) return;

        // Clear any existing summary
        container.innerHTML = '';

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.craftData.name || 'New Craft';
        container.appendChild(titleDiv);

        // Badges
        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        if (this.craftData.type) {
            badgesDiv.appendChild(this.createBadge(this.craftData.type, 'info'));
        }
        
        if (this.craftData.ignoreTechRequirements) {
            badgesDiv.appendChild(this.createBadge('Tech Unlocked', 'warning'));
        }

        container.appendChild(badgesDiv);

        // Summary grid
        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        // Type
        this.addSummaryField(gridDiv, 'Type', this.craftData.type || '—');

        // Calculate stats
        let totalMass = 0;
        let totalThrust = 0;
        
        for (const component of this.craftData.components) {
            if (component.mass) totalMass += component.mass;
            if (component.thrust) totalThrust += component.thrust;
        }

        // Stats
        this.addSummaryField(gridDiv, 'Mass', `${totalMass} units`);
        this.addSummaryField(gridDiv, 'Thrust', `${totalThrust} units`);
        this.addSummaryField(gridDiv, 'Components', this.craftData.components.length.toString());

        container.appendChild(gridDiv);
    }

    refreshSummary() {
        if (!this.element) return;
        const summaryContainer = this.element.querySelector('.widget-summary');
        if (!summaryContainer) return;
        
        const isMinimized = this.element.classList.contains('minimized');
        if (isMinimized) {
            this.renderSummary(summaryContainer);
        }
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) {
            this.refreshSummary();
        }
    }

    addSummaryField(container, label, value) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'summary-label';
        labelDiv.textContent = label;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'summary-value';
        valueDiv.textContent = value;

        container.appendChild(labelDiv);
        container.appendChild(valueDiv);
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}