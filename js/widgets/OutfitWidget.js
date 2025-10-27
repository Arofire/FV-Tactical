// Outfit widget for configuring ship load-outs
class OutfitWidget extends Widget {
    constructor(x = 550, y = 120) {
        super('outfit', 'New Outfit', x, y, null);

        this.defaultRoles = [
            'Artillery',
            'Brawler',
            'Lancer',
            'QWarfare',
            'Scout',
            'Support',
            'Escort',
            'Carrier',
            'Interceptor'
        ];

        this.hardpointDefinitions = [
            { key: 'UHP', label: 'Utility Hardpoints' },
            { key: 'SHP', label: 'Secondary Hardpoints' },
            { key: 'PHP', label: 'Primary Hardpoints' },
            { key: 'MHP', label: 'Main Hardpoints' }
        ];

        this.parentShipWidget = null;
        this.ignoreTechRequirements = false; // Mirrored from parent ShipWidget

        this.outfitData = {
            name: 'New Outfit',
            role: 'Artillery',
            customRole: '',
            roleMode: 'dropdown',
            notes: '',
            hardpoints: {
                base: { UHP: 0, SHP: 0, PHP: 0, MHP: 0 },
                merge: { UHP: 0, SHP: 0, PHP: 0, MHP: 0 },
                split: { UHP: 0, SHP: 0, PHP: 0, MHP: 0 }
            },
            stats: {
                shipyardMonths: 0,
                cargo: 0,
                remass: 0,
                systemHulls: 0,
                powerplantHulls: 0
            },
            systemsData: {
                availableSystemHulls: 0,
                usedSystemHulls: 0,
                modules: [],
                heatManagement: {
                    magneticSystems: 0,
                    demonSystems: 0
                }
            },
            weapons: {
                spinal: '',
                offensive: [],
                defensive: []
            }
        };

        this.moduleTypes = this.buildModuleDefinitions();
        this.weaponsData = null;
        this.weaponsDataLoaded = false;
        this.loadWeaponsData();

        this.roleMode = this.outfitData.roleMode;
        this.availableRoles = OutfitWidget.loadStoredRoles(this.defaultRoles);
        this.ensureRoleAvailable(this.outfitData.role);

        this.layoutMode = 'three-column';
        this.init();
    }

    static getRoleStorageKey() {
        return 'outfitWidgetRoles';
    }

    static loadStoredRoles(defaultRoles = []) {
        try {
            const raw = localStorage.getItem(OutfitWidget.getRoleStorageKey());
            if (!raw) return [...defaultRoles];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? Array.from(new Set([...(defaultRoles || []), ...parsed])).sort((a, b) => a.localeCompare(b))
                : [...defaultRoles];
        } catch (err) {
            console.warn('Unable to load stored outfit roles', err);
            return [...defaultRoles];
        }
    }

    static saveStoredRoles(roles = []) {
        try {
            localStorage.setItem(OutfitWidget.getRoleStorageKey(), JSON.stringify(roles));
        } catch (err) {
            console.warn('Unable to persist outfit roles', err);
        }
    }


    ensureRoleAvailable(role) {
        if (!role) return;
        const normalized = role.trim();
        if (!normalized) return;
        if (!this.availableRoles.includes(normalized)) {
            this.availableRoles.push(normalized);
            this.availableRoles.sort((a, b) => a.localeCompare(b));
            OutfitWidget.saveStoredRoles(this.availableRoles);
        }
    }

    buildModuleDefinitions() {
        return {
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
                techRequirement: 'advanced-sensors',
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
            magneticHeatManagement: {
                name: 'Magnetic Heat Management',
                systemHulls: 1,
                category: 'heat',
                maxCount: null,
                techRequirement: 'magnetic-fields',
                description: 'Magnetic field-based heat dissipation'
            },
            demonHeatManagement: {
                name: 'Demon Heat Management',
                systemHulls: 1,
                category: 'heat',
                maxCount: null,
                techRequirement: 'demon-technology',
                description: 'Advanced demon-tech heat management'
            },
            berthModule: {
                name: 'Berth',
                systemHulls: 1,
                category: 'utility',
                maxCount: null,
                techRequirement: null,
                description: 'Crew/passenger berth capacity module'
            }
        };
    }

    async loadWeaponsData() {
        try {
            const response = await fetch('data/weapons.json');
            this.weaponsData = await response.json();
            this.weaponsDataLoaded = true;
            console.log('Weapons data loaded:', this.weaponsData.categories.length, 'categories');
            // If widget is already rendered, refresh weapons sections and attach listeners
            if (this.element && document.contains(this.element)) {
                console.log('Refreshing weapons dropdowns after data load');
                this.refreshWeaponDropdowns();
                this.setupWeaponsEventListeners();
            }
        } catch (error) {
            console.error('Failed to load weapons data:', error);
            this.weaponsData = { categories: [] };
            this.weaponsDataLoaded = true;
        }
    }

    getAllWeapons() {
        if (!this.weaponsData || !this.weaponsData.categories) {
            return [];
        }
        const weapons = [];
        for (const category of this.weaponsData.categories) {
            if (category.weapons && Array.isArray(category.weapons)) {
                for (const weapon of category.weapons) {
                    weapons.push({ ...weapon, categoryName: category.name });
                }
            }
        }
        return weapons;
    }

    getSpinalWeapons() {
        return this.getAllWeapons().filter(weapon => 
            weapon.techRequirement && weapon.techRequirement.includes('spinal')
        );
    }

    getPDWeapons() {
        return this.getAllWeapons().filter(weapon => 
            weapon.name && weapon.name.toLowerCase().includes('pd')
        );
    }

    getOffensiveWeapons() {
        const allWeapons = this.getAllWeapons();
        const pdWeapons = this.getPDWeapons();
        const spinalWeapons = this.getSpinalWeapons();
        
        return allWeapons.filter(weapon => 
            !pdWeapons.includes(weapon) && !spinalWeapons.includes(weapon)
        );
    }

    filterWeaponsByTech(weapons) {
        if (this.ignoreTechRequirements) return weapons;
        
        return weapons.filter(weapon => {
            if (!weapon.techRequirement) return true;
            return window.empire?.hasTech?.(weapon.techRequirement) ?? false;
        });
    }

    getRoleInputValue() {
        return this.roleMode === 'custom'
            ? (this.outfitData.customRole || this.outfitData.role || '')
            : (this.outfitData.role || '');
    }

