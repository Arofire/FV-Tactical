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
            // Ten foundational tech requirement flags (placeholders)
            foundations: {
                structural: false,
                propulsion: false,
                power: false,
                heat: false,
                lifeSupport: false,
                navigation: false,
                sensors: false,
                weapons: false,
                defense: false,
                logistics: false
            },
            operational: false,
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
        // Order & keys for foundations checkboxes
        this.foundationKeys = [
            'structural', 'propulsion', 'power', 'heat', 'lifeSupport',
            'navigation', 'sensors', 'weapons', 'defense', 'logistics'
        ];
        
        this.init();
    }

    getTotalHulls() {
        return Object.values(this.shipData.hullComposition).reduce((sum, count) => sum + count, 0);
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
            
            <!-- Foundations Section -->
            <div class="foundations-section">
                <h4>Foundations</h4>
                <div class="foundations-grid">
                    ${this.foundationKeys.map(key => `
                        <label class="foundation-item">
                            <input type="checkbox" id="${this.id}-foundation-${key}" ${this.shipData.foundations[key] ? 'checked' : ''}>
                            ${key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <!-- Top-level Status Controls -->
            <div class="top-flags">
                <label class="flag-item"><input type="checkbox" id="${this.id}-operational" ${this.shipData.operational ? 'checked' : ''}> Operational</label>
                <label class="flag-item"><input type="checkbox" id="${this.id}-ignore-tech" ${this.shipData.ignoreTechRequirements ? 'checked' : ''}> Ignore Tech Requirements</label>
            </div>

            <!-- Basic Info Section -->
            <div class="section-block" id="${this.id}-basic-section">
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
                
                <!-- Ignore tech checkbox moved to top flags -->
            </div>
            <!-- Hull Composition Section -->
            <div class="section-block" id="${this.id}-hulls-section">
                <div class="hull-composition">
                    <h4>Hull Composition</h4>
                    <div class="hull-grid">
                        ${this.hullTypes.map(hullType => `
                            <div class="hull-item">
                                <label>${hullType.charAt(0).toUpperCase() + hullType.slice(1)}</label>
                                <div class="hull-controls">
                                    <button class="hull-btn decrease" data-hull="${hullType}">−</button>
                                    <span class="hull-count" id="${this.id}-hull-${hullType}">${this.shipData.hullComposition[hullType]}</span>
                                    <button class="hull-btn increase" data-hull="${hullType}">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="hull-total">
                        Total: <span id="${this.id}-hull-total">${this.getTotalHulls()}</span>
                    </div>
                </div>
            </div>
            <!-- Power & Propulsion Section -->
            <div class="section-block" id="${this.id}-power-section">
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
            <!-- Heat Management Section -->
            <div class="section-block" id="${this.id}-heat-section">
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
        `;
        
        this.setupEventListeners();
        this.updateNodes();
        this.updateStats();
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;

        const anchorConfigs = [
            { id: 'ship-name', selector: `#${this.id}-name`, closest: '.input-group' },
            { id: 'ship-role', selector: `#${this.id}-role`, closest: '.input-group' },
            { id: 'ship-basic', selector: `#${this.id}-basic-section` },
            { id: 'ship-hulls', selector: `#${this.id}-hulls-section` },
            { id: 'ship-power', selector: `#${this.id}-power-section` },
            { id: 'ship-heat', selector: `#${this.id}-heat-section` }
        ];

        anchorConfigs.forEach(({ id, selector, closest }) => {
            const element = this.element.querySelector(selector);
            if (element) {
                const anchorElement = closest ? (element.closest(closest) || element) : element;
                this.addLayoutAnchor(id, anchorElement, { selector, closest });
            }
        });

        const foundations = this.element.querySelector('.foundations-section');
        if (foundations) {
            this.addLayoutAnchor('ship-foundations', foundations, { offset: -10, selector: '.foundations-section' });
        }

        const topFlags = this.element.querySelector('.top-flags');
        if (topFlags) {
            this.addLayoutAnchor('ship-flags', topFlags, { selector: '.top-flags' });
        }

        const systemHullBadge = this.element.querySelector(`#${this.id}-hull-system`);
        if (systemHullBadge) {
            const hullItem = systemHullBadge.closest('.hull-item') || systemHullBadge;
            this.addLayoutAnchor('ship-system-hull', hullItem, { offset: 16, selector: `#${this.id}-hull-system`, closest: '.hull-item' });
        }
    }

    setupEventListeners() {
        super.setupEventListeners();
        
        // Prevent double-binding
        if (this._eventsBound) return;
        this._eventsBound = true;
        
        // Basic information inputs
        const nameInput = document.getElementById(`${this.id}-name`);
        const roleSelect = document.getElementById(`${this.id}-role`);
        const customRoleInput = document.getElementById(`${this.id}-custom-role`);
        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
    const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        
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
                if (customRoleInput) customRoleInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
                this.updateText2ImgPrompt();
            });
        }
        if (customRoleInput) {
            customRoleInput.addEventListener('input', (e) => {
                this.shipData.customRole = e.target.value;
                this.updateText2ImgPrompt();
            });
        }
        if (ignoreTechCheckbox) {
            ignoreTechCheckbox.addEventListener('change', (e) => {
                this.shipData.ignoreTechRequirements = e.target.checked;
            });
        }
        if (operationalCheckbox) {
            operationalCheckbox.addEventListener('change', (e) => {
                this.shipData.operational = e.target.checked;
            });
        }
        // Foundations checkboxes
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.addEventListener('change', (e) => {
                    this.shipData.foundations[key] = e.target.checked;
                });
            }
        });
        
        // Hull composition controls (single increment guard)
        const hullButtons = this.element.querySelectorAll('.hull-btn');
        hullButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const hullType = e.currentTarget.dataset.hull;
                const isIncrease = e.currentTarget.classList.contains('increase');
                const current = this.shipData.hullComposition[hullType];
                this.shipData.hullComposition[hullType] = Math.max(0, current + (isIncrease ? 1 : -1));
                this.updateHullDisplay();
                this.createNodes();
                this.updateNodes();
                this.updateStats();
                this.updateText2ImgPrompt();
                // Propagate system hull count if changed
                if (hullType === 'system') this.propagateSystemHulls();
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

    // switchTab removed - linear layout

    updateStats() {
        // Update powerplant status
        const powerplantStatus = document.getElementById(`${this.id}-powerplant-status`);
        if (powerplantStatus) {
            if (this.shipData.hullComposition.powerplant > 0) {
                powerplantStatus.innerHTML = '<div class="status-warning">⚠️ Powerplant node required</div>';
            } else {
                powerplantStatus.innerHTML = '<div class="status-info">No powerplant hulls - no power requirements</div>';
            }
        }
    }

    updateNodes() { /* DOM node list removed in linear layout; retained for potential future use */ }

    createNodes() {
        // Create nodes dynamically based on hull composition
        this.clearNodes();
        
        // Always add base ship data output node
        this.addNode('output', 'data', 'Ship Data', 1, 0.2, {
            anchorId: 'ship-name'
        });
        
        // Statistics output node
        this.addNode('output', 'statistics', 'Statistics', 1, 0.35, {
            anchorId: 'ship-flags'
        });
        
        // Add conditional nodes based on hull composition
        if (this.shipData.hullComposition.magazine > 0 || this.shipData.hullComposition.hangar > 0) {
            this.addNode('input', 'loadout', 'Loadout', 0, 0.4, {
                anchorId: 'ship-hulls',
                anchorOffset: -40
            });
        }
        
        if (this.shipData.hullComposition.powerplant > 0) {
            this.addNode('input', 'powerplant', 'Powerplant', 0, 0.55, {
                anchorId: 'ship-power'
            });
        }
        
        if (this.shipData.hullComposition.system > 0) {
            this.addNode('input', 'systems', 'Systems', 0, 0.75, {
                anchorId: 'ship-system-hull',
                anchorOffset: -20
            });
            this.addNode('output', 'system-hulls', 'System Hulls', 1, 0.85, {
                anchorId: 'ship-system-hull',
                anchorOffset: 20
            });
        }

        this.reflowNodes();
        this.updateNodes();
    }
    
    clearNodes() {
        // Remove all existing nodes
        for (const nodeId of Array.from(this.nodes.keys())) {
            this.removeNode(nodeId);
        }
    }

    propagateSystemHulls() {
        const systemHullsNode = this.getNodeByType('system-hulls');
        if (!systemHullsNode) return;
        
        const systemHullCount = this.shipData.hullComposition.system;
        
        for (const connection of systemHullsNode.connections) {
            const targetWidget = window.nodeSystem.getWidgetByNodeId(connection.targetNodeId);
            if (targetWidget && targetWidget.setAvailableSystemHulls) {
                targetWidget.setAvailableSystemHulls(systemHullCount);
            }
        }
    }

    getSerializedData() {
        return {
            ...super.getSerializedData(),
            shipData: this.shipData
        };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.shipData) {
            this.shipData = { ...this.shipData, ...data.shipData };
            this.updateHullDisplay();
            this.createNodes();
            this.updateStats();
            this.updateText2ImgPrompt();
        }
    }
}