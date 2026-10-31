// Ship design widget
class ShipWidget extends DesignWidget {
    constructor(x = 100, y = 100) {
        super('ship', 'New Ship Class', x, y);
        
        this.defaultRoles = ShipWidget.getDefaultRoles();

        // Initialize ship class data
        this.shipData = {
            name: 'New Ship Class',
            role: 'corvette',
            customRole: '',
            description: '',
            appearance: '',
            text2imgPrompt: '',
            developmentCost: null,
            armorEfficiency: 3,
            hullComposition: {
                magazine: 0,
                hangar: 0,
                system: 0,
                emplacement: 0,
                core: 0,
                freight: 0,
                tankage: 0
            },
            containmentHulls: 0,
            // Ten foundational flags that may require tech
            foundations: {
                magazineDensity: false,
                hangarDensity: false,
                supplyRatingEfficiency: false,
                commonComplexArmour: false,
                biomechanicalRegeneration: false,
                intelligentMetamaterials: false,
                limitedLiveStructure: false,
                oracleInferencing: false,
                defensiveAtomicStructure: false,
                metamaterialForging: false
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
            ignoreRequiredTech: false,
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
            { key: 'emplacement', label: 'Emplacement' },
            { key: 'core', label: 'Core' }
        ];
        this.civilHullTypes = [
            { key: 'freight', label: 'Freight' },
            { key: 'tankage', label: 'Tankage' }
        ];
        this.hullTypes = [
            ...this.militaryHullTypes.map(({ key }) => key),
            ...this.civilHullTypes.map(({ key }) => key)
        ];
        this.compositionHullTypes = ['magazine', 'hangar', 'system', 'emplacement'];
        // Order & keys for foundations checkboxes
        this.foundationKeys = [
            'magazineDensity', 'hangarDensity', 'supplyRatingEfficiency', 'commonComplexArmour',
            'biomechanicalRegeneration', 'intelligentMetamaterials', 'limitedLiveStructure', 'oracleInferencing',
            'defensiveAtomicStructure', 'metamaterialForging'
        ];
        
        // Labels for foundations
        this.foundationLabels = {
            magazineDensity: 'Magazine Density',
            hangarDensity: 'Hangar Density',
            supplyRatingEfficiency: 'Supply Rating Efficiency',
            commonComplexArmour: 'Common Complex Armour',
            biomechanicalRegeneration: 'Biomechanical Regeneration',
            intelligentMetamaterials: 'Intelligent Metamaterials',
            limitedLiveStructure: 'Limited Live Structure',
            oracleInferencing: 'Oracle Inferencing',
            defensiveAtomicStructure: 'Defensive Atomic Structure',
            metamaterialForging: 'Metamaterial Forging'
        };
        
        this.lockedCompositionCapacity = null;
        this.isSubclass = false;
        this._preflightTimer = null;

        this.init();
    }

    get designData() {
        return this.shipData;
    }

    get defaultTitle() {
        return 'New Ship Class';
    }

    rename(name) {
        super.rename(name);
        this.queuePreflightCheck();
    }

    static getDefaultRoles() {
        return [
            'corvette', 'frigate', 'destroyer', 'cruiser', 'battleship',
            'dreadnought', 'carrier', 'fighter', 'bomber', 'scout',
            'transport', 'support'
        ];
    }

    static getRoleStorageKey() {
        return 'shipWidgetRoles';
    }

    static loadStoredRoles(defaultRoles = []) {
        try {
            const raw = localStorage.getItem(ShipWidget.getRoleStorageKey());
            if (!raw) return [...defaultRoles];
            const parsed = JSON.parse(raw);
            if (parsed && !Array.isArray(parsed) && parsed.replaceDefaults === true &&
                Array.isArray(parsed.roles)) {
                return Array.from(new Set(parsed.roles.filter(role => typeof role === 'string')))
                    .sort((a, b) => a.localeCompare(b));
            }
            const stored = Array.isArray(parsed) ? parsed : [];
            return Array.from(new Set([...defaultRoles, ...stored])).sort((a, b) => a.localeCompare(b));
        } catch (error) {
            console.warn('Unable to load stored ship roles', error);
            return [...defaultRoles];
        }
    }

    static saveStoredRoles(roles = []) {
        try {
            localStorage.setItem(ShipWidget.getRoleStorageKey(), JSON.stringify({
                roles: Array.from(new Set(roles.filter(role => typeof role === 'string'))),
                replaceDefaults: true
            }));
        } catch (err) {
            console.warn('Unable to persist ship roles', err);
        }
    }

    static setStoredRoles(roles) {
        if (!Array.isArray(roles)) return;
        ShipWidget.saveStoredRoles(roles);
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

    static escapeRoleHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    generateRoleOptionsHTML(selectedRole) {
        return this.availableRoles
            .sort((a, b) => a.localeCompare(b))
            .map(role => `<option value="${ShipWidget.escapeRoleHTML(role)}" ${selectedRole === role ? 'selected' : ''}>${ShipWidget.escapeRoleHTML(this.formatRoleLabel(role))}</option>`)
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
            const widgets = window.widgetManager?.getAllWidgets?.() || [];
            if (!widgets.includes(this)) widgets.push(this);
            for (const widget of widgets) {
                if (widget.type !== 'ship') continue;
                widget.availableRoles = [...this.availableRoles];
                widget.populateRoleSelect(widget.roleSelectElement, widget.shipData.role);
            }
        }
    }

    removeRolePreset(role) {
        const removedRole = typeof role === 'string' ? role.trim() : '';
        if (!removedRole || !this.availableRoles.includes(removedRole)) return;
        const roles = this.availableRoles.filter(availableRole => availableRole !== removedRole);
        ShipWidget.saveStoredRoles(roles);

        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        if (!widgets.includes(this)) widgets.push(this);
        for (const widget of widgets) {
            if (widget.type !== 'ship') continue;
            widget.availableRoles = [...roles];
            const activeRole = widget.roleMode === 'custom'
                ? widget.roleCustomInput?.value.trim() || widget.shipData.customRole || widget.shipData.role
                : widget.shipData.role;
            if (activeRole === removedRole) {
                widget.shipData.role = roles[0] || '';
                widget.shipData.customRole = '';
                widget.roleMode = 'dropdown';
            }
            widget.populateRoleSelect(widget.roleSelectElement, widget.shipData.role);
            widget.applyRoleMode(widget.roleMode);
            widget.queuePreflightCheck();
            widget.notifyShipDataChanged();
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
            if (parentWidget?.type === 'ship') {
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
            const previousCompositionTotal = this.getCompositionHullTotal();
            const previousCore = this.shipData.hullComposition.core;
            this.isSubclass = true;
            this.lockedCompositionCapacity = parentShip.getCompositionHullTotal();
            this.shipData.hullComposition.core = parentShip.shipData.hullComposition.core || 0;
            this.enforceCompositionCapacity();
            this.syncFoundationsFromParent(parentShip);
            this.setFoundationsLocked(true, parentShip);
            if (previousCompositionTotal !== this.getCompositionHullTotal() ||
                previousCore !== this.shipData.hullComposition.core) {
                this.notifyShipChildrenToRefresh();
            }
        } else {
            this.isSubclass = false;
            this.lockedCompositionCapacity = null;
            this.setFoundationsLocked(false);
        }
        this.updateHullDisplay();
        this.queuePreflightCheck();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        const node = this.nodes.get(nodeId);
        if (node && node.nodeType === 'Class') {
            this.updateSubclassState();
        }
    }

    notifyShipChildrenToRefresh() {
        if (this.children && this.children.size > 0 && window.widgetManager) {
            this.children.forEach(childId => {
                const childWidget = window.widgetManager.getWidget(childId);
                if (childWidget?.type === 'ship' && typeof childWidget.updateSubclassState === 'function') {
                    childWidget.updateSubclassState();
                }
            });
        }
        this.queuePreflightCheck();
    }
    
    notifyOutfitChildrenToRefresh(methodName = 'handleParentRequiredTechChange') {
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
            if (this.minimized) this.toggleMinimize();
            if (window.widgetManager) {
                for (const childId of parentWidget.children) {
                    const child = window.widgetManager.getWidget(childId);
                    if (child?.type === 'outfit' && !child.minimized) child.toggleMinimize();
                }
            }
            if (!parentWidget.minimized) parentWidget.toggleMinimize();
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

    notifyShipDataChanged() {
        this.updateClassCostDisplay();
        console.log(`[ShipWidget ${this.id}] Data changed, notifying all children...`);
        this.notifyChildrenOfChange();
    }

    getClassCost() {
        const hullCosts = {
            core: 5,
            emplacement: 3,
            freight: 1,
            hangar: 3,
            magazine: 3,
            tankage: 1,
            system: 5
        };
        const composition = this.shipData.hullComposition || {};
        const hullCost = Object.entries(hullCosts).reduce((total, [hullType, unitCost]) => {
            const count = Math.max(0, Number(composition[hullType]) || 0);
            return total + count * unitCost;
        }, 0);
        const remassCapacity = Math.max(0, Number(this.shipData.resources?.remass) || 0);
        const total = Math.round(hullCost + remassCapacity * 0.6378);

        return {
            combatValue: total,
            industryCost: total
        };
    }

    getCostTotals() {
        const classCost = this.getClassCost();
        return window.empire?.economyMode === 'campaign'
            ? { IP: classCost.industryCost }
            : { CV: classCost.combatValue };
    }

    updateClassCostDisplay() {
        const classCost = this.getClassCost();
        this.shipData.classCost = classCost;

        this.setHeaderMetric('cost', '', this.formatCostTotals(this.getCostTotals()));
        this.refreshDevelopmentMetric();

        return classCost;
    }

    getTotalHulls() {
        this.queuePreflightCheck();
        return Object.values(this.shipData.hullComposition).reduce((sum, count) => sum + count, 0);
    }

    getCompositionHullTotal() {
        return this.compositionHullTypes.reduce(
            (sum, type) => sum + Math.max(0, Number(this.shipData.hullComposition[type]) || 0),
            0
        );
    }

    enforceCompositionCapacity() {
        if (this.lockedCompositionCapacity === null) return;
        let remaining = this.lockedCompositionCapacity;
        for (const hullType of this.compositionHullTypes) {
            const current = Math.max(0, Number(this.shipData.hullComposition[hullType]) || 0);
            const allowed = Math.min(current, remaining);
            this.shipData.hullComposition[hullType] = allowed;
            remaining -= allowed;
        }
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
        const informationSection = this.createDesignSection('information', '');
        const roleOptions = this.generateRoleOptionsHTML(this.shipData.role);
        const roleInputValue = this.getRoleInputValue();
        
        this.setSectionContent(informationSection, `
            <div class="ship-information-header" id="${this.id}-information-header">
                ${this.renderFlags()}
            </div>
            <div class="input-group information-group" id="${this.id}-role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role-select" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${roleOptions}
                    </select>
                    <input type="text" id="${this.id}-role-custom" class="role-input" placeholder="Enter custom role" value="${roleInputValue}" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''}>
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '🖉' : '🌳'}</button>
                    <button type="button" class="widget-remove-action" id="${this.id}-role-remove" title="Remove current role preset" aria-label="Remove current role preset">−</button>
                </div>
            </div>
        `);
        sectionsContainer.appendChild(informationSection.section);
        
        // Create Foundations section
        const foundationsSection = this.createDesignSection('foundations', 'Foundations');
        const foundationsContent = foundationsSection.contentContainer;
        foundationsContent.classList.add('foundations-section');
        foundationsContent.id = `${this.id}-foundations-section`;
        this.setSectionContent(foundationsSection, `
            <div class="design-option-list">
                ${this.foundationKeys.map(key => `
                    <label class="foundation-item design-option">
                        <input type="checkbox" id="${this.id}-foundation-${key}" ${this.shipData.foundations[key] ? 'checked' : ''}>
                        ${this.foundationLabels[key]}
                    </label>
                `).join('')}
            </div>
        `);
        sectionsContainer.appendChild(foundationsSection.section);
        
        // Create Composition section
        const compositionSection = this.createDesignSection('composition', 'Composition');
        const compositionContent = compositionSection.contentContainer;
        compositionContent.classList.add('composition-section');
        compositionContent.id = `${this.id}-composition-section`;
        compositionSection.titleElement.classList.add('composition-title');
        const compositionCounter = document.createElement('span');
        compositionCounter.className = 'outfit-resource-counter';
        compositionCounter.id = `${this.id}-composition-resource`;
        compositionCounter.setAttribute('aria-label', 'Composition hulls used / available');
        const compositionUsed = document.createElement('span');
        compositionUsed.className = 'outfit-resource-used';
        const compositionCapacity = document.createElement('span');
        compositionCapacity.className = 'outfit-resource-capacity';
        compositionCounter.append(
            compositionUsed,
            document.createTextNode(' / '),
            compositionCapacity
        );
        compositionSection.titleElement.appendChild(compositionCounter);
        const containmentHullInput = `
            <div class="composition-item">
                <label for="${this.id}-containment-hulls">Containment</label>
                <input type="number" class="hull-spin" id="${this.id}-containment-hulls" min="0" step="1" value="${this.getCivilHullSlots()}">
            </div>
        `;
        const militaryHullInputs = this.militaryHullTypes.map(({ key, label }) => `
            ${key === 'core' ? containmentHullInput : ''}
            <div class="composition-item">
                <label for="${this.id}-hull-${key}">${label}</label>
                <input type="number" class="hull-spin" data-hull="${key}" id="${this.id}-hull-${key}" min="0" step="1" value="${this.shipData.hullComposition[key] ?? 0}">
                ${key === 'core' ? `<output class="composition-value class-core-value" id="${this.id}-core-hull-value" aria-label="Core hull count"></output>` : ''}
            </div>
        `).join('');
        const civilHullInputs = this.civilHullTypes.map(({ key, label }) => `
            <div class="composition-item">
                <label>${label}</label>
                <output class="composition-value" id="${this.id}-hull-${key}" aria-label="${label} hull count">${this.shipData.hullComposition[key] ?? 0}</output>
            </div>
        `).join('');
        const cargoValue = this.shipData.resources?.cargo ?? 0;
        const remassValue = this.shipData.resources?.remass ?? 0;
        this.setSectionContent(compositionSection, `
            <div class="composition-group military-hulls">
                <div class="composition-grid">
                    ${militaryHullInputs}
                </div>
            </div>
            <div class="containment-relationship" aria-hidden="true">
                <span class="containment-relationship-stem"></span>
                <span class="containment-relationship-branch"></span>
                <span class="containment-relationship-child containment-relationship-child-left"></span>
                <span class="containment-relationship-child containment-relationship-child-right"></span>
            </div>
            <div class="composition-group civil-hulls">
                <div class="composition-grid">
                    ${civilHullInputs}
                </div>
            </div>
            <div class="cargo-remass-control" id="${this.id}-cargo-remass-control">
                <div class="cargo-endurance">
                    <span class="label">Cargo</span>
                    <input type="number" class="value cargo-remass-value" id="${this.id}-cargo-value" min="0" step="1" value="${cargoValue}" aria-label="Cargo allocation">
                </div>
                <input type="range" class="cargo-remass-slider" id="${this.id}-cargo-remass-slider" min="0" max="0" value="${cargoValue}" step="1" aria-label="Cargo and Remass allocation">
                <div class="remass-burns">
                    <span class="label">Remass</span>
                    <input type="number" class="value cargo-remass-value" id="${this.id}-remass-value" min="0" step="1" value="${remassValue}" aria-label="Remass allocation">
                </div>
            </div>
        `);
        sectionsContainer.appendChild(compositionSection.section);
        
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
        
        const operationalCheckbox = getElement(`${this.id}-operational`);
        const roleSelect = getElement(`${this.id}-role-select`);
        const customRoleInput = getElement(`${this.id}-role-custom`);
        const roleToggleBtn = getElement(`${this.id}-role-toggle`);
        const roleRemoveBtn = getElement(`${this.id}-role-remove`);
        this.roleSelectElement = roleSelect;
        this.roleCustomInput = customRoleInput;
        this.roleToggleButton = roleToggleBtn;

        if (operationalCheckbox) {
            operationalCheckbox.addEventListener('change', () => {
                this.queuePreflightCheck();
            });
        }
        this.setupFlagListeners(() => {
            this.queuePreflightCheck();
            this.notifyShipDataChanged();
        });

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
                this.notifyShipDataChanged();
            });
        }

        if (customRoleInput) {
            customRoleInput.addEventListener('input', (e) => {
                const value = e.target.value;
                this.shipData.customRole = value;
                this.shipData.role = value;
                this.queuePreflightCheck();
                this.notifyShipDataChanged();
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
                this.notifyShipDataChanged();
            });
        }

        if (roleRemoveBtn) {
            roleRemoveBtn.addEventListener('click', () => {
                const role = this.roleMode === 'custom'
                    ? this.roleCustomInput?.value.trim() || this.shipData.customRole || this.shipData.role
                    : this.roleSelectElement?.value || this.shipData.role;
                this.removeRolePreset(role);
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
        const hullInputs = this.element.querySelectorAll('.hull-spin[data-hull]');
        hullInputs.forEach(input => {
            const updateHull = (value) => {
                const hullType = input.dataset.hull;
                if (this.isSubclass && hullType === 'core') {
                    this.updateSubclassState();
                    return;
                }
                let parsed = Math.max(0, parseInt(value, 10) || 0);
                if (this.isSubclass && this.compositionHullTypes.includes(hullType)) {
                    const otherUsage = this.getCompositionHullTotal() -
                        (Number(this.shipData.hullComposition[hullType]) || 0);
                    parsed = Math.min(parsed, Math.max(0, this.lockedCompositionCapacity - otherUsage));
                }
                this.shipData.hullComposition[hullType] = parsed;
                input.value = parsed;

                this.reflowNodes();
                this.updateStats();
                this.notifyShipChildrenToRefresh();
                this.notifyShipDataChanged();
            };
            input.addEventListener('input', (e) => updateHull(e.target.value));
            input.addEventListener('change', (e) => updateHull(e.target.value));
        });

        const containmentInput = document.getElementById(`${this.id}-containment-hulls`);
        if (containmentInput) {
            const updateContainment = () => {
                this.shipData.containmentHulls = Math.max(0, parseInt(containmentInput.value, 10) || 0);
                containmentInput.value = this.shipData.containmentHulls;
                this.updateCargoRemassAllocation(this.shipData.resources?.cargo || 0);
                this.updateStats();
                this.reflowNodes();
                this.notifyShipChildrenToRefresh();
                this.notifyShipDataChanged();
            };
            containmentInput.addEventListener('input', updateContainment);
            containmentInput.addEventListener('change', updateContainment);
        }

        const cargoRemassSlider = document.getElementById(`${this.id}-cargo-remass-slider`);
        if (cargoRemassSlider) {
            const getCargoValue = (value) => {
                const parsedValue = parseInt(value, 10);
                return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
            };
            const handleSliderInput = (value) => {
                const previousFreight = this.shipData.hullComposition.freight;
                const previousTankage = this.shipData.hullComposition.tankage;
                this.updateCargoRemassAllocation(getCargoValue(value));
                this.updateCargoRemassReadouts();
                if (this.shipData.hullComposition.freight !== previousFreight ||
                    this.shipData.hullComposition.tankage !== previousTankage) {
                    this.updateHullDisplay();
                }
            };
            const handleValueInput = (value, allocation) => {
                const parsedValue = parseInt(value, 10);
                if (!Number.isFinite(parsedValue) || parsedValue < 0) return;

                const capacity = this.getCivilHullSlots() * 50;
                const clampedValue = Math.min(parsedValue, capacity);
                const cargo = allocation === 'cargo' ? clampedValue : capacity - clampedValue;
                const previousFreight = this.shipData.hullComposition.freight;
                const previousTankage = this.shipData.hullComposition.tankage;
                this.updateCargoRemassAllocation(cargo);
                cargoRemassSlider.value = this.shipData.resources.cargo;

                const editedInput = document.getElementById(`${this.id}-${allocation}-value`);
                if (editedInput && clampedValue !== parsedValue) {
                    editedInput.value = clampedValue;
                }
                const counterpartAllocation = allocation === 'cargo' ? 'remass' : 'cargo';
                const counterpartInput = document.getElementById(`${this.id}-${counterpartAllocation}-value`);
                if (counterpartInput) {
                    counterpartInput.value = this.shipData.resources[counterpartAllocation];
                }

                if (this.shipData.hullComposition.freight !== previousFreight ||
                    this.shipData.hullComposition.tankage !== previousTankage) {
                    this.updateHullDisplay();
                }
            };
            const handleSliderChange = (value) => {
                this.updateCargoRemassAllocation(getCargoValue(value));
                this.reflowNodes();
                this.updateStats();
                this.notifyShipChildrenToRefresh();
                this.notifyShipDataChanged();
            };
            cargoRemassSlider.addEventListener('input', (e) => handleSliderInput(e.target.value));
            cargoRemassSlider.addEventListener('change', (e) => handleSliderChange(e.target.value));

            ['cargo', 'remass'].forEach((allocation) => {
                const input = document.getElementById(`${this.id}-${allocation}-value`);
                if (!input) return;

                input.addEventListener('input', () => handleValueInput(input.value, allocation));
                input.addEventListener('change', () => {
                    handleValueInput(input.value, allocation);
                    this.reflowNodes();
                    this.updateStats();
                    this.notifyShipChildrenToRefresh();
                    this.notifyShipDataChanged();
                });
            });
        }
    }
    
    updateHullDisplay() {
        this.hullTypes.forEach(hullType => {
            const countElement = document.getElementById(`${this.id}-hull-${hullType}`);
            if (countElement) {
                const count = this.shipData.hullComposition[hullType] ?? 0;
                if (countElement instanceof HTMLInputElement) {
                    countElement.value = count;
                    if (hullType === 'core') {
                        countElement.hidden = this.isSubclass;
                        countElement.disabled = this.isSubclass;
                    }
                } else {
                    countElement.textContent = count;
                }
            }
        });
        const coreValue = this.element?.querySelector('.class-core-value');
        if (coreValue) {
            coreValue.textContent = String(this.shipData.hullComposition.core ?? 0);
            coreValue.hidden = !this.isSubclass;
        }
        const compositionCounter = this.element?.querySelector('.outfit-resource-counter');
        if (compositionCounter) {
            compositionCounter.hidden = !this.isSubclass;
            compositionCounter.querySelector('.outfit-resource-used').textContent =
                String(this.getCompositionHullTotal());
            compositionCounter.querySelector('.outfit-resource-capacity').textContent =
                String(this.lockedCompositionCapacity ?? 0);
        }
        const containmentInput = document.getElementById(`${this.id}-containment-hulls`);
        if (containmentInput) containmentInput.value = this.getCivilHullSlots();

        // Composition totals and notes are no longer displayed; locking logic remains internal.
    }

    getCivilHullSlots() {
        return this.shipData.containmentHulls ??
            ((this.shipData.hullComposition.freight ?? 0) + (this.shipData.hullComposition.tankage ?? 0));
    }

    // Translate cargo allocation into hull counts and the remaining remass capacity.
    updateCargoRemassAllocation(rawCargoValue) {
        if (!this.shipData.resources) {
            this.shipData.resources = { cargo: 0, remass: 0 };
        }

        const totalSlots = this.getCivilHullSlots();
        if (totalSlots <= 0) {
            this.shipData.resources.cargo = 0;
            this.shipData.resources.remass = 0;
            this.shipData.hullComposition.freight = 0;
            this.shipData.hullComposition.tankage = 0;
            return;
        }

        const capacity = totalSlots * 50;
        const cargo = Math.max(0, Math.min(rawCargoValue, capacity));
        this.shipData.resources.cargo = cargo;
        const freightHulls = Math.min(totalSlots, Math.ceil(cargo / 50));
        const tankageHulls = totalSlots - freightHulls;
        this.shipData.resources.remass = capacity - cargo;
        this.shipData.containmentHulls = totalSlots;
        this.shipData.hullComposition.freight = freightHulls;
        this.shipData.hullComposition.tankage = tankageHulls;
    }

    // Sync the cargo/remass slider and readouts with current allocation and capacity.
    updateCargoRemassUI() {
        if (!this.shipData.resources) {
            this.shipData.resources = { cargo: 0, remass: 0 };
        }

        const slider = document.getElementById(`${this.id}-cargo-remass-slider`);
        const cargoInput = document.getElementById(`${this.id}-cargo-value`);
        const remassInput = document.getElementById(`${this.id}-remass-value`);
        const totalSlots = this.getCivilHullSlots();
        const capacity = totalSlots * 50;
        const currentCargo = this.shipData.resources.cargo ?? 0;
        const cargo = Math.max(0, Math.min(currentCargo, capacity));
        this.updateCargoRemassAllocation(cargo);

        if (slider) {
            slider.max = capacity;
            slider.value = cargo;
            slider.disabled = capacity === 0;
        }

        [cargoInput, remassInput].forEach((input) => {
            if (!input) return;
            input.max = capacity;
            input.disabled = capacity === 0;
        });

        this.updateCargoRemassReadouts();
    }

    updateCargoRemassReadouts() {
        const cargoValueElement = document.getElementById(`${this.id}-cargo-value`);
        const remassValueElement = document.getElementById(`${this.id}-remass-value`);
        const cargo = this.shipData.resources?.cargo ?? 0;
        const remass = this.shipData.resources?.remass ?? 0;

        if (cargoValueElement) {
            cargoValueElement.value = cargo;
        }

        if (remassValueElement) {
            remassValueElement.value = remass;
        }
    }

    // switchTab removed - linear layout

    updateStats() {
        this.updateCargoRemassUI();
        this.updateHullDisplay();
        this.updateClassCostDisplay();
        this.queuePreflightCheck();
    }

    refresh() {
        if (!this.element) return;
        this.syncFormFromData();
        this.updateStats();
        this.refreshSummary();
        this.notifyShipChildrenToRefresh();
    }

    syncFormFromData() {
        const simpleFields = {
            'ignoreRequiredTech': { id: 'ignore-required-tech', type: 'checkbox' },
            'operational': { id: 'operational', type: 'checkbox' }
        };
        this.syncDataToFields(this.shipData, simpleFields);
        this.updateTitle(this.shipData.name);

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
            'ignoreRequiredTech': { id: 'ignore-required-tech', type: 'checkbox' },
            'operational': { id: 'operational', type: 'checkbox' }
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
                if (this.isSubclass && hullType === 'core') return;
                const input = document.getElementById(`${this.id}-hull-${hullType}`);
                if (input) {
                    const value = parseInt(input.value, 10);
                    this.shipData.hullComposition[hullType] = Number.isFinite(value) && value >= 0 ? value : 0;
                }
            });
        }

        // Handle containment allocation
        const containmentInput = document.getElementById(`${this.id}-containment-hulls`);
        if (containmentInput) {
            const value = parseInt(containmentInput.value, 10);
            this.shipData.containmentHulls = Number.isFinite(value) && value >= 0 ? value : 0;
        }
        const cargoSlider = document.getElementById(`${this.id}-cargo-remass-slider`);
        if (cargoSlider) {
            const cargoValue = parseInt(cargoSlider.value, 10);
            const cargo = Number.isFinite(cargoValue) && cargoValue >= 0 ? cargoValue : 0;
            this.updateCargoRemassAllocation(cargo);
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
                if ('optional' in options) {
                    existing.optional = !!options.optional;
                    this.getNodeDomElement(nodeId)?.classList.toggle('optional', existing.optional);
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
            classOutput: `${this.id}-node-output-class`
        };

        ensureNode('input', 'Class', 'Class', 0, 0.25, {
            nodeId: nodeIds.classInput,
            anchorId: 'ship-information',
            sectionId: 'information',
            minSpacing: 36,
            optional: true
        });

        ensureNode('output', 'Class', 'Class', 1, 0.25, {
            nodeId: nodeIds.classOutput,
            anchorId: 'ship-information',
            sectionId: 'information',
            anchorOffset: 20,
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
        if (data.ignoreRequiredTech) {
            badges.appendChild(this.createBadge('Ignores Required Tech', 'warning'));
        }

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'summary-grid';

        const roleLabel = this.formatRoleLabel(this.getRoleInputValue()) || '—';
        const hullSummary = this.formatHullSummary();
        const foundationSummary = this.formatFoundations();
        const classCost = this.getClassCost();
        const isCampaign = window.empire?.economyMode === 'campaign';
        const classCostValue = isCampaign ? classCost.industryCost : classCost.combatValue;
        const classCostUnit = isCampaign ? 'IP' : 'CV';

        const fields = [
            { label: 'Role', value: roleLabel },
            { label: 'DvP Cost', value: this.formatOptionalNumber(data.developmentCost) },
            {
                label: 'Class Cost',
                value: `${classCostValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${classCostUnit}`
            },
            { label: 'Hull Sections', value: hullSummary },
            { label: 'Cargo', value: this.formatOptionalNumber(resources.cargo) },
            { label: 'Remass', value: this.formatOptionalNumber(resources.remass) },
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
        this.updateClassCostDisplay();
        return {
            ...super.getSerializedData(),
            shipData: this.shipData
        };
    }

    updateTitle(text = this.shipData.name) {
        this.title = text || this.defaultTitle;
        if (this.titleElement && !this.titleEditor) {
            this.titleElement.textContent = this.title;
        }
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        const incoming = data.shipData;
        if (!incoming || typeof incoming !== 'object') return;

        const pickFields = (source, fields) => Object.fromEntries(
            fields.filter(key => Object.prototype.hasOwnProperty.call(source || {}, key))
                .map(key => [key, source[key]])
        );
        const currentFields = [
            'name', 'role', 'customRole', 'description', 'designNotes', 'appearance',
            'text2imgPrompt', 'developmentCost', 'armorEfficiency', 'containmentHulls',
            'operational', 'ignoreRequiredTech'
        ];
        this.shipData = {
            ...this.shipData,
            ...pickFields(incoming, currentFields),
            hullComposition: {
                ...this.shipData.hullComposition,
                ...pickFields(incoming.hullComposition, this.hullTypes)
            },
            foundations: {
                ...this.shipData.foundations,
                ...pickFields(incoming.foundations, this.foundationKeys)
            },
            powerAndPropulsion: {
                ...this.shipData.powerAndPropulsion,
                ...pickFields(incoming.powerAndPropulsion, [
                    'thrust', 'burnRating', 'heatEfficiency', 'supplyRating'
                ])
            },
            heatManagement: {
                ...this.shipData.heatManagement,
                ...pickFields(incoming.heatManagement, ['capacity', 'dissipation']),
                thresholds: {
                    ...this.shipData.heatManagement.thresholds,
                    ...pickFields(incoming.heatManagement?.thresholds, [
                        'warning', 'critical', 'maximum'
                    ])
                }
            },
            resources: {
                ...this.shipData.resources,
                ...pickFields(incoming.resources, ['cargo', 'remass'])
            }
        };
        this.ensureRoleAvailable(this.shipData.role);
        this.roleMode = this.shipData.customRole ? 'custom' : 'dropdown';

        this.syncFormFromData();
        this.createNodes();
        this.updateStats();
        this.updateSubclassState();
        this.notifyShipChildrenToRefresh();
    }
}