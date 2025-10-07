// Ship design widget
class ShipWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('ship', 'New Ship Class', x, y, 400, 600);
        
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

        this.roleMode = 'dropdown';
        this.availableRoles = ShipWidget.loadStoredRoles(this.defaultRoles);
        this.ensureRoleAvailable(this.shipData.role);
        if (this.shipData.customRole) {
            this.roleMode = 'custom';
        }
        
        this.hullTypes = [
            'containment', 'remass', 'magazine', 'hangar', 
            'bunker', 'system', 'powerplant'
        ];
        // Order & keys for foundations checkboxes
        this.foundationKeys = [
            'structural', 'propulsion', 'power', 'heat', 'lifeSupport',
            'navigation', 'sensors', 'weapons', 'defense', 'logistics'
        ];
        
        this.lockedHullTotal = null;
        this.isSubclass = false;

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

    getParentShipWidget() {
        if (!this.parents || this.parents.size === 0) return null;
        if (!window.widgetManager) return null;
        for (const parentId of this.parents) {
            const parentWidget = window.widgetManager.getWidget(parentId);
            if (parentWidget && parentWidget.type === 'ship') {
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
        const noteEl = document.getElementById(`${this.id}-foundations-note`);
        if (!noteEl) return;
        if (isLocked) {
            const parentName = parentWidget?.shipData?.name || 'Parent Ship';
            noteEl.textContent = `Inherited from ${parentName}.`;
            noteEl.classList.add('locked');
        } else {
            noteEl.textContent = '';
            noteEl.classList.remove('locked');
        }
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
    }

    notifyShipChildrenToRefresh() {
        if (!this.children || this.children.size === 0 || !window.widgetManager) return;
        this.children.forEach(childId => {
            const childWidget = window.widgetManager.getWidget(childId);
            if (childWidget && childWidget.type === 'ship' && typeof childWidget.updateSubclassState === 'function') {
                childWidget.updateSubclassState();
            }
        });
    }

    onParentLinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.updateSubclassState();
        }
    }

    onParentUnlinked(parentWidget) {
        if (parentWidget?.type === 'ship') {
            this.updateSubclassState();
        }
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
        const roleOptions = this.generateRoleOptionsHTML(this.shipData.role);
        const roleInputValue = this.getRoleInputValue();

        contentElement.innerHTML = `
            <div class="ship-meta-header widget-sticky-header" id="${this.id}-meta-header">
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
            <div class="input-group role-group" id="${this.id}-role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role-select" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${roleOptions}
                    </select>
                    <input type="text" id="${this.id}-role-custom" class="role-input" placeholder="Enter custom role" value="${roleInputValue}" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''}>
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '✏️' : '🌳'}</button>
                </div>
            </div>
            <div class="input-group" id="${this.id}-notes-group">
                <label>Class Notes</label>
                <textarea id="${this.id}-class-notes" placeholder="Design notes, doctrine, or operational directives...">${this.shipData.designNotes}</textarea>
            </div>
            <div class="section-block foundations-section" id="${this.id}-foundations-section">
                <h4>Foundations</h4>
                <div class="foundations-grid">
                    ${this.foundationKeys.map(key => `
                        <label class="foundation-item">
                            <input type="checkbox" id="${this.id}-foundation-${key}" ${this.shipData.foundations[key] ? 'checked' : ''}>
                            ${key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}
                        </label>
                    `).join('')}
                </div>
                <div class="foundations-note" id="${this.id}-foundations-note"></div>
            </div>
            <div class="section-block composition-section" id="${this.id}-composition-section">
                <h4>Composition</h4>
                <div class="composition-grid">
                    ${this.hullTypes.map(hullType => `
                        <div class="composition-item">
                            <label>${hullType.charAt(0).toUpperCase() + hullType.slice(1)}</label>
                            <input type="number" class="hull-spin" data-hull="${hullType}" id="${this.id}-hull-${hullType}" min="0" step="1" value="${this.shipData.hullComposition[hullType]}">
                        </div>
                    `).join('')}
                </div>
                <div class="composition-total">
                    Total Hulls: <span id="${this.id}-hull-total">${this.getTotalHulls()}</span>
                </div>
                <div class="composition-note" id="${this.id}-composition-note"></div>
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
            { id: 'ship-meta', selector: `#${this.id}-meta-header` },
            { id: 'ship-name', selector: `#${this.id}-name-group` },
            { id: 'ship-role', selector: `#${this.id}-role-group` },
            { id: 'ship-notes', selector: `#${this.id}-notes-group` },
            { id: 'ship-foundations', selector: `#${this.id}-foundations-section` },
            { id: 'ship-composition', selector: `#${this.id}-composition-section` }
        ];

        anchorConfigs.forEach(({ id, selector, closest }) => {
            const element = this.element.querySelector(selector);
            if (element) {
                const anchorElement = closest ? (element.closest(closest) || element) : element;
                this.addLayoutAnchor(id, anchorElement, { selector, closest });
            }
        });

    }

    setupEventListeners() {
        super.setupEventListeners();
        
        // Prevent double-binding
        if (this._eventsBound) return;
        this._eventsBound = true;
        
        const nameInput = document.getElementById(`${this.id}-name`);
        const notesInput = document.getElementById(`${this.id}-class-notes`);
        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
    const dvpInput = document.getElementById(`${this.id}-dvp-cost`);
    const roleSelect = document.getElementById(`${this.id}-role-select`);
    const customRoleInput = document.getElementById(`${this.id}-role-custom`);
    const roleToggleBtn = document.getElementById(`${this.id}-role-toggle`);
    this.roleSelectElement = roleSelect;
    this.roleCustomInput = customRoleInput;
    this.roleToggleButton = roleToggleBtn;

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipData.name = e.target.value;
                this.updateTitle(this.shipData.name);
            });
        }
        if (notesInput) {
            notesInput.addEventListener('input', (e) => {
                this.shipData.designNotes = e.target.value;
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
                    this.roleToggleButton.textContent = '✏️';
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
            });
        }

        if (customRoleInput) {
            customRoleInput.addEventListener('input', (e) => {
                const value = e.target.value;
                this.shipData.customRole = value;
                this.shipData.role = value;
            });
            customRoleInput.addEventListener('change', (e) => {
                this.ensureRoleAvailable(e.target.value);
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
                this.updateHullDisplay();
                this.createNodes();
                this.updateStats();
                    this.notifyShipChildrenToRefresh();
            };
            input.addEventListener('input', (e) => updateHull(e.target.value));
            input.addEventListener('change', (e) => updateHull(e.target.value));
        });
    }
    
    updateHullDisplay() {
        this.hullTypes.forEach(hullType => {
            const countElement = document.getElementById(`${this.id}-hull-${hullType}`);
            if (countElement) {
                countElement.value = this.shipData.hullComposition[hullType];
            }
        });
        
        const totalElement = document.getElementById(`${this.id}-hull-total`);
        if (totalElement) {
            const total = this.getTotalHulls();
            if (this.lockedHullTotal != null) {
                totalElement.textContent = `${total} / ${this.lockedHullTotal}`;
                const totalWrapper = totalElement.parentElement;
                if (totalWrapper) {
                    totalWrapper.classList.toggle('mismatch', total !== this.lockedHullTotal);
                }
            } else {
                totalElement.textContent = total;
                const totalWrapper = totalElement.parentElement;
                if (totalWrapper) {
                    totalWrapper.classList.remove('mismatch');
                }
            }
        }

        const compositionNote = document.getElementById(`${this.id}-composition-note`);
        if (compositionNote) {
            if (this.lockedHullTotal != null) {
                const total = this.getTotalHulls();
                const delta = total - this.lockedHullTotal;
                if (delta === 0) {
                    compositionNote.textContent = `Locked to parent total of ${this.lockedHullTotal} hulls.`;
                    compositionNote.classList.remove('warning');
                } else if (delta > 0) {
                    compositionNote.textContent = `${delta} hull${delta === 1 ? '' : 's'} above parent total.`;
                    compositionNote.classList.add('warning');
                } else {
                    const deficit = Math.abs(delta);
                    compositionNote.textContent = `${deficit} hull${deficit === 1 ? '' : 's'} below parent total.`;
                    compositionNote.classList.add('warning');
                }
            } else {
                compositionNote.textContent = '';
                compositionNote.classList.remove('warning');
            }
        }
    }

    // switchTab removed - linear layout

    updateStats() {
        this.updateHullDisplay();
    }

    syncFormFromData() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.value = this.shipData.name || '';
        }

        const notesInput = document.getElementById(`${this.id}-class-notes`);
        if (notesInput) {
            notesInput.value = this.shipData.designNotes || '';
        }

        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        if (ignoreTechCheckbox) {
            ignoreTechCheckbox.checked = !!this.shipData.ignoreTechRequirements;
        }

        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        if (operationalCheckbox) {
            operationalCheckbox.checked = !!this.shipData.operational;
        }

        const dvpInput = document.getElementById(`${this.id}-dvp-cost`);
        if (dvpInput) {
            dvpInput.value = this.shipData.developmentCost ?? '';
        }

        this.foundationKeys.forEach(key => {
            const cb = document.getElementById(`${this.id}-foundation-${key}`);
            if (cb) {
                cb.checked = !!this.shipData.foundations[key];
            }
        });

        this.updateHullDisplay();

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

    updateNodes() { /* DOM node list removed in linear layout; retained for potential future use */ }

    createNodes() {
        if (this.nodes.size === 0) {
            // Parent input: connects from another ship class
            this.addNode('input', 'ship-class', 'Class', 0, 0.3, {
                anchorId: 'ship-meta',
                minSpacing: 36
            });

            // Child outputs
            this.addNode('output', 'outfit', 'Outfit', 1, 0.45, {
                anchorId: 'ship-composition',
                anchorOffset: -30,
                minSpacing: 32
            });

            this.addNode('output', 'loadout', 'Loadout', 1, 0.6, {
                anchorId: 'ship-composition',
                anchorOffset: 30,
                minSpacing: 32
            });

            this.addNode('output', 'statistics', 'Statistics', 1, 0.3, {
                anchorId: 'ship-meta',
                anchorOffset: 20,
                minSpacing: 32
            });

            this.addNode('output', 'ship-class', 'Subclass', 1, 0.8, {
                anchorId: 'ship-notes',
                anchorOffset: 40,
                minSpacing: 32
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