// Ship design widget
class ShipWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('ship', 'New Ship Class', x, y, null);
        
        this.defaultRoles = [
            'corvette', 'frigate', 'destroyer', 'cruiser', 'battleship', 
            'dreadnought', 'carrier', 'fighter', 'bomber', 'scout', 
            'transport', 'support'
        ];

        // Initialize ship class data
        this.shipData = {
            name: 'New Ship Class',
            role: 'corvette',
            customRole: '',
            description: '',
            designNotes: '',
            appearance: '',
            text2imgPrompt: '',
            developmentCost: null,
            hullComposition: {
                containment: 0,
                remass: 0,
                magazine: 0,
                hangar: 0,
                bunker: 0,
                system: 0,
                powerplant: 0,
                emplacement: 0
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
            ignoreTechRequirements: false,
            hardpoints: {
                perEmplacement: 4,
                utility: 0,
                secondary: 0,
                primary: 0,
                main: 0,
                totalValue: 0,
                UHP: 0,
                SHP: 0,
                PHP: 0,
                MHP: 0
            },
            resources: {
                cargo: 0,
                remass: 0
            }
        };

        this.roleMode = 'dropdown';
        this.availableRoles = ShipWidget.loadStoredRoles(this.defaultRoles);
        this.ensureRoleAvailable(this.shipData.role);
        if (this.shipData.customRole) {
            this.roleMode = 'custom';
        }
        
        this.militaryHullTypes = [
            { key: 'magazine', label: 'Magazine' },
            { key: 'hangar', label: 'Hangar' },
            { key: 'system', label: 'System' },
            { key: 'powerplant', label: 'Powerplant' },
            { key: 'emplacement', label: 'Emplacement' }
        ];
        this.civilHullTypes = [
            { key: 'containment', label: 'Containment' },
            { key: 'remass', label: 'Remass' },
            { key: 'bunker', label: 'Bunker' }
        ];
        this.hullTypes = [
            ...this.militaryHullTypes.map(({ key }) => key),
            ...this.civilHullTypes.map(({ key }) => key)
        ];
        // Order & keys for foundations checkboxes
        this.foundationKeys = [
            'structural', 'propulsion', 'power', 'heat', 'lifeSupport',
            'navigation', 'sensors', 'weapons', 'defense', 'logistics'
        ];
        
        this.lockedHullTotal = null;
        this.isSubclass = false;
        this._preflightTimer = null;

        this.layoutMode = 'three-column';
        this.init();
    }

    static getRoleStorageKey() {
        return 'shipWidgetRoles';
    }

    static loadStoredRoles(defaultRoles = []) {
        let stored = [];
        try {
            const fromStorage = localStorage.getItem(ShipWidget.getRoleStorageKey());
            if (fromStorage) {
                stored = JSON.parse(fromStorage);
            }
        } catch (err) {
            console.warn('Unable to load stored ship roles', err);
        }
        const merged = new Set([...(defaultRoles || []), ...(stored || [])]);
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
    }

    static saveStoredRoles(roles = []) {
        try {
            localStorage.setItem(ShipWidget.getRoleStorageKey(), JSON.stringify(roles));
        } catch (err) {
            console.warn('Unable to persist ship roles', err);
        }
    }

    getRoleInputValue() {
        if (this.roleMode === 'custom') {
            return this.shipData.customRole || this.shipData.role || '';
        }
        return this.shipData.role || '';
    }

    formatRoleLabel(role) {
        if (!role) return '';
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    generateRoleOptionsHTML(selectedRole) {
        return this.availableRoles
            .sort((a, b) => a.localeCompare(b))
            .map(role => `<option value="${role}" ${selectedRole === role ? 'selected' : ''}>${this.formatRoleLabel(role)}</option>`)
            .join('');
    }

    populateRoleSelect(selectElement, selectedRole = this.shipData.role) {
        if (!selectElement) return;
        selectElement.innerHTML = this.generateRoleOptionsHTML(selectedRole);
        if (selectedRole) {
            selectElement.value = selectedRole;
        }
    }

    ensureRoleAvailable(role) {
        if (!role) return;
        const normalized = role.trim();
        if (!normalized) return;
        if (!this.availableRoles.includes(normalized)) {
            this.availableRoles.push(normalized);
            this.availableRoles.sort((a, b) => a.localeCompare(b));
            ShipWidget.saveStoredRoles(this.availableRoles);
        }
    }

    queuePreflightCheck(delay = 100) {
        if (this._preflightTimer) {
            clearTimeout(this._preflightTimer);
        }
        this._preflightTimer = window.setTimeout(() => {
            this._preflightTimer = null;
            if (window.preflightCheck) {
                window.preflightCheck.runCheck();
            } else if (window.app?.runPreflightCheck) {
                window.app.runPreflightCheck();
            }
            if (this.minimized && typeof this.refreshSummary === 'function') {
                try {
                    this.refreshSummary();
                } catch (error) {
                    /* ignore summary refresh failures */
                }
            }
        }, delay);
    }

    getParentShipWidget() {
        if (!this.parents || this.parents.size === 0) return null;
        if (!window.widgetManager) return null;
        for (const parentId of this.parents) {
            const parentWidget = window.widgetManager.getWidget(parentId);
            if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
                return parentWidget;
            }
        }
        return null;
    }

    syncFoundationsFromParent(parentWidget) {
        if (!parentWidget?.shipData?.foundations) return;
        this.shipData.foundations = { ...parentWidget.shipData.foundations };
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.checked = !!this.shipData.foundations[key];
            }
        });
    }

    setFoundationsLocked(isLocked, parentWidget = null) {
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.disabled = isLocked;
                const label = cb.closest('.foundation-item');
                if (label) {
                    label.classList.toggle('locked', isLocked);
                }
            }
        });
    }

    updateSubclassState() {
        const parentShip = this.getParentShipWidget();
        if (parentShip) {
            this.isSubclass = true;
            this.lockedHullTotal = parentShip.getTotalHulls();
            this.syncFoundationsFromParent(parentShip);
            this.setFoundationsLocked(true, parentShip);
        } else {
            this.isSubclass = false;
            this.lockedHullTotal = null;
            this.setFoundationsLocked(false);
        }
        this.updateHullDisplay();
        this.queuePreflightCheck();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        const node = this.nodes.get(nodeId);
        if (node && node.nodeType === 'ship-class') {
            this.updateSubclassState();
    }
    }

    notifyShipChildrenToRefresh() {
        if (this.children && this.children.size > 0 && window.widgetManager) {
            this.children.forEach(childId => {
                const childWidget = window.widgetManager.getWidget(childId);
                if (childWidget && (childWidget.type === 'ship' || childWidget.type === 'shipPrototype') && typeof childWidget.updateSubclassState === 'function') {
                    childWidget.updateSubclassState();
                }
            });
        }
        this.queuePreflightCheck();
    }
    
    notifyOutfitChildrenToRefresh(methodName = 'handleParentTechRequirementChange') {
        if (!this.children || this.children.size === 0 || !window.widgetManager) return;
        this.children.forEach(childId => {
            const childWidget = window.widgetManager.getWidget(childId);
            if (childWidget && childWidget.type === 'outfit') {
                const fn = childWidget?.[methodName];
                if (typeof fn === 'function') {
                    fn.call(childWidget, this);
                }
            }
        });
    }

    onParentLinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.updateSubclassState();
            this.queuePreflightCheck();
        }
    }

    onParentUnlinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.updateSubclassState();
            this.queuePreflightCheck();
        }
    }

    getTotalHulls() {
        this.queuePreflightCheck();
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
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Information section (merged meta and role)
        const informationSection = this.createSection('information', 'Information');
        const roleOptions = this.generateRoleOptionsHTML(this.shipData.role);
        const roleInputValue = this.getRoleInputValue();
        
        this.setSectionContent(informationSection, `
            <div class="ship-information-header" id="${this.id}-information-header">
                <label class="ship-flag"><input type="checkbox" id="${this.id}-operational" ${this.shipData.operational ? 'checked' : ''}> Operational</label>
                <label class="ship-flag"><input type="checkbox" id="${this.id}-ignore-tech" ${this.shipData.ignoreTechRequirements ? 'checked' : ''}> Ignore Tech</label>
                <div class="ship-dvp">
                    <label for="${this.id}-dvp-cost">DvP Cost</label>
                    <input type="number" min="0" step="1" id="${this.id}-dvp-cost" value="${this.shipData.developmentCost ?? ''}" placeholder="0">
                </div>
            </div>
            <div class="input-group" id="${this.id}-name-group">
                <label>Class Name</label>
                <input type="text" id="${this.id}-name" value="${this.shipData.name}" placeholder="Enter ship class name">
            </div>
            <div class="input-group information-group" id="${this.id}-role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role-select" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${roleOptions}
                    </select>
                    <input type="text" id="${this.id}-role-custom" class="role-input" placeholder="Enter custom role" value="${roleInputValue}" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''}>
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '🖉' : '🌳'}</button>
                </div>
            </div>
            <div class="input-group" id="${this.id}-notes-group">
                <label>Class Notes</label>
                <textarea id="${this.id}-class-notes" placeholder="Design notes, doctrine, or operational directives...">${this.shipData.designNotes}</textarea>
            </div>
        `);
        sectionsContainer.appendChild(informationSection.section);
        
        // Create Foundations section
        const foundationsSection = this.createSection('foundations', 'Foundations');
        const foundationsContent = foundationsSection.contentContainer;
        foundationsContent.classList.add('foundations-section');
        foundationsContent.id = `${this.id}-foundations-section`;
        this.setSectionContent(foundationsSection, `
            <div class="foundations-grid">
                ${this.foundationKeys.map(key => `
                    <label class="foundation-item">
                        <input type="checkbox" id="${this.id}-foundation-${key}" ${this.shipData.foundations[key] ? 'checked' : ''}>
                        ${key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}
                    </label>
                `).join('')}
            </div>
        `);
        sectionsContainer.appendChild(foundationsSection.section);
        
        // Create Composition section
        const compositionSection = this.createSection('composition', 'Composition');
        const compositionContent = compositionSection.contentContainer;
        compositionContent.classList.add('composition-section');
        compositionContent.id = `${this.id}-composition-section`;
        const militaryHullInputs = this.militaryHullTypes.map(({ key, label }) => `
            <div class="composition-item">
                <label>${label}</label>
                <input type="number" class="hull-spin" data-hull="${key}" id="${this.id}-hull-${key}" min="0" step="1" value="${this.shipData.hullComposition[key] ?? 0}">
            </div>
        `).join('');
        const civilHullInputs = this.civilHullTypes.map(({ key, label }) => `
            <div class="composition-item">
                <label>${label}</label>
                <input type="number" class="hull-spin" data-hull="${key}" id="${this.id}-hull-${key}" min="0" step="1" value="${this.shipData.hullComposition[key] ?? 0}">
            </div>
        `).join('');
        const hardpointRatio = this.shipData.hardpoints?.perEmplacement ?? 4;
        const cargoValue = this.shipData.resources?.cargo ?? 0;
        const remassValue = this.shipData.resources?.remass ?? 0;
        this.setSectionContent(compositionSection, `
            <div class="composition-group military-hulls">
                <div class="composition-grid">
                    ${militaryHullInputs}
                </div>
            </div>
            <div class="hardpoints-area" id="${this.id}-hardpoints-area">
                <div class="hardpoint-summary">
                    <div class="hardpoint-value">
                        <span class="label">Utility Hardpoints</span>
                        <span class="value" id="${this.id}-utility-hardpoints">0</span>
                    </div>
                    <div class="hardpoint-value">
                        <span class="label">Emplacement Ratio</span>
                        <span class="value" id="${this.id}-emplacement-ratio">1:${hardpointRatio}</span>
                    </div>
                    <div class="hardpoint-value">
                        <span class="label">Hardpoint Value</span>
                        <span class="value" id="${this.id}-hardpoint-value">0</span>
                    </div>
                </div>
                <div class="hardpoint-sliders">
                    <div class="hardpoint-item">
                        <div class="hardpoint-label">
                            <span class="code">SHP</span>
                            <span class="value" id="${this.id}-shp-count">0</span>
                        </div>
                        <input type="range" class="hardpoint-slider" id="${this.id}-shp-slider" min="0" max="1" value="0" step="1" disabled>
                    </div>
                    <div class="hardpoint-item">
                        <div class="hardpoint-label">
                            <span class="code">PHP</span>
                            <span class="value" id="${this.id}-php-count">0</span>
                        </div>
                        <input type="range" class="hardpoint-slider" id="${this.id}-php-slider" min="0" max="1" value="0" step="1" disabled>
                    </div>
                    <div class="hardpoint-item">
                        <div class="hardpoint-label">
                            <span class="code">MHP</span>
                            <span class="value" id="${this.id}-mhp-count">0</span>
                        </div>
                        <input type="range" class="hardpoint-slider" id="${this.id}-mhp-slider" min="0" max="1" value="0" step="1" disabled>
                    </div>
                </div>
            </div>
            <div class="composition-group civil-hulls">
                <div class="composition-grid">
                    ${civilHullInputs}
                </div>
            </div>
            <div class="cargo-remass-control" id="${this.id}-cargo-remass-control">
                <div class="cargo-endurance">
                    <span class="label">Endurance</span>
                    <span class="value" id="${this.id}-cargo-value">${cargoValue}</span>
                </div>
                <input type="range" class="cargo-remass-slider" id="${this.id}-cargo-remass-slider" min="0" max="0" value="${cargoValue}" step="1">
                <div class="remass-burns">
                    <span class="label">Burns</span>
                    <span class="value" id="${this.id}-remass-value">${remassValue}</span>
                </div>
            </div>
        `);
        sectionsContainer.appendChild(compositionSection.section);
        
        this.setupEventListeners();
        this.updateNodes();
        this.updateStats();
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;

        const anchorConfigs = [
            { id: 'ship-information', selector: `#${this.id}-information` },
            { id: 'ship-foundations', selector: `#${this.id}-foundations` },
            { id: 'ship-composition', selector: `#${this.id}-composition` }
        ];

        anchorConfigs.forEach(({ id, selector }) => {
            const element = this.element.querySelector(selector);
            if (element) {
                this.addLayoutAnchor(id, element, { selector });
            }
        });
    }

    setupEventListeners() {
        super.setupEventListeners();
        
        // Prevent double-binding
        if (this._eventsBound) return;
        this._eventsBound = true;
        
        // Use widget element's querySelector for elements within this widget
        // This is more reliable than document.getElementById
        const getElement = (id) => this.element?.querySelector(`#${id}`);
        
        const nameInput = getElement(`${this.id}-name`);
        const notesInput = getElement(`${this.id}-class-notes`);
        const ignoreTechCheckbox = getElement(`${this.id}-ignore-tech`);
        const operationalCheckbox = getElement(`${this.id}-operational`);
    const dvpInput = getElement(`${this.id}-dvp-cost`);
    const roleSelect = getElement(`${this.id}-role-select`);
    const customRoleInput = getElement(`${this.id}-role-custom`);
    const roleToggleBtn = getElement(`${this.id}-role-toggle`);
    this.roleSelectElement = roleSelect;
    this.roleCustomInput = customRoleInput;
    this.roleToggleButton = roleToggleBtn;

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipData.name = e.target.value;
                this.updateTitle(this.shipData.name);
                this.queuePreflightCheck();
            });
        }
        if (notesInput) {
            notesInput.addEventListener('input', (e) => {
                this.shipData.designNotes = e.target.value;
                this.queuePreflightCheck();
            });
        }
        if (ignoreTechCheckbox) {
            ignoreTechCheckbox.addEventListener('change', (e) => {
                this.shipData.ignoreTechRequirements = e.target.checked;
                this.queuePreflightCheck();
                this.notifyOutfitChildrenToRefresh();
            });
        }
        if (operationalCheckbox) {
            operationalCheckbox.addEventListener('change', (e) => {
                this.shipData.operational = e.target.checked;
                this.queuePreflightCheck();
            });
        }
        if (dvpInput) {
            dvpInput.addEventListener('input', (e) => {
                const raw = e.target.value;
                if (raw === '' || raw === null) {
                    this.shipData.developmentCost = null;
                    return;
                }
                const value = parseInt(raw, 10);
                this.shipData.developmentCost = Number.isFinite(value) && value >= 0 ? value : null;
                if (this.shipData.developmentCost === null) {
                    e.target.value = '';
                }
                if (this.shipData.developmentCost !== null) {
                    e.target.value = this.shipData.developmentCost;
                }
                this.queuePreflightCheck();
            });
        }

        this.applyRoleMode = (mode) => {
            this.roleMode = mode;
            if (this.roleSelectElement) {
                if (mode === 'dropdown') {
                    this.roleSelectElement.style.display = '';
                    this.populateRoleSelect(this.roleSelectElement);
                    this.roleSelectElement.value = this.shipData.role;
                } else {
                    this.roleSelectElement.style.display = 'none';
                }
            }
            if (this.roleCustomInput) {
                if (mode === 'custom') {
                    this.roleCustomInput.style.display = '';
                    this.roleCustomInput.value = this.getRoleInputValue();
                    this.roleCustomInput.focus();
                } else {
                    this.roleCustomInput.style.display = 'none';
                }
            }
            if (this.roleToggleButton) {
                if (mode === 'dropdown') {
                    this.roleToggleButton.textContent = '🖉';
                    this.roleToggleButton.title = 'Use custom role';
                } else {
                    this.roleToggleButton.textContent = '🌳';
                    this.roleToggleButton.title = 'Use role list';
                }
            }
        };

        if (roleSelect) {
            this.populateRoleSelect(roleSelect);
            roleSelect.addEventListener('change', (e) => {
                this.shipData.role = e.target.value;
                this.shipData.customRole = '';
                this.roleMode = 'dropdown';
                this.queuePreflightCheck();
            });
        }

        if (customRoleInput) {
            customRoleInput.addEventListener('input', (e) => {
                const value = e.target.value;
                this.shipData.customRole = value;
                this.shipData.role = value;
                this.queuePreflightCheck();
            });
            customRoleInput.addEventListener('change', (e) => {
                this.ensureRoleAvailable(e.target.value);
                this.queuePreflightCheck();
            });
        }

        if (roleToggleBtn) {
            roleToggleBtn.addEventListener('click', () => {
                if (this.roleMode === 'dropdown') {
                    this.applyRoleMode('custom');
                } else {
                    const customValue = this.roleCustomInput ? this.roleCustomInput.value.trim() : '';
                    if (customValue) {
                        this.ensureRoleAvailable(customValue);
                        this.shipData.role = customValue;
                    }
                    this.shipData.customRole = '';
                    this.applyRoleMode('dropdown');
                }
                this.queuePreflightCheck();
            });
        }

        this.applyRoleMode(this.roleMode);
        this.updateSubclassState();
        // Foundations checkboxes
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.addEventListener('change', (e) => {
                    this.shipData.foundations[key] = e.target.checked;
                    this.notifyShipChildrenToRefresh();
                });
            }
        });
        const hullInputs = this.element.querySelectorAll('.hull-spin');
        hullInputs.forEach(input => {
            const updateHull = (value) => {
                const hullType = input.dataset.hull;
                const parsed = Math.max(0, parseInt(value, 10) || 0);
                this.shipData.hullComposition[hullType] = parsed;
                input.value = parsed;

                if (hullType === 'containment' || hullType === 'remass') {
                    const currentCargo = this.shipData.resources?.cargo ?? 0;
                    this.updateCargoRemassAllocation(currentCargo);
                }

                this.reflowNodes();
                this.updateStats();
                this.notifyShipChildrenToRefresh();
            };
            input.addEventListener('input', (e) => updateHull(e.target.value));
            input.addEventListener('change', (e) => updateHull(e.target.value));
        });

        const cargoRemassSlider = document.getElementById(`${this.id}-cargo-remass-slider`);
        if (cargoRemassSlider) {
            const handleSliderChange = (value) => {
                const cargoValue = Math.max(0, parseInt(value, 10) || 0);
                this.updateCargoRemassAllocation(cargoValue);
                this.reflowNodes();
                this.updateStats();
                this.notifyShipChildrenToRefresh();
            };
            cargoRemassSlider.addEventListener('input', (e) => handleSliderChange(e.target.value));
            cargoRemassSlider.addEventListener('change', (e) => handleSliderChange(e.target.value));
        }
    }
    
    updateHullDisplay() {
        this.hullTypes.forEach(hullType => {
            const countElement = document.getElementById(`${this.id}-hull-${hullType}`);
            if (countElement) {
                countElement.value = this.shipData.hullComposition[hullType] ?? 0;
            }
        });
        
        // Composition totals and notes are no longer displayed; locking logic remains internal.
    }

    // Split hardpoint value evenly and cascade leftovers toward cheaper mounts.
    calculateHardpointDistribution(totalValue) {
        const order = [
            { key: 'mhp', cost: 8 },
            { key: 'php', cost: 4 },
            { key: 'shp', cost: 2 }
        ];
        const baseShare = Math.floor(totalValue / 3);
        const buckets = [baseShare, baseShare, totalValue - (baseShare * 2)];
        const distribution = { mhp: 0, php: 0, shp: 0 };
        let carry = 0;

        order.forEach(({ key, cost }, index) => {
            const available = (buckets[index] ?? 0) + carry;
            const count = Math.floor(available / cost);
            distribution[key] = count;
            const used = count * cost;
            carry = available - used;
        });

    return { distribution, leftover: carry };
    }

    // Recompute derived hardpoint counts and refresh supporting UI controls.
    updateHardpointStats() {
        if (!this.shipData.hardpoints) {
            this.shipData.hardpoints = {
                perEmplacement: 4,
                utility: 0,
                secondary: 0,
                primary: 0,
                main: 0,
                totalValue: 0,
                UHP: 0,
                SHP: 0,
                PHP: 0,
                MHP: 0
            };
        }

        const magazine = this.shipData.hullComposition.magazine ?? 0;
        const hangar = this.shipData.hullComposition.hangar ?? 0;
        const system = this.shipData.hullComposition.system ?? 0;
        const powerplant = this.shipData.hullComposition.powerplant ?? 0;
        const emplacement = this.shipData.hullComposition.emplacement ?? 0;
        const perEmplacement = Math.max(0, this.shipData.hardpoints.perEmplacement ?? 4);

        const utilityCount = magazine + hangar + system + powerplant;
        const totalValue = emplacement * perEmplacement;
        const { distribution } = this.calculateHardpointDistribution(totalValue);

        this.shipData.hardpoints.utility = utilityCount;
        this.shipData.hardpoints.secondary = distribution.shp;
        this.shipData.hardpoints.primary = distribution.php;
        this.shipData.hardpoints.main = distribution.mhp;
        this.shipData.hardpoints.totalValue = totalValue;
        this.shipData.hardpoints.UHP = utilityCount;
        this.shipData.hardpoints.SHP = distribution.shp;
        this.shipData.hardpoints.PHP = distribution.php;
        this.shipData.hardpoints.MHP = distribution.mhp;

        const utilityElement = document.getElementById(`${this.id}-utility-hardpoints`);
        if (utilityElement) {
            utilityElement.textContent = utilityCount;
        }

        const ratioElement = document.getElementById(`${this.id}-emplacement-ratio`);
        if (ratioElement) {
            ratioElement.textContent = `1:${perEmplacement}`;
        }

        const valueElement = document.getElementById(`${this.id}-hardpoint-value`);
        if (valueElement) {
            valueElement.textContent = totalValue;
        }

        const sliderConfigs = [
            { key: 'shp', elementId: `${this.id}-shp-slider`, count: distribution.shp, displayId: `${this.id}-shp-count` },
            { key: 'php', elementId: `${this.id}-php-slider`, count: distribution.php, displayId: `${this.id}-php-count` },
            { key: 'mhp', elementId: `${this.id}-mhp-slider`, count: distribution.mhp, displayId: `${this.id}-mhp-count` }
        ];

        sliderConfigs.forEach(({ elementId, count, displayId }) => {
            const slider = document.getElementById(elementId);
            if (slider) {
                slider.max = Math.max(count, 1);
                slider.value = count;
            }
            const display = document.getElementById(displayId);
            if (display) {
                display.textContent = count;
            }
        });
    }

    getCivilHullSlots() {
        const containment = this.shipData.hullComposition.containment ?? 0;
        const remass = this.shipData.hullComposition.remass ?? 0;
        return containment + remass;
    }

    // Translate cargo slider value into updated hull counts while preserving total slots.
    updateCargoRemassAllocation(rawCargoValue) {
        if (!this.shipData.resources) {
            this.shipData.resources = { cargo: 0, remass: 0 };
        }

        const totalSlots = this.getCivilHullSlots();
        if (totalSlots <= 0) {
            this.shipData.resources.cargo = 0;
            this.shipData.resources.remass = 0;
            return;
        }

        const capacity = totalSlots * 50;
        const cargo = Math.max(0, Math.min(rawCargoValue, capacity));
        const remass = capacity - cargo;

        this.shipData.resources.cargo = cargo;
        this.shipData.resources.remass = remass;

        const fullContainment = Math.min(totalSlots, Math.floor(cargo / 50));
        this.shipData.hullComposition.containment = fullContainment;
        this.shipData.hullComposition.remass = totalSlots - fullContainment;
    }

    // Sync the cargo/remass slider and readouts with current allocation and capacity.
    updateCargoRemassUI() {
        if (!this.shipData.resources) {
            this.shipData.resources = { cargo: 0, remass: 0 };
        }

        const slider = document.getElementById(`${this.id}-cargo-remass-slider`);
        const cargoValueElement = document.getElementById(`${this.id}-cargo-value`);
        const remassValueElement = document.getElementById(`${this.id}-remass-value`);

        const totalSlots = this.getCivilHullSlots();
        const capacity = totalSlots * 50;

        let cargo = this.shipData.resources.cargo ?? 0;
        cargo = Math.max(0, Math.min(cargo, capacity));
        let remass = this.shipData.resources.remass ?? (capacity - cargo);
        remass = Math.max(0, capacity - cargo);

        if (capacity === 0) {
            cargo = 0;
            remass = 0;
        }

        this.shipData.resources.cargo = cargo;
        this.shipData.resources.remass = remass;

        if (slider) {
            slider.max = capacity;
            slider.value = cargo;
            slider.disabled = capacity === 0;
        }

        if (cargoValueElement) {
            cargoValueElement.textContent = cargo;
        }

        if (remassValueElement) {
            remassValueElement.textContent = remass;
        }
    }

    // switchTab removed - linear layout

    updateStats() {
        this.updateHullDisplay();
        this.updateHardpointStats();
        this.updateCargoRemassUI();
        this.queuePreflightCheck();
    }

    syncFormFromData() {
        // Use base class helper for simple fields
        const simpleFields = {
            'name': { id: 'name', type: 'text' },
            'designNotes': { id: 'class-notes', type: 'text' },
            'ignoreTechRequirements': { id: 'ignore-tech', type: 'checkbox' },
            'operational': { id: 'operational', type: 'checkbox' },
            'developmentCost': { id: 'dvp-cost', type: 'number' }
        };
        this.syncDataToFields(this.shipData, simpleFields);

        // Handle foundation checkboxes
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.checked = !!this.shipData.foundations[key];
            }
        });

        // Update hull display (spinboxes)
        this.updateHullDisplay();
        
        // Update cargo/remass slider
        this.updateCargoRemassUI();

        // Handle role (custom logic for dropdown vs custom)
        const roleValue = this.shipData.customRole ? this.shipData.customRole : this.shipData.role;
        this.ensureRoleAvailable(this.shipData.role);
        if (this.roleSelectElement) {
            this.populateRoleSelect(this.roleSelectElement, this.shipData.role);
        }
        if (this.roleCustomInput) {
            this.roleCustomInput.value = roleValue || '';
        }
        if (typeof this.applyRoleMode === 'function') {
            this.applyRoleMode(this.shipData.customRole ? 'custom' : 'dropdown');
        }
        
        this.updateSubclassState();
    }

    syncDataFromForm() {
        // Use base class helper for simple fields
        const simpleFields = {
            'name': { id: 'name', type: 'text' },
            'designNotes': { id: 'class-notes', type: 'text' },
            'ignoreTechRequirements': { id: 'ignore-tech', type: 'checkbox' },
            'operational': { id: 'operational', type: 'checkbox' },
            'developmentCost': { id: 'dvp-cost', type: 'number' }
        };
        this.syncFieldsToData(this.shipData, simpleFields);

        // Handle foundation checkboxes
        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                if (!this.shipData.foundations) {
                    this.shipData.foundations = {};
                }
                this.shipData.foundations[key] = !!cb.checked;
            }
        });

        // Handle role (custom logic for dropdown vs custom)
        const roleSelect = this.roleSelectElement || document.getElementById(`${this.id}-role-select`);
        const customRoleInput = this.roleCustomInput || document.getElementById(`${this.id}-role-custom`);

        if (this.roleMode === 'custom') {
            const customValue = customRoleInput ? customRoleInput.value.trim() : '';
            this.shipData.customRole = customValue;
            if (customValue) {
                this.shipData.role = customValue;
            }
        } else {
            const selectedRole = roleSelect ? roleSelect.value : this.shipData.role;
            if (selectedRole) {
                this.shipData.role = selectedRole;
            }
            this.shipData.customRole = '';
        }

        this.ensureRoleAvailable(this.shipData.role);

        // Handle hull composition spinboxes
        if (this.shipData.hullComposition) {
            this.hullTypes.forEach(hullType => {
                const input = document.getElementById(`${this.id}-hull-${hullType}`);
                if (input) {
                    const value = parseInt(input.value, 10);
                    this.shipData.hullComposition[hullType] = Number.isFinite(value) && value >= 0 ? value : 0;
                }
            });
        }

        // Handle cargo/remass slider
        const cargoSlider = document.getElementById(`${this.id}-cargo-remass-slider`);
        if (cargoSlider) {
            const totalSlots = this.getCivilHullSlots();
            const capacity = totalSlots * 50;
            const cargoValue = parseInt(cargoSlider.value, 10);
            const cargo = Number.isFinite(cargoValue) && cargoValue >= 0 ? cargoValue : 0;
            const remass = Math.max(0, capacity - cargo);

            if (!this.shipData.resources) {
                this.shipData.resources = { cargo: 0, remass: 0 };
            }
            this.shipData.resources.cargo = cargo;
            this.shipData.resources.remass = remass;
        }
    }

    updateNodes() { /* DOM node list removed in linear layout; retained for potential future use */ }

    createNodes() {
        const ensureNode = (type, nodeType, label, relativeX, relativeY, options = {}) => {
            const nodeId = options.nodeId;
            if (nodeId && this.nodes.has(nodeId)) {
                const existing = this.nodes.get(nodeId);
                existing.type = type;
                existing.nodeType = nodeType;
                existing.label = label;
                existing.relativeX = relativeX;
                existing.relativeY = relativeY;
                if ('anchorId' in options) existing.anchorId = options.anchorId;
                if ('sectionId' in options) existing.sectionId = options.sectionId;
                if ('anchorOffset' in options) existing.anchorOffset = options.anchorOffset;
                if ('minSpacing' in options) existing.minSpacing = options.minSpacing;
                if ('allowMultipleConnections' in options) {
                    existing.allowMultipleConnections = !!options.allowMultipleConnections;
                }
                const labelElement = this.element?.querySelector(`.node-label[data-node-id="${nodeId}"]`);
                if (labelElement) {
                    labelElement.textContent = label;
                }
                return nodeId;
            }
            return this.addNode(type, nodeType, label, relativeX, relativeY, options);
        };

        const nodeIds = {
            classInput: `${this.id}-node-input-class`,
            classOutput: `${this.id}-node-output-class`,
            statsOutput: `${this.id}-node-output-statistics`
        };

        ensureNode('input', 'Class', 'Class', 0, 0.25, {
            nodeId: nodeIds.classInput,
            anchorId: 'ship-information',
            sectionId: 'information',
            minSpacing: 36
        });

        ensureNode('output', 'Class', 'Class', 1, 0.25, {
            nodeId: nodeIds.classOutput,
            anchorId: 'ship-information',
            sectionId: 'information',
            anchorOffset: 20,
            minSpacing: 32
        });

        ensureNode('output', 'Statistics', 'Statistics', 1, 0.4, {
            nodeId: nodeIds.statsOutput,
            anchorId: 'ship-information',
            sectionId: 'information',
            anchorOffset: 40,
            minSpacing: 32
        });

        this.reflowNodes();
        this.updateNodes();
    }
    
    clearNodes() {
        super.clearNodes();
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) {
            this.refreshSummary();
        }
    }

    renderSummary(container) {
        if (!container) return;

        const data = this.shipData || {};
        const resources = data.resources || {};
        const hardpoints = data.hardpoints || {};
        const power = data.powerAndPropulsion || {};
        const heat = data.heatManagement || {};

        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = data.name || 'New Ship Class';

        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        if (data.operational) {
            badges.appendChild(this.createBadge('Operational', 'caution'));
        }
        if (data.ignoreTechRequirements) {
            badges.appendChild(this.createBadge('Ignores Tech', 'warning'));
        }

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'summary-grid';

        const roleLabel = this.formatRoleLabel(this.getRoleInputValue()) || '—';
        const hullSummary = this.formatHullSummary();
        const foundationSummary = this.formatFoundations();

        const fields = [
            { label: 'Role', value: roleLabel },
            { label: 'DvP Cost', value: this.formatOptionalNumber(data.developmentCost) },
            { label: 'Hull Sections', value: hullSummary },
            { label: 'Cargo', value: this.formatOptionalNumber(resources.cargo, ' t') },
            { label: 'Remass', value: this.formatOptionalNumber(resources.remass, ' t') },
            { label: 'Hardpoints', value: this.formatHardpoints(hardpoints) },
            { label: 'Propulsion', value: this.formatPropulsion(power) },
            { label: 'Heat', value: this.formatHeat(heat) }
        ];

        if (foundationSummary) {
            fields.push({ label: 'Foundations', value: foundationSummary });
        }

        fields
            .filter(field => field.value && field.value !== '')
            .forEach(field => {
                const wrapper = document.createElement('div');
                wrapper.className = 'summary-field';

                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = field.label;

                const value = document.createElement('span');
                value.className = 'value';
                value.textContent = field.value;

                wrapper.appendChild(label);
                wrapper.appendChild(value);
                summaryGrid.appendChild(wrapper);
            });

        container.innerHTML = '';
        container.appendChild(title);
        if (badges.childElementCount > 0) {
            container.appendChild(badges);
        }
        container.appendChild(summaryGrid);
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

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = 'summary-badge';
        if (variant) {
            badge.classList.add(variant);
        }
        badge.textContent = text;
        return badge;
    }

    formatHullSummary() {
        const composition = this.shipData?.hullComposition || {};
        const total = this.getTotalHulls();
        if (!total) return 'None';

        const ordered = [
            ...this.militaryHullTypes,
            ...this.civilHullTypes
        ];

        const parts = ordered
            .map(({ key, label }) => ({ count: composition[key] || 0, label }))
            .filter(entry => entry.count > 0)
            .map(entry => `${entry.count} ${entry.label}`);

        if (!parts.length) return String(total);

        const truncated = parts.slice(0, 3).join(', ');
        const remainder = parts.length > 3 ? ` +${parts.length - 3} more` : '';
        return `${total} (${truncated}${remainder})`;
    }

    formatFoundations() {
        const foundations = this.shipData?.foundations || {};
        const active = this.foundationKeys
            .filter(key => foundations[key])
            .map(key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()));
        if (!active.length) return '';
        const truncated = active.slice(0, 4).join(', ');
        return active.length > 4 ? `${truncated} +${active.length - 4} more` : truncated;
    }

    formatHardpoints(hardpoints = {}) {
        const { utility, totalValue, SHP, PHP, MHP } = hardpoints;
        const parts = [];
        if (utility != null) parts.push(`U ${utility}`);
        if (totalValue != null) parts.push(`Total ${totalValue}`);
        const highValue = [
            ['SHP', SHP],
            ['PHP', PHP],
            ['MHP', MHP]
        ].filter(([, value]) => value != null && value !== 0);
        if (highValue.length) {
            parts.push(highValue.map(([label, value]) => `${label} ${value}`).join(' '));
        }
        return parts.length ? parts.join(' · ') : '—';
    }

    formatPropulsion(power = {}) {
        const { thrust, burnRating, heatEfficiency, supplyRating } = power;
        const parts = [];
        if (thrust != null) parts.push(`Thrust ${thrust}`);
        if (burnRating != null) parts.push(`Burn ${burnRating}`);
        if (heatEfficiency != null) parts.push(`HeatEff ${heatEfficiency}`);
        if (supplyRating != null) parts.push(`Supply ${supplyRating}`);
        return parts.length ? parts.join(' · ') : '—';
    }

    formatHeat(heat = {}) {
        const capacity = heat.capacity;
        const dissipation = heat.dissipation;
        const warning = heat.thresholds?.warning;
        const critical = heat.thresholds?.critical;
        const parts = [];
        if (capacity != null) parts.push(`Cap ${capacity}`);
        if (dissipation != null) parts.push(`Diss ${dissipation}`);
        const thresholds = [warning, critical].filter(value => value != null);
        if (thresholds.length) {
            parts.push(`Thresh ${thresholds.join('/')}`);
        }
        return parts.length ? parts.join(' · ') : '—';
    }

    formatOptionalNumber(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    close() {
        if (this._preflightTimer) {
            clearTimeout(this._preflightTimer);
            this._preflightTimer = null;
        }
        super.close();
    }

    getSerializedData() {
        this.syncDataFromForm();
        return {
            ...super.getSerializedData(),
            shipData: this.shipData
        };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.shipData) {
            this.shipData = { ...this.shipData, ...data.shipData };
            
            // Deep merge nested objects from the incoming data
            this.shipData.hullComposition = {
                containment: 0,
                remass: 0,
                magazine: 0,
                hangar: 0,
                bunker: 0,
                system: 0,
                powerplant: 0,
                emplacement: 0,
                ...(data.shipData.hullComposition || {})
            };
            this.shipData.hardpoints = {
                perEmplacement: 4,
                utility: 0,
                secondary: 0,
                primary: 0,
                main: 0,
                totalValue: 0,
                UHP: 0,
                SHP: 0,
                PHP: 0,
                MHP: 0,
                ...(data.shipData.hardpoints || {})
            };
            this.shipData.foundations = {
                structural: false,
                propulsion: false,
                power: false,
                heat: false,
                lifeSupport: false,
                navigation: false,
                sensors: false,
                weapons: false,
                defense: false,
                logistics: false,
                ...(data.shipData.foundations || {})
            };
            this.shipData.resources = {
                cargo: 0,
                remass: 0,
                ...(data.shipData.resources || {})
            };
            
            if (!data.shipData.resources) {
                const containmentCapacity = (this.shipData.hullComposition.containment ?? 0) * 50;
                const remassCapacity = (this.shipData.hullComposition.remass ?? 0) * 50;
                this.shipData.resources.cargo = containmentCapacity;
                this.shipData.resources.remass = remassCapacity;
            }
            this.ensureRoleAvailable(this.shipData.role);
            this.roleMode = this.shipData.customRole ? 'custom' : 'dropdown';
            
            this.syncFormFromData();
            this.createNodes();
            this.updateStats();
            this.updateSubclassState();
            this.notifyShipChildrenToRefresh();
        }
    }
}