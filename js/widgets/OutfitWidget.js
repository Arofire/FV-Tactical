// Outfit widget for configuring ship load-outs
class OutfitWidget extends Widget {
    constructor(x = 550, y = 120) {
        super('outfit', 'New Outfit', x, y, 560, 900);

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

        this.weaponCatalog = {
            '': { label: 'Select Weapon', cost: 0, hardpoint: '-' },
            'laser-battery': { label: 'Laser Battery', cost: 12, hardpoint: 'SHP' },
            'railgun': { label: 'Mass Driver Railgun', cost: 40, hardpoint: 'PHP' },
            'missile-rack': { label: 'Missile Rack', cost: 18, hardpoint: 'UHP' },
            'beam-lance': { label: 'Beam Lance', cost: 55, hardpoint: 'MHP' },
            'point-defense': { label: 'Point Defense Cluster', cost: 8, hardpoint: 'UHP' }
        };

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

        this.roleMode = this.outfitData.roleMode;
        this.availableRoles = OutfitWidget.loadStoredRoles(this.defaultRoles);
        this.ensureRoleAvailable(this.outfitData.role);

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
        const hardpointRows = this.hardpointDefinitions.map(({ key }) => `
            <tr>
                <td>${key}</td>
                <td id="${this.id}-hp-base-${key}">${this.outfitData.hardpoints.base[key]}</td>
                <td><input type="number" id="${this.id}-hp-merge-${key}" min="0" step="3" value="${this.outfitData.hardpoints.merge[key]}"></td>
                <td><input type="number" id="${this.id}-hp-split-${key}" min="0" step="1" value="${this.outfitData.hardpoints.split[key]}"></td>
            </tr>
        `).join('');

        contentElement.innerHTML = `
            <div class="outfit-meta-header widget-sticky-header" id="${this.id}-meta-header">
                <div class="outfit-header-row" id="${this.id}-hardpoint-row">
                    ${this.hardpointDefinitions.map(({ key }) => `
                        <div class="outfit-stat" data-hardpoint="${key}">
                            <span class="label">${key}</span>
                            <span class="value" id="${this.id}-hp-value-${key}">0</span>
                        </div>
                    `).join('')}
                </div>
                <div class="outfit-header-row" id="${this.id}-shipyard-row">
                    <div class="outfit-stat">
                        <span class="label">SM</span>
                        <span class="value" id="${this.id}-shipyard-months">0</span>
                    </div>
                </div>
            </div>
            <div class="input-group" id="${this.id}-name-group">
                <label>Outfit Name</label>
                <input type="text" id="${this.id}-name" value="${this.outfitData.name}" placeholder="Enter outfit name">
            </div>
            <div class="input-group role-group" id="${this.id}-role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role-select" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${this.getRoleOptions()}
                    </select>
                    <input type="text" id="${this.id}-role-custom" class="role-input" placeholder="Enter custom role" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''} value="${this.getRoleInputValue()}">
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '✏️' : '🌳'}</button>
                </div>
            </div>
            <div class="input-group" id="${this.id}-notes-group">
                <label>Outfit Notes</label>
                <textarea id="${this.id}-notes" placeholder="Doctrine, deployment notes, logistics considerations...">${this.outfitData.notes}</textarea>
            </div>
            <div class="section-block" id="${this.id}-hardpoints-section">
                <h4>Hardpoints</h4>
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
                <div class="hardpoint-note">Merging reduces available hardpoints by 3 at a time; splitting increases the available count.</div>
            </div>
            <div class="section-block" id="${this.id}-power-section">
                <h4>Power and Propulsion</h4>
                <div class="placeholder-block">(Reserved)</div>
            </div>
            <div class="section-block" id="${this.id}-heat-section">
                <h4>Heat Management</h4>
                <div class="placeholder-block">(Reserved)</div>
            </div>
            <div class="section-block" id="${this.id}-hyperspace-section">
                <h4>Hyperspace</h4>
                <div class="placeholder-block">(Reserved)</div>
            </div>
            <div class="section-block systems-section" id="${this.id}-systems-section">
                <h4>Systems</h4>
                ${this.renderSystemsSection()}
            </div>
            <div class="section-block" id="${this.id}-features-section">
                <h4>Features</h4>
                ${this.renderFeaturesTable()}
            </div>
            <div class="section-block" id="${this.id}-weapons-section">
                <h4>Weapons</h4>
                ${this.renderWeaponsSection()}
            </div>
        `;

        this.setupEventListeners();
        this.registerLayoutAnchors();
        this.updateHardpointHeader();
        this.updateShipyardMonths();
        this.renderSystemsContent();
        this.initializeWeaponsContent();
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;
        const anchors = [
            { id: 'outfit-meta', selector: `#${this.id}-meta-header` },
            { id: 'outfit-name', selector: `#${this.id}-name-group` },
            { id: 'outfit-role', selector: `#${this.id}-role-group` },
            { id: 'outfit-notes', selector: `#${this.id}-notes-group` },
            { id: 'outfit-hardpoints', selector: `#${this.id}-hardpoints-section` },
            { id: 'outfit-power', selector: `#${this.id}-power-section` },
            { id: 'outfit-heat', selector: `#${this.id}-heat-section` },
            { id: 'outfit-hyperspace', selector: `#${this.id}-hyperspace-section` },
            { id: 'outfit-systems', selector: `#${this.id}-systems-section` },
            { id: 'outfit-features', selector: `#${this.id}-features-section` },
            { id: 'outfit-weapons', selector: `#${this.id}-weapons-section` }
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
            });
        }

        if (notesInput) {
            notesInput.addEventListener('input', (e) => {
                this.outfitData.notes = e.target.value;
            });
        }

        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                this.outfitData.role = e.target.value;
                this.outfitData.customRole = '';
                this.roleMode = 'dropdown';
            });
        }

        if (roleCustom) {
            roleCustom.addEventListener('input', (e) => {
                const value = e.target.value;
                this.outfitData.customRole = value;
                this.outfitData.role = value;
            });
            roleCustom.addEventListener('change', (e) => {
                const value = e.target.value.trim();
                if (value) this.ensureRoleAvailable(value);
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
                });
            }

            if (splitInput) {
                splitInput.addEventListener('input', (e) => {
                    const value = Math.max(0, parseInt(e.target.value, 10) || 0);
                    e.target.value = value;
                    this.outfitData.hardpoints.split[key] = value;
                    this.updateHardpointHeader();
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
    }

    uninstallModule(moduleInstanceId) {
        const idx = this.outfitData.systemsData.modules.findIndex(m => m.id === moduleInstanceId);
        if (idx === -1) return;
        const module = this.outfitData.systemsData.modules[idx];
        this.outfitData.systemsData.usedSystemHulls = Math.max(0, this.outfitData.systemsData.usedSystemHulls - (module?.systemHulls || 0));
        this.outfitData.systemsData.modules.splice(idx, 1);
        this.renderSystemsContent();
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
            ['Aero Streamlining', '', '', '', '', 'FALSE', '-', '', '', '(252)', '', '', ''],
            ['Enhanced Armour', '', '', '', '', 'FALSE', '-', '', '', '(33)', '', '', ''],
            ['QW Hardening', '', '', '', '', 'FALSE', '-', '', '', '', '', '', ''],
            ['Particle Sail', '', '', '', '', 'FALSE', '5%', '', '', '', '', '', ''],
            ['Fighter Catapult', '', '', '', '', '0', 'MHP', '', '', '(50)', '', '', ''],
            ['Flinger Little', '', '', '', '', 'FALSE', 'MHP', '', '', '(50)', '', '', ''],
            ['Magazine Crane', '', '', '', '', 'FALSE', 'MHP', '', '', '(50)', '', '', ''],
            ['Bomb Launcher', '', '', '', '', '0', 'PHP', '', '', '(12)', '', '', ''],
            ['LASER Focus', '', '', '', '', '0', 'SHP', '', '', '(50)', '', '', ''],
            ['Jump Beacon', '', '', '', '', 'FALSE', 'MHP', '', '', '(90)', '', '', ''],
            ['Transporter', '', '', '', '', '0', 'UHP', '', '', '(30)', '', '', '']
        ];
        return `
            <table class="features-table">
                <thead>
                    <tr>
                        ${Array.from({ length: 12 }).map((_, idx) => `<th>${idx === 0 ? 'Feature' : '&nbsp;'}</th>`).join('')}
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
        const spinalOptions = Object.entries(this.weaponCatalog)
            .map(([key, weapon]) => `<option value="${key}">${weapon.label}</option>`)
            .join('');
        return `
            <div class="weapons-subsection spinal">
                <h5>Spinal Weapon</h5>
                <select id="${this.id}-spinal-weapon">${spinalOptions}</select>
            </div>
            <div class="weapons-subsection offensive">
                <div class="weapons-header">
                    <h5>Offensive Weapons</h5>
                    <button class="add-weapon-btn" id="${this.id}-add-offensive">＋ Add</button>
                </div>
                <table class="weapons-table">
                    <thead>
                        <tr>
                            <th>Mount</th>
                            <th>Weapon</th>
                            <th>Copies</th>
                            <th>Arcs</th>
                            <th>Hardpoint</th>
                            <th>Total Cost</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="${this.id}-offensive-body"></tbody>
                </table>
            </div>
            <div class="weapons-subsection defensive">
                <div class="weapons-header">
                    <h5>Defensive Weapons</h5>
                    <button class="add-weapon-btn" id="${this.id}-add-defensive">＋ Add</button>
                </div>
                <table class="weapons-table">
                    <thead>
                        <tr>
                            <th>Weapon</th>
                            <th>Copies</th>
                            <th>Arcs</th>
                            <th>Hardpoint</th>
                            <th>Total Cost</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="${this.id}-defensive-body"></tbody>
                </table>
            </div>
        `;
    }

    initializeWeaponsContent() {
        this.renderOffensiveWeapons();
        this.renderDefensiveWeapons();
        const spinalSelect = document.getElementById(`${this.id}-spinal-weapon`);
        if (spinalSelect) spinalSelect.value = this.outfitData.weapons.spinal || '';
    }

    setupWeaponsEventListeners() {
        const spinalSelect = document.getElementById(`${this.id}-spinal-weapon`);
        if (spinalSelect) {
            spinalSelect.addEventListener('change', (e) => {
                this.outfitData.weapons.spinal = e.target.value;
            });
        }

        const addOffensive = document.getElementById(`${this.id}-add-offensive`);
        if (addOffensive) {
            addOffensive.addEventListener('click', () => {
                this.outfitData.weapons.offensive.push({ mount: 'Single', weapon: '', copies: 1, arcs: '', hardpoint: '-', totalCost: 0 });
                this.renderOffensiveWeapons();
            });
        }

        const addDefensive = document.getElementById(`${this.id}-add-defensive`);
        if (addDefensive) {
            addDefensive.addEventListener('click', () => {
                this.outfitData.weapons.defensive.push({ weapon: '', copies: 1, arcs: '', hardpoint: '-', totalCost: 0 });
                this.renderDefensiveWeapons();
            });
        }
    }

    renderOffensiveWeapons() {
        const body = document.getElementById(`${this.id}-offensive-body`);
        if (!body) return;
        const mountOptions = ['Single', 'Dual', 'Triple', 'Quad'];
        body.innerHTML = this.outfitData.weapons.offensive.map((row, index) => {
            const weaponOptions = Object.entries(this.weaponCatalog)
                .map(([key, weapon]) => `<option value="${key}" ${row.weapon === key ? 'selected' : ''}>${weapon.label}</option>`)
                .join('');
            const mountSelect = mountOptions.map(option => `<option value="${option}" ${row.mount === option ? 'selected' : ''}>${option}</option>`).join('');
            return `
                <tr data-index="${index}">
                    <td>
                        <select data-field="mount">${mountSelect}</select>
                    </td>
                    <td>
                        <select data-field="weapon">${weaponOptions}</select>
                    </td>
                    <td>
                        <input type="number" data-field="copies" min="1" step="1" value="${row.copies}">
                    </td>
                    <td>
                        <input type="text" data-field="arcs" value="${row.arcs}" placeholder="FPSA">
                    </td>
                    <td class="hp" data-field="hardpoint">${row.hardpoint || '-'}</td>
                    <td class="cost" data-field="totalCost">${row.totalCost || 0}</td>
                    <td><button class="remove-weapon" data-remove="offensive" data-index="${index}">✕</button></td>
                </tr>
            `;
        }).join('');

        body.querySelectorAll('select, input').forEach(el => {
            el.addEventListener('change', (e) => this.handleWeaponFieldChange(e, 'offensive'));
            el.addEventListener('input', (e) => this.handleWeaponFieldChange(e, 'offensive'));
        });
        body.querySelectorAll('button[data-remove="offensive"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index, 10);
                this.outfitData.weapons.offensive.splice(index, 1);
                this.renderOffensiveWeapons();
            });
        });
    }

    renderDefensiveWeapons() {
        const body = document.getElementById(`${this.id}-defensive-body`);
        if (!body) return;
        body.innerHTML = this.outfitData.weapons.defensive.map((row, index) => {
            const weaponOptions = Object.entries(this.weaponCatalog)
                .map(([key, weapon]) => `<option value="${key}" ${row.weapon === key ? 'selected' : ''}>${weapon.label}</option>`)
                .join('');
            return `
                <tr data-index="${index}">
                    <td>
                        <select data-field="weapon">${weaponOptions}</select>
                    </td>
                    <td>
                        <input type="number" data-field="copies" min="1" step="1" value="${row.copies}">
                    </td>
                    <td>
                        <input type="text" data-field="arcs" value="${row.arcs}" placeholder="FPSA">
                    </td>
                    <td class="hp" data-field="hardpoint">${row.hardpoint || '-'}</td>
                    <td class="cost" data-field="totalCost">${row.totalCost || 0}</td>
                    <td><button class="remove-weapon" data-remove="defensive" data-index="${index}">✕</button></td>
                </tr>
            `;
        }).join('');

        body.querySelectorAll('select, input').forEach(el => {
            el.addEventListener('change', (e) => this.handleWeaponFieldChange(e, 'defensive'));
            el.addEventListener('input', (e) => this.handleWeaponFieldChange(e, 'defensive'));
        });
        body.querySelectorAll('button[data-remove="defensive"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index, 10);
                this.outfitData.weapons.defensive.splice(index, 1);
                this.renderDefensiveWeapons();
            });
        });
    }

    handleWeaponFieldChange(event, table) {
        const cell = event.target.closest('tr');
        if (!cell) return;
        const index = parseInt(cell.dataset.index, 10);
        const dataset = table === 'offensive' ? this.outfitData.weapons.offensive : this.outfitData.weapons.defensive;
        const row = dataset[index];
        if (!row) return;

        const field = event.target.dataset.field;
        if (field === 'weapon') {
            row.weapon = event.target.value;
        } else if (field === 'mount') {
            row.mount = event.target.value;
        } else if (field === 'copies') {
            const value = Math.max(1, parseInt(event.target.value, 10) || 1);
            event.target.value = value;
            row.copies = value;
        } else if (field === 'arcs') {
            row.arcs = event.target.value.toUpperCase();
            event.target.value = row.arcs;
        }

        const catalogEntry = this.weaponCatalog[row.weapon] || { cost: 0, hardpoint: '-' };
        const mountMultiplier = table === 'offensive' ? this.getMountMultiplier(row.mount) : 1;
        row.hardpoint = catalogEntry.hardpoint || '-';
        row.totalCost = mountMultiplier * catalogEntry.cost * row.copies;

        if (table === 'offensive') {
            this.renderOffensiveWeapons();
        } else {
            this.renderDefensiveWeapons();
        }
    }

    getMountMultiplier(mount) {
        switch ((mount || '').toLowerCase()) {
            case 'dual': return 2;
            case 'triple': return 3;
            case 'quad': return 4;
            default: return 1;
        }
    }

    onParentLinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.applyParentInheritance(parentWidget);
        }
    }

    onParentUnlinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.resetInheritedValues();
        }
    }

    applyParentInheritance(shipWidget) {
        const shipData = shipWidget?.shipData || {};
        const stats = shipData.statistics || {};
        const hulls = shipData.hullComposition || {};

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
    }

    resetInheritedValues() {
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
    }

    createNodes() {
        if (this.nodes.size > 0) {
            this.reflowNodes();
            return;
        }
        this.addNode('input', 'ship-class', 'Class', 0, 0.25, {
            anchorId: 'outfit-meta',
            minSpacing: 32
        });
        this.addNode('input', 'powerplant', 'Powerplant', 0, 0.45, {
            anchorId: 'outfit-power',
            minSpacing: 32
        });
        this.addNode('output', 'information', 'Information', 1, 0.4, {
            anchorId: 'outfit-weapons',
            minSpacing: 32
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return {
            ...super.getSerializedData(),
            outfitData: this.outfitData
        };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
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
}
