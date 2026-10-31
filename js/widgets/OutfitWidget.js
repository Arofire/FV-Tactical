// Outfit configuration for a Ship Class, with core-derived resources.
class OutfitWidget extends DesignWidget {
    static QUANTUM_SYSTEM_IDS = ['targeting', 'command', 'navigation'];

    static calculateEntropyBands(entropyCapacity, radiatorOffset = 0) {
        if (!Number.isFinite(entropyCapacity) || entropyCapacity < 0 ||
            !Number.isFinite(radiatorOffset)) {
            return null;
        }
        return Array.from({ length: 6 }, (_, index) => {
            const base = Math.min(
                entropyCapacity,
                Math.max(1, Math.round(entropyCapacity * (index + 1) / 6))
            );
            return Math.min(
                entropyCapacity,
                Math.max(0, base + radiatorOffset * (index + 1))
            );
        });
    }

    static combineEntropyAnalyses(analyses = []) {
        const valid = analyses.filter(analysis =>
            Number.isFinite(analysis?.totalEntropy) && analysis.totalEntropy >= 0
        );
        if (!valid.length) return null;
        const totalEntropy = valid.reduce((total, analysis) =>
            total + analysis.totalEntropy, 0);
        const radiatorOffset = valid.reduce((total, analysis) =>
            total + (Number.isFinite(analysis.radiatorOffset) ? analysis.radiatorOffset : 0), 0);
        return {
            totalEntropy,
            entropyBands: OutfitWidget.calculateEntropyBands(totalEntropy, radiatorOffset)
        };
    }

    static calculateGearBurnMetrics(hullCount, baseEngineExponent, instability) {
        const hulls = Number(hullCount);
        const baseExponent = Number(baseEngineExponent);
        const instabilityValue = Number(instability);
        if (![hulls, baseExponent, instabilityValue].every(Number.isFinite) ||
            hulls <= 0 || baseExponent <= 0 || instabilityValue < 0) {
            return null;
        }

        const engineExponent = hulls < 28
            ? baseExponent
            : 1 + (baseExponent - 1) / (1 + 0.8 * Math.log(hulls / 28));
        const thrustPenalty = hulls < 28 ? 1 : 1 + (hulls - 28) / 56;
        if (!Number.isFinite(engineExponent) || engineExponent === 0 ||
            !Number.isFinite(thrustPenalty) || thrustPenalty <= 0) {
            return null;
        }

        const useful = Math.pow(instabilityValue, 1 / engineExponent);
        if (!Number.isFinite(useful) || useful < 0) return null;
        const entropy = Math.ceil(instabilityValue - useful);
        if (!Number.isFinite(entropy) || entropy < 0) return null;
        const thrustRequired = hulls * thrustPenalty;
        return {
            engineExponent,
            thrustPenalty,
            thrustRequired,
            useful,
            entropy,
            remassPerBurn: useful > 0 ? Math.ceil(thrustRequired / useful) : null
        };
    }

    constructor(x = 550, y = 120) {
        super('outfit', 'New Outfit', x, y);
        this.defaultRoles = OutfitWidget.getDefaultRoles();
        this.availableRoles = OutfitWidget.loadStoredRoles(this.defaultRoles);
        this.outfitData = {
            name: 'New Outfit',
            role: 'Artillery',
            customRole: '',
            roleMode: 'dropdown',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            coreWidgetId: '',
            resources: {
                utilities: null,
                emplacements: null,
                systems: null,
                hardpoints: null,
                core: null,
                containmentHulls: null
            },
            initiative: null,
            defenses: {
                armor: 0
            },
            utilityDevices: {
                radiators: [],
                defenses: []
            },
            systems: {
                general: {
                    berthing: 0,
                    berthingCargo: 0,
                    craftLauncher: 0,
                    laserGenerator: { techId: '', count: 0 },
                    tending: 0
                },
                entropy: {},
                quantum: {
                    targeting: 0,
                    command: 0,
                    navigation: 0
                }
            },
            resourceUse: {
                utilities: 0,
                emplacements: 0,
                systems: 0,
                hardpoints: 0,
                core: 0
            },
            selectedCore: null,
            weapons: {
                spinal: '',
                offensive: [],
                defensive: []
            }
        };
        this.weaponsData = { categories: [] };
        this.weaponsDataLoaded = false;
        this.utilitiesData = { radiators: [], defenses: [] };
        this.utilitiesDataLoaded = false;
        this.systemsData = { general: [], entropy: [], quantum: [] };
        this.systemsDataLoaded = false;
        this.laserGeneratorTechs = [];
        this.userToggledCategoryIds = new Set();
        this.ensureRoleAvailable(this.outfitData.role);
        this.init();
        this.onEconomyModeChanged();
        this.loadWeaponsData();
        this.loadUtilitiesData();
        this.loadSystemsData();
        ShipCoreWidget.loadOptions()
            .then(() => this.refreshResourceDisplay())
            .catch(error => this.reportCatalogueError('Ship core catalogue (data/ship-cores.json)', error));
    }

    get designData() {
        return this.outfitData;
    }

    get defaultTitle() {
        return 'New Outfit';
    }

    static getDefaultRoles() {
        return [
            'Artillery', 'Brawler', 'Lancer', 'QWarfare', 'Scout',
            'Support', 'Escort', 'Carrier', 'Interceptor'
        ];
    }

    static getRoleStorageKey() {
        return 'outfitWidgetRoles';
    }

    static loadStoredRoles(defaultRoles = []) {
        try {
            const raw = localStorage.getItem(OutfitWidget.getRoleStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
            if (parsed && !Array.isArray(parsed) && parsed.replaceDefaults === true &&
                Array.isArray(parsed.roles)) {
                return Array.from(new Set(parsed.roles.filter(role => typeof role === 'string')))
                    .sort((a, b) => a.localeCompare(b));
            }
            return Array.isArray(parsed)
                ? Array.from(new Set([...defaultRoles, ...parsed])).sort((a, b) => a.localeCompare(b))
                : [...defaultRoles];
        } catch (error) {
            console.warn('Unable to load stored outfit roles', error);
            return [...defaultRoles];
        }
    }

    static saveStoredRoles(roles = []) {
        try {
            localStorage.setItem(OutfitWidget.getRoleStorageKey(), JSON.stringify({
                roles: Array.from(new Set(roles.filter(role => typeof role === 'string'))),
                replaceDefaults: true
            }));
        } catch (error) {
            console.warn('Unable to persist stored outfit roles', error);
        }
    }

    static setStoredRoles(roles) {
        if (!Array.isArray(roles)) return;
        OutfitWidget.saveStoredRoles(roles);
    }

    static escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    ensureRoleAvailable(role) {
        const normalized = typeof role === 'string' ? role.trim() : '';
        if (normalized && !this.availableRoles.includes(normalized)) {
            this.availableRoles.push(normalized);
            this.availableRoles.sort((a, b) => a.localeCompare(b));
            OutfitWidget.saveStoredRoles(this.availableRoles);
            const widgets = window.widgetManager?.getAllWidgets?.() || [];
            if (!widgets.includes(this)) widgets.push(this);
            for (const widget of widgets) {
                if (widget.type !== 'outfit') continue;
                widget.availableRoles = [...this.availableRoles];
                const roleSelect = widget.element?.querySelector(`#${widget.id}-role`);
                if (roleSelect) {
                    roleSelect.innerHTML = widget.getRoleOptions();
                    roleSelect.value = widget.outfitData.role;
                }
            }
        }
    }

    removeRolePreset(role) {
        const removedRole = typeof role === 'string' ? role.trim() : '';
        if (!removedRole || !this.availableRoles.includes(removedRole)) return;
        const roles = this.availableRoles.filter(availableRole => availableRole !== removedRole);
        OutfitWidget.saveStoredRoles(roles);

        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        if (!widgets.includes(this)) widgets.push(this);
        for (const widget of widgets) {
            if (widget.type !== 'outfit') continue;
            widget.availableRoles = [...roles];
            const activeRole = widget.outfitData.roleMode === 'custom'
                ? widget.element?.querySelector(`#${widget.id}-custom-role`)?.value.trim() ||
                    widget.outfitData.customRole || widget.outfitData.role
                : widget.outfitData.role;
            if (activeRole === removedRole) {
                widget.outfitData.role = roles[0] || '';
                widget.outfitData.customRole = '';
                widget.outfitData.roleMode = 'dropdown';
            }
            widget.applyRoleMode(widget.outfitData.roleMode);
            widget.onOutfitDataChanged();
            widget.refreshSummary();
        }
    }

    getRoleInputValue() {
        return this.outfitData.roleMode === 'custom'
            ? this.outfitData.customRole || this.outfitData.role || ''
            : this.outfitData.role || '';
    }

    applyRoleMode(mode) {
        this.outfitData.roleMode = mode;
        const roleSelect = this.element?.querySelector(`#${this.id}-role`);
        const customRoleInput = this.element?.querySelector(`#${this.id}-custom-role`);
        const roleToggleButton = this.element?.querySelector(`#${this.id}-role-toggle`);
        if (roleSelect) {
            roleSelect.style.display = mode === 'dropdown' ? '' : 'none';
            if (mode === 'dropdown') {
                roleSelect.innerHTML = this.getRoleOptions();
                roleSelect.value = this.outfitData.role;
            }
        }
        if (customRoleInput) {
            customRoleInput.style.display = mode === 'custom' ? '' : 'none';
            if (mode === 'custom') {
                customRoleInput.value = this.getRoleInputValue();
                customRoleInput.focus();
            }
        }
        if (roleToggleButton) {
            roleToggleButton.textContent = mode === 'dropdown' ? '🖉' : '🌳';
            roleToggleButton.title = mode === 'dropdown' ? 'Use custom role' : 'Use role list';
        }
    }

    toggleRoleMode() {
        if (this.outfitData.roleMode === 'dropdown') {
            this.applyRoleMode('custom');
            return;
        }

        const customValue = this.element?.querySelector(`#${this.id}-custom-role`)?.value.trim() || '';
        if (customValue) {
            this.ensureRoleAvailable(customValue);
            this.outfitData.role = customValue;
        }
        this.outfitData.customRole = '';
        this.applyRoleMode('dropdown');
    }

    formatRoleLabel(role) {
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
    }

    async loadWeaponsData() {
        try {
            this.weaponsData = await WeaponCatalogue.load();
            this.weaponsDataLoaded = true;
        } catch (error) {
            this.reportCatalogueError('Weapons catalogue (data/weapons.json)', error);
        }
        this.refresh();
    }

    async loadUtilitiesData() {
        try {
            const data = await this.fetchJSON('data/utilities.json');
            if (!data || !Array.isArray(data.radiators) || !Array.isArray(data.defenses)) {
                throw new Error('Utilities data must contain radiators and defenses arrays');
            }
            this.utilitiesData = data;
            this.utilitiesDataLoaded = true;
        } catch (error) {
            this.reportCatalogueError('Utilities catalogue (data/utilities.json)', error);
            this.utilitiesData = { radiators: [], defenses: [] };
        }
        this.refresh();
    }

    async loadSystemsData() {
        try {
            const [data, techData] = await Promise.all([
                this.fetchJSON('data/systems.json'),
                TechTree.ensureLoaded()
            ]);
            if (!data || !Array.isArray(data.general) || !Array.isArray(data.entropy) ||
                !Array.isArray(data.quantum)) {
                throw new Error('Systems data must contain general, entropy, and quantum arrays');
            }
            this.systemsData = data;
            this.systemsDataLoaded = true;
            const laserGenerator = data.general.find(item => item.id === 'laser-generator');
            const techCategory = laserGenerator?.technologyCategory;
            this.laserGeneratorTechs = Object.entries(techData)
                .filter(([, tech]) => tech?.category === techCategory &&
                    typeof tech.name === 'string' && tech.name.toLowerCase().includes('generator'))
                .map(([id, tech]) => ({
                    id,
                    name: tech.name,
                    abbreviation: tech.abbreviation || '',
                    requiredTech: [...(tech.requiredTech || [])]
                }));
            const knownEntropyIds = new Set(data.entropy.map(item => item.id));
            const entropySelections = Object.fromEntries(
                Object.entries(this.outfitData.systems.entropy)
                    .filter(([id]) => !knownEntropyIds.has(id))
            );
            for (const item of data.entropy) {
                const existing = this.outfitData.systems.entropy[item.id];
                entropySelections[item.id] = {
                    count: this.parseCount(existing?.count),
                    radiance: item.radiance,
                    requiredTech: [...(item.requiredTech || [])]
                };
            }
            this.outfitData.systems.entropy = entropySelections;
            this.outfitData.systems.quantum = Object.fromEntries(
                OutfitWidget.QUANTUM_SYSTEM_IDS.map(id => [
                    id,
                    this.parseCount(this.outfitData.systems.quantum?.[id])
                ])
            );
        } catch (error) {
            this.reportCatalogueError('Systems catalogue (data/systems.json)', error);
            this.systemsData = { general: [], entropy: [], quantum: [] };
            this.laserGeneratorTechs = [];
        }
        this.refresh();
    }

    refreshArmorDisplay(resources = this.getResourceSources()) {
        const input = this.element?.querySelector(`#${this.id}-armor`);
        if (input) input.value = this.parseCount(this.outfitData.defenses?.armor);
        this.outfitData.armorHits = this.getArmorHits();
        this.outfitData.armorHardpoints = this.getHardpointCapacity(resources);
        this.outfitData.effectiveHulls = this.getEffectiveHullCount();
        this.outfitData.initiative = this.getInitiative();
    }

    getAllWeapons() {
        return (this.weaponsData?.categories || []).flatMap(category =>
            (category.weapons || []).map(weapon => ({
                ...weapon,
                categoryName: category.name || ''
            }))
        );
    }

    getSpinalWeapons() {
        return this.getAllWeapons().filter(weapon =>
            weapon.isSpinal && WeaponCatalogue.getMount(weapon).resourceType !== 'hardpoints'
        );
    }

    getMountableWeapons() {
        return this.getAllWeapons().filter(weapon => {
            const { resourceType } = WeaponCatalogue.getMount(weapon);
            return resourceType !== 'hardpoints' && (resourceType || weapon.isSpinal);
        });
    }

    getPDWeapons() {
        return this.getMountableWeapons().filter(weapon => weapon.isPointDefense);
    }

    getOffensiveWeapons() {
        return this.getMountableWeapons().filter(weapon =>
            !weapon.isPointDefense && !weapon.isSpinal
        );
    }

    get ignoreRequiredTech() {
        return !!this.outfitData.ignoreRequiredTech;
    }

    filterByRequiredTech(weapons) {
        return super.filterByRequiredTech(weapons);
    }

    formatOptionCost(value, category = 'general', itemId = '') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '';
        try {
            if (typeof window.app?.formatOptionCost === 'function') {
                return window.app.formatOptionCost(value, category, itemId);
            }
        } catch (error) {
            // Fall back to CV if the application economy formatter is unavailable.
        }
        return `${value} CV`;
    }

