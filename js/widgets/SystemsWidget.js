// Systems widget for ship modules
class SystemsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('systems', 'Ship Systems', x, y, 380, 500);
        
        // Initialize systems data
        this.systemsData = {
            availableSystemHulls: 0,
            usedSystemHulls: 0,
            modules: [],
            heatManagement: {
                magneticSystems: 0,
                demonSystems: 0
            }
        };
        
        // Define available system modules
        this.moduleTypes = {
            // Single-instance modules
            surveyEquipment: {
                name: 'Survey Equipment',
                systemHulls: 1,
                category: 'utility',
                maxCount: 1,
                techRequirement: null,
                description: 'Advanced sensors for planetary and asteroid surveys'
            },
            longRangeScanner: {
                name: 'Long Range Scanner',
                systemHulls: 6,
                category: 'utility',
                maxCount: 1,
                techRequirement: 'advanced-sensors', // Example tech requirement
                description: 'Long-range detection and analysis systems'
            },
            commandBridge: {
                name: 'Command Bridge',
                systemHulls: 6,
                category: 'utility',
                maxCount: 1,
                techRequirement: null,
                description: 'Advanced command and control center'
            },
            quantumWarfare3: {
                name: 'Quantum Warfare System (Basic)',
                systemHulls: 3,
                category: 'warfare',
                maxCount: 1,
                techRequirement: 'quantum-integration',
                description: 'Basic quantum warfare capabilities'
            },
            quantumWarfare5: {
                name: 'Quantum Warfare System (Advanced)',
                systemHulls: 5,
                category: 'warfare',
                maxCount: 1,
                techRequirement: 'living-network',
                description: 'Advanced quantum warfare systems'
            },
            quantumWarfare8: {
                name: 'Quantum Warfare System (Elite)',
                systemHulls: 8,
                category: 'warfare',
                maxCount: 1,
                techRequirement: 'oracle-machines',
                description: 'Elite quantum warfare technology'
            },
            hyperdrive1: {
                name: 'Hyperdrive (Class I)',
                systemHulls: 1,
                category: 'propulsion',
                maxCount: 1,
                techRequirement: 'basic-hyperdrive',
                description: 'Basic hyperdrive system'
            },
            hyperdrive2: {
                name: 'Hyperdrive (Class II)',
                systemHulls: 2,
                category: 'propulsion',
                maxCount: 1,
                techRequirement: 'advanced-hyperdrive',
                description: 'Advanced hyperdrive system'
            },
            hyperdrive3: {
                name: 'Hyperdrive (Class III)',
                systemHulls: 3,
                category: 'propulsion',
                maxCount: 1,
                techRequirement: 'elite-hyperdrive',
                description: 'Elite hyperdrive technology'
            },
            // Multiple-instance modules (heat management)
            magneticHeatManagement: {
                name: 'Magnetic Heat Management',
                systemHulls: 1,
                category: 'heat',
                maxCount: null, // Unlimited
                techRequirement: 'magnetic-fields',
                description: 'Magnetic field-based heat dissipation'
            },
            demonHeatManagement: {
                name: 'Demon Heat Management',
                systemHulls: 1,
                category: 'heat',
                maxCount: null, // Unlimited
                techRequirement: 'demon-technology',
                description: 'Advanced demon-tech heat management'
            },
            berthModule: {
                name: 'Berth',
                systemHulls: 1,
                category: 'utility',
                maxCount: null, // multiple allowed
                techRequirement: null,
                description: 'Crew/passenger berth capacity module'
            }
        };
        
        this.init();
    }
    
    createContent(contentElement) {
        contentElement.innerHTML = `
            <div class="input-group">
                <div class="system-hulls-info">
                    <div class="hull-status">
                        <span>System Hulls: <strong id="${this.id}-used-hulls">${this.systemsData.usedSystemHulls}</strong> / <strong id="${this.id}-available-hulls">${this.systemsData.availableSystemHulls}</strong></span>
                        <div class="hull-bar">
                            <div class="hull-bar-fill" id="${this.id}-hull-bar"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="widget-tabs">
                <button class="widget-tab active" data-tab="modules">System Modules</button>
                <button class="widget-tab" data-tab="heat">Heat Management</button>
                <button class="widget-tab" data-tab="summary">Summary</button>
            </div>
            
            <!-- System Modules Tab -->
            <div class="widget-tab-content active" id="${this.id}-modules-tab">
                <div class="modules-section">
                    <h4>Available Modules</h4>
                    <div class="modules-grid" id="${this.id}-available-modules">
                        ${this.renderAvailableModules()}
                    </div>
                </div>
                
                <div class="installed-modules-section">
                    <h4>Installed Modules</h4>
                    <div class="installed-modules-list" id="${this.id}-installed-modules">
                        ${this.renderInstalledModules()}
                    </div>
                </div>
            </div>
            
            <!-- Heat Management Tab -->
            <div class="widget-tab-content" id="${this.id}-heat-tab">
                <div class="heat-management-section">
                    <h4>Heat Management Systems</h4>
                    <div class="heat-systems">
                        <div class="heat-system-item">
                            <div class="heat-system-info">
                                <span class="heat-system-name">Magnetic Heat Management</span>
                                <span class="heat-system-count">Installed: <strong id="${this.id}-magnetic-count">${this.systemsData.heatManagement.magneticSystems}</strong></span>
                            </div>
                            <div class="heat-system-controls">
                                <button class="heat-btn decrease" data-type="magnetic">−</button>
                                <button class="heat-btn increase" data-type="magnetic">+</button>
                            </div>
                        </div>
                        
                        <div class="heat-system-item">
                            <div class="heat-system-info">
                                <span class="heat-system-name">Demon Heat Management</span>
                                <span class="heat-system-count">Installed: <strong id="${this.id}-demon-count">${this.systemsData.heatManagement.demonSystems}</strong></span>
                            </div>
                            <div class="heat-system-controls">
                                <button class="heat-btn decrease" data-type="demon">−</button>
                                <button class="heat-btn increase" data-type="demon">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="heat-stats-summary">
                        <h5>Heat Management Summary</h5>
                        <div class="stat-item">
                            <label>Total Heat Dissipation:</label>
                            <span id="${this.id}-total-dissipation">${this.calculateHeatDissipation()}/turn</span>
                        </div>
                        <div class="stat-item">
                            <label>Heat Capacity Bonus:</label>
                            <span id="${this.id}-capacity-bonus">+${this.calculateCapacityBonus()}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Summary Tab -->
            <div class="widget-tab-content" id="${this.id}-summary-tab">
                <div class="systems-summary">
                    <h4>Systems Summary</h4>
                    <div class="summary-stats" id="${this.id}-summary-stats">
                        ${this.renderSummaryStats()}
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
        this.updateHullBar();
    }
    
    renderAvailableModules() {
        let html = '';
        
        Object.entries(this.moduleTypes).forEach(([moduleId, module]) => {
            if (module.category === 'heat') return; // Heat modules handled separately
            
            const isInstalled = this.systemsData.modules.find(m => m.moduleId === moduleId);
            const canInstall = !isInstalled && this.canInstallModule(moduleId);
            const hasSystemHulls = this.systemsData.availableSystemHulls >= this.systemsData.usedSystemHulls + module.systemHulls;
            const hasTech = !module.techRequirement || this.hasTech(module.techRequirement);
            
            html += `
                <div class="module-card ${!canInstall ? 'disabled' : ''}" data-module="${moduleId}">
                    <div class="module-header">
                        <span class="module-name">${module.name}</span>
                        <span class="module-hulls">${module.systemHulls} hulls</span>
                    </div>
                    <div class="module-description">${module.description}</div>
                    <div class="module-status">
                        ${!hasTech ? '<span class="status-error">Tech Required</span>' : ''}
                        ${!hasSystemHulls ? '<span class="status-error">Insufficient Hulls</span>' : ''}
                        ${isInstalled ? '<span class="status-installed">Installed</span>' : ''}
                        ${canInstall && hasSystemHulls && hasTech ? '<button class="install-btn" onclick="window.widgetManager.getWidget(\'' + this.id + '\').installModule(\'' + moduleId + '\')">Install</button>' : ''}
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    renderInstalledModules() {
        if (this.systemsData.modules.length === 0) {
            return '<div class="no-modules">No modules installed</div>';
        }
        
        let html = '';
        this.systemsData.modules.forEach(module => {
            const moduleType = this.moduleTypes[module.moduleId];
            if (moduleType) {
                html += `
                    <div class="installed-module-item">
                        <div class="installed-module-info">
                            <span class="installed-module-name">${moduleType.name}</span>
                            <span class="installed-module-hulls">${moduleType.systemHulls} hulls</span>
                        </div>
                        <button class="uninstall-btn" onclick="window.widgetManager.getWidget('${this.id}').uninstallModule('${module.id}')">Uninstall</button>
                    </div>
                `;
            }
        });
        
        return html;
    }
    
    renderSummaryStats() {
        const utilityModules = this.systemsData.modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'utility').length;
        const warfareModules = this.systemsData.modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'warfare').length;
        const propulsionModules = this.systemsData.modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'propulsion').length;
        const totalHeatSystems = this.systemsData.heatManagement.magneticSystems + this.systemsData.heatManagement.demonSystems;
        
        return `
            <div class="stat-item">
                <label>Utility Modules:</label>
                <span>${utilityModules}</span>
            </div>
            <div class="stat-item">
                <label>Warfare Modules:</label>
                <span>${warfareModules}</span>
            </div>
            <div class="stat-item">
                <label>Propulsion Modules:</label>
                <span>${propulsionModules}</span>
            </div>
            <div class="stat-item">
                <label>Heat Management Systems:</label>
                <span>${totalHeatSystems}</span>
            </div>
            <div class="stat-item">
                <label>System Hulls Used:</label>
                <span>${this.systemsData.usedSystemHulls} / ${this.systemsData.availableSystemHulls}</span>
            </div>
        `;
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Tab switching
        const tabButtons = this.element.querySelectorAll('.widget-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Heat management controls
        const heatButtons = this.element.querySelectorAll('.heat-btn');
        heatButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const heatType = e.target.dataset.type;
                const isIncrease = e.target.classList.contains('increase');
                
                if (isIncrease) {
                    this.addHeatManagement(heatType);
                } else {
                    this.removeHeatManagement(heatType);
                }
            });
        });
    }
    
    switchTab(tabName) {
        const tabs = this.element.querySelectorAll('.widget-tab');
        const contents = this.element.querySelectorAll('.widget-tab-content');
        
        tabs.forEach(tab => tab.classList.remove('active'));
        contents.forEach(content => content.classList.remove('active'));
        
        const selectedTab = this.element.querySelector(`[data-tab="${tabName}"]`);
        const selectedContent = this.element.querySelector(`#${this.id}-${tabName}-tab`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');
        
        if (tabName === 'summary') {
            this.updateSummary();
        }
    }
    
    canInstallModule(moduleId) {
        const module = this.moduleTypes[moduleId];
        if (!module) return false;
        
        // Check if already installed (for single-instance modules)
        if (module.maxCount === 1) {
            return !this.systemsData.modules.find(m => m.moduleId === moduleId);
        }
        
        return true;
    }
    
    hasTech(techId) {
        // This would check against the empire's researched technologies
        // For now, return true (ignore tech requirements)
        return window.gameInstance?.empire?.hasTech(techId) || true;
    }
    
    installModule(moduleId) {
        const module = this.moduleTypes[moduleId];
        if (!module || !this.canInstallModule(moduleId)) return;
        
        // Check system hull availability
        if (this.systemsData.usedSystemHulls + module.systemHulls > this.systemsData.availableSystemHulls) {
            alert('Insufficient system hulls available');
            return;
        }
        
        // Add module
        const newModule = {
            id: `${moduleId}-${Date.now()}`,
            moduleId: moduleId,
            name: module.name,
            systemHulls: module.systemHulls
        };
        
        this.systemsData.modules.push(newModule);
        this.systemsData.usedSystemHulls += module.systemHulls;
        
        this.updateDisplay();
    }
    
    uninstallModule(moduleInstanceId) {
        const moduleIndex = this.systemsData.modules.findIndex(m => m.id === moduleInstanceId);
        if (moduleIndex === -1) return;
        
        const module = this.systemsData.modules[moduleIndex];
        this.systemsData.usedSystemHulls -= module.systemHulls;
        this.systemsData.modules.splice(moduleIndex, 1);
        
        this.updateDisplay();
    }
    
    addHeatManagement(heatType) {
        if (this.systemsData.usedSystemHulls >= this.systemsData.availableSystemHulls) {
            alert('Insufficient system hulls available');
            return;
        }
        
        // Check tech requirements
        const techId = heatType === 'magnetic' ? 'magnetic-fields' : 'demon-technology';
        if (!this.hasTech(techId)) {
            alert(`Technology required: ${techId}`);
            return;
        }
        
        this.systemsData.heatManagement[heatType + 'Systems']++;
        this.systemsData.usedSystemHulls++;
        
        this.updateHeatDisplay();
        this.updateHullBar();
    }
    
    removeHeatManagement(heatType) {
        if (this.systemsData.heatManagement[heatType + 'Systems'] > 0) {
            this.systemsData.heatManagement[heatType + 'Systems']--;
            this.systemsData.usedSystemHulls--;
            
            this.updateHeatDisplay();
            this.updateHullBar();
        }
    }
    
    calculateHeatDissipation() {
        // Magnetic: 2 heat dissipation per system
        // Demon: 3 heat dissipation per system
        return (this.systemsData.heatManagement.magneticSystems * 2) + 
               (this.systemsData.heatManagement.demonSystems * 3);
    }
    
    calculateCapacityBonus() {
        // Magnetic: +5 capacity per system
        // Demon: +8 capacity per system
        return (this.systemsData.heatManagement.magneticSystems * 5) + 
               (this.systemsData.heatManagement.demonSystems * 8);
    }
    
    updateDisplay() {
        // Update available modules
        const availableModulesContainer = document.getElementById(`${this.id}-available-modules`);
        if (availableModulesContainer) {
            availableModulesContainer.innerHTML = this.renderAvailableModules();
        }
        
        // Update installed modules
        const installedModulesContainer = document.getElementById(`${this.id}-installed-modules`);
        if (installedModulesContainer) {
            installedModulesContainer.innerHTML = this.renderInstalledModules();
        }
        
        this.updateHullBar();
        this.updateHeatDisplay();
    }
    
    updateHeatDisplay() {
        const magneticCountElement = document.getElementById(`${this.id}-magnetic-count`);
        const demonCountElement = document.getElementById(`${this.id}-demon-count`);
        const totalDissipationElement = document.getElementById(`${this.id}-total-dissipation`);
        const capacityBonusElement = document.getElementById(`${this.id}-capacity-bonus`);
        
        if (magneticCountElement) magneticCountElement.textContent = this.systemsData.heatManagement.magneticSystems;
        if (demonCountElement) demonCountElement.textContent = this.systemsData.heatManagement.demonSystems;
        if (totalDissipationElement) totalDissipationElement.textContent = this.calculateHeatDissipation() + '/turn';
        if (capacityBonusElement) capacityBonusElement.textContent = '+' + this.calculateCapacityBonus();
    }
    
    updateHullBar() {
        const usedHullsElement = document.getElementById(`${this.id}-used-hulls`);
        const availableHullsElement = document.getElementById(`${this.id}-available-hulls`);
        const hullBarElement = document.getElementById(`${this.id}-hull-bar`);
        
        if (usedHullsElement) usedHullsElement.textContent = this.systemsData.usedSystemHulls;
        if (availableHullsElement) availableHullsElement.textContent = this.systemsData.availableSystemHulls;
        
        if (hullBarElement && this.systemsData.availableSystemHulls > 0) {
            const percentage = (this.systemsData.usedSystemHulls / this.systemsData.availableSystemHulls) * 100;
            hullBarElement.style.width = percentage + '%';
            
            if (percentage > 90) {
                hullBarElement.className = 'hull-bar-fill critical';
            } else if (percentage > 70) {
                hullBarElement.className = 'hull-bar-fill warning';
            } else {
                hullBarElement.className = 'hull-bar-fill normal';
            }
        }
    }
    
    updateSummary() {
        const summaryStatsElement = document.getElementById(`${this.id}-summary-stats`);
        if (summaryStatsElement) {
            summaryStatsElement.innerHTML = this.renderSummaryStats();
        }
    }
    
    setAvailableSystemHulls(count) {
        this.systemsData.availableSystemHulls = count;
        this.updateHullBar();
        this.updateDisplay();
    }
    
    getSystemsOutput() {
        return {
            modules: this.systemsData.modules,
            heatDissipation: this.calculateHeatDissipation(),
            heatCapacityBonus: this.calculateCapacityBonus(),
            systemHullsUsed: this.systemsData.usedSystemHulls,
            heatManagement: this.systemsData.heatManagement
        };
    }
    
    createNodes() {
        this.addNode('input', 'system-hulls', 'System Hulls', 0, 0.3);
        this.addNode('output', 'systems-output', 'Systems Data', 1, 0.3);
    }
    
    // Handle connection input from ship widgets
    onNodeConnected(nodeId, sourceWidget, sourceNodeId) {
        super.onNodeConnected(nodeId, sourceWidget, sourceNodeId);
        
        const node = this.nodes.get(nodeId);
        if (node && node.type === 'system-hulls' && sourceWidget.type === 'ship') {
            // Get system hulls from connected ship
            const systemHulls = sourceWidget.shipData?.hullComposition?.system || 0;
            this.setAvailableSystemHulls(systemHulls);
        }
    }
    
    // Handle connection removal
    onNodeDisconnected(nodeId, targetWidget, targetNodeId) {
        super.onNodeDisconnected(nodeId, targetWidget, targetNodeId);
        
        const node = this.nodes.get(nodeId);
        if (node && node.type === 'system-hulls') {
            // Reset available system hulls when disconnected
            this.setAvailableSystemHulls(0);
        }
    }
    
    getSerializedData() {
        return {
            ...super.getSerializedData(),
            systemsData: this.systemsData
        };
    }
    
    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.systemsData) {
            this.systemsData = { ...this.systemsData, ...data.systemsData };
            this.updateDisplay();
        }
    }
}