    formatRoleLabel(role) {
        if (!role) return '';
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    getRoleOptions(selected = this.outfitData.role) {
        return this.availableRoles
            .sort((a, b) => a.localeCompare(b))
            .map(role => `<option value="${role}" ${role === selected ? 'selected' : ''}>${this.formatRoleLabel(role)}</option>`) 
            .join('');
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Meta section (no title)
        const metaSection = this.createSection('meta', '');
        this.setSectionContent(metaSection, `
            <div class="outfit-meta-header widget-sticky-header" id="${this.id}-meta-header">
                ${this.hardpointDefinitions.map(({ key }) => `
                    <div class="outfit-stat" data-hardpoint="${key}">
                        <span class="label">${key}</span>
                        <span class="value" id="${this.id}-hp-value-${key}">0</span>
                    </div>
                `).join('')}
                <div class="outfit-stat">
                    <span class="label">SM</span>
                    <span class="value" id="${this.id}-shipyard-months">0</span>
                </div>
            </div>
            <div class="input-group" id="${this.id}-name-group">
                <label>Outfit Name</label>
                <input type="text" id="${this.id}-name" value="${this.outfitData.name}" placeholder="Enter outfit name">
            </div>
        `);
        sectionsContainer.appendChild(metaSection.section);
        
        // Create Role section (no title)
        const roleSection = this.createSection('role', '');
        this.setSectionContent(roleSection, `
            <div class="input-group role-group" id="${this.id}-role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role-select" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${this.getRoleOptions()}
                    </select>
                    <input type="text" id="${this.id}-role-custom" class="role-input" placeholder="Enter custom role" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''} value="${this.getRoleInputValue()}">
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '🖉' : '🌳'}</button>
                </div>
            </div>
            <div class="input-group" id="${this.id}-notes-group">
                <label>Outfit Notes</label>
                <textarea id="${this.id}-notes" placeholder="Doctrine, deployment notes, logistics considerations...">${this.outfitData.notes}</textarea>
            </div>
        `);
        sectionsContainer.appendChild(roleSection.section);
        
        // Create Hardpoints section
        const hardpointsSection = this.createSection('hardpoints', 'Hardpoints');
        const hardpointsContent = hardpointsSection.contentContainer;
        hardpointsContent.id = `${this.id}-hardpoints-section`;
        const hardpointRows = this.hardpointDefinitions.map(({ key }) => `
            <tr>
                <td>${key}</td>
                <td id="${this.id}-hp-base-${key}">${this.outfitData.hardpoints.base[key]}</td>
                <td><input type="number" id="${this.id}-hp-merge-${key}" min="0" step="3" value="${this.outfitData.hardpoints.merge[key]}"></td>
                <td><input type="number" id="${this.id}-hp-split-${key}" min="0" step="1" value="${this.outfitData.hardpoints.split[key]}"></td>
            </tr>
        `).join('');
        this.setSectionContent(hardpointsSection, `
            <table class="hardpoints-table">
                <thead>
                    <tr>
                        <th>Hardpoint</th>
                        <th>Base</th>
                        <th>Merge (−3)</th>
                        <th>Split (+1)</th>
                    </tr>
                </thead>
                <tbody>
                    ${hardpointRows}
                </tbody>
            </table>
        `);
        sectionsContainer.appendChild(hardpointsSection.section);
        
        // Create Systems section
        const systemsSection = this.createSection('systems', 'Systems');
        const systemsContent = systemsSection.contentContainer;
        systemsContent.classList.add('systems-section');
        systemsContent.id = `${this.id}-systems-section`;
        this.setSectionContent(systemsSection, this.renderSystemsSection());
        sectionsContainer.appendChild(systemsSection.section);
        
        // Create Features section
        const featuresSection = this.createSection('features', 'Features');
        const featuresContent = featuresSection.contentContainer;
        featuresContent.id = `${this.id}-features-section`;
        this.setSectionContent(featuresSection, this.renderFeaturesTable());
        sectionsContainer.appendChild(featuresSection.section);

        // Create Weapons section
        const weaponsSection = this.createSection('weapons', 'Weapons');
        const weaponsContent = weaponsSection.contentContainer;
        weaponsContent.id = `${this.id}-weapons-section`;
        this.setSectionContent(weaponsSection, this.renderWeaponsSection());
        sectionsContainer.appendChild(weaponsSection.section);

        this.setupEventListeners();
        this.registerLayoutAnchors();
        this.updateHardpointHeader();
        this.updateShipyardMonths();
        this.renderSystemsContent();
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;
        const anchors = [
            { id: 'outfit-meta', selector: `#${this.id}-meta` },
            { id: 'outfit-role', selector: `#${this.id}-role` },
            { id: 'outfit-hardpoints', selector: `#${this.id}-hardpoints` },
            { id: 'outfit-systems', selector: `#${this.id}-systems` },
            { id: 'outfit-features', selector: `#${this.id}-features` },
            { id: 'outfit-weapons', selector: `#${this.id}-weapons` }
        ];
        anchors.forEach(({ id, selector }) => {
            const el = this.element.querySelector(selector);
            if (el) this.addLayoutAnchor(id, el, { selector });
        });
    }

    setupEventListeners() {
        super.setupEventListeners();
        if (this._eventsBound) return;
        this._eventsBound = true;

        const nameInput = document.getElementById(`${this.id}-name`);
        const notesInput = document.getElementById(`${this.id}-notes`);
        const roleSelect = document.getElementById(`${this.id}-role-select`);
        const roleCustom = document.getElementById(`${this.id}-role-custom`);
        const roleToggle = document.getElementById(`${this.id}-role-toggle`);

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.outfitData.name = e.target.value;
                this.updateTitle(this.outfitData.name || 'New Outfit');
                this.refreshSummary();
            });
        }

        if (notesInput) {
            notesInput.addEventListener('input', (e) => {
                this.outfitData.notes = e.target.value;
                this.refreshSummary();
            });
        }

        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                this.outfitData.role = e.target.value;
                this.outfitData.customRole = '';
                this.roleMode = 'dropdown';
                this.refreshSummary();
            });
        }

        if (roleCustom) {
            roleCustom.addEventListener('input', (e) => {
                const value = e.target.value;
                this.outfitData.customRole = value;
                this.outfitData.role = value;
                this.refreshSummary();
            });
            roleCustom.addEventListener('change', (e) => {
                const value = e.target.value.trim();
                if (value) this.ensureRoleAvailable(value);
                this.refreshSummary();
            });
        }

        if (roleToggle) {
            roleToggle.addEventListener('click', () => {
                if (this.roleMode === 'dropdown') {
                    this.applyRoleMode('custom');
                } else {
                    const value = (roleCustom?.value || '').trim();
                    if (value) {
                        this.ensureRoleAvailable(value);
                        this.outfitData.role = value;
                    }
                    this.outfitData.customRole = '';
                    this.applyRoleMode('dropdown');
                }
                this.refreshSummary();
            });
        }

        this.applyRoleMode(this.roleMode);
        this.setupHardpointControls();
        this.setupSystemsEventListeners();
        this.setupWeaponsEventListeners();
    }

    applyRoleMode(mode) {
        this.roleMode = mode;
        this.outfitData.roleMode = mode;
        const roleSelect = document.getElementById(`${this.id}-role-select`);
        const roleCustom = document.getElementById(`${this.id}-role-custom`);
        const roleToggle = document.getElementById(`${this.id}-role-toggle`);

        if (roleSelect) {
            if (mode === 'dropdown') {
                roleSelect.style.display = '';
                this.populateRoleSelect(roleSelect);
                roleSelect.value = this.outfitData.role;
            } else {
                roleSelect.style.display = 'none';
            }
        }

        if (roleCustom) {
            if (mode === 'custom') {
                roleCustom.style.display = '';
                roleCustom.value = this.getRoleInputValue();
                roleCustom.focus();
            } else {
                roleCustom.style.display = 'none';
            }
        }

        if (roleToggle) {
            if (mode === 'dropdown') {
                roleToggle.textContent = '✏️';
                roleToggle.title = 'Use custom role';
            } else {
                roleToggle.textContent = '🌳';
                roleToggle.title = 'Use role list';
            }
        }
    }

    populateRoleSelect(selectElement, selectedRole = this.outfitData.role) {
        if (!selectElement) return;
        selectElement.innerHTML = this.getRoleOptions(selectedRole);
        if (selectedRole) selectElement.value = selectedRole;
    }

    setupHardpointControls() {
        this.hardpointDefinitions.forEach(({ key }) => {
            const mergeInput = document.getElementById(`${this.id}-hp-merge-${key}`);
            const splitInput = document.getElementById(`${this.id}-hp-split-${key}`);

            if (mergeInput) {
                mergeInput.addEventListener('input', (e) => {
                    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
                    e.target.value = value;
                    this.outfitData.hardpoints.merge[key] = value;
                    this.updateHardpointHeader();
                    this.refreshSummary();
                });
            }

            if (splitInput) {
                splitInput.addEventListener('input', (e) => {
                    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
                    e.target.value = value;
                    this.outfitData.hardpoints.split[key] = value;
                    this.updateHardpointHeader();
                    this.refreshSummary();
                });
            }
        });
    }

    updateHardpointHeader() {
        this.hardpointDefinitions.forEach(({ key }) => {
            const base = this.outfitData.hardpoints.base[key] || 0;
            const merged = this.outfitData.hardpoints.merge[key] || 0;
            const split = this.outfitData.hardpoints.split[key] || 0;
            const value = Math.max(0, base - merged + split);
            const valueEl = document.getElementById(`${this.id}-hp-value-${key}`);
            if (valueEl) valueEl.textContent = value;
        });
    }

    updateHardpointBaseDisplay() {
        this.hardpointDefinitions.forEach(({ key }) => {
            const baseEl = document.getElementById(`${this.id}-hp-base-${key}`);
            if (baseEl) baseEl.textContent = this.outfitData.hardpoints.base[key] || 0;
        });
        this.updateHardpointHeader();
    }

    updateShipyardMonths() {
        const el = document.getElementById(`${this.id}-shipyard-months`);
        if (el) el.textContent = this.outfitData.stats.shipyardMonths ?? 0;
    }

    renderSystemsSection() {
        return `
            <div class="system-hulls-info">
                <div class="hull-status">
                    <span>System Hulls: <strong id="${this.id}-used-hulls">${this.outfitData.systemsData.usedSystemHulls}</strong> / <strong id="${this.id}-available-hulls">${this.outfitData.systemsData.availableSystemHulls}</strong></span>
                    <div class="hull-bar">
                        <div class="hull-bar-fill" id="${this.id}-hull-bar"></div>
                    </div>
                </div>
            </div>
            <div class="widget-tabs">
                <button class="widget-tab active" data-tab="modules">System Modules</button>
                <button class="widget-tab" data-tab="heat">Heat Management</button>
                <button class="widget-tab" data-tab="summary">Summary</button>
            </div>
            <div class="widget-tab-content active" id="${this.id}-modules-tab">
                <div class="modules-section">
                    <h5>Available Modules</h5>
                    <div class="modules-grid" id="${this.id}-available-modules"></div>
                </div>
                <div class="installed-modules-section">
                    <h5>Installed Modules</h5>
                    <div class="installed-modules-list" id="${this.id}-installed-modules"></div>
                </div>
            </div>
            <div class="widget-tab-content" id="${this.id}-heat-tab">
                <div class="heat-management-section">
                    <h5>Heat Management Systems</h5>
                    <div class="heat-systems">
                        <div class="heat-system-item">
                            <div class="heat-system-info">
                                <span class="heat-system-name">Magnetic Heat Management</span>
                                <span class="heat-system-count">Installed: <strong id="${this.id}-magnetic-count">${this.outfitData.systemsData.heatManagement.magneticSystems}</strong></span>
                            </div>
                            <div class="heat-system-controls">
                                <button class="heat-btn decrease" data-type="magnetic">−</button>
                                <button class="heat-btn increase" data-type="magnetic">+</button>
                            </div>
                        </div>
                        <div class="heat-system-item">
                            <div class="heat-system-info">
                                <span class="heat-system-name">Demon Heat Management</span>
                                <span class="heat-system-count">Installed: <strong id="${this.id}-demon-count">${this.outfitData.systemsData.heatManagement.demonSystems}</strong></span>
                            </div>
                            <div class="heat-system-controls">
                                <button class="heat-btn decrease" data-type="demon">−</button>
                                <button class="heat-btn increase" data-type="demon">+</button>
                            </div>
                        </div>
                    </div>
                    <div class="heat-stats-summary">
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
            <div class="widget-tab-content" id="${this.id}-summary-tab">
                <div class="systems-summary">
                    <h5>Systems Summary</h5>
                    <div class="summary-stats" id="${this.id}-summary-stats"></div>
                </div>
            </div>
        `;
    }

    renderSystemsContent() {
        const available = document.getElementById(`${this.id}-available-modules`);
        const installed = document.getElementById(`${this.id}-installed-modules`);
        const summary = document.getElementById(`${this.id}-summary-stats`);

        if (available) available.innerHTML = this.renderAvailableModules();
        if (installed) installed.innerHTML = this.renderInstalledModules();
        if (summary) summary.innerHTML = this.renderSummaryStats();
        this.updateHullBar();
    }

    renderAvailableModules() {
        return Object.entries(this.moduleTypes).filter(([_, module]) => module.category !== 'heat')
            .map(([moduleId, module]) => {
                const isInstalled = this.outfitData.systemsData.modules.find(m => m.moduleId === moduleId);
                const canInstall = !isInstalled && this.canInstallModule(moduleId);
                const hasSystemHulls = this.outfitData.systemsData.availableSystemHulls >= this.outfitData.systemsData.usedSystemHulls + module.systemHulls;
                const hasTech = this.hasTech(module.techRequirement);
                const disabled = !canInstall || !hasSystemHulls || !hasTech;
                return `
                    <div class="module-card ${disabled ? 'disabled' : ''}" data-module="${moduleId}">
                        <div class="module-header">
                            <span class="module-name">${module.name}</span>
                            <span class="module-hulls">${module.systemHulls} hulls</span>
                        </div>
                        <div class="module-description">${module.description}</div>
                        <div class="module-status">
                            ${!hasTech ? '<span class="status-error">Tech Required</span>' : ''}
                            ${!hasSystemHulls ? '<span class="status-error">Insufficient Hulls</span>' : ''}
                            ${isInstalled ? '<span class="status-installed">Installed</span>' : ''}
                            ${!disabled ? `<button class="install-btn" data-install="${moduleId}">Install</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
    }

    renderInstalledModules() {
        if (this.outfitData.systemsData.modules.length === 0) {
            return '<div class="no-modules">No modules installed</div>';
        }
        return this.outfitData.systemsData.modules.map(module => {
            const moduleType = this.moduleTypes[module.moduleId];
            if (!moduleType) return '';
            return `
                <div class="installed-module-item">
                    <div class="installed-module-info">
                        <span class="installed-module-name">${moduleType.name}</span>
                        <span class="installed-module-hulls">${moduleType.systemHulls} hulls</span>
                    </div>
                    <button class="uninstall-btn" data-uninstall="${module.id}">Uninstall</button>
                </div>
            `;
        }).join('');
    }

    renderSummaryStats() {
        const modules = this.outfitData.systemsData.modules;
        const utilityModules = modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'utility').length;
        const warfareModules = modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'warfare').length;
        const propulsionModules = modules.filter(m => this.moduleTypes[m.moduleId]?.category === 'propulsion').length;
        const totalHeat = this.outfitData.systemsData.heatManagement.magneticSystems + this.outfitData.systemsData.heatManagement.demonSystems;
        return `
            <div class="stat-item"><label>Utility Modules:</label><span>${utilityModules}</span></div>
            <div class="stat-item"><label>Warfare Modules:</label><span>${warfareModules}</span></div>
            <div class="stat-item"><label>Propulsion Modules:</label><span>${propulsionModules}</span></div>
            <div class="stat-item"><label>Heat Management Systems:</label><span>${totalHeat}</span></div>
            <div class="stat-item"><label>System Hulls Used:</label><span>${this.outfitData.systemsData.usedSystemHulls} / ${this.outfitData.systemsData.availableSystemHulls}</span></div>
        `;
    }

    setupSystemsEventListeners() {
        const tabs = this.element.querySelectorAll('.widget-tab');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchSystemsTab(tab);
            });
        });

        this.element.addEventListener('click', (e) => {
            const installTarget = e.target.closest('button[data-install]');
            if (installTarget) {
                const moduleId = installTarget.dataset.install;
                this.installModule(moduleId);
                return;
            }
            const uninstallTarget = e.target.closest('button[data-uninstall]');
            if (uninstallTarget) {
                const moduleInstanceId = uninstallTarget.dataset.uninstall;
                this.uninstallModule(moduleInstanceId);
                return;
            }
        });

        const heatButtons = this.element.querySelectorAll('.heat-btn');
        heatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                if (!type) return;
                if (e.currentTarget.classList.contains('increase')) {
                    this.addHeatManagement(type);
                } else {
                    this.removeHeatManagement(type);
                }
            });
        });
    }

    switchSystemsTab(tab) {
        const tabs = this.element.querySelectorAll('.widget-tab');
        const contents = this.element.querySelectorAll('.widget-tab-content');
        tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        contents.forEach(section => section.classList.toggle('active', section.id === `${this.id}-${tab}-tab`));
        if (tab === 'summary') {
            const summary = document.getElementById(`${this.id}-summary-stats`);
            if (summary) summary.innerHTML = this.renderSummaryStats();
        }
    }

    canInstallModule(moduleId) {
        const module = this.moduleTypes[moduleId];
        if (!module) return false;
        if (module.maxCount === 1) {
            return !this.outfitData.systemsData.modules.find(m => m.moduleId === moduleId);
        }
        return true;
    }

    hasTech(techRequirement) {
        if (!techRequirement) return true;
        return window.empire?.hasTech?.(techRequirement) ?? true;
    }

    installModule(moduleId) {
        const module = this.moduleTypes[moduleId];
        if (!module) return;
        if (!this.canInstallModule(moduleId)) return;
        const total = this.outfitData.systemsData.usedSystemHulls + module.systemHulls;
        if (total > this.outfitData.systemsData.availableSystemHulls) return;
        const newModule = {
            id: `${moduleId}-${Date.now()}`,
            moduleId,
            name: module.name,
            systemHulls: module.systemHulls
        };
        this.outfitData.systemsData.modules.push(newModule);
        this.outfitData.systemsData.usedSystemHulls = total;
        this.renderSystemsContent();
        this.refreshSummary();
    }

    uninstallModule(moduleInstanceId) {
        const idx = this.outfitData.systemsData.modules.findIndex(m => m.id === moduleInstanceId);
        if (idx === -1) return;
        const module = this.outfitData.systemsData.modules[idx];
        this.outfitData.systemsData.usedSystemHulls = Math.max(0, this.outfitData.systemsData.usedSystemHulls - (module?.systemHulls || 0));
        this.outfitData.systemsData.modules.splice(idx, 1);
        this.renderSystemsContent();
        this.refreshSummary();
    }

    addHeatManagement(type) {
        const moduleKey = type === 'magnetic' ? 'magneticHeatManagement' : 'demonHeatManagement';
        const module = this.moduleTypes[moduleKey];
        if (!module) return;
        if (this.outfitData.systemsData.usedSystemHulls + module.systemHulls > this.outfitData.systemsData.availableSystemHulls) return;
        if (type === 'magnetic') this.outfitData.systemsData.heatManagement.magneticSystems++;
        if (type === 'demon') this.outfitData.systemsData.heatManagement.demonSystems++;
        this.outfitData.systemsData.usedSystemHulls += module.systemHulls;
        this.updateHeatStats();
        this.refreshSummary();
    }

    removeHeatManagement(type) {
        const moduleKey = type === 'magnetic' ? 'magneticHeatManagement' : 'demonHeatManagement';
        const module = this.moduleTypes[moduleKey];
        if (!module) return;
        if (type === 'magnetic' && this.outfitData.systemsData.heatManagement.magneticSystems > 0) {
            this.outfitData.systemsData.heatManagement.magneticSystems--;
            this.outfitData.systemsData.usedSystemHulls = Math.max(0, this.outfitData.systemsData.usedSystemHulls - module.systemHulls);
        }
        if (type === 'demon' && this.outfitData.systemsData.heatManagement.demonSystems > 0) {
            this.outfitData.systemsData.heatManagement.demonSystems--;
            this.outfitData.systemsData.usedSystemHulls = Math.max(0, this.outfitData.systemsData.usedSystemHulls - module.systemHulls);
        }
        this.updateHeatStats();
        this.refreshSummary();
    }

    updateHeatStats() {
        const magnetic = document.getElementById(`${this.id}-magnetic-count`);
        const demon = document.getElementById(`${this.id}-demon-count`);
        const dissipation = document.getElementById(`${this.id}-total-dissipation`);
        const capacity = document.getElementById(`${this.id}-capacity-bonus`);
        if (magnetic) magnetic.textContent = this.outfitData.systemsData.heatManagement.magneticSystems;
        if (demon) demon.textContent = this.outfitData.systemsData.heatManagement.demonSystems;
        if (dissipation) dissipation.textContent = `${this.calculateHeatDissipation()}/turn`;
        if (capacity) capacity.textContent = `+${this.calculateCapacityBonus()}`;
        this.renderSystemsContent();
    }

    calculateHeatDissipation() {
        const magnetic = this.outfitData.systemsData.heatManagement.magneticSystems;
        const demon = this.outfitData.systemsData.heatManagement.demonSystems;
        return magnetic * 5 + demon * 8;
    }

    calculateCapacityBonus() {
        const magnetic = this.outfitData.systemsData.heatManagement.magneticSystems;
        const demon = this.outfitData.systemsData.heatManagement.demonSystems;
        return magnetic * 2 + demon * 6;
    }

    updateHullBar() {
        const bar = document.getElementById(`${this.id}-hull-bar`);
        if (!bar) return;
        const used = this.outfitData.systemsData.usedSystemHulls;
        const available = this.outfitData.systemsData.availableSystemHulls || 1;
        const percent = Math.min(100, (used / available) * 100);
        bar.style.width = `${percent}%`;
        const usedLabel = document.getElementById(`${this.id}-used-hulls`);
        const availableLabel = document.getElementById(`${this.id}-available-hulls`);
        if (usedLabel) usedLabel.textContent = used;
        if (availableLabel) availableLabel.textContent = available;
    }

    renderFeaturesTable() {
        const rows = [
            ['Aero Streamlining', 'FALSE', '-', '(252)'],
            ['Enhanced Armour', 'FALSE', '-', '(33)'],
            ['QW Hardening', 'FALSE', '-', ''],
            ['Particle Sail', 'FALSE', '5%', ''],
            ['Fighter Catapult', '0', 'MHP', '(50)'],
            ['Flinger Little', 'FALSE', 'MHP', '(50)'],
            ['Magazine Crane', 'FALSE', 'MHP', '(50)'],
            ['Bomb Launcher', '0', 'PHP', '(12)'],
            ['LASER Focus', '0', 'SHP', '(50)'],
            ['Jump Beacon', 'FALSE', 'MHP', '(90)'],
            ['Transporter', '0', 'UHP', '(30)']
        ];
        return `
            <table class="features-table">
                <thead>
                    <tr>
                        <th>Feature</th>
                        <th>Active</th>
                        <th>Cost</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderWeaponsSection() {
        const spinalWeapons = this.filterWeaponsByTech(this.getSpinalWeapons());
        const spinalOptions = spinalWeapons.map(w => 
            `<option value="${w.id}">${w.name} (${w.categoryName})</option>`
        ).join('');

        return `
            <div class="weapons-section">
                <div class="spinal-weapon-group">
                    <h5>Spinal Mount</h5>
                    <div class="input-group">
                        <select id="${this.id}-spinal-weapon" class="weapon-select">
                            <option value="">None</option>
                            ${spinalOptions}
                        </select>
                    </div>
                </div>

                <div class="offensive-weapons-group">
                    <h5>Offensive Weapons</h5>
                    <button type="button" class="add-weapon-btn" id="${this.id}-add-offensive">Add Weapon</button>
                    <table class="weapons-table">
                        <thead>
                            <tr>
                                <th>Mount</th>
                                <th>Weapon</th>
                                <th>Arc</th>
                                <th>Hardpoint</th>
                                <th>Count</th>
                                <th>Cost</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="${this.id}-offensive-weapons-body">
                            ${this.renderWeaponRows('offensive')}
                        </tbody>
                    </table>
                </div>

                <div class="defensive-weapons-group">
                    <h5>Defensive Weapons</h5>
                    <button type="button" class="add-weapon-btn" id="${this.id}-add-defensive">Add Weapon</button>
                    <table class="weapons-table">
                        <thead>
                            <tr>
                                <th>Mount</th>
                                <th>Weapon</th>
                                <th>Arc</th>
                                <th>Hardpoint</th>
                                <th>Count</th>
                                <th>Cost</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="${this.id}-defensive-weapons-body">
                            ${this.renderWeaponRows('defensive')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderWeaponRows(category) {
        const weapons = this.outfitData.weapons[category];
        if (!weapons || weapons.length === 0) {
            return '<tr class="no-weapons"><td colspan="7">No weapons added</td></tr>';
        }

        return weapons.map((weapon, index) => this.renderWeaponRow(category, weapon, index)).join('');
    }

    renderWeaponRow(category, weapon, index) {
        const offensiveWeapons = category === 'offensive' 
            ? this.filterWeaponsByTech(this.getOffensiveWeapons())
            : this.filterWeaponsByTech(this.getPDWeapons());

        const weaponOptions = offensiveWeapons.map(w => 
            `<option value="${w.id}" ${weapon.weaponId === w.id ? 'selected' : ''}>${w.name}</option>`
        ).join('');

        const selectedWeapon = offensiveWeapons.find(w => w.id === weapon.weaponId);
        const hardpoint = selectedWeapon?.hardpoint || '-';
        const weaponCost = selectedWeapon?.cost || 0;
        const totalCost = weaponCost * (weapon.count || 0);

        return `
            <tr data-index="${index}">
                <td>
                    <select class="mount-select" data-category="${category}" data-index="${index}">
                        <option value="Single" ${weapon.mount === 'Single' ? 'selected' : ''}>Single</option>
                        <option value="Double" ${weapon.mount === 'Double' ? 'selected' : ''}>Double</option>
                        <option value="Triple" ${weapon.mount === 'Triple' ? 'selected' : ''}>Triple</option>
                        <option value="Quad" ${weapon.mount === 'Quad' ? 'selected' : ''}>Quad</option>
                    </select>
                </td>
                <td>
                    <select class="weapon-select" data-category="${category}" data-index="${index}">
                        <option value="">Select weapon...</option>
                        ${weaponOptions}
                    </select>
                </td>
                <td>
                    <div class="arc-field" data-category="${category}" data-index="${index}">
                        <input type="text" readonly value="${weapon.arc || ''}" class="arc-display" placeholder="FPSA">
                        <div class="arc-popup" style="display: none;">
                            <div class="arc-checkbox-grid">
                                <div class="arc-row">
                                    <label><input type="checkbox" value="F" ${weapon.arc?.includes('F') ? 'checked' : ''}> Fore</label>
                                </div>
                                <div class="arc-row arc-sides">
                                    <label><input type="checkbox" value="P" ${weapon.arc?.includes('P') ? 'checked' : ''}> Port</label>
                                    <div class="arc-arrow">↑</div>
                                    <label><input type="checkbox" value="S" ${weapon.arc?.includes('S') ? 'checked' : ''}> Starboard</label>
                                </div>
                                <div class="arc-row">
                                    <label><input type="checkbox" value="A" ${weapon.arc?.includes('A') ? 'checked' : ''}> Aft</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="hardpoint-cell">${hardpoint}</td>
                <td>
                    <input type="number" min="0" step="1" value="${weapon.count || 0}" 
                           class="count-input" data-category="${category}" data-index="${index}">
                </td>
                <td class="cost-cell">${totalCost}</td>
                <td>
                    <button type="button" class="remove-weapon-btn" data-category="${category}" data-index="${index}">×</button>
                </td>
            </tr>
        `;
    }

    setupWeaponsEventListeners() {
        // Get weapons section
        const weaponsSection = document.getElementById(`${this.id}-weapons-section`);
        if (!weaponsSection) {
            return;
        }
        
        // Check if listeners are already attached to prevent duplicates
        if (this._weaponsListenersAttached) {
            return;
        }
        this._weaponsListenersAttached = true;

        // Setup add weapon buttons
        const addOffensiveBtn = weaponsSection.querySelector(`#${this.id}-add-offensive`);
        const addDefensiveBtn = weaponsSection.querySelector(`#${this.id}-add-defensive`);
        
        if (addOffensiveBtn) {
            addOffensiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addWeaponRow('offensive');
            });
        }

        if (addDefensiveBtn) {
            addDefensiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addWeaponRow('defensive');
            });
        }

        // Spinal weapon selector
        const spinalSelect = weaponsSection.querySelector(`#${this.id}-spinal-weapon`);
        if (spinalSelect) {
            spinalSelect.addEventListener('change', (e) => {
                this.outfitData.weapons.spinal = e.target.value;
            });
        }

        // Event delegation for weapon table interactions
        weaponsSection.addEventListener('change', (e) => {
            if (e.target.classList.contains('mount-select')) {
                const { category, index } = e.target.dataset;
                if (this.outfitData.weapons[category] && this.outfitData.weapons[category][index]) {
                    this.outfitData.weapons[category][index].mount = e.target.value;
                }
            } else if (e.target.classList.contains('weapon-select')) {
                const { category, index } = e.target.dataset;
                if (this.outfitData.weapons[category] && this.outfitData.weapons[category][index]) {
                    this.outfitData.weapons[category][index].weaponId = e.target.value;
                    this.refreshWeaponsTable(category);
                }
            } else if (e.target.classList.contains('count-input')) {
                const { category, index } = e.target.dataset;
                if (this.outfitData.weapons[category] && this.outfitData.weapons[category][index]) {
                    this.outfitData.weapons[category][index].count = parseInt(e.target.value, 10) || 0;
                    this.refreshWeaponsTable(category);
                }
            }
        });

        weaponsSection.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-weapon-btn')) {
                e.preventDefault();
                const { category, index } = e.target.dataset;
                this.removeWeaponRow(category, parseInt(index, 10));
            } else if (e.target.classList.contains('arc-display')) {
                e.preventDefault();
                const arcField = e.target.closest('.arc-field');
                if (arcField) {
                    const popup = arcField.querySelector('.arc-popup');
                    if (popup) {
                        popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
                    }
                }
            }
        });

        // Arc checkbox handling
        weaponsSection.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.arc-popup')) {
                const arcField = e.target.closest('.arc-field');
                if (arcField) {
                    const { category, index } = arcField.dataset;
                    if (this.outfitData.weapons[category] && this.outfitData.weapons[category][index]) {
                        const checkboxes = arcField.querySelectorAll('input[type="checkbox"]:checked');
                        const arcValue = Array.from(checkboxes).map(cb => cb.value).sort().join('');
                        this.outfitData.weapons[category][index].arc = arcValue;
                        const arcDisplay = arcField.querySelector('.arc-display');
                        if (arcDisplay) {
                            arcDisplay.value = arcValue;
                        }
                    }
                }
            }
        });

        // Hide arc popup when mouse leaves
        weaponsSection.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('arc-field') || e.target.classList.contains('arc-popup')) {
                const arcField = e.target.closest('.arc-field');
                if (arcField) {
                    const popup = arcField.querySelector('.arc-popup');
                    if (popup) popup.style.display = 'none';
                }
            }
        }, true);
    }

    addWeaponRow(category) {
        const weapon = {
            mount: 'Single',
            weaponId: '',
            arc: '',
            count: 0
        };
        this.outfitData.weapons[category].push(weapon);
        this.refreshWeaponsTable(category);
    }

    removeWeaponRow(category, index) {
        this.outfitData.weapons[category].splice(index, 1);
        this.refreshWeaponsTable(category);
    }

    refreshWeaponsTable(category) {
        const tbody = document.getElementById(`${this.id}-${category}-weapons-body`);
        if (tbody) {
            tbody.innerHTML = this.renderWeaponRows(category);
        }
    }

    refreshWeaponDropdowns() {
        // Refresh spinal weapon dropdown
        const spinalSelect = document.getElementById(`${this.id}-spinal-weapon`);
        if (spinalSelect) {
            const currentValue = spinalSelect.value;
            const spinalWeapons = this.filterWeaponsByTech(this.getSpinalWeapons());
            const spinalOptions = spinalWeapons.map(w => 
                `<option value="${w.id}">${w.name} (${w.categoryName})</option>`
            ).join('');
            spinalSelect.innerHTML = `<option value="">None</option>${spinalOptions}`;
            spinalSelect.value = currentValue;
        }

        // Refresh offensive and defensive weapon tables
        this.refreshWeaponsTable('offensive');
        this.refreshWeaponsTable('defensive');
    }

    getParentShipWidget() {
        if (this.parentShipWidget && this.parentShipWidget.element?.isConnected) {
            return this.parentShipWidget;
        }

        if (this.parents && window.widgetManager) {
            for (const parentId of this.parents) {
                const widget = window.widgetManager.getWidget(parentId);
                if (widget && (widget.type === 'ship' || widget.type === 'shipPrototype')) {
                    this.parentShipWidget = widget;
                    return widget;
                }
            }
        }

        return null;
    }

    onParentLinked(parentWidget) {
        if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
            this.parentShipWidget = parentWidget;
            this.applyParentInheritance(parentWidget);
        }
    }

    onParentUnlinked(parentWidget) {
        if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
            if (this.parentShipWidget === parentWidget) {
                this.parentShipWidget = null;
            }
            this.resetInheritedValues();
        }
    }

    applyParentInheritance(shipWidget) {
        if (shipWidget && (shipWidget.type === 'ship' || shipWidget.type === 'shipPrototype')) {
            this.parentShipWidget = shipWidget;
        }
        const shipData = shipWidget?.shipData || {};
        const stats = shipData.statistics || {};
        const hulls = shipData.hullComposition || {};

        // Mirror ignoreTechRequirements flag from parent ship
        this.ignoreTechRequirements = shipData.ignoreTechRequirements ?? false;

        this.outfitData.stats.cargo = stats.cargo ?? 0;
        this.outfitData.stats.remass = stats.remass ?? hulls.remass ?? 0;
        this.outfitData.stats.shipyardMonths = stats.shipyardMonths ?? 0;
        this.outfitData.stats.systemHulls = hulls.system ?? 0;
        this.outfitData.stats.powerplantHulls = hulls.powerplant ?? 0;

        const hardpointsBase = shipData.hardpointsBase || shipData.hardpoints || {};
        this.hardpointDefinitions.forEach(({ key }) => {
            this.outfitData.hardpoints.base[key] = hardpointsBase[key] ?? this.outfitData.hardpoints.base[key] ?? 0;
        });

        this.updateHardpointBaseDisplay();
        this.updateShipyardMonths();
        this.refreshWeaponDropdowns();
    }

    resetInheritedValues() {
        this.ignoreTechRequirements = false;
        this.outfitData.stats.cargo = 0;
        this.outfitData.stats.remass = 0;
        this.outfitData.stats.shipyardMonths = 0;
        this.outfitData.stats.systemHulls = 0;
        this.outfitData.stats.powerplantHulls = 0;
        this.hardpointDefinitions.forEach(({ key }) => {
            this.outfitData.hardpoints.base[key] = 0;
        });
        this.updateHardpointBaseDisplay();
        this.updateShipyardMonths();
        this.refreshWeaponDropdowns();
    }

    handleParentTechRequirementChange(parentWidget) {
        // Mirror the ignoreTechRequirements flag from parent
        if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
            this.ignoreTechRequirements = parentWidget.shipData?.ignoreTechRequirements ?? false;
            // Refresh weapons to apply new filtering
            this.refreshWeaponDropdowns();
        }
    }

    createNodes() {
        this.clearNodes();

        this.addNode('input', 'Class', 'Class', 0, 0.2, {
            anchorId: 'outfit-meta',
            sectionId: 'meta',
            minSpacing: 32
        });

        this.addNode('input', 'Core', 'Core', 0, 0.4, {
            anchorId: 'outfit-meta',
            sectionId: 'meta',
            anchorOffset: 32,
            minSpacing: 32
        });

        this.addNode('output', 'Outfit', 'Outfit', 1, 0.2, {
            anchorId: 'outfit-meta',
            sectionId: 'meta',
            minSpacing: 32,
            anchorOffset: 48
        });

        this.addNode('output', 'Statistics', 'Statistics', 1, 0.35, {
            anchorId: 'outfit-meta',
            sectionId: 'meta',
            anchorOffset: 80,
            minSpacing: 32
        });

        this.reflowNodes();
    }



    syncDataFromForm() {
        // Sync simple form fields to outfitData
        const simpleFields = {
            'name': { id: 'name', type: 'text' },
            'notes': { id: 'notes', type: 'text' }
        };
        this.syncFieldsToData(this.outfitData, simpleFields);

        // Handle role (dropdown vs custom)
        const roleSelect = document.getElementById(`${this.id}-role-select`);
        const roleCustom = document.getElementById(`${this.id}-role-custom`);
        
        if (this.roleMode === 'custom' && roleCustom) {
            this.outfitData.customRole = roleCustom.value.trim();
            this.outfitData.role = this.outfitData.customRole;
        } else if (roleSelect) {
            this.outfitData.role = roleSelect.value;
            this.outfitData.customRole = '';
        }

        // Sync hardpoint merge/split values
        ['UHP', 'SHP', 'PHP', 'MHP'].forEach(key => {
            const mergeInput = document.getElementById(`${this.id}-hp-merge-${key}`);
            const splitInput = document.getElementById(`${this.id}-hp-split-${key}`);
            if (mergeInput) {
                const val = parseInt(mergeInput.value, 10);
                this.outfitData.hardpoints.merge[key] = isNaN(val) ? 0 : val;
            }
            if (splitInput) {
                const val = parseInt(splitInput.value, 10);
                this.outfitData.hardpoints.split[key] = isNaN(val) ? 0 : val;
            }
        });

        // Sync spinal mount selection
        const spinalSelect = document.getElementById(`${this.id}-spinal-weapon`);
        if (spinalSelect) {
            this.outfitData.weapons.spinal = spinalSelect.value;
        }

        // Sync weapon arrays (offensive/defensive)
        ['offensive', 'defensive'].forEach(category => {
            const weaponsArray = this.outfitData.weapons?.[category];
            if (!weaponsArray || !Array.isArray(weaponsArray)) return;
            
            weaponsArray.forEach((weapon, idx) => {
                const nameEl = document.getElementById(`${this.id}-${category}-${idx}-name`);
                const categoryEl = document.getElementById(`${this.id}-${category}-${idx}-category`);
                const hpEl = document.getElementById(`${this.id}-${category}-${idx}-hp`);
                const countEl = document.getElementById(`${this.id}-${category}-${idx}-count`);
                
                if (nameEl) weapon.name = nameEl.value;
                if (categoryEl) weapon.category = categoryEl.value;
                if (hpEl) weapon.hp = parseInt(hpEl.value, 10) || 0;
                if (countEl) weapon.count = parseInt(countEl.value, 10) || 0;
            });
        });
    }

    getSerializedData() {
        this.syncDataFromForm();
        return {
            ...super.getSerializedData(),
            outfitData: this.outfitData,
            ignoreTechRequirements: this.ignoreTechRequirements
        };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.ignoreTechRequirements !== undefined) {
            this.ignoreTechRequirements = data.ignoreTechRequirements;
        }
        if (data.outfitData) {
            this.outfitData = {
                ...this.outfitData,
                ...data.outfitData,
                hardpoints: {
                    base: { ...this.outfitData.hardpoints.base, ...(data.outfitData.hardpoints?.base || {}) },
                    merge: { ...this.outfitData.hardpoints.merge, ...(data.outfitData.hardpoints?.merge || {}) },
                    split: { ...this.outfitData.hardpoints.split, ...(data.outfitData.hardpoints?.split || {}) }
                },
                stats: { ...this.outfitData.stats, ...(data.outfitData.stats || {}) },
                systemsData: {
                    availableSystemHulls: data.outfitData.systemsData?.availableSystemHulls ?? this.outfitData.systemsData.availableSystemHulls,
                    usedSystemHulls: data.outfitData.systemsData?.usedSystemHulls ?? this.outfitData.systemsData.usedSystemHulls,
                    modules: Array.isArray(data.outfitData.systemsData?.modules) ? data.outfitData.systemsData.modules : [],
                    heatManagement: {
                        magneticSystems: data.outfitData.systemsData?.heatManagement?.magneticSystems ?? this.outfitData.systemsData.heatManagement.magneticSystems,
                        demonSystems: data.outfitData.systemsData?.heatManagement?.demonSystems ?? this.outfitData.systemsData.heatManagement.demonSystems
                    }
                },
                weapons: {
                    spinal: data.outfitData.weapons?.spinal ?? this.outfitData.weapons.spinal,
                    offensive: Array.isArray(data.outfitData.weapons?.offensive) ? data.outfitData.weapons.offensive : [],
                    defensive: Array.isArray(data.outfitData.weapons?.defensive) ? data.outfitData.weapons.defensive : []
                }
            };
            this.roleMode = this.outfitData.roleMode || (this.outfitData.customRole ? 'custom' : 'dropdown');
            this.ensureRoleAvailable(this.outfitData.role);
            this.syncFormFromData();
        }
    }

    syncFormFromData() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) nameInput.value = this.outfitData.name || '';

        const notesInput = document.getElementById(`${this.id}-notes`);
        if (notesInput) notesInput.value = this.outfitData.notes || '';

        this.updateHardpointBaseDisplay();
        this.updateShipyardMonths();

        const roleSelect = document.getElementById(`${this.id}-role-select`);
        const roleCustom = document.getElementById(`${this.id}-role-custom`);
        this.populateRoleSelect(roleSelect, this.outfitData.role);
        if (roleCustom) roleCustom.value = this.getRoleInputValue();
        this.applyRoleMode(this.outfitData.customRole ? 'custom' : 'dropdown');

        this.renderSystemsContent();
        this.initializeWeaponsContent();
    }

    updateTitle(text) {
        const titleElement = this.element?.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = text || this.outfitData.name || 'New Outfit';
        }
    }

    renderSummary(container) {
        if (!container) return;

        // Clear any existing summary
        container.innerHTML = '';

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.outfitData.name || 'New Outfit';
        container.appendChild(titleDiv);

        // Badges
        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        if (this.outfitData.role) {
            badgesDiv.appendChild(this.createBadge(this.outfitData.role, 'role'));
        }
        
        if (this.roleMode === 'custom') {
            badgesDiv.appendChild(this.createBadge('Custom Role', 'info'));
        }

        container.appendChild(badgesDiv);

        // Summary grid
        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        // Role
        const roleValue = this.outfitData.role || '—';
        this.addSummaryField(gridDiv, 'Role', roleValue);

        // Hardpoints
        const hpBase = this.formatHardpoints(this.outfitData.hardpoints.base);
        const hpMerge = this.formatHardpoints(this.outfitData.hardpoints.merge);
        const hpSplit = this.formatHardpoints(this.outfitData.hardpoints.split);
        this.addSummaryField(gridDiv, 'Hardpoints (Base)', hpBase);
        if (hpMerge !== '—') {
            this.addSummaryField(gridDiv, 'Hardpoints (Merge)', hpMerge);
        }
        if (hpSplit !== '—') {
            this.addSummaryField(gridDiv, 'Hardpoints (Split)', hpSplit);
        }

        // Systems
        const moduleCount = this.outfitData.systemsData?.modules?.length || 0;
        const usedHulls = this.outfitData.systemsData?.usedSystemHulls || 0;
        const availableHulls = this.outfitData.systemsData?.availableSystemHulls || 0;
        this.addSummaryField(gridDiv, 'System Modules', `${moduleCount} (${usedHulls}/${availableHulls} hulls)`);

        // Heat Management
        const magnetic = this.outfitData.systemsData?.heatManagement?.magneticSystems || 0;
        const demon = this.outfitData.systemsData?.heatManagement?.demonSystems || 0;
        if (magnetic > 0 || demon > 0) {
            const heatParts = [];
            if (magnetic > 0) heatParts.push(`${magnetic}× Magnetic`);
            if (demon > 0) heatParts.push(`${demon}× Demon`);
            this.addSummaryField(gridDiv, 'Heat Mgmt', heatParts.join(', '));
        }

        // Weapons
        const spinalWeapon = this.outfitData.weapons?.spinal || '—';
        const offensiveCount = this.outfitData.weapons?.offensive?.length || 0;
        const defensiveCount = this.outfitData.weapons?.defensive?.length || 0;
        
        if (spinalWeapon !== 'none' && spinalWeapon !== '—') {
            this.addSummaryField(gridDiv, 'Spinal', spinalWeapon);
        }
        this.addSummaryField(gridDiv, 'Offensive Weapons', offensiveCount.toString());
        this.addSummaryField(gridDiv, 'Defensive Weapons', defensiveCount.toString());

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

    formatHardpoints(hardpointObj) {
        if (!hardpointObj) return '—';
        
        const parts = [];
        if (hardpointObj.spinal > 0) parts.push(`${hardpointObj.spinal}S`);
        if (hardpointObj.heavy > 0) parts.push(`${hardpointObj.heavy}H`);
        if (hardpointObj.medium > 0) parts.push(`${hardpointObj.medium}M`);
        if (hardpointObj.light > 0) parts.push(`${hardpointObj.light}L`);
        if (hardpointObj.turret > 0) parts.push(`${hardpointObj.turret}T`);
        
        return parts.length > 0 ? parts.join(' ') : '—';
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}