    getRoleOptions(selected = this.outfitData.role) {
        return this.availableRoles.map(role =>
            `<option value="${OutfitWidget.escapeHTML(role)}" ${role === selected ? 'selected' : ''}>${OutfitWidget.escapeHTML(this.formatRoleLabel(role))}</option>`
        ).join('');
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const identity = this.createDesignSection('meta', '');
        this.setSectionContent(identity, `
            <div class="outfit-flags">${this.renderFlags()}</div>
            <div class="input-group role-group">
                <label for="${this.id}-role">Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role" class="role-select" ${this.outfitData.roleMode === 'custom' ? 'style="display:none;"' : ''}>${this.getRoleOptions()}</select>
                    <input id="${this.id}-custom-role" class="role-input" type="text" placeholder="Enter custom role" value="${OutfitWidget.escapeHTML(this.getRoleInputValue())}" ${this.outfitData.roleMode === 'dropdown' ? 'style="display:none;"' : ''}>
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.outfitData.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.outfitData.roleMode === 'dropdown' ? '🖉' : '🌳'}</button>
                    <button type="button" class="widget-remove-action" id="${this.id}-role-remove" title="Remove current role preset" aria-label="Remove current role preset">−</button>
                </div>
            </div>
            ${this.renderDesignFields([{
                key: 'notes', path: 'notes', type: 'textarea', label: 'Notes',
                placeholder: 'Doctrine and deployment notes', rows: 2
            }])}
        `);
        sections.appendChild(identity.section);

        const armor = this.createDesignSection('category-armor', 'Armor');
        this.addCategoryDisclosure(armor, 'category-armor', 'Armor');
        this.addSectionSubtotal(armor.titleElement, 'armor-cost');
        this.setSectionContent(armor, this.renderArmorSection());
        this.wrapCategoryContent(armor);
        sections.appendChild(armor.section);

        const core = this.createDesignSection('category-core', 'Core');
        this.addCategoryDisclosure(core, 'category-core', 'Core');
        this.addSectionSubtotal(core.titleElement, 'core-cost');
        this.addResourceCounter(core.titleElement, 'core');
        this.setSectionContent(core, `
            <div class="input-group outfit-core-source" id="${this.id}-core-source">
                <select id="${this.id}-core-select" aria-label="Select operational core"></select>
            </div>
            <div class="outfit-core-properties" id="${this.id}-core-properties" aria-live="polite"></div>
        `);
        this.wrapCategoryContent(core);
        sections.appendChild(core.section);

        const systems = this.createDesignSection('category-systems', 'Systems');
        this.addCategoryDisclosure(systems, 'category-systems', 'Systems');
        this.addSectionSubtotal(systems.titleElement, 'system-cost');
        this.addResourceCounter(systems.titleElement, 'systems');
        this.setSectionContent(systems, this.renderSystemsSection());
        this.wrapCategoryContent(systems);
        sections.appendChild(systems.section);

        for (const category of ['emplacements', 'utilities']) {
            const title = category[0].toUpperCase() + category.slice(1);
            const section = this.createDesignSection(`category-${category}`, title);
            this.addCategoryDisclosure(section, `category-${category}`, title);
            this.addSectionSubtotal(
                section.titleElement,
                category === 'emplacements' ? 'emplacement-cost' : 'utility-cost'
            );
            this.addResourceCounter(section.titleElement, category);
            const weapons = category === 'emplacements'
                ? this.renderEmplacementWeaponsSection()
                : `${this.renderRadiatorsSection()}
                    ${this.renderUtilityDefensesSection()}
                    ${this.renderWeaponCategory('defensive', 'Defensive Weapons')}`;
            const categoryContent = `${weapons}<div class="outfit-resource-note" id="${this.id}-resource-${category}-note"></div>`;
            this.setSectionContent(section, categoryContent);
            this.wrapCategoryContent(section);
            sections.appendChild(section.section);
        }

        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.refreshSubsectionAvailability();
        this.registerLayoutAnchors();
    }

