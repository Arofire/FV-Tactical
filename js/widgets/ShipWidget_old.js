// Ship design widget
class ShipWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('ship', 'New Ship Class', x, y, 400, 600);
        
        // Initialize ship class data
        this.shipData = {
            name: 'New Ship Class',
            role: 'corvette',
            customRole: '',
            description: '',
            designNotes: '',
            appearance: '',
            text2imgPrompt: '',
            hullComposition: {
                containment: 0,
                remass: 0,
                magazine: 0,
                hangar: 0,
                bunker: 0,
                system: 0,
                powerplant: 0
            },
            powerAndPropulsion: {
                thrust: 0,
                burnRating: 0,
                heatEfficiency: 0,
                supplyRating: 0
            },
            heatManagement: {
                capacity: 0,
                thresholds: { warning: 0, critical: 0, maximum: 0 },
                dissipation: 0
            },
            ignoreTechRequirements: false
        };
        
        this.defaultRoles = [
            'corvette', 'frigate', 'destroyer', 'cruiser', 'battleship', 
            'dreadnought', 'carrier', 'fighter', 'bomber', 'scout', 
            'transport', 'support', 'custom'
        ];
        
        this.hullTypes = [
            'containment', 'remass', 'magazine', 'hangar', 
            'bunker', 'system', 'powerplant'
        ];
        
        this.selectedComponent = null;
        this.init();
    }

    createContent(contentElement) {
        contentElement.innerHTML = `
            <!-- Basic Information -->
            <div class="input-group">
                <label>Ship Class Name</label>
                <input type="text" id="${this.id}-name" value="${this.shipData.name}" placeholder="Enter ship class name">
            </div>
            
            <div class="input-group">
                <label>Role</label>
                <select id="${this.id}-role">
                    ${this.defaultRoles.map(role => 
                        `<option value="${role}" ${this.shipData.role === role ? 'selected' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`
                    ).join('')}
                </select>
                <input type="text" id="${this.id}-custom-role" placeholder="Enter custom role" 
                       style="display: ${this.shipData.role === 'custom' ? 'block' : 'none'}; margin-top: 4px;" 
                       value="${this.shipData.customRole}">
            </div>
            
            <div class="widget-tabs">
                <button class="widget-tab active" data-tab="basic">Basic Info</button>
                <button class="widget-tab" data-tab="hulls">Hull Composition</button>
                <button class="widget-tab" data-tab="power">Power & Propulsion</button>
                <button class="widget-tab" data-tab="heat">Heat Management</button>
                <button class="widget-tab" data-tab="nodes">Connection Nodes</button>
            </div>
            
            <!-- Basic Info Tab -->
            <div class="widget-tab-content active" id="${this.id}-basic-tab">
                <div class="input-group">
                    <label>Description</label>
                    <textarea id="${this.id}-description" placeholder="Ship class description and purpose...">${this.shipData.description}</textarea>
                </div>
                
                <div class="input-group">
                    <label>Design Notes</label>
                    <textarea id="${this.id}-design-notes" placeholder="Internal design notes and requirements...">${this.shipData.designNotes}</textarea>
                </div>
                
                <div class="input-group">
                    <label>Appearance</label>
                    <textarea id="${this.id}-appearance" placeholder="Visual description for opponents...">${this.shipData.appearance}</textarea>
                </div>
                
                <div class="input-group">
                    <label>Text2Img Prompt</label>
                    <textarea id="${this.id}-text2img" placeholder="AI image generation prompt (auto-generated from design criteria)..." readonly>${this.shipData.text2imgPrompt}</textarea>
                </div>
                
                <div class="input-group">
                    <label>
                        <input type="checkbox" id="${this.id}-ignore-tech" ${this.shipData.ignoreTechRequirements ? 'checked' : ''}>
                        Ignore Tech Requirements
                    </label>
                </div>
            </div>
            
            <!-- Hull Composition Tab -->
            <div class="widget-tab-content" id="${this.id}-hulls-tab">
                <div class="hull-composition">
                    <h4>Hull Composition</h4>
                    <div class="hull-grid">
                        ${this.hullTypes.map(hullType => `
                            <div class="hull-item">
                                <label>${hullType.charAt(0).toUpperCase() + hullType.slice(1)} Hulls</label>
                                <div class="hull-controls">
                                    <button class="hull-btn decrease" data-hull="${hullType}">−</button>
                                    <span class="hull-count" id="${this.id}-hull-${hullType}">${this.shipData.hullComposition[hullType]}</span>
                                    <button class="hull-btn increase" data-hull="${hullType}">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="hull-total">
                        Total Hulls: <span id="${this.id}-hull-total">${this.getTotalHulls()}</span>
                    </div>
                </div>
            </div>
            
            <!-- Power & Propulsion Tab -->
            <div class="widget-tab-content" id="${this.id}-power-tab">
                <div class="power-propulsion-segment">
                    <h4>Power & Propulsion</h4>
                    <div class="power-stats" id="${this.id}-power-stats">
                        <div class="stat-item">
                            <label>Thrust:</label>
                            <span>${this.shipData.powerAndPropulsion.thrust}</span>
                        </div>
                        <div class="stat-item">
                            <label>Burn Rating:</label>
                            <span>${this.shipData.powerAndPropulsion.burnRating}</span>
                        </div>
                        <div class="stat-item">
                            <label>Heat Efficiency:</label>
                            <span>${this.shipData.powerAndPropulsion.heatEfficiency}</span>
                        </div>
                        <div class="stat-item">
                            <label>Supply Rating:</label>
                            <span>${this.shipData.powerAndPropulsion.supplyRating}</span>
                        </div>
                    </div>
                    <div class="powerplant-status" id="${this.id}-powerplant-status">
                        ${this.shipData.hullComposition.powerplant > 0 ? 
                            '<div class="status-warning">⚠️ Powerplant node required</div>' : 
                            '<div class="status-info">No powerplant hulls - no power requirements</div>'
                        }
                    </div>
                </div>
            </div>
            
            <!-- Heat Management Tab -->
            <div class="widget-tab-content" id="${this.id}-heat-tab">
                <div class="heat-management-segment">
                    <h4>Heat Management</h4>
                    <div class="heat-stats" id="${this.id}-heat-stats">
                        <div class="stat-item">
                            <label>Heat Capacity:</label>
                            <span>${this.shipData.heatManagement.capacity}</span>
                        </div>
                        <div class="stat-item">
                            <label>Heat Dissipation:</label>
                            <span>${this.shipData.heatManagement.dissipation}/turn</span>
                        </div>
                        <div class="heat-thresholds">
                            <h5>Heat Thresholds</h5>
                            <div class="stat-item">
                                <label>Warning:</label>
                                <span>${this.shipData.heatManagement.thresholds.warning}</span>
                            </div>
                            <div class="stat-item">
                                <label>Critical:</label>
                                <span>${this.shipData.heatManagement.thresholds.critical}</span>
                            </div>
                            <div class="stat-item">
                                <label>Maximum:</label>
                                <span>${this.shipData.heatManagement.thresholds.maximum}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Connection Nodes Tab -->
            <div class="widget-tab-content" id="${this.id}-nodes-tab">
                <div class="connection-nodes">
                    <h4>Connection Nodes</h4>
                    <div class="node-list" id="${this.id}-node-list">
                        <!-- Nodes will be dynamically generated based on hull composition -->
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
        this.updateNodes();
        this.updateStats();
    }

    getTotalHulls() {
        return Object.values(this.shipData.hullComposition).reduce((sum, count) => sum + count, 0);
    }

    updateNodes() {
        const nodeList = document.getElementById(`${this.id}-node-list`);
        if (!nodeList) return;
        
        let nodesHtml = '';
        
        // Loadout node (Magazine or Hangar hulls)
        if (this.shipData.hullComposition.magazine > 0 || this.shipData.hullComposition.hangar > 0) {
            nodesHtml += `
                <div class="node-item loadout-node">
                    <div class="node-header">
                        <span class="node-title">⚡ Loadout Node</span>
                        <span class="node-status warning">⚠️ Warning if not connected</span>
                    </div>
                    <div class="node-description">Connects to Equipment Loadout Widget</div>
                </div>
            `;
        }
        
        // Powerplant node (Powerplant hulls)
        if (this.shipData.hullComposition.powerplant > 0) {
            nodesHtml += `
                <div class="node-item powerplant-node">
                    <div class="node-header">
                        <span class="node-title">🔋 Powerplant Node</span>
                        <span class="node-status error">❌ Error if not connected</span>
                    </div>
                    <div class="node-description">Connects to Powerplant Widget</div>
                </div>
            `;
        }
        
        // Systems node (System hulls)
        if (this.shipData.hullComposition.system > 0) {
            nodesHtml += `
                <div class="node-item systems-node">
                    <div class="node-header">
                        <span class="node-title">🖥️ Systems Node</span>
                        <span class="node-status warning">⚠️ Warning if not connected</span>
                    </div>
                    <div class="node-description">Connects to Systems Widget</div>
                </div>
            `;
        }
        
        if (nodesHtml === '') {
            nodesHtml = '<div class="no-nodes">No connection nodes required for current hull composition</div>';
        }
        
        nodeList.innerHTML = nodesHtml;
    }

    updateText2ImgPrompt() {
        // Auto-generate text2img prompt from ship data
        const role = this.shipData.role === 'custom' ? this.shipData.customRole : this.shipData.role;
        const totalHulls = this.getTotalHulls();
        
        let prompt = `${role} class starship`;
        if (this.shipData.appearance) {
            prompt += `, ${this.shipData.appearance}`;
        }
        if (totalHulls > 0) {
            prompt += `, ${totalHulls} hull sections`;
        }
        
        this.shipData.text2imgPrompt = prompt;
        const promptElement = document.getElementById(`${this.id}-text2img`);
        if (promptElement) {
            promptElement.value = prompt;
        }
    }

    setupEventListeners() {
        super.setupEventListeners();
        
        // Basic information inputs
        const nameInput = document.getElementById(`${this.id}-name`);
        const roleSelect = document.getElementById(`${this.id}-role`);
        const customRoleInput = document.getElementById(`${this.id}-custom-role`);
        const descriptionTextarea = document.getElementById(`${this.id}-description`);
        const designNotesTextarea = document.getElementById(`${this.id}-design-notes`);
        const appearanceTextarea = document.getElementById(`${this.id}-appearance`);
        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipData.name = e.target.value;
                this.updateTitle(this.shipData.name);
                this.updateText2ImgPrompt();
            });
        }
        
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                this.shipData.role = e.target.value;
                const customRoleInput = document.getElementById(`${this.id}-custom-role`);
                if (customRoleInput) {
                    customRoleInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
                this.updateText2ImgPrompt();
            });
        }
        
        if (customRoleInput) {
            customRoleInput.addEventListener('input', (e) => {
                this.shipData.customRole = e.target.value;
                this.updateText2ImgPrompt();
            });
        }
        
        if (descriptionTextarea) {
            descriptionTextarea.addEventListener('input', (e) => {
                this.shipData.description = e.target.value;
            });
        }
        
        if (designNotesTextarea) {
            designNotesTextarea.addEventListener('input', (e) => {
                this.shipData.designNotes = e.target.value;
            });
        }
        
        if (appearanceTextarea) {
            appearanceTextarea.addEventListener('input', (e) => {
                this.shipData.appearance = e.target.value;
                this.updateText2ImgPrompt();
            });
        }
        
        if (ignoreTechCheckbox) {
            ignoreTechCheckbox.addEventListener('change', (e) => {
                this.shipData.ignoreTechRequirements = e.target.checked;
            });
        }
        
        // Hull composition controls
        const hullButtons = this.element.querySelectorAll('.hull-btn');
        hullButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const hullType = e.target.dataset.hull;
                const isIncrease = e.target.classList.contains('increase');
                
                if (isIncrease) {
                    this.shipData.hullComposition[hullType]++;
                } else if (this.shipData.hullComposition[hullType] > 0) {
                    this.shipData.hullComposition[hullType]--;
                }
                
                this.updateHullDisplay();
                this.updateNodes();
                this.updateStats();
                this.updateText2ImgPrompt();
            });
        });
        
        // Tab switching
        const tabButtons = this.element.querySelectorAll('.widget-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }
    
    updateHullDisplay() {
        this.hullTypes.forEach(hullType => {
            const countElement = document.getElementById(`${this.id}-hull-${hullType}`);
            if (countElement) {
                countElement.textContent = this.shipData.hullComposition[hullType];
            }
        });
        
        const totalElement = document.getElementById(`${this.id}-hull-total`);
        if (totalElement) {
            totalElement.textContent = this.getTotalHulls();
        }
    }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.shipData.name || 'New Ship Class';
        }
        this.title = this.shipData.name || 'New Ship Class';
    }

    updateComponentOptions() {
        const categorySelect = document.getElementById(`${this.id}-component-category`);
        const typeSelect = document.getElementById(`${this.id}-component-type`);
        
        if (!categorySelect || !typeSelect) return;
        
        // Check if ComponentLibrary is available
        if (typeof ComponentLibrary === 'undefined') {
            console.warn('ComponentLibrary not yet loaded, retrying...');
            typeSelect.innerHTML = '<option value="">Loading components...</option>';
            // Retry after a short delay
            setTimeout(() => this.updateComponentOptions(), 100);
            return;
        }
        
        const category = categorySelect.value;
        let availableComponents;
        
        try {
            if (this.shipData.ignoreTechRequirements) {
                availableComponents = ComponentLibrary.getComponentsByCategory(category);
            } else {
                // Always fallback to all components if empire is not available
                if (window.empire) {
                    availableComponents = ComponentLibrary.getAvailableComponents(category, window.empire);
                } else {
                    console.warn('Empire not available, showing all components');
                    availableComponents = ComponentLibrary.getComponentsByCategory(category);
                }
            }
        } catch (error) {
            console.error('Error getting components:', error);
            typeSelect.innerHTML = '<option value="">Error loading components</option>';
            return;
        }
        
        // Ensure availableComponents is valid
        if (!availableComponents || typeof availableComponents !== 'object') {
            console.warn('No components available for category:', category);
            typeSelect.innerHTML = '<option value="">No components available</option>';
            return;
        }
        
        typeSelect.innerHTML = '<option value="">Select component...</option>';
        
        for (const [id, component] of Object.entries(availableComponents)) {
            // Skip invalid or undefined components
            if (!component || !component.name) {
                console.warn('Skipping invalid component:', id, component);
                continue;
            }
            
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${component.name} (${component.cost || 0} credits)`;
            
            // Add tech requirements to tooltip
            if (component.requiredTech && component.requiredTech.length > 0) {
                option.title = `Requires: ${component.requiredTech.join(', ')}`;
            }
            
            typeSelect.appendChild(option);
        }
    }

    addComponent() {
        const categorySelect = document.getElementById(`${this.id}-component-category`);
        const typeSelect = document.getElementById(`${this.id}-component-type`);
        
        if (!categorySelect || !typeSelect || !typeSelect.value) return;
        
        // Check if ComponentLibrary is available
        if (typeof ComponentLibrary === 'undefined') {
            console.error('ComponentLibrary not available');
            return;
        }
        
        const category = categorySelect.value;
        const componentId = typeSelect.value;
        
        let component;
        try {
            component = ComponentLibrary.getComponent(category, componentId);
        } catch (error) {
            console.error('Error getting component:', error);
            return;
        }
        
        if (!component) return;
        
        // Check tech requirements
        if (component.requiredTech && !this.shipData.ignoreTechRequirements && window.empire) {
            const missingTech = component.requiredTech.filter(tech => !window.empire.hasTech(tech));
            if (missingTech.length > 0) {
                alert(`Cannot add component: Missing required technologies: ${missingTech.join(', ')}`);
                return;
            }
        }
        
        // Add to ship data
        const shipComponent = {
            id: `${componentId}-${Date.now()}`,
            componentId: componentId,
            category: category,
            ...component
        };
        
        this.shipData.components.push(shipComponent);
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
        
        // Reset selection
        typeSelect.value = '';
        
        // Trigger preflight check
        if (window.preflightCheck) {
            window.preflightCheck.runCheck();
        }
    }

    removeComponent(componentId) {
        this.shipData.components = this.shipData.components.filter(c => c.id !== componentId);
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
        
        if (window.preflightCheck) {
            window.preflightCheck.runCheck();
        }
    }

    updateComponentList() {
        const componentList = document.getElementById(`${this.id}-component-list`);
        if (!componentList) return;
        
        componentList.innerHTML = '';
        
        if (this.shipData.components.length === 0) {
            componentList.innerHTML = '<p style="opacity: 0.5; font-style: italic;">No components added</p>';
            return;
        }
        
        for (const component of this.shipData.components) {
            const componentItem = document.createElement('div');
            componentItem.className = 'component-item';
            
            const info = document.createElement('div');
            const name = document.createElement('div');
            name.className = 'component-name';
            name.textContent = component.name;
            
            const details = document.createElement('div');
            details.className = 'component-details';
            const detailsText = [];
            if (component.mass) detailsText.push(`${component.mass} mass`);
            if (component.powerConsumption) detailsText.push(`${component.powerConsumption} power`);
            if (component.cost) detailsText.push(`${component.cost} credits`);
            details.textContent = detailsText.join(', ');
            
            info.appendChild(name);
            info.appendChild(details);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'component-remove';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => this.removeComponent(component.id);
            
            componentItem.appendChild(info);
            componentItem.appendChild(removeBtn);
            componentList.appendChild(componentItem);
        }
    }

    updateStats() {
        const statsContainer = document.getElementById(`${this.id}-stats`);
        if (!statsContainer) return;
        
        let totalMass = 0;
        let totalCost = 0;
        let totalPowerConsumption = 0;
        let totalPowerGeneration = 0;
        let totalThrust = 0;
        let totalDamage = 0;
        let totalHitPoints = 0;
        let weaponCount = 0;
        
        for (const component of this.shipData.components) {
            if (component.mass) totalMass += component.mass;
            if (component.cost) totalCost += component.cost;
            if (component.powerConsumption) totalPowerConsumption += component.powerConsumption;
            if (component.powerOutput) totalPowerGeneration += component.powerOutput;
            if (component.thrust) totalThrust += component.thrust;
            if (component.damage) {
                totalDamage += component.damage;
                weaponCount++;
            }
            if (component.hitPoints) totalHitPoints += component.hitPoints;
        }
        
        const powerBalance = totalPowerGeneration - totalPowerConsumption;
        const thrustToWeight = totalMass > 0 ? (totalThrust / totalMass).toFixed(2) : 0;
        
        statsContainer.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Total Mass:</span>
                <span class="stat-value">${totalMass} units</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Total Cost:</span>
                <span class="stat-value">${totalCost} credits</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Hit Points:</span>
                <span class="stat-value">${totalHitPoints}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Power Balance:</span>
                <span class="stat-value ${powerBalance < 0 ? 'error' : (powerBalance > totalPowerGeneration * 0.5 ? 'warning' : '')}">${powerBalance} (${totalPowerGeneration} gen, ${totalPowerConsumption} used)</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Thrust/Weight:</span>
                <span class="stat-value">${thrustToWeight}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Weapons:</span>
                <span class="stat-value">${weaponCount} (${totalDamage} total damage)</span>
            </div>
        `;
    }

    switchTab(tabName) {
        const tabs = this.element.querySelectorAll('.widget-tab');
        const contents = this.element.querySelectorAll('.widget-tab-content');
        
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        contents.forEach(content => {
            content.classList.toggle('active', content.id.includes(tabName));
        });
        
        if (tabName === 'stats') {
            this.updateStats();
        }
    }

    createNodes() {
        this.updateNodes();
    }

    updateNodes() {
        // Clear existing nodes
        for (const nodeId of Array.from(this.nodes.keys())) {
            this.removeNode(nodeId);
        }
        
        // Add basic nodes
        this.addNode('input', 'power', 'Power', 0, 0.2);
        this.addNode('output', 'component', 'Ship Data', 1, 0.2);
        
        // Add dynamic nodes based on components
        let hasWeapons = false;
        let hasMagazines = false;
        
        for (const component of this.shipData.components) {
            if (component.type === 'weapon') {
                hasWeapons = true;
            }
            if (component.magazineSize) {
                hasMagazines = true;
            }
        }
        
        if (hasWeapons) {
            this.addNode('input', 'weapon', 'Weapons', 0, 0.5);
        }
        
        if (hasMagazines) {
            this.addNode('input', 'magazine', 'Magazines', 0, 0.8);
        }
    }

    getSerializedData() {
        return {
            ...this.shipData,
            components: this.shipData.components || []
        };
    }

    loadSerializedData(data) {
        this.shipData = {
            name: data.name || 'New Ship Class',
            classification: data.classification || 'cruiser',
            components: data.components || [],
            description: data.description || '',
            ignoreTechRequirements: data.ignoreTechRequirements || false
        };
        
        // Update UI elements
        const nameInput = document.getElementById(`${this.id}-name`);
        const classificationSelect = document.getElementById(`${this.id}-classification`);
        const descriptionTextarea = document.getElementById(`${this.id}-description`);
        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        
        if (nameInput) nameInput.value = this.shipData.name;
        if (classificationSelect) classificationSelect.value = this.shipData.classification;
        if (descriptionTextarea) descriptionTextarea.value = this.shipData.description;
        if (ignoreTechCheckbox) ignoreTechCheckbox.checked = this.shipData.ignoreTechRequirements;
        
        this.updateTitle();
        this.updateComponentList();
        this.updateStats();
        this.updateNodes();
    }
}