    addCategoryDisclosure(sectionRef, categoryId, label) {
        const title = sectionRef?.titleElement;
        if (!title) return;
        title.classList.add('outfit-category-title');
        title.replaceChildren();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'outfit-category-toggle';
        button.dataset.categoryToggle = categoryId;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `${this.id}-${categoryId}-content`);
        button.textContent = label;
        title.appendChild(button);
        sectionRef.section.classList.add('outfit-category-section', 'is-collapsed');
    }

    wrapCategoryContent(sectionRef) {
        const title = sectionRef?.titleElement;
        if (!title?.parentElement) return;
        const content = document.createElement('div');
        content.className = 'outfit-category-content';
        content.id = `${this.id}-${sectionRef.section.id.replace(`${this.id}-`, '')}-content`;
        let sibling = title.nextSibling;
        while (sibling) {
            const next = sibling.nextSibling;
            content.appendChild(sibling);
            sibling = next;
        }
        title.parentElement.appendChild(content);
    }

    setCategoryExpanded(section, expanded) {
        if (!section) return;
        section.classList.toggle('is-collapsed', !expanded);
        const toggle = section.querySelector('[data-category-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
    }

    refreshInitialCategoryExpansion() {
        const resources = this.getResourceSources();
        const capacities = {
            'category-armor': resources.hardpoints,
            'category-core': resources.core,
            'category-systems': resources.systems,
            'category-emplacements': resources.emplacements,
            'category-utilities': resources.utilities
        };
        for (const [categoryId, capacity] of Object.entries(capacities)) {
            if (this.userToggledCategoryIds.has(categoryId)) continue;
            const section = this.element?.querySelector(`#${this.id}-${categoryId}`);
            this.setCategoryExpanded(section, capacity !== null && capacity > 0);
        }
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;
        for (const sectionId of ['meta', 'category-armor', 'category-core', 'category-systems', 'category-emplacements', 'category-utilities']) {
            const element = this.element.querySelector(`#${this.id}-${sectionId}`);
            if (element) this.addLayoutAnchor(`outfit-${sectionId}`, element, { selector: `#${this.id}-${sectionId}` });
        }
        for (const categoryId of ['category-armor', 'category-core']) {
            const selector = `#${this.id}-${categoryId} .section-title`;
            const heading = this.element.querySelector(selector);
            if (heading) this.addLayoutAnchor(`outfit-${categoryId}-heading`, heading, { selector });
        }
    }

    setupEventListeners() {
        super.setupEventListeners();
        if (this._outfitEventsBound || !this.element) return;
        this._outfitEventsBound = true;

        this.element.addEventListener('focusin', event => {
            if (event.target.id === `${this.id}-core-select`) this.refreshCoreOptions();
        });
        this.setupFlagListeners(() => {
            this.refresh();
        });
        this.setupDesignFieldListeners([{ key: 'notes', type: 'textarea' }]);

        this.element.addEventListener('input', event => {
            const target = event.target;
            if (target.id === `${this.id}-custom-role`) {
                this.outfitData.customRole = target.value;
                this.outfitData.role = target.value;
                this.outfitData.roleMode = 'custom';
            } else if (target.dataset.defenseField === 'armor') {
                this.outfitData.defenses.armor = this.parseCount(target.value);
                target.value = this.outfitData.defenses.armor;
            } else if (target.dataset.berthingCargo !== undefined) {
                this.updateBerthingFromCargo(target.value, true);
            } else if (target.dataset.berthingCount !== undefined) {
                this.updateBerthingFromBerths(target.value, true);
            } else if (target.dataset.berthingSlider !== undefined) {
                this.updateBerthingFromCargo(target.value);
            } else if (target.dataset.systemCount) {
                this.updateSystemCount(target);
                if (target.dataset.systemCount === 'laserGenerator') {
                    this.refreshWeapons();
                }
            }
            this.refreshWeaponResourceDisplay();
            this.refreshSectionCostLabels();
            this.onOutfitDataChanged();
            this.refreshSummary();
        });

        this.element.addEventListener('change', event => {
            const target = event.target;
            if (target.id === `${this.id}-role`) {
                this.outfitData.role = target.value;
                this.outfitData.customRole = '';
                this.applyRoleMode('dropdown');
            } else if (target.id === `${this.id}-custom-role`) {
                this.ensureRoleAvailable(target.value);
            } else if (target.id === `${this.id}-operational` ||
                target.id === `${this.id}-ignore-required-tech`) {
                return;
            } else if (target.id === `${this.id}-core-select`) {
                this.outfitData.coreWidgetId = target.value;
                this.refreshCoreOptions();
                this.refreshResourceDisplay();
            } else if (target.id === `${this.id}-spinal-weapon`) {
                this.outfitData.weapons.spinal = target.value;
            } else if (target.dataset.berthingCount !== undefined) {
                this.updateBerthingFromBerths(target.value);
            } else if (target.dataset.berthingCargo !== undefined ||
                target.dataset.berthingSlider !== undefined) {
                this.updateBerthingFromCargo(target.value);
            } else if (target.dataset.laserGeneratorTech !== undefined) {
                this.outfitData.systems.general.laserGenerator.techId = target.value;
                this.refreshSystemsControls();
                this.refreshWeapons();
            } else if (target.dataset.weaponField) {
                const value = target.type === 'checkbox' ? target.checked : target.value;
                this.updateWeaponField(target, target.dataset.weaponField, value);
                this.refreshWeapons();
            } else if (target.dataset.arcCheckbox !== undefined) {
                this.updateWeaponArc(target);
            }
            this.refreshWeaponResourceDisplay();
            this.refreshSectionCostLabels();
            this.onOutfitDataChanged();
            this.refreshSummary();
        });

        this.element.addEventListener('click', event => {
            const roleRemove = event.target.closest(`#${this.id}-role-remove`);
            if (roleRemove) {
                const role = this.outfitData.roleMode === 'custom'
                    ? this.element.querySelector(`#${this.id}-custom-role`)?.value.trim() ||
                        this.outfitData.customRole || this.outfitData.role
                    : this.element.querySelector(`#${this.id}-role`)?.value || this.outfitData.role;
                this.removeRolePreset(role);
                return;
            }
            const roleToggle = event.target.closest(`#${this.id}-role-toggle`);
            if (roleToggle) {
                this.toggleRoleMode();
                this.onOutfitDataChanged();
                this.refreshSummary();
                return;
            }
            const categoryToggle = event.target.closest('[data-category-toggle]');
            if (categoryToggle) {
                const categoryId = categoryToggle.dataset.categoryToggle;
                const section = categoryToggle.closest('.outfit-category-section');
                const expanded = categoryToggle.getAttribute('aria-expanded') !== 'true';
                if (categoryId) this.userToggledCategoryIds.add(categoryId);
                this.setCategoryExpanded(section, expanded);
                return;
            }
            const utilityRemove = event.target.closest('[data-remove-utility-device]');
            if (utilityRemove) {
                const [collection, rawIndex] = utilityRemove.dataset.removeUtilityDevice.split('|');
                const selections = this.outfitData.utilityDevices[collection];
                const index = Number(rawIndex);
                if (!selections || !Number.isSafeInteger(index) || !selections[index]) return;
                selections[index].count = this.parseCount(selections[index].count) - 1;
                if (selections[index].count <= 0) selections.splice(index, 1);
                this.refreshCatalogControls();
                this.refreshWeaponResourceDisplay();
                this.refreshSectionCostLabels();
                this.onOutfitDataChanged();
                this.refreshSummary();
                return;
            }
            const utilityButton = event.target.closest('[data-utility-action="add"]');
            if (utilityButton) {
                const collection = utilityButton.dataset.collection;
                if (collection !== 'radiators' && collection !== 'defenses') return;
                const picker = this.element.querySelector(`[data-utility-picker="${collection}"]`);
                const item = this.utilitiesData[collection].find(option => option.id === picker?.value);
                if (!item || !this.isOptionAvailable(item)) return;
                const existing = this.outfitData.utilityDevices[collection]
                    .find(selection => selection.id === item.id);
                if (existing) {
                    existing.count = this.parseCount(existing.count) + 1;
                } else {
                    this.outfitData.utilityDevices[collection].push({ ...item, count: 1 });
                }
                this.refreshCatalogControls();
                this.refreshWeaponResourceDisplay();
                this.refreshSectionCostLabels();
                this.onOutfitDataChanged();
                this.refreshSummary();
                return;
            }
            const button = event.target.closest('[data-weapon-action]');
            if (!button) return;
            const category = button.dataset.category;
            if (button.dataset.weaponAction === 'add') {
                if (category !== 'offensive' && category !== 'defensive') return;
                const picker = this.element.querySelector(`[data-weapon-picker="${category}"]`);
                const weapons = category === 'offensive' ? this.getOffensiveWeapons() : this.getPDWeapons();
                const selected = weapons.find(weapon => weapon.id === picker?.value);
                if (!selected || !this.isOptionAvailable(selected)) return;
                const weapon = {
                    weaponId: selected.id,
                    name: selected.name,
                    count: 1,
                    isTurreted: false,
                    requiredTech: [...(selected.requiredTech || [])]
                };
                if (category === 'offensive') weapon.arc = '';
                const existing = this.outfitData.weapons[category].find(selection =>
                    selection.weaponId === weapon.weaponId &&
                    Boolean(selection.isTurreted) === weapon.isTurreted &&
                    (category !== 'offensive' ||
                        this.getValidWeaponArc(selection.arc) === weapon.arc)
                );
                if (existing) {
                    existing.count = this.parseCount(existing.count) + 1;
                } else {
                    this.outfitData.weapons[category].push(weapon);
                }
            } else if (button.dataset.weaponAction === 'remove') {
                if (category !== 'offensive' && category !== 'defensive') return;
                const index = Number(button.dataset.index);
                const weapon = this.outfitData.weapons[category][index];
                if (!weapon) return;
                weapon.count = this.parseCount(weapon.count) - 1;
                if (weapon.count <= 0) this.outfitData.weapons[category].splice(index, 1);
            } else {
                return;
            }
            this.refreshWeapons();
            this.onOutfitDataChanged();
            this.refreshSummary();
        });
        this.applyRoleMode(this.outfitData.roleMode);
    }

    updateWeaponField(target, field, value) {
        const category = target.dataset.category;
        const weapon = this.outfitData.weapons?.[category]?.[Number(target.dataset.index)];
        if (!weapon) return;
        if (field === 'isTurreted' && weapon.isTurreted && !value &&
            this.getValidWeaponArc(weapon.arc, weapon.isMain, true).length > 1) {
            weapon.arc = '';
        }
        weapon[field] = value;
        if (field === 'isTurreted') {
            this.normalizeWeaponArc(weapon, category);
        }
    }

    getValidWeaponArc(arc, isMain = false, isTurreted = false) {
        const validArcs = Array.from(new Set(String(arc || '').split('')
            .filter(value => (isMain ? 'PS' : 'FPSA').includes(value))));
        return (isTurreted ? validArcs : validArcs.slice(0, 1)).sort().join('');
    }

    getWeaponDefinition(weaponId) {
        return this.getAllWeapons().find(item => item.id === weaponId);
    }

    isTurretOptionDisabled(weapon) {
        const mount = WeaponCatalogue.getMount(weapon);
        return !weapon || Boolean(weapon.isMain) ||
            (mount.resourceType === 'emplacements' && mount.resourceCount === 1);
    }

    normalizeWeaponArc(weapon, category) {
        if (!weapon) return;
        if (category === 'defensive') {
            delete weapon.arc;
            return;
        }
        const definition = this.getWeaponDefinition(weapon.weaponId);
        if (!definition) return;
        if (this.isTurretOptionDisabled(definition)) weapon.isTurreted = false;
        weapon.arc = this.getValidWeaponArc(
            weapon.arc,
            definition?.isMain,
            Boolean(weapon.isTurreted)
        );
    }

    updateWeaponArc(target) {
        const category = target.dataset.category;
        const index = Number(target.dataset.index);
        const weapon = this.outfitData.weapons?.[category]?.[index];
        const row = target.closest('.design-entry-options');
        if (category !== 'offensive' || !weapon || !row) return;
        const definition = this.getWeaponDefinition(weapon.weaponId);
        const checkedArcs = Array.from(row.querySelectorAll('[data-arc-checkbox]:checked'))
            .map(checkbox => checkbox.value);
        const isTurreted = category === 'offensive' && weapon.isTurreted;
        const selectedArcs = target.checked && !isTurreted
            ? target.value
            : checkedArcs.join('');
        weapon.arc = this.getValidWeaponArc(selectedArcs, definition?.isMain, isTurreted);
        row.querySelectorAll('[data-arc-checkbox]').forEach(checkbox => {
            checkbox.checked = weapon.arc.includes(checkbox.value);
        });
    }

    parseCount(value) {
        const count = Number.parseInt(value, 10);
        return Number.isFinite(count) ? Math.max(0, count) : 0;
    }

    getConnectedCoreData() {
        const linked = this.getConnectedDataByNodeType('Core')[0]?.data;
        return linked || null;
    }

    getSelectedCoreWidget() {
        if (this.getConnectedCoreData()) return null;
        const selectedId = this.outfitData.coreWidgetId;
        const widget = window.widgetManager?.getWidget?.(selectedId);
        if (widget?.type === 'shipCore' && widget.coreData?.operational) return widget;
        return null;
    }

    getCoreData() {
        return this.getConnectedCoreData() || this.getSelectedCoreWidget()?.coreData || null;
    }

    refreshSelectedCoreData(coreWidgetId) {
        if (this.outfitData.coreWidgetId !== coreWidgetId || this.getConnectedCoreData()) return;
        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    getConnectedClassData() {
        const hasClassConnection = Array.from(this.nodes.values()).some(node =>
            node.type === 'input' && node.nodeType === 'Class' && node.connections?.size
        );
        const linkedClass = hasClassConnection
            ? this.getConnectedDataByNodeType('Class')[0]?.data?.shipData
            : null;
        if (linkedClass) return linkedClass;

        const hasCoreConnection = Array.from(this.nodes.values()).some(node =>
            node.type === 'input' && node.nodeType === 'Core' && node.connections?.size
        );
        return hasCoreConnection ? this.getConnectedCoreData()?.shipData || null : null;
    }

    getResourceSources() {
        const classData = this.getConnectedClassData();
        const composition = classData?.hullComposition || {};
        const coreData = this.getCoreData();
        const coreSize = this.numericOrNull(coreData?.powerplantSize);
        const optionalNumber = (...values) => {
            const value = values.find(item => item !== undefined && item !== null && item !== '');
            return value === undefined ? null : this.numericOrNull(value);
        };
        const containmentHulls = optionalNumber(classData?.containmentHulls) ??
            (optionalNumber(composition.freight) === null &&
            optionalNumber(composition.tankage) === null
                ? null
                : (optionalNumber(composition.freight) || 0) +
                    (optionalNumber(composition.tankage) || 0));
        const systemCapacity = optionalNumber(composition.system);
        const availableSystems = systemCapacity === null
            ? null
            : Math.max(0, systemCapacity);
        const coreHardpoints = optionalNumber(coreData?.hardpoints);
        const calculatedHardpoints = containmentHulls === null
            ? null
            : Math.floor(
                Math.pow(containmentHulls, 2 / 3) +
                    Number.EPSILON * Math.max(1, Math.pow(containmentHulls, 2 / 3))
            );
        return {
            utilities: coreSize === null ? null : coreSize * 2,
            emplacements: optionalNumber(composition.emplacement),
            systems: availableSystems,
            hardpoints: this.getHardpointCapacity({ hardpoints: coreHardpoints ?? calculatedHardpoints }),
            core: optionalNumber(composition.core),
            containmentHulls
        };
    }

    getArmorEfficiency() {
        return this.getConnectedClassData()?.armorEfficiency ?? null;
    }

    getArmorHits() {
        const efficiency = this.getArmorEfficiency();
        return efficiency === null
            ? null
            : this.parseCount(this.outfitData.defenses?.armor) * efficiency;
    }

    getHardpointCapacity(resources = this.getResourceSources()) {
        return ShipCapacity.getHardpointCapacity(resources.hardpoints, this.getArmorHits());
    }

    getClassHullCount() {
        const hullComposition = this.getConnectedClassData()?.hullComposition;
        if (!hullComposition || typeof hullComposition !== 'object') return null;
        return Object.values(hullComposition).reduce((total, count) => {
            const number = Number(count);
            return total + (Number.isFinite(number) && number > 0 ? number : 0);
        }, 0);
    }

    getEffectiveHullCount() {
        const classHullCount = this.getClassHullCount();
        return classHullCount === null ? null : classHullCount + this.parseCount(this.outfitData.defenses?.armor);
    }

    getInitiative() {
        const hullComposition = this.getConnectedClassData()?.hullComposition;
        if (!hullComposition || typeof hullComposition !== 'object') return null;
        const coreHulls = this.numericOrNull(hullComposition.core);
        const totalHulls = this.getEffectiveHullCount();
        if (coreHulls === null || totalHulls === null || totalHulls <= 0) return null;
        return coreHulls / totalHulls;
    }

    getGearBurnAnalysis(core = this.getCoreData()) {
        if (!core) return null;
        const effectiveHulls = this.getEffectiveHullCount();
        const classData = this.getConnectedClassData();
        const availableRemass = this.numericOrNull(classData?.resources?.remass);
        const manifoldEfficiency = this.numericOrNull(core.manifoldEfficiency);
        const hullComposition = classData?.hullComposition;
        const baseEntropy = !hullComposition || typeof hullComposition !== 'object'
            ? null
            : 2 * (
                this.parseCount(hullComposition.emplacement) +
                this.getQuantumSystemCount()
            );
        const totalEntropy = baseEntropy === null || manifoldEfficiency === null
            ? null
            : Math.floor(baseEntropy * manifoldEfficiency);
        const radiatorOffset = this.getRadiatorEntropyOffset();
        const entropyBands = totalEntropy === null
            ? null
            : OutfitWidget.calculateEntropyBands(totalEntropy, radiatorOffset);
        const exportEntropyBands = totalEntropy === null
            ? null
            : OutfitWidget.calculateEntropyBands(totalEntropy);
        let entropyRadianceValue = 0;
        const exportEntropyRadiance = exportEntropyBands?.map((current, index) => {
            const next = exportEntropyBands[index + 1];
            if (next !== undefined && current < next) return entropyRadianceValue++;
            return 5;
        }) ?? null;
        const baseMetrics = effectiveHulls === null
            ? null
            : OutfitWidget.calculateGearBurnMetrics(
                effectiveHulls,
                core.engineEfficiency,
                0
            );
        const gears = (Array.isArray(core.gears) ? core.gears : []).map((gear, index) => {
            const metrics = effectiveHulls === null
                ? null
                : OutfitWidget.calculateGearBurnMetrics(
                    effectiveHulls,
                    core.engineEfficiency,
                    gear.instability
                );
            let maximumBurns = null;
            let unlimitedBurns = false;
            if (metrics && availableRemass !== null) {
                if (metrics.remassPerBurn === 0) {
                    unlimitedBurns = true;
                } else if (metrics.remassPerBurn === null) {
                    maximumBurns = 0;
                } else {
                    maximumBurns = Math.floor(Math.max(0, availableRemass) / metrics.remassPerBurn);
                }
            }
            return {
                name: gear.name || `Gear ${index + 1}`,
                instability: this.numericOrNull(gear.instability),
                useful: metrics?.useful ?? null,
                entropy: metrics?.entropy ?? null,
                remassPerBurn: metrics?.remassPerBurn ?? null,
                maximumBurns,
                unlimitedBurns
            };
        });
        return {
            effectiveHulls,
            baseEntropy,
            totalEntropy,
            radiatorOffset,
            entropyBands,
            exportEntropyBands,
            exportEntropyRadiance,
            thrustPenalty: baseMetrics?.thrustPenalty ?? null,
            availableRemass,
            gears
        };
    }

    getQuantumSystemCount() {
        return OutfitWidget.QUANTUM_SYSTEM_IDS.reduce(
            (total, id) => total + this.parseCount(this.outfitData.systems.quantum?.[id]),
            0
        );
    }

    getRadiatorEntropyOffset() {
        return (this.outfitData.utilityDevices?.radiators || []).reduce((total, selection) => {
            const definition = this.utilitiesData.radiators.find(item => item.id === selection.id);
            const offset = Number(selection.offset ?? definition?.offset);
            return total + (Number.isFinite(offset)
                ? offset * this.parseCount(selection.count)
                : 0);
        }, 0);
    }

    addResourceCounter(titleElement, resource) {
        if (!titleElement) return;
        const counter = document.createElement('span');
        counter.className = 'outfit-resource-counter';
        counter.id = `${this.id}-resource-${resource}-counter`;
        counter.setAttribute('aria-label', `${resource} used / available`);
        const used = document.createElement('span');
        used.className = 'outfit-resource-used';
        used.textContent = '0';
        const capacity = document.createElement('span');
        capacity.className = 'outfit-resource-capacity';
        capacity.textContent = '0';
        counter.append(used, document.createTextNode(' / '), capacity);
        titleElement.appendChild(counter);
    }

    addSectionSubtotal(titleElement, name) {
        if (!titleElement) return;
        const subtotal = document.createElement('span');
        subtotal.className = 'outfit-section-subtotal outfit-section-subtotal-inline';
        subtotal.id = `${this.id}-${name}`;
        subtotal.setAttribute('aria-live', 'polite');
        titleElement.appendChild(subtotal);
    }

    numericOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    getCoreThreshold(core) {
        const threshold = this.numericOrNull(core?.reactorStability);
        return threshold === null ? null : Math.floor(threshold);
    }

    getOperationalCores() {
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        return widgets.filter(widget =>
            widget !== this && widget.type === 'shipCore' && widget.coreData?.operational
        );
    }

    refreshCoreOptions() {
        const select = this.element?.querySelector(`#${this.id}-core-select`);
        if (!select) return;
        const directCore = !!this.getConnectedCoreData();
        const selectedWidget = this.getSelectedCoreWidget();
        const selectedId = selectedWidget?.id || '';
        const options = this.getOperationalCores().map(widget =>
            `<option value="${OutfitWidget.escapeHTML(widget.id)}" ${widget.id === selectedId ? 'selected' : ''}>${OutfitWidget.escapeHTML(widget.title || 'Ship Core')} (Size ${OutfitWidget.escapeHTML(widget.coreData.powerplantSize ?? '—')})</option>`
        ).join('');
        select.innerHTML = `<option value="">Select operational core...</option>${options}`;
        select.value = selectedId;
        const source = this.element.querySelector(`#${this.id}-core-source`);
        if (source) source.hidden = directCore;
    }

    refreshResourceDisplay() {
        if (!this.element) return;
        const resources = this.getResourceSources();
        this.refreshResourceCounters(resources);
        this.refreshBerthingAllocationUI();
        this.refreshInitialCategoryExpansion();
        this.refreshArmorDisplay(resources);
        const core = this.getCoreData();
        this.outfitData.selectedCore = core ? this.serializeCore(core) : null;
        this.renderCoreProperties(core);
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.refreshWeapons();
    }

    getArmorHullCost() {
        return this.numericOrNull(this.getConnectedClassData()?.armorCost) ?? 9;
    }

    getArmorCostTotals() {
        const unit = window.empire?.economyMode === 'campaign' ? 'IP' : 'CV';
        return { [unit]: this.parseCount(this.outfitData.defenses?.armor) * this.getArmorHullCost() };
    }

    getWeaponCostTotals() {
        return { [window.empire?.economyMode === 'campaign' ? 'MP' : 'CV']: this.getWeaponsCost() };
    }

    getCoreCostTotals() {
        const core = this.getCoreData();
        const cost = core ? ShipCoreWidget.calculateCost(core, this.getEffectiveHullCount()) : null;
        return cost ? { [window.empire?.economyMode === 'campaign' ? 'IP' : 'CV']: cost.total } : {};
    }

    static sumCosts(...groups) {
        const totals = {};
        for (const group of groups) {
            for (const [unit, value] of Object.entries(group)) {
                if (Number.isFinite(value)) totals[unit] = (totals[unit] || 0) + value;
            }
        }
        return totals;
    }

    getConfigurationCostTotals() {
        const unit = window.empire?.economyMode === 'campaign' ? 'MP' : 'CV';
        return OutfitWidget.sumCosts(
            this.getArmorCostTotals(),
            { [unit]: this.getWeaponsCost() + this.getUtilityDeviceCost() + this.getSystemsCost() }
        );
    }

    getCostTotals() {
        return OutfitWidget.sumCosts(this.getConfigurationCostTotals(), this.getCoreCostTotals());
    }

    getWeaponsCost() {
        const costOf = (weaponId, count) => (Number(this.getWeaponDefinition(weaponId)?.cost) || 0) * this.parseCount(count);
        let total = costOf(this.outfitData.weapons?.spinal, 1);
        for (const category of ['offensive', 'defensive']) {
            for (const weapon of this.outfitData.weapons?.[category] || []) {
                total += costOf(weapon.weaponId, weapon.count);
            }
        }
        return total;
    }

    getUtilityDeviceCost(collection = null) {
        let total = 0;
        const collections = collection ? [collection] : ['radiators', 'defenses'];
        for (const deviceCollection of collections) {
            for (const selection of this.outfitData.utilityDevices?.[deviceCollection] || []) {
                const definition = this.utilitiesData[deviceCollection].find(item => item.id === selection.id);
                total += (Number(definition?.cost) || 0) * this.parseCount(selection.count);
            }
        }
        return total;
    }

    getWeaponCategoryCost(category) {
        return (this.outfitData.weapons?.[category] || []).reduce((total, selection) => {
            const weapon = this.getWeaponDefinition(selection.weaponId);
            return total + (Number(weapon?.cost) || 0) * this.parseCount(selection.count);
        }, 0);
    }

    getSpinalWeaponCost() {
        return (Number(this.getWeaponDefinition(this.outfitData.weapons?.spinal)?.cost) || 0);
    }

    getUtilityCostSubtotal() {
        const defensiveWeapons = (this.outfitData.weapons?.defensive || []).reduce((sum, selection) => {
            const weapon = this.getWeaponDefinition(selection.weaponId);
            return sum + (Number(weapon?.cost) || 0) * this.parseCount(selection.count);
        }, 0);
        return defensiveWeapons + this.getUtilityDeviceCost();
    }

    getEmplacementCostSubtotal() {
        const costOf = (weaponId, count) =>
            (Number(this.getWeaponDefinition(weaponId)?.cost) || 0) * this.parseCount(count);
        return costOf(this.outfitData.weapons?.spinal, 1) +
            (this.outfitData.weapons?.offensive || []).reduce(
                (total, selection) => total + costOf(selection.weaponId, selection.count),
                0
            );
    }

    getSystemsCost(category = null) {
        let total = 0;
        if (!category || category === 'general') {
            for (const item of this.systemsData.general) {
                const field = this.getGeneralSystemField(item.id);
                const selection = item.id === 'laser-generator'
                    ? this.outfitData.systems.general.laserGenerator
                    : null;
                const count = item.id === 'laser-generator'
                    ? (selection?.techId ? this.parseCount(selection.count) : 0)
                    : this.parseCount(this.outfitData.systems.general[field]);
                total += (Number(item.cost) || 0) * count;
            }
        }
        if (!category || category === 'entropy') {
            for (const item of this.systemsData.entropy) {
                total += (Number(item.cost) || 0) *
                    this.parseCount(this.outfitData.systems.entropy[item.id]?.count);
            }
        }
        if (!category || category === 'quantum') {
            for (const item of this.systemsData.quantum) {
                total += (Number(item.cost) || 0) *
                    this.parseCount(this.outfitData.systems.quantum[item.id]);
            }
        }
        return total;
    }

    refreshSectionCostLabels() {
        if (!this.element) return;
        const formatSubtotal = value => {
            return this.formatTotalCost(value, 'weapons') || '0 CV';
        };
        const formatResourceSubtotal = totals => this.formatCostTotals(totals)
            .replace(/\bIP\b/g, 'Industry')
            .replace(/\bMP\b/g, 'Material')
            .replace(/\bEP\b/g, 'Energy');
        const setSubsectionCost = (key, value) => {
            const element = this.element.querySelector(`#${this.id}-${key}`);
            if (element) element.textContent = value ? formatSubtotal(value) : '';
        };
        setSubsectionCost('spinal-subtotal', this.getSpinalWeaponCost());
        setSubsectionCost('radiator-subtotal', this.getUtilityDeviceCost('radiators'));
        setSubsectionCost('utility-defense-subtotal', this.getUtilityDeviceCost('defenses'));
        setSubsectionCost('offensive-weapon-subtotal', this.getWeaponCategoryCost('offensive'));
        setSubsectionCost('defensive-weapon-subtotal', this.getWeaponCategoryCost('defensive'));
        setSubsectionCost('general-system-subtotal', this.getSystemsCost('general'));
        setSubsectionCost('entropy-system-subtotal', this.getSystemsCost('entropy'));
        setSubsectionCost('quantum-system-subtotal', this.getSystemsCost('quantum'));
        const utilities = this.element.querySelector(`#${this.id}-utility-cost`);
        if (utilities) utilities.textContent = formatSubtotal(this.getUtilityCostSubtotal());
        const emplacements = this.element.querySelector(`#${this.id}-emplacement-cost`);
        if (emplacements) emplacements.textContent = formatSubtotal(this.getEmplacementCostSubtotal());
        const systems = this.element.querySelector(`#${this.id}-system-cost`);
        if (systems) systems.textContent = formatSubtotal(this.getSystemsCost());
        const armor = this.element.querySelector(`#${this.id}-armor-cost`);
        if (armor) armor.textContent = formatResourceSubtotal(this.getArmorCostTotals());
        const core = this.element.querySelector(`#${this.id}-core-cost`);
        if (core) core.textContent = formatResourceSubtotal(this.getCoreCostTotals());
    }

    refreshCostMetrics() {
        this.refreshDevelopmentMetric();
        this.setHeaderMetric('core', '', null);
        this.setHeaderMetric('outfit', '', null);
        this.setHeaderMetric('cost', '', this.formatCostTotals(this.getCostTotals()));
        this.refreshSectionCostLabels();
    }

    renderCoreProperties(core) {
        this.refreshCostMetrics();
        const container = this.element?.querySelector(`#${this.id}-core-properties`);
        if (!container) return;
        container.replaceChildren();
        if (!core) return;

        const display = value => value === undefined || value === null || value === '' ? '—' : String(value);
        const burnAnalysis = this.getGearBurnAnalysis(core);
        const properties = [
            ['Operational', core.operational ? 'Yes' : 'No'],
            ['Reactor', `${display(core.reactorName || core.reactor)} · ${display(core.reactorValue)}`],
            ['Engine', `${display(core.engineName || core.engine)} · ${display(core.engineValue)}`],
            ['Manifold', `${display(core.manifoldName || core.manifold)} · ${display(core.manifoldValue)}`],
            ['Threshold', display(this.getCoreThreshold(core))],
            ['Entropy', display(burnAnalysis?.totalEntropy)]
        ];
        const grid = document.createElement('dl');
        grid.className = 'outfit-core-properties-grid';
        for (const [label, value] of properties) {
            const term = document.createElement('dt');
            term.textContent = label;
            const detail = document.createElement('dd');
            detail.textContent = value;
            grid.append(term, detail);
        }
        container.appendChild(grid);

        const burnSection = document.createElement('section');
        burnSection.className = 'outfit-core-burn-analysis';
        const heading = document.createElement('h4');
        heading.textContent = 'Gears';
        burnSection.appendChild(heading);
        if (!burnAnalysis?.gears.length) {
            const empty = document.createElement('div');
            empty.textContent = 'No gears configured';
            burnSection.appendChild(empty);
        } else {
            for (const gear of burnAnalysis.gears) {
                const maxBurns = gear.unlimitedBurns
                    ? 'Unlimited'
                    : gear.maximumBurns === null ? '—' : String(gear.maximumBurns);
                const remassPerBurn = gear.remassPerBurn === null
                    ? '—'
                    : String(Number(gear.remassPerBurn.toFixed(4)));
                const grid = document.createElement('dl');
                grid.className = 'outfit-core-properties-grid';
                for (const [label, value] of [
                    ['Gear', gear.name],
                    ['Instability', display(gear.instability)],
                    ['Useful', display(gear.useful)],
                    ['Entropy', display(gear.entropy)],
                    ['Remass per burn', remassPerBurn],
                    ['Maximum burns', maxBurns]
                ]) {
                    const term = document.createElement('dt');
                    term.textContent = label;
                    const detail = document.createElement('dd');
                    detail.textContent = value;
                    grid.append(term, detail);
                }
                burnSection.appendChild(grid);
            }
        }
        container.appendChild(burnSection);
    }

    refreshResourceCounters(resources = this.getResourceSources()) {
        const usage = this.getResourceUse();
        this.outfitData.resources = { ...resources };
        this.outfitData.resourceUse = { ...usage };
        for (const name of ['core', 'emplacements', 'utilities', 'systems', 'hardpoints']) {
            const counter = this.element?.querySelector(`#${this.id}-resource-${name}-counter`);
            if (!counter) continue;
            const usedElement = counter.querySelector('.outfit-resource-used');
            const capacityElement = counter.querySelector('.outfit-resource-capacity');
            const used = usage[name];
            const capacity = resources[name];
            const hasCapacity = typeof capacity === 'number' && Number.isFinite(capacity);
            const availableCapacity = hasCapacity ? capacity : 0;
            if (usedElement) {
                usedElement.textContent = String(used);
                usedElement.classList.toggle('is-over-capacity', used > availableCapacity);
            }
            if (capacityElement) {
                capacityElement.textContent = hasCapacity ? String(capacity) : '0';
                capacityElement.classList.toggle('has-unused-capacity', hasCapacity && used < capacity);
            }
        }
    }

    serializeCore(core) {
        const techs = [core.reactor, core.engine, core.manifold, ...(Array.isArray(core.requiredTech) ? core.requiredTech : [])]
            .filter(value => typeof value === 'string' && value);
        return {
            name: core.name || this.getSelectedCoreWidget()?.title || '',
            operational: Boolean(core.operational),
            developmentCost: this.numericOrNull(core.developmentCost),
            reactorValue: this.numericOrNull(core.reactorValue),
            engineValue: this.numericOrNull(core.engineValue),
            manifoldValue: this.numericOrNull(core.manifoldValue),
            reactorName: core.reactorName || '',
            engineName: core.engineName || '',
            manifoldName: core.manifoldName || '',
            reactorStability: this.getCoreThreshold(core),
            engineEfficiency: this.numericOrNull(core.engineEfficiency),
            manifoldEfficiency: this.numericOrNull(core.manifoldEfficiency),
            gears: Array.isArray(core.gears) ? core.gears.map(gear => {
                const savedGear = { ...gear };
                delete savedGear.burnRatio;
                delete savedGear.adjustedRatio;
                delete savedGear.remassPerBurn;
                delete savedGear.entropy;
                return savedGear;
            }) : [],
            hardpoints: this.numericOrNull(core.hardpoints),
            effectiveHulls: this.getEffectiveHullCount(),
            burnAnalysis: this.getGearBurnAnalysis(core),
            cost: ShipCoreWidget.calculateCost(core, this.getEffectiveHullCount())?.total ?? null,
            reactor: core.reactor || '',
            engine: core.engine || '',
            manifold: core.manifold || '',
            requiredTech: Array.from(new Set(techs))
        };
    }

    renderEmplacementWeaponsSection() {
        return `
            <div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="spinal">
                ${this.renderOutfitSubsectionTitle('Spinal Mount', 'spinal-subtotal')}
                <select id="${this.id}-spinal-weapon" class="weapon-select">
                    <option value="">None</option>
                    ${this.renderWeaponOptions(this.getSpinalWeapons(), this.outfitData.weapons.spinal)}
                </select>
                <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
            </div>
            ${this.renderWeaponCategory('offensive', 'Offensive Weapons')}
        `;
    }

    renderArmorSection() {
        return `<div class="outfit-armor-control">
            <div class="composition-item">
                <label for="${this.id}-armor">Armour</label>
                <input id="${this.id}-armor" class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(this.outfitData.defenses?.armor)}" data-defense-field="armor">
            </div>
        </div>`;
    }

    renderRadiatorsSection() {
        return `<div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="radiators">
            ${this.renderOutfitSubsectionTitle('Radiance', 'radiator-subtotal')}
            ${this.renderUtilityDevicePicker('radiators')}
            <div id="${this.id}-radiator-rows" class="design-entry-list"></div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>`;
    }

    renderUtilityDefensesSection() {
        return `<div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="utility-defenses">
            ${this.renderOutfitSubsectionTitle('Defenses', 'utility-defense-subtotal')}
            ${this.renderUtilityDevicePicker('defenses')}
            <div id="${this.id}-utility-defense-rows" class="design-entry-list"></div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>`;
    }

    renderOutfitSubsectionTitle(label, subtotalKey) {
        return `<div class="design-subtitle">
            <span>${this.escape(label)}</span>
            <span class="outfit-section-subtotal outfit-section-subtotal-inline" id="${this.id}-${subtotalKey}" aria-live="polite"></span>
        </div>`;
    }

    renderUtilityDevicePicker(collection) {
        const label = collection === 'radiators' ? 'Radiator' : 'Defense';
        const items = this.filterByRequiredTech(this.utilitiesData[collection] || []);
        const groupedItems = new Map();
        for (const item of items) {
            const group = item.type || 'Other';
            if (!groupedItems.has(group)) groupedItems.set(group, []);
            groupedItems.get(group).push(item);
        }
        const options = Array.from(groupedItems, ([group, groupItems]) =>
            `<optgroup label="${OutfitWidget.escapeHTML(group)}">${groupItems.map(item =>
                `<option value="${OutfitWidget.escapeHTML(item.id)}">${OutfitWidget.escapeHTML(item.name)}</option>`
            ).join('')}</optgroup>`
        ).join('');
        return `<div class="design-picker">
            <select class="design-select" data-utility-picker="${collection}" aria-label="${label} to add">
                <option value="">Select ${label.toLowerCase()}...</option>${options}
            </select>
            <button type="button" class="widget-add-action" data-utility-action="add" data-collection="${collection}" ${items.length ? '' : 'disabled'}>Add</button>
        </div>`;
    }

    renderUtilityDeviceRows(collection) {
        const containerId = collection === 'radiators' ? 'radiator-rows' : 'utility-defense-rows';
        const container = this.element?.querySelector(`#${this.id}-${containerId}`);
        this.renderEntryRows(container, (this.outfitData.utilityDevices?.[collection] || [])
            .map((selection, index) => {
                const item = (this.utilitiesData[collection] || [])
                    .find(option => option.id === selection.id);
                const quantity = this.parseCount(selection.count);
                return {
                    key: `${collection}|${index}`,
                    name: item?.name || selection.name || selection.id || 'Unavailable',
                    quantity,
                    cost: (Number(item?.cost) || 0) * quantity,
                    category: 'weapons',
                    unavailable: !item || !this.isOptionAvailable(item)
                };
            }), 'removeUtilityDevice');
    }

    renderSystemsSection() {
        return `<div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="general-systems">
            ${this.renderOutfitSubsectionTitle('General Systems', 'general-system-subtotal')}
            <div id="${this.id}-general-system-rows">${this.renderGeneralSystems()}</div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>
        <div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="entropy-systems">
            ${this.renderOutfitSubsectionTitle('Entropy Systems', 'entropy-system-subtotal')}
            <div id="${this.id}-entropy-system-rows">${this.renderEntropySystems()}</div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>
        <div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="quantum-systems">
            ${this.renderOutfitSubsectionTitle('Quantum Systems', 'quantum-system-subtotal')}
            <div id="${this.id}-quantum-system-rows">${this.renderQuantumSystems()}</div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>`;
    }

    renderGeneralSystems() {
        return `<div class="composition-grid outfit-systems-grid">${this.systemsData.general.map(item => {
            if (item.id === 'laser-generator') {
                const laser = this.outfitData.systems.general.laserGenerator;
                const available = this.getAvailableLaserGeneratorTechs();
                const selectedTech = this.laserGeneratorTechs.find(tech => tech.id === laser.techId);
                const unavailableOption = laser.techId && !available.some(tech => tech.id === laser.techId)
                    ? `<option value="${OutfitWidget.escapeHTML(laser.techId)}" selected>${OutfitWidget.escapeHTML(selectedTech?.name || laser.techId)} (unavailable)</option>`
                    : '';
                const hasAvailableSelection = available.some(tech => tech.id === laser.techId);
                return `<div class="composition-item outfit-system-item outfit-laser-generator">
                    <label for="${this.id}-laser-generator-tech">${OutfitWidget.escapeHTML(item.name)}</label>
                    <div class="outfit-system-item-controls">
                        <select id="${this.id}-laser-generator-tech" data-laser-generator-tech aria-label="Laser generator technology">
                            <option value="">Select researched technology...</option>
                            ${unavailableOption}
                            ${available.map(tech =>
                                `<option value="${OutfitWidget.escapeHTML(tech.id)}" ${tech.id === laser.techId ? 'selected' : ''}>${OutfitWidget.escapeHTML(tech.name)}</option>`
                            ).join('')}
                        </select>
                        <input class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(laser.count)}" data-system-count="laserGenerator" aria-label="Laser generator quantity" ${hasAvailableSelection ? '' : 'disabled'}>
                    </div>
                </div>`;
            }
            const field = this.getGeneralSystemField(item.id);
            const count = this.parseCount(this.outfitData.systems.general[field]);
            const unavailable = !this.isCatalogItemAvailable(item);
            if (item.id === 'berthing') {
                const cargo = this.parseCount(this.outfitData.systems.general.berthingCargo);
                const berths = Math.max(0, count * 5 - cargo / 10);
                return `<div class="composition-item outfit-system-item outfit-berthing-system">
                    <label for="${this.id}-system-berthing">Berthing</label>
                    <input id="${this.id}-system-berthing" class="hull-spin" type="number" min="0" step="1" value="${count}" data-system-count="berthing" aria-label="Berthing quantity" ${unavailable ? 'disabled' : ''}>
                </div>
                <div class="cargo-remass-control berthing-allocation-control">
                    <div class="cargo-endurance">
                        <label class="label" for="${this.id}-berthing-cargo">Cargo</label>
                        <input type="number" class="value" id="${this.id}-berthing-cargo" min="0" step="10" value="${cargo}" data-berthing-cargo aria-label="Cargo allocated to berthing" ${unavailable ? 'disabled' : ''}>
                    </div>
                    <input type="range" class="cargo-remass-slider" id="${this.id}-berthing-slider" min="0" max="0" value="${cargo}" step="10" data-berthing-slider aria-label="Cargo to berthing allocation" ${unavailable ? 'disabled' : ''}>
                    <div class="remass-burns">
                        <label class="label" for="${this.id}-berthing-value">Berths</label>
                        <input type="number" class="value" id="${this.id}-berthing-value" min="0" step="1" value="${berths}" data-berthing-count aria-label="Available berths" ${unavailable ? 'disabled' : ''}>
                    </div>
                </div>`;
            }
            return `<div class="composition-item outfit-system-item${unavailable ? ' is-unavailable' : ''}">
                <label for="${this.id}-system-${OutfitWidget.escapeHTML(field)}">${OutfitWidget.escapeHTML(item.name)}</label>
                <input id="${this.id}-system-${OutfitWidget.escapeHTML(field)}" class="hull-spin" type="number" min="0" step="1" value="${count}" data-system-count="${OutfitWidget.escapeHTML(field)}" aria-label="${OutfitWidget.escapeHTML(item.name)} quantity" ${unavailable ? 'disabled' : ''}>
                ${unavailable ? '<span class="outfit-device-stats">Required technology unavailable</span>' : ''}
            </div>`;
        }).join('')}</div>`;
    }

    renderEntropySystems() {
        return `<div class="composition-grid outfit-systems-grid">${this.systemsData.entropy.map(item => {
            const selection = this.outfitData.systems.entropy[item.id] || { count: 0 };
            const unavailable = !this.isCatalogItemAvailable(item);
            return `<div class="composition-item outfit-system-item${unavailable ? ' is-unavailable' : ''}">
                <label for="${this.id}-entropy-${OutfitWidget.escapeHTML(item.id)}">${OutfitWidget.escapeHTML(item.name)}</label>
                <input id="${this.id}-entropy-${OutfitWidget.escapeHTML(item.id)}" class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(selection.count)}" data-system-count="entropy:${OutfitWidget.escapeHTML(item.id)}" aria-label="${OutfitWidget.escapeHTML(item.name)} quantity" ${unavailable ? 'disabled' : ''}>
                ${unavailable ? '<span class="outfit-device-stats">Required technology unavailable</span>' : ''}
            </div>`;
        }).join('')}</div>`;
    }

    renderQuantumSystems() {
        return `<div class="composition-grid outfit-systems-grid outfit-quantum-systems-grid">${this.systemsData.quantum.map(item => {
            const count = this.parseCount(this.outfitData.systems.quantum[item.id]);
            const unavailable = !this.isCatalogItemAvailable(item);
            return `<div class="composition-item outfit-system-item outfit-quantum-system${unavailable ? ' is-unavailable' : ''}">
                <label for="${this.id}-quantum-${OutfitWidget.escapeHTML(item.id)}">${OutfitWidget.escapeHTML(item.name)}</label>
                <input id="${this.id}-quantum-${OutfitWidget.escapeHTML(item.id)}" class="hull-spin" type="number" min="0" step="1" value="${count}" data-system-count="quantum:${OutfitWidget.escapeHTML(item.id)}" aria-label="${OutfitWidget.escapeHTML(item.name)} quantity" ${unavailable ? 'disabled' : ''}>
                ${unavailable ? '<span class="outfit-device-stats">Required technology unavailable</span>' : ''}
            </div>`;
        }).join('')}</div>`;
    }

    getGeneralSystemField(itemId) {
        return itemId === 'craft-launcher' ? 'craftLauncher' : itemId;
    }

    getAvailableLaserGeneratorTechs() {
        return this.laserGeneratorTechs.filter(tech =>
            this.ignoreRequiredTech || (window.empire?.hasTech?.(tech.id) ?? false)
        );
    }

    getInstalledLaserGeneratorSuffix() {
        const selection = this.outfitData.systems.general.laserGenerator;
        if (!selection.techId || this.parseCount(selection.count) <= 0) return '';
        const tech = this.laserGeneratorTechs.find(item => item.id === selection.techId);
        return tech?.abbreviation?.toLowerCase() || '';
    }

    isGeneratorTaggedWeapon(weapon) {
        return WeaponCatalogue.hasTag(weapon, 'Generator');
    }

    getGeneratorWeaponType(weapon) {
        if (!this.isGeneratorTaggedWeapon(weapon)) return null;
        const match = String(weapon.id || '').match(/-(aperture|collimator|maser|uvaser|fel|haser)(?=-\d+$|$)/i);
        if (!match) return 'unmapped';
        const type = match[1].toLowerCase();
        return type === 'aperture' || type === 'collimator' ? 'base' : type;
    }

    getGeneratorWeaponFamilyKey(weapon) {
        if (!this.isGeneratorTaggedWeapon(weapon)) return '';
        return String(weapon.id || '').replace(
            /-(?:aperture|collimator|maser|uvaser|fel|haser)(?=-\d+$|$)/i,
            '-{generator}'
        );
    }

    getGeneratorWeaponVariant(weapon, generatorType) {
        const familyKey = this.getGeneratorWeaponFamilyKey(weapon);
        if (!familyKey) return null;
        return this.getAllWeapons().find(candidate =>
            this.getGeneratorWeaponFamilyKey(candidate) === familyKey &&
            this.getGeneratorWeaponType(candidate) === generatorType
        ) || null;
    }

    getGeneratorFilteredWeapons(weapons) {
        const installedGenerator = this.getInstalledLaserGeneratorSuffix();
        return weapons.filter(weapon => {
            const type = this.getGeneratorWeaponType(weapon);
            if (type === null) return true;
            return installedGenerator ? type === installedGenerator : type === 'base';
        });
    }

    isGeneratorWeaponCompatible(weapon) {
        const type = this.getGeneratorWeaponType(weapon);
        if (type === null) return true;
        const installedGenerator = this.getInstalledLaserGeneratorSuffix();
        return installedGenerator ? type === installedGenerator : type === 'base';
    }

    normalizeGeneratorWeaponId(weaponId) {
        const definition = this.getWeaponDefinition(weaponId);
        const type = this.getGeneratorWeaponType(definition);
        if (!definition || type === null || type === 'unmapped') return weaponId;

        const installedGenerator = this.getInstalledLaserGeneratorSuffix();
        const targetType = installedGenerator || 'base';
        if (type === targetType) return weaponId;
        return this.getGeneratorWeaponVariant(definition, targetType)?.id || weaponId;
    }

    normalizeLaserWeaponSelections() {
        if (!this.weaponsDataLoaded || !this.systemsDataLoaded) return;
        const normalizeCategory = category => {
            const selections = this.outfitData.weapons[category] || [];
            for (const selection of selections) {
                const normalizedId = this.normalizeGeneratorWeaponId(selection.weaponId);
                if (normalizedId === selection.weaponId) continue;
                selection.weaponId = normalizedId;
                this.applyWeaponRequirements(selection, category);
            }
            this.outfitData.weapons[category] = this.mergeSelectionQuantities(
                selections,
                weapon => weapon.weaponId
                    ? JSON.stringify([
                        weapon.weaponId,
                        Boolean(weapon.isTurreted),
                        category === 'offensive' ? weapon.arc : ''
                    ])
                    : null
            );
        };
        normalizeCategory('offensive');
        normalizeCategory('defensive');
        this.outfitData.weapons.spinal = this.normalizeGeneratorWeaponId(
            this.outfitData.weapons.spinal
        );
    }

    isCatalogItemAvailable(item) {
        return this.isOptionAvailable(item);
    }

    updateSystemCount(target) {
        const field = target.dataset.systemCount;
        if (!field) return;
        const count = this.parseCount(target.value);
        if (field.startsWith('entropy:')) {
            const id = field.slice('entropy:'.length);
            const item = this.systemsData.entropy.find(option => option.id === id);
            if (!item) return;
            this.outfitData.systems.entropy[id] = {
                count,
                radiance: item.radiance,
                requiredTech: [...(item.requiredTech || [])]
            };
        } else if (field.startsWith('quantum:')) {
            const id = field.slice('quantum:'.length);
            if (!OutfitWidget.QUANTUM_SYSTEM_IDS.includes(id)) return;
            this.outfitData.systems.quantum[id] = count;
        } else if (field === 'laserGenerator') {
            this.outfitData.systems.general.laserGenerator.count = count;
        } else {
            this.outfitData.systems.general[field] = count;
        }
        target.value = String(count);
        if (field === 'berthing') {
            const cargoInput = this.element?.querySelector(`#${this.id}-berthing-cargo`);
            const berthInput = this.element?.querySelector(`#${this.id}-berthing-value`);
            this.refreshBerthingAllocationUI(
                cargoInput === document.activeElement,
                berthInput === document.activeElement
            );
        }
    }

    updateBerthingFromCargo(rawValue, preserveCargoInput = false) {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        const berthingSystems = this.parseCount(this.outfitData.systems.general.berthing);
        const maximumCargo = berthingSystems * 50;
        const allocation = preserveCargoInput
            ? Math.floor(parsed / 10) * 10
            : Math.round(parsed / 10) * 10;
        const cargo = Math.max(0, Math.min(allocation, maximumCargo));
        this.outfitData.systems.general.berthingCargo = cargo;
        this.refreshBerthingAllocationUI(preserveCargoInput && parsed <= maximumCargo);
    }

    updateBerthingFromBerths(rawValue, preserveBerthsInput = false) {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        const berthingSystems = this.parseCount(this.outfitData.systems.general.berthing);
        const maximumBerths = berthingSystems * 5;
        const berths = Math.max(0, Math.min(Math.round(parsed), maximumBerths));
        this.outfitData.systems.general.berthingCargo =
            (maximumBerths - berths) * 10;
        this.refreshBerthingAllocationUI(false, preserveBerthsInput && parsed <= maximumBerths);
    }

    refreshBerthingAllocationUI(preserveCargoInput = false, preserveBerthsInput = false) {
        const berthingInput = this.element?.querySelector(`#${this.id}-system-berthing`);
        const cargoInput = this.element?.querySelector(`#${this.id}-berthing-cargo`);
        const slider = this.element?.querySelector(`#${this.id}-berthing-slider`);
        const berthingValue = this.element?.querySelector(`#${this.id}-berthing-value`);
        const berthingSystems = this.parseCount(this.outfitData.systems.general.berthing);
        const maximumCargo = berthingSystems * 50;
        const cargo = Math.min(
            this.parseCount(this.outfitData.systems.general.berthingCargo),
            maximumCargo
        );
        this.outfitData.systems.general.berthingCargo = cargo;
        const berths = Math.max(0, berthingSystems * 5 - cargo / 10);
        if (berthingInput) berthingInput.value = String(berthingSystems);
        if (berthingValue) {
            if (!preserveBerthsInput) berthingValue.value = String(berths);
            berthingValue.max = String(berthingSystems * 5);
        }
        if (cargoInput) {
            if (!preserveCargoInput) cargoInput.value = String(cargo);
            cargoInput.max = String(maximumCargo);
            cargoInput.disabled = berthingSystems <= 0 ||
                berthingInput?.disabled === true;
        }
        if (slider) {
            slider.max = String(maximumCargo);
            slider.value = String(cargo);
            slider.disabled = berthingSystems <= 0 ||
                berthingInput?.disabled === true;
        }
    }

    refreshUtilityDeviceRows(collection) {
        this.renderUtilityDeviceRows(collection);
    }

    refreshUtilityDevicePickers() {
        for (const collection of ['radiators', 'defenses']) {
            const picker = this.element?.querySelector(`[data-utility-picker="${collection}"]`);
            const wrapper = picker?.closest('.design-picker');
            if (!picker || !wrapper) continue;
            const selectedId = picker.value;
            wrapper.outerHTML = this.renderUtilityDevicePicker(collection);
            const refreshedPicker = this.element?.querySelector(`[data-utility-picker="${collection}"]`);
            if (refreshedPicker && Array.from(refreshedPicker.options).some(option => option.value === selectedId)) {
                refreshedPicker.value = selectedId;
            }
        }
    }

    refreshWeaponPickers() {
        for (const category of ['offensive', 'defensive']) {
            const picker = this.element?.querySelector(`[data-weapon-picker="${category}"]`);
            const wrapper = picker?.closest('.design-picker');
            if (!picker || !wrapper) continue;
            const selectedId = this.normalizeGeneratorWeaponId(picker.value);
            wrapper.outerHTML = this.renderWeaponPicker(category);
            const refreshedPicker = this.element?.querySelector(`[data-weapon-picker="${category}"]`);
            if (refreshedPicker && Array.from(refreshedPicker.options).some(option => option.value === selectedId)) {
                refreshedPicker.value = selectedId;
            }
        }
    }

    refreshSystemsControls() {
        const general = this.element?.querySelector(`#${this.id}-general-system-rows`);
        const entropy = this.element?.querySelector(`#${this.id}-entropy-system-rows`);
        const quantum = this.element?.querySelector(`#${this.id}-quantum-system-rows`);
        if (general) general.innerHTML = this.renderGeneralSystems();
        if (entropy) entropy.innerHTML = this.renderEntropySystems();
        if (quantum) quantum.innerHTML = this.renderQuantumSystems();
    }

    refreshCatalogControls() {
        if (this.systemsDataLoaded) {
            const knownIds = new Set(this.systemsData.entropy.map(item => item.id));
            const unknownSelections = Object.fromEntries(
                Object.entries(this.outfitData.systems.entropy)
                    .filter(([id]) => !knownIds.has(id))
            );
            this.outfitData.systems.entropy = {
                ...unknownSelections,
                ...Object.fromEntries(this.systemsData.entropy.map(item => {
                    const selection = this.outfitData.systems.entropy[item.id] || {};
                    return [item.id, {
                        count: this.parseCount(selection.count),
                        radiance: item.radiance,
                        requiredTech: [...(item.requiredTech || [])]
                    }];
                }))
            };
        }
        this.outfitData.systems.quantum = Object.fromEntries(
            OutfitWidget.QUANTUM_SYSTEM_IDS.map(id => [
                id,
                this.parseCount(this.outfitData.systems.quantum?.[id])
            ])
        );
        this.refreshUtilityDevicePickers();
        this.refreshUtilityDeviceRows('radiators');
        this.refreshUtilityDeviceRows('defenses');
        this.refreshSystemsControls();
        this.refreshBerthingAllocationUI();
        this.refreshSectionCostLabels();
        this.refreshWeaponResourceDisplay();
        this.refreshSubsectionAvailability();
    }

    renderWeaponCategory(category, title) {
        const subtotalKey = category === 'offensive'
            ? 'offensive-weapon-subtotal'
            : 'defensive-weapon-subtotal';
        return `<div class="design-subsection design-loadout-group outfit-availability-container" data-availability-key="${category}-weapons">
            ${this.renderOutfitSubsectionTitle(title, subtotalKey)}
            ${this.renderWeaponPicker(category)}
            <div id="${this.id}-${category}-weapons-table" class="design-entry-list"></div>
            <p class="outfit-unavailable-hint" hidden>No options available with current technology.</p>
        </div>`;
    }

    renderWeaponPicker(category) {
        const items = category === 'offensive' ? this.getOffensiveWeapons() : this.getPDWeapons();
        const available = this.filterByRequiredTech(this.getGeneratorFilteredWeapons(items));
        const options = available.map(weapon => {
            const label = category === 'defensive'
                ? weapon.name
                : `${weapon.name} (${weapon.hp || weapon.categoryName})`;
            return `<option value="${OutfitWidget.escapeHTML(weapon.id)}">${OutfitWidget.escapeHTML(label)}</option>`;
        }).join('');
        return `<div class="design-picker">
            <select class="design-select" data-weapon-picker="${category}" aria-label="${category === 'offensive' ? 'Offensive' : 'Defensive'} weapon to add">
                <option value="">Select weapon...</option>${options}
            </select>
            <button type="button" class="widget-add-action" data-weapon-action="add" data-category="${category}" ${available.length ? '' : 'disabled'}>Add</button>
        </div>`;
    }

    renderWeaponOptions(weapons, selectedId = '') {
        const available = this.filterByRequiredTech(this.getGeneratorFilteredWeapons(weapons));
        const selected = weapons.find(weapon => weapon.id === selectedId);
        if (selectedId && !available.some(weapon => weapon.id === selectedId)) {
            if (selected) available.push(selected);
            else {
                return `<option value="${OutfitWidget.escapeHTML(selectedId)}" selected>${OutfitWidget.escapeHTML(selectedId)} (unavailable)</option>` +
                    available.map(weapon =>
                        `<option value="${OutfitWidget.escapeHTML(weapon.id)}">${OutfitWidget.escapeHTML(weapon.name)} (${OutfitWidget.escapeHTML(weapon.hp || weapon.categoryName)})</option>`
                    ).join('');
            }
        }
        return available.map(weapon => {
            const unavailable = !this.isOptionAvailable(weapon) ||
                !this.isGeneratorWeaponCompatible(weapon);
            return `<option value="${OutfitWidget.escapeHTML(weapon.id)}" ${weapon.id === selectedId ? 'selected' : ''}>${OutfitWidget.escapeHTML(weapon.name)}${unavailable ? ' (unavailable)' : ` (${OutfitWidget.escapeHTML(weapon.hp || weapon.categoryName)})`}</option>`;
        }).join('');
    }

    renderWeaponRows(category) {
        const weapons = this.outfitData.weapons?.[category] || [];
        return weapons.map((weapon, index) => this.renderWeaponRow(category, weapon, index)).join('');
    }

    renderWeaponTable(category) {
        const weapons = this.outfitData.weapons?.[category] || [];
        if (!weapons.length) return '';
        return this.renderWeaponRows(category);
    }

    renderWeaponRow(category, weapon, index) {
        const all = category === 'offensive' ? this.getOffensiveWeapons() : this.getPDWeapons();
        const selected = all.find(item => item.id === weapon.weaponId);
        const weaponName = selected?.name || weapon.name || weapon.weaponId || 'Unavailable weapon';
        const turretDisabled = category === 'offensive' && this.isTurretOptionDisabled(selected);
        const isTurreted = category === 'offensive' && !turretDisabled && !!weapon.isTurreted;
        const arc = this.getValidWeaponArc(weapon.arc, selected?.isMain, isTurreted);
        const arcOption = (value, label) => {
            const disabled = selected?.isMain && (value === 'F' || value === 'A');
            return `<label class="arc-option${disabled ? ' disabled' : ''}"><input type="checkbox" data-arc-checkbox data-category="${category}" data-index="${index}" value="${value}" ${arc.includes(value) ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${label}</label>`;
        };
        const turretOption = category === 'offensive'
            ? `<div class="design-entry-options">
                <label class="turret-option${turretDisabled ? ' disabled' : ''}"><input type="checkbox" data-weapon-field="isTurreted" data-category="${category}" data-index="${index}" aria-label="Install as turret" ${isTurreted ? 'checked' : ''} ${turretDisabled ? 'disabled' : ''}> Turret</label>
                ${arcOption('F', 'Fore')}${arcOption('P', 'Port')}${arcOption('S', 'Starboard')}${arcOption('A', 'Aft')}
            </div>`
            : '';
        const quantity = this.parseCount(weapon.count);
        const cost = (Number(selected?.cost) || 0) * quantity;
        const unavailable = !selected || !this.isOptionAvailable(selected) ||
            !this.isGeneratorWeaponCompatible(selected);
        return `<div class="design-entry-group">
            <div class="design-entry${unavailable ? ' is-unavailable' : ''}">
                <span class="design-entry-name">${OutfitWidget.escapeHTML(weaponName)}${unavailable ? ' (unavailable)' : ''}</span>
                <span class="design-entry-quantity">×${quantity}</span>
                <span class="design-entry-cost">${cost ? this.formatTotalCost(cost, 'weapons') : ''}</span>
                <button type="button" class="widget-remove-action" data-weapon-action="remove" data-category="${category}" data-index="${index}" aria-label="Remove one ${OutfitWidget.escapeHTML(weaponName)}">−</button>
            </div>
            ${turretOption}
        </div>`;
    }

    refreshWeapons() {
        if (!this.element) return;
        this.normalizeLaserWeaponSelections();
        this.refreshWeaponPickers();
        const spinal = this.element.querySelector(`#${this.id}-spinal-weapon`);
        if (spinal) {
            const selected = this.outfitData.weapons.spinal || '';
            spinal.innerHTML = `<option value="">None</option>${this.renderWeaponOptions(this.getSpinalWeapons(), selected)}`;
            spinal.value = selected;
        }
        for (const category of ['offensive', 'defensive']) {
            const table = this.element.querySelector(`#${this.id}-${category}-weapons-table`);
            if (table) {
                table.innerHTML = this.renderWeaponTable(category);
                table.hidden = (this.outfitData.weapons?.[category] || []).length === 0;
            }
        }
        this.refreshSectionCostLabels();
        this.refreshWeaponResourceDisplay();
        this.refreshSubsectionAvailability();
    }

    refreshSubsectionAvailability() {
        if (!this.element) return;
        const availability = {
            radiators: this.filterByRequiredTech(this.utilitiesData.radiators).length > 0,
            'utility-defenses': this.filterByRequiredTech(this.utilitiesData.defenses).length > 0,
            'spinal': this.filterByRequiredTech(
                this.getGeneratorFilteredWeapons(this.getSpinalWeapons())
            ).length > 0,
            'offensive-weapons': this.filterByRequiredTech(
                this.getGeneratorFilteredWeapons(this.getOffensiveWeapons())
            ).length > 0,
            'defensive-weapons': this.filterByRequiredTech(
                this.getGeneratorFilteredWeapons(this.getPDWeapons())
            ).length > 0,
            'general-systems': this.systemsData.general.some(item =>
                item.id === 'laser-generator'
                    ? this.getAvailableLaserGeneratorTechs().length > 0
                    : this.isCatalogItemAvailable(item)
            ),
            'entropy-systems': this.systemsData.entropy.some(item => this.isCatalogItemAvailable(item)),
            'quantum-systems': this.systemsData.quantum.some(item => this.isCatalogItemAvailable(item))
        };
        this.element.querySelectorAll('[data-availability-key]').forEach(container => {
            const available = availability[container.dataset.availabilityKey] ?? true;
            container.classList.toggle('outfit-subsection-unavailable', !available);
            const hint = container.querySelector('.outfit-unavailable-hint');
            if (hint) hint.hidden = available;
        });
    }

    getWeaponResourceUse() {
        const resourceUse = { hardpoints: 0, utilities: 0, emplacements: 0 };
        const addWeapon = (weaponId, count, isTurreted = false) => {
            const weapon = this.getWeaponDefinition(weaponId);
            const { resourceType, resourceCount } = WeaponCatalogue.getMount(weapon);
            if (!weapon || !resourceType ||
                !Object.prototype.hasOwnProperty.call(resourceUse, resourceType)) return;
            const turretSurcharge = isTurreted && !this.isTurretOptionDisabled(weapon) ? 1 : 0;
            resourceUse[resourceType] += this.parseCount(count) *
                (this.parseCount(resourceCount) + turretSurcharge);
        };

        addWeapon(this.outfitData.weapons?.spinal, 1);
        for (const category of ['offensive', 'defensive']) {
            for (const weapon of this.outfitData.weapons?.[category] || []) {
                addWeapon(
                    weapon.weaponId,
                    weapon.count,
                    category === 'offensive' && weapon.isTurreted
                );
            }
        }
        return resourceUse;
    }

    refreshWeaponResourceDisplay() {
        if (!this.element) return;
        const resources = this.getResourceSources();
        this.refreshResourceCounters(resources);
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.refreshArmorDisplay(resources);
        this.renderCoreProperties(this.getCoreData());
    }

    getResourceUse() {
        const weaponUse = this.getWeaponResourceUse();
        const core = this.getCoreData();
        const utilityDeviceUse = ['radiators', 'defenses'].reduce((sum, collection) =>
            sum + (this.outfitData.utilityDevices?.[collection] || []).reduce(
                (subtotal, selection) => subtotal + (selection.id ? this.parseCount(selection.count) : 0),
                0
            ), 0);
        const generalSystems = this.outfitData.systems.general;
        const generalSystemUse = this.parseCount(generalSystems.berthing) +
            this.parseCount(generalSystems.craftLauncher) +
            (generalSystems.laserGenerator.techId ? this.parseCount(generalSystems.laserGenerator.count) : 0) +
            this.parseCount(generalSystems.tending);
        const entropySystemUse = this.systemsData.entropy.reduce((sum, item) =>
            sum + this.parseCount(this.outfitData.systems.entropy[item.id]?.count), 0);
        const quantumSystemUse = this.getQuantumSystemCount();
        return {
            core: core ? this.parseCount(core.powerplantSize) : 0,
            emplacements: weaponUse.emplacements,
            utilities: weaponUse.utilities + utilityDeviceUse,
            systems: generalSystemUse + entropySystemUse + quantumSystemUse,
            hardpoints: weaponUse.hardpoints + this.getConnectedLoadoutHardpointUse()
        };
    }

    getConnectedLoadoutHardpointUse() {
        return this.getConnectedDataByNodeType('Loadout').reduce((total, connection) => {
            const data = connection.data || {};
            const loadout = data.loadoutData || {};
            if (!loadout.operational) return total;
            const used = Number(data.hardpointsUsed ?? loadout.hardpointDevices?.length);
            return total + (Number.isFinite(used) && used > 0 ? used : 0);
        }, 0);
    }

    onTechTreeUpdated() {
        this.refresh();
    }

    onEconomyModeChanged() {
        this.refreshSectionCostLabels();
        this.renderCoreProperties(this.getCoreData());
    }

    updateWidgetTitle() {
        const title = this.element?.querySelector('.widget-title');
        if (title) title.textContent = this.title;
    }

    updateTitle(text = this.outfitData.name) {
        if (typeof text === 'string') this.title = text || 'New Outfit';
        this.updateWidgetTitle();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.syncConnectedData();
    }

    onParentDataChanged() {
        this.syncConnectedData();
    }

    syncConnectedData() {
        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    onOutfitDataChanged() {
        this.notifyChildrenOfChange();
    }

    ensureNodeForConnection(nodeId) {
        const prefix = `${this.id}-input:Loadout-`;
        if (!nodeId.startsWith(prefix)) return;
        const requiredIndex = Number(nodeId.slice(prefix.length));
        if (!Number.isSafeInteger(requiredIndex) || requiredIndex < 1) return;
        while (!this.nodes.has(nodeId) &&
            (this.expandableNodeGroups.get('loadouts')?.nodes.length || 0) < requiredIndex) {
            this.addExpandableGroupNode('loadouts');
        }
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Class', 'Class', 0, 0.5, {
            sectionId: 'category-core', anchorId: `${this.id}-category-core`, anchorOffset: 32, minSpacing: 32
        });
        this.addNode('input', 'Core', 'Core', 0, 0.25, {
            sectionId: 'category-core', anchorId: 'outfit-category-core-heading', minSpacing: 32, optional: true
        });
        this.addNode('output', 'Outfit', 'Outfit', 1, 0.25, {
            sectionId: 'meta', anchorId: `${this.id}-meta`, minSpacing: 32
        });
        this.createExpandableNodeGroup('loadouts', {
            baseLabel: 'Loadout',
            labelFormatter: () => 'Loadout',
            nodeType: 'Loadout',
            direction: 'input',
            sectionId: 'category-armor',
            anchorId: `${this.id}-category-armor`,
            anchorOffset: 32,
            minSpacing: 32,
            minAvailable: 1,
            maxFree: 1,
            initialNodes: 1,
            relativeY: 0.65,
            optional: true
        });
        this.reflowNodes();
    }

    syncDataFromForm() {
        if (!this.element) return;
        const value = id => this.element.querySelector(`#${this.id}-${id}`);
        if (value('name')) this.outfitData.name = value('name').value;
        if (value('notes')) this.outfitData.notes = value('notes').value;
        if (value('armor')) this.outfitData.defenses.armor = this.parseCount(value('armor').value);
        if (value('role')) this.outfitData.role = value('role').value;
        if (value('custom-role') && this.outfitData.roleMode === 'custom') {
            this.outfitData.customRole = value('custom-role').value;
            this.outfitData.role = this.outfitData.customRole;
        }
        if (value('operational')) this.outfitData.operational = value('operational').checked;
        if (value('ignore-required-tech')) {
            this.outfitData.ignoreRequiredTech = value('ignore-required-tech').checked;
        }
        const selectedCore = value('core-select');
        if (selectedCore && !selectedCore.disabled) this.outfitData.coreWidgetId = selectedCore.value;
        const spinal = value('spinal-weapon');
        if (spinal) this.outfitData.weapons.spinal = spinal.value;
        const laserTech = this.element.querySelector('[data-laser-generator-tech]');
        if (laserTech && this.systemsData.general.length) {
            this.outfitData.systems.general.laserGenerator.techId = laserTech.value;
        }
        this.element.querySelectorAll('[data-system-count]').forEach(input =>
            this.updateSystemCount(input)
        );
        const cargoInput = this.element.querySelector(`#${this.id}-berthing-cargo`);
        const berthInput = this.element.querySelector(`#${this.id}-berthing-value`);
        this.refreshBerthingAllocationUI(
            cargoInput === document.activeElement,
            berthInput === document.activeElement
        );
    }

    getSelectedRequiredTech() {
        const requirements = [];
        const add = value => {
            if (typeof value === 'string' && value.trim()) requirements.push(value.trim());
            else if (Array.isArray(value)) value.forEach(add);
        };
        const core = this.outfitData.selectedCore;
        if (core) {
            add(core.requiredTech);
            add(core.reactor);
            add(core.engine);
            add(core.manifold);
        }
        for (const weapon of this.outfitData.weapons.offensive.concat(this.outfitData.weapons.defensive)) {
            add(weapon.requiredTech);
        }
        for (const collection of ['radiators', 'defenses']) {
            for (const selection of this.outfitData.utilityDevices[collection]) {
                const definition = this.utilitiesData[collection].find(item => item.id === selection.id);
                add(definition?.requiredTech || selection.requiredTech);
            }
        }
        for (const item of this.systemsData.general) {
            if (item.id === 'laser-generator') {
                const techId = this.outfitData.systems.general.laserGenerator.techId;
                if (techId) add(techId);
            } else if (this.parseCount(this.outfitData.systems.general[this.getGeneralSystemField(item.id)]) > 0) {
                add(item.requiredTech);
            }
        }
        for (const item of this.systemsData.entropy) {
            if (this.parseCount(this.outfitData.systems.entropy[item.id]?.count) > 0) {
                add(item.requiredTech);
            }
        }
        for (const item of this.systemsData.quantum) {
            if (this.parseCount(this.outfitData.systems.quantum[item.id]) > 0) {
                add(item.requiredTech);
            }
        }
        for (const connection of this.getConnectedDataByNodeType('Loadout')) {
            const loadout = connection.data?.loadoutData;
            if (loadout?.operational && Array.isArray(loadout.requiredTech)) {
                add(loadout.requiredTech);
            }
        }
        const spinal = this.getAllWeapons().find(weapon => weapon.id === this.outfitData.weapons.spinal);
        add(spinal?.requiredTech);
        return Array.from(new Set(requirements));
    }

    getSerializedData() {
        this.syncDataFromForm();
        this.outfitData.resources = this.getResourceSources();
        this.outfitData.resourceUse = this.getResourceUse();
        this.refreshArmorDisplay(this.outfitData.resources);
        const core = this.getCoreData();
        this.outfitData.selectedCore = core ? this.serializeCore(core) : null;
        this.outfitData.ignoreRequiredTech = this.ignoreRequiredTech;
        this.outfitData.weapons.offensive.forEach(weapon => this.applyWeaponRequirements(weapon, 'offensive'));
        this.outfitData.weapons.defensive.forEach(weapon => this.applyWeaponRequirements(weapon, 'defensive'));
        for (const collection of ['radiators', 'defenses']) {
            this.outfitData.utilityDevices[collection] =
                this.outfitData.utilityDevices[collection].map(selection => {
                    const definition = this.utilitiesData[collection].find(item => item.id === selection.id);
                    return definition
                        ? { ...definition, count: this.parseCount(selection.count) }
                        : { ...selection, count: this.parseCount(selection.count) };
                });
        }
        for (const item of this.systemsData.entropy) {
            const selection = this.outfitData.systems.entropy[item.id] || {};
            const count = this.parseCount(selection.count);
            this.outfitData.systems.entropy[item.id] = {
                count,
                radiance: item.radiance,
                requiredTech: count > 0 ? [...(item.requiredTech || [])] : []
            };
        }
        this.outfitData.systems.quantum = Object.fromEntries(
            OutfitWidget.QUANTUM_SYSTEM_IDS.map(id => [
                id,
                this.parseCount(this.outfitData.systems.quantum?.[id])
            ])
        );
        const requiredTech = this.getSelectedRequiredTech();
        this.outfitData.requiredTech = requiredTech;
        const selectedSpinal = this.getAllWeapons().find(weapon => weapon.id === this.outfitData.weapons.spinal);
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        return {
            ...super.getSerializedData(),
            outfitData: this.outfitData,
            ignoreRequiredTech: this.ignoreRequiredTech,
            requiredTech,
            spinalWeapon: selectedSpinal ? {
                id: selectedSpinal.id,
                name: selectedSpinal.name,
                hp: selectedSpinal.hp,
                ...WeaponCatalogue.getMount(selectedSpinal),
                isSpinal: selectedSpinal.isSpinal,
                requiredTech: [...(selectedSpinal.requiredTech || [])]
            } : null
        };
    }

    getHullPlanExportDevices() {
        const systems = [];
        const addSystem = (name, count) => {
            const quantity = this.parseCount(count);
            if (name && quantity > 0) systems.push({ name, count: quantity });
        };

        for (const item of this.systemsData.general) {
            if (item.id === 'laser-generator') {
                const selection = this.outfitData.systems.general.laserGenerator;
                const technology = this.laserGeneratorTechs.find(tech =>
                    tech.id === selection.techId
                );
                addSystem(
                    technology ? `${item.name} (${technology.name})` : item.name,
                    selection.techId ? selection.count : 0
                );
            } else {
                addSystem(
                    item.name,
                    this.outfitData.systems.general[this.getGeneralSystemField(item.id)]
                );
            }
        }
        for (const item of this.systemsData.entropy) {
            addSystem(item.name, this.outfitData.systems.entropy[item.id]?.count);
        }
        for (const item of this.systemsData.quantum) {
            addSystem(item.name, this.outfitData.systems.quantum[item.id]);
        }

        const utilities = [];
        for (const collection of ['radiators', 'defenses']) {
            for (const selection of this.outfitData.utilityDevices[collection] || []) {
                const count = this.parseCount(selection.count);
                if (selection.name && count > 0) utilities.push({ name: selection.name, count });
            }
        }
        for (const category of ['offensive', 'defensive']) {
            for (const weapon of this.outfitData.weapons[category] || []) {
                if (WeaponCatalogue.getMount(weapon).resourceType === 'utilities' && weapon.name) {
                    const count = this.parseCount(weapon.count);
                    if (count > 0) utilities.push({ name: weapon.name, count });
                }
            }
        }

        return { systems, utilities };
    }

    applyWeaponRequirements(weapon, category) {
        const definition = this.getAllWeapons().find(item => item.id === weapon.weaponId);
        const required = definition?.requiredTech || weapon.requiredTech || [];
        weapon.name = definition?.name || weapon.name || '';
        weapon.requiredTech = [...required];
        if (definition) {
            weapon.hp = definition.hp ?? null;
            Object.assign(weapon, WeaponCatalogue.getMount(definition));
            weapon.isSpinal = Boolean(definition.isSpinal);
            weapon.isMain = Boolean(definition.isMain);
            weapon.isPointDefense = Boolean(definition.isPointDefense);
        }
        weapon.isTurreted = category === 'offensive' && Boolean(weapon.isTurreted);
        this.normalizeWeaponArc(weapon, category);
    }

    mergeSelectionQuantities(selections, getKey) {
        const merged = [];
        const indexes = new Map();
        for (const selection of selections) {
            const key = getKey(selection);
            if (key === null || key === undefined) {
                merged.push({ ...selection, count: this.parseCount(selection.count) });
                continue;
            }
            const index = indexes.get(key);
            if (index === undefined) {
                indexes.set(key, merged.length);
                merged.push({ ...selection, count: this.parseCount(selection.count) });
            } else {
                merged[index].count += this.parseCount(selection.count);
            }
        }
        return merged;
    }

    loadSerializedData(data = {}) {
        super.loadSerializedData(data);
        const incoming = data.outfitData || {};
        const pickFields = (source, fields) => Object.fromEntries(
            fields.filter(key => Object.prototype.hasOwnProperty.call(source || {}, key))
                .map(key => [key, source[key]])
        );
        const weaponFields = [
            'weaponId', 'count', 'isTurreted', 'requiredTech', 'arc', 'name', 'hp',
            'resourceType', 'resourceCount', 'isSpinal', 'isMain', 'isPointDefense'
        ];
        const deviceFields = [
            'id', 'name', 'type', 'count', 'cost', 'radiance', 'offset', 'efficiency',
            'capacity', 'limit', 'deployed', 'reserved', 'regeneration', 'requiredTech'
        ];
        const loadDeviceSelections = collection =>
            Array.isArray(incoming.utilityDevices?.[collection])
                ? incoming.utilityDevices[collection]
                    .filter(selection => selection && typeof selection === 'object')
                    .map(selection => pickFields(selection, deviceFields))
                : [];
        const loadWeapons = category => Array.isArray(incoming.weapons?.[category])
            ? incoming.weapons[category]
                .filter(weapon => weapon && typeof weapon === 'object')
                .map(weapon => pickFields(weapon, weaponFields))
            : [];
        const selectedCoreFields = [
            'name', 'operational', 'developmentCost', 'reactorValue', 'engineValue',
            'manifoldValue', 'reactorName', 'engineName', 'manifoldName', 'reactorStability',
            'engineEfficiency', 'manifoldEfficiency', 'gears', 'hardpoints', 'effectiveHulls',
            'burnAnalysis', 'cost', 'reactor', 'engine', 'manifold', 'requiredTech'
        ];
        this.outfitData = {
            ...this.outfitData,
            ...pickFields(incoming, [
                'name', 'role', 'customRole', 'roleMode', 'notes', 'operational',
                'ignoreRequiredTech', 'coreWidgetId', 'requiredTech'
            ]),
            operational: Boolean(incoming.operational ?? this.outfitData.operational),
            resources: {
                ...this.outfitData.resources,
                ...pickFields(incoming.resources, [
                    'utilities', 'emplacements', 'systems', 'hardpoints', 'core',
                    'containmentHulls'
                ])
            },
            defenses: {
                ...this.outfitData.defenses,
                ...pickFields(incoming.defenses, ['armor'])
            },
            utilityDevices: {
                radiators: loadDeviceSelections('radiators'),
                defenses: loadDeviceSelections('defenses')
            },
            systems: {
                general: {
                    ...this.outfitData.systems.general,
                    ...pickFields(incoming.systems?.general, [
                        'berthing', 'berthingCargo', 'craftLauncher', 'tending'
                    ]),
                    laserGenerator: {
                        ...this.outfitData.systems.general.laserGenerator,
                        ...pickFields(incoming.systems?.general?.laserGenerator, ['techId', 'count'])
                    }
                },
                entropy: {
                    ...this.outfitData.systems.entropy,
                    ...(incoming.systems?.entropy && typeof incoming.systems.entropy === 'object'
                        ? incoming.systems.entropy
                        : {})
                },
                quantum: Object.fromEntries(
                    OutfitWidget.QUANTUM_SYSTEM_IDS.map(id => [
                        id,
                        this.parseCount(incoming.systems?.quantum?.[id])
                    ])
                )
            },
            resourceUse: {
                ...this.outfitData.resourceUse,
                ...pickFields(incoming.resourceUse, [
                    'utilities', 'emplacements', 'systems', 'hardpoints', 'core'
                ])
            },
            selectedCore: incoming.selectedCore && typeof incoming.selectedCore === 'object'
                ? pickFields(incoming.selectedCore, selectedCoreFields)
                : null,
            weapons: {
                spinal: incoming.weapons?.spinal ?? this.outfitData.weapons.spinal,
                offensive: loadWeapons('offensive'),
                defensive: loadWeapons('defensive')
            }
        };
        for (const collection of ['radiators', 'defenses']) {
            this.outfitData.utilityDevices[collection] = this.mergeSelectionQuantities(
                this.outfitData.utilityDevices[collection],
                selection => selection.id
            );
        }
        for (const category of ['offensive', 'defensive']) {
            this.outfitData.weapons[category].forEach(weapon => this.applyWeaponRequirements(weapon, category));
            this.outfitData.weapons[category] = this.mergeSelectionQuantities(
                this.outfitData.weapons[category],
                weapon => weapon.weaponId
                    ? JSON.stringify([
                        weapon.weaponId,
                        Boolean(weapon.isTurreted),
                        category === 'offensive' ? weapon.arc : ''
                    ])
                    : null
            );
        }
        this.outfitData.ignoreRequiredTech =
            data.ignoreRequiredTech ?? incoming.ignoreRequiredTech ?? this.outfitData.ignoreRequiredTech;
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.outfitData.roleMode = incoming.roleMode ??
            (this.outfitData.customRole ? 'custom' : 'dropdown');
        this.ensureRoleAvailable(this.outfitData.role);
        this.title = this.outfitData.name || 'New Outfit';
        this.syncFormFromData();
    }

    syncFormFromData() {
        if (!this.element) return;
        const setValue = (id, value) => {
            const input = this.element.querySelector(`#${this.id}-${id}`);
            if (input) input.value = value ?? '';
        };
        setValue('notes', this.outfitData.notes);
        setValue('armor', this.outfitData.defenses?.armor);
        setValue('role', this.outfitData.role);
        setValue('custom-role', this.outfitData.customRole);
        this.applyRoleMode(this.outfitData.roleMode);
        const operational = this.element.querySelector(`#${this.id}-operational`);
        const ignore = this.element.querySelector(`#${this.id}-ignore-required-tech`);
        if (operational) operational.checked = this.outfitData.operational;
        if (ignore) ignore.checked = this.ignoreRequiredTech;
        this.updateWidgetTitle();
        this.refreshCatalogControls();
        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.refreshSummary();
    }

    refreshSummary() {
        if (!this.summaryElement) return;
        const name = document.createElement('strong');
        name.textContent = this.outfitData.name || 'New Outfit';
        const role = document.createElement('span');
        role.textContent = this.outfitData.role || 'No role';
        const summary = document.createElement('div');
        summary.className = 'summary-grid';
        const usage = this.getResourceUse();
        for (const resource of ['core', 'emplacements', 'utilities', 'systems', 'hardpoints']) {
            const entry = document.createElement('div');
            entry.className = 'summary-item';
            entry.textContent = `${resource}: ${usage[resource]} / ${this.outfitData.resources?.[resource] ?? '—'}`;
            summary.appendChild(entry);
        }
        const containment = document.createElement('div');
        containment.className = 'summary-item';
        containment.textContent = `Containment hull basis: ${this.outfitData.resources?.containmentHulls ?? '—'}`;
        summary.appendChild(containment);
        this.summaryElement.replaceChildren(name, role, summary);
    }

    refresh() {
        if (!this.element) return;
        this.refreshWeapons();
        this.refreshCatalogControls();
        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.refreshSectionCostLabels();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    onMinimizeStateChanged(isMinimized) {
        if (!isMinimized) this.refreshSummary();
    }
}
