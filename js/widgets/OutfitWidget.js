// Outfit configuration for a Ship Class, with core-derived resources.
class OutfitWidget extends Widget {
    static calculateGearBurnMetrics(hullCount, baseEngineExponent, instability) {
        const hulls = Number(hullCount);
        const baseExponent = Number(baseEngineExponent);
        const instabilityValue = Number(instability);
        if (![hulls, baseExponent, instabilityValue].every(Number.isFinite) ||
            hulls <= 0 || baseExponent <= 0 || instabilityValue < 0) {
            return null;
        }

        const exponentDenominator = 1 + 0.8 * Math.log(hulls / 28);
        if (!Number.isFinite(exponentDenominator) || exponentDenominator === 0) return null;
        const engineExponent = 1 + (baseExponent - 1) / exponentDenominator;
        const thrustPenalty = 1 + (hulls - 28) / 56;
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
        super('outfit', 'New Outfit', x, y, null);
        this.defaultRoles = [
            'Artillery', 'Brawler', 'Lancer', 'QWarfare', 'Scout',
            'Support', 'Escort', 'Carrier', 'Interceptor'
        ];
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
                    craftLauncher: 0,
                    laserGenerator: { techId: '', count: 0 },
                    tending: 0
                },
                entropy: {}
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
        this.systemsData = { general: [], entropy: [] };
        this.systemsDataLoaded = false;
        this.laserGeneratorTechs = [];
        this.layoutMode = 'three-column';
        this.titleEditHandler = name => {
            this.outfitData.name = name;
            this.updateTitle(name);
        };
        this.ensureRoleAvailable(this.outfitData.role);
        this.init();
        this.onEconomyModeChanged();
        this.loadWeaponsData();
        this.loadUtilitiesData();
        this.loadSystemsData();
        ShipCoreWidget.loadOptions().then(() => this.refreshResourceDisplay());
    }

    static getRoleStorageKey() {
        return 'outfitWidgetRoles';
    }

    static loadStoredRoles(defaultRoles = []) {
        try {
            const raw = localStorage.getItem(OutfitWidget.getRoleStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
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
            localStorage.setItem(OutfitWidget.getRoleStorageKey(), JSON.stringify(roles));
        } catch (error) {
            console.warn('Unable to persist stored outfit roles', error);
        }
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
        }
    }

    formatRoleLabel(role) {
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
    }

    async loadWeaponsData() {
        try {
            const response = await fetch('data/weapons.json');
            if (!response.ok) throw new Error(`Unable to load weapons (${response.status})`);
            const data = await response.json();
            this.weaponsData = data && Array.isArray(data.categories) ? data : { categories: [] };
        } catch (error) {
            console.error('Failed to load weapons data:', error);
            this.weaponsData = { categories: [] };
        }
        this.weaponsDataLoaded = true;
        this.refreshWeapons();
    }

    async loadUtilitiesData() {
        try {
            const response = await fetch('data/utilities.json');
            if (!response.ok) throw new Error(`Unable to load utilities (${response.status})`);
            const data = await response.json();
            if (!data || !Array.isArray(data.radiators) || !Array.isArray(data.defenses)) {
                throw new Error('Utilities data must contain radiators and defenses arrays');
            }
            this.utilitiesData = data;
            this.utilitiesDataLoaded = true;
        } catch (error) {
            console.error('Failed to load utilities data:', error);
            this.utilitiesData = { radiators: [], defenses: [] };
        }
        this.refreshCatalogControls();
    }

    async loadSystemsData() {
        try {
            const [response, techData] = await Promise.all([
                fetch('data/systems.json'),
                TechTree.ensureLoaded()
            ]);
            if (!response.ok) throw new Error(`Unable to load systems (${response.status})`);
            const data = await response.json();
            if (!data || !Array.isArray(data.general) || !Array.isArray(data.entropy)) {
                throw new Error('Systems data must contain general and entropy arrays');
            }
            this.systemsData = data;
            this.systemsDataLoaded = true;
            const laserGenerator = data.general.find(item => item.id === 'laser-generator');
            const techCategory = laserGenerator?.technologyCategory;
            this.laserGeneratorTechs = Object.entries(techData)
                .filter(([, tech]) => tech?.category === techCategory &&
                    typeof tech.name === 'string' && tech.name.toLowerCase().includes('generator'))
                .map(([id, tech]) => ({ id, name: tech.name, requiredTech: [...(tech.requiredTech || [])] }));
            const entropySelections = {};
            for (const item of data.entropy) {
                const existing = this.outfitData.systems.entropy[item.id];
                entropySelections[item.id] = {
                    count: this.parseCount(existing?.count),
                    radiance: item.radiance,
                    requiredTech: [...(item.requiredTech || [])]
                };
            }
            this.outfitData.systems.entropy = entropySelections;
        } catch (error) {
            console.error('Failed to load systems data:', error);
            this.systemsData = { general: [], entropy: [] };
            this.laserGeneratorTechs = [];
        }
        this.refreshCatalogControls();
    }

    refreshArmorDisplay(resources = this.getResourceSources()) {
        const input = this.element?.querySelector(`#${this.id}-armor`);
        if (input) input.value = this.parseCount(this.outfitData.defenses?.armor);
        const result = this.element?.querySelector(`#${this.id}-armor-result`);
        if (result) {
            const capacity = resources.hardpoints;
            const used = this.getArmorHardpointUse(resources);
            result.textContent = `Armor hits: ${this.getArmorHits() ?? '—'} · Hardpoints used: ${used ?? '—'} / ${capacity ?? '—'} · Effective hulls: ${this.getEffectiveHullCount() ?? '—'}`;
        }
        this.outfitData.armorHits = this.getArmorHits();
        this.outfitData.armorHardpoints = this.getArmorHardpointUse(resources);
        this.outfitData.effectiveHulls = this.getEffectiveHullCount();
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
            weapon.isSpinal && weapon.resourceType !== 'hardpoints'
        );
    }

    getMountableWeapons() {
        return this.getAllWeapons().filter(weapon =>
            weapon.resourceType !== 'hardpoints' && (!!weapon.resourceType || weapon.isSpinal)
        );
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
        if (this.ignoreRequiredTech) return weapons;
        return weapons.filter(weapon =>
            (weapon.requiredTech || []).every(tech => window.empire?.hasTech?.(tech) ?? false)
        );
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
        const identity = this.createSection('meta', 'Outfit');
        this.setSectionContent(identity, `
            <div class="ship-information-header outfit-flags">
                <label class="ship-flag"><input id="${this.id}-operational" type="checkbox" ${this.outfitData.operational ? 'checked' : ''}> Operational</label>
                <label class="ship-flag"><input id="${this.id}-ignore-required-tech" type="checkbox" ${this.outfitData.ignoreRequiredTech ? 'checked' : ''}> Ignore Required Tech</label>
            </div>
            <div class="input-group">
                <label for="${this.id}-role">Role</label>
                <select id="${this.id}-role">${this.getRoleOptions()}</select>
                <input id="${this.id}-custom-role" type="text" placeholder="Custom role" value="${OutfitWidget.escapeHTML(this.outfitData.customRole)}">
            </div>
            <div class="input-group">
                <label for="${this.id}-notes">Notes</label>
                <textarea id="${this.id}-notes" placeholder="Doctrine and deployment notes">${OutfitWidget.escapeHTML(this.outfitData.notes)}</textarea>
            </div>
        `);
        sections.appendChild(identity.section);

        const armor = this.createSection('category-armor', 'Armor');
        this.setSectionContent(armor, this.renderArmorSection());
        sections.appendChild(armor.section);

        const core = this.createSection('category-core', 'Core');
        this.addResourceCounter(core.titleElement, 'core');
        this.setSectionContent(core, `
            <div class="input-group outfit-core-source" id="${this.id}-core-source">
                <select id="${this.id}-core-select" aria-label="Select operational core"></select>
            </div>
            <div class="outfit-core-properties" id="${this.id}-core-properties" aria-live="polite"></div>
            <div id="${this.id}-core-cost" class="outfit-section-subtotal" aria-live="polite"></div>
        `);
        sections.appendChild(core.section);

        for (const category of ['emplacements', 'utilities']) {
            const title = category[0].toUpperCase() + category.slice(1);
            const section = this.createSection(`category-${category}`, title);
            this.addResourceCounter(section.titleElement, category);
            const weapons = category === 'emplacements'
                ? this.renderEmplacementWeaponsSection()
                : `${this.renderRadiatorsSection()}
                    ${this.renderUtilityDefensesSection()}
                    ${this.renderWeaponCategory('defensive', 'Defensive Weapons')}`;
            const categoryContent = `${weapons}<div class="outfit-resource-note" id="${this.id}-resource-${category}-note"></div>`;
            this.setSectionContent(section, category === 'utilities'
                ? `${categoryContent}<div id="${this.id}-utility-cost" class="outfit-section-subtotal" aria-live="polite"></div>`
                : `${categoryContent}<div id="${this.id}-emplacement-cost" class="outfit-section-subtotal" aria-live="polite"></div>`);
            sections.appendChild(section.section);
        }

        const systems = this.createSection('category-systems', 'Systems');
        this.addResourceCounter(systems.titleElement, 'systems');
        this.setSectionContent(systems, this.renderSystemsSection());
        sections.appendChild(systems.section);

        this.refreshCoreOptions();
        this.refreshResourceDisplay();
        this.registerLayoutAnchors();
    }

    registerLayoutAnchors() {
        this.resetLayoutAnchors();
        if (!this.element) return;
        for (const sectionId of ['meta', 'category-armor', 'category-core', 'category-emplacements', 'category-utilities', 'category-systems']) {
            const element = this.element.querySelector(`#${this.id}-${sectionId}`);
            if (element) this.addLayoutAnchor(`outfit-${sectionId}`, element, { selector: `#${this.id}-${sectionId}` });
        }
    }

    setupEventListeners() {
        super.setupEventListeners();
        if (this._outfitEventsBound || !this.element) return;
        this._outfitEventsBound = true;

        this.element.addEventListener('focusin', event => {
            if (event.target.id === `${this.id}-core-select`) this.refreshCoreOptions();
        });

        this.element.addEventListener('input', event => {
            const target = event.target;
            if (target.id === `${this.id}-custom-role`) {
                this.outfitData.customRole = target.value;
                this.outfitData.role = target.value.trim();
                this.outfitData.roleMode = 'custom';
            } else if (target.id === `${this.id}-notes`) {
                this.outfitData.notes = target.value;
            } else if (target.dataset.defenseField === 'armor') {
                this.outfitData.defenses.armor = this.parseCount(target.value);
                target.value = this.outfitData.defenses.armor;
            } else if (target.dataset.weaponField === 'count') {
                this.updateWeaponField(target, 'count', this.parseCount(target.value));
                target.value = this.parseCount(target.value);
                const weapon = this.outfitData.weapons?.[target.dataset.category]?.[Number(target.dataset.index)];
                const definition = this.getAllWeapons().find(item => item.id === weapon?.weaponId);
                const costCell = target.closest('tr')?.querySelector('.cost-cell');
                if (costCell) costCell.textContent = this.getWeaponCostDisplay(definition, this.parseCount(target.value));
            } else if (target.dataset.utilityDeviceCount) {
                this.updateUtilityDeviceCount(target);
            } else if (target.dataset.systemCount) {
                this.updateSystemCount(target);
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
                this.outfitData.roleMode = 'dropdown';
                const custom = this.element.querySelector(`#${this.id}-custom-role`);
                if (custom) custom.value = '';
            } else if (target.id === `${this.id}-operational`) {
                this.outfitData.operational = target.checked;
            } else if (target.id === `${this.id}-ignore-required-tech`) {
                this.outfitData.ignoreRequiredTech = target.checked;
                this.refreshWeapons();
                this.refreshCatalogControls();
            } else if (target.id === `${this.id}-core-select`) {
                this.outfitData.coreWidgetId = target.value;
                this.refreshCoreOptions();
                this.refreshResourceDisplay();
            } else if (target.id === `${this.id}-spinal-weapon`) {
                this.outfitData.weapons.spinal = target.value;
            } else if (target.dataset.utilityDeviceSelect) {
                this.updateUtilityDeviceSelection(target);
            } else if (target.dataset.laserGeneratorTech !== undefined) {
                this.outfitData.systems.general.laserGenerator.techId = target.value;
                this.refreshSystemsControls();
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
            const utilityButton = event.target.closest('[data-utility-action]');
            if (utilityButton) {
                const collection = utilityButton.dataset.collection;
                if (utilityButton.dataset.utilityAction === 'add' &&
                    (collection === 'radiators' || collection === 'defenses')) {
                    this.outfitData.utilityDevices[collection].push({ id: '', count: 0, requiredTech: [] });
                } else if (utilityButton.dataset.utilityAction === 'remove' &&
                    (collection === 'radiators' || collection === 'defenses')) {
                    this.outfitData.utilityDevices[collection].splice(Number(utilityButton.dataset.index), 1);
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
                const weapon = {
                    weaponId: '', count: 0, isTurreted: false,
                    requiredTech: []
                };
                if (category === 'offensive') weapon.arc = '';
                this.outfitData.weapons[category].push(weapon);
            } else if (button.dataset.weaponAction === 'remove') {
                this.outfitData.weapons[category].splice(Number(button.dataset.index), 1);
            } else {
                return;
            }
            this.refreshWeapons();
            this.onOutfitDataChanged();
            this.refreshSummary();
        });
    }

    updateWeaponField(target, field, value) {
        const category = target.dataset.category;
        const weapon = this.outfitData.weapons?.[category]?.[Number(target.dataset.index)];
        if (!weapon) return;
        weapon[field] = field === 'count' ? value : value;
        if (field === 'weaponId') {
            const selected = this.getAllWeapons().find(item => item.id === value);
            weapon.requiredTech = [...(selected?.requiredTech || [])];
            weapon.name = selected?.name || '';
        }
        if (field === 'weaponId' || field === 'isTurreted') {
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
        return !weapon || Boolean(weapon.isMain) ||
            (weapon.resourceType === 'emplacements' && Number(weapon.resourceCount) === 1);
    }

    normalizeWeaponArc(weapon, category) {
        if (!weapon) return;
        if (category === 'defensive') {
            delete weapon.arc;
            return;
        }
        const definition = this.getWeaponDefinition(weapon.weaponId);
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
        const row = target.closest('tr');
        if (category !== 'offensive' || !weapon || !row) return;
        const definition = this.getWeaponDefinition(weapon.weaponId);
        const checkedArcs = Array.from(row.querySelectorAll('[data-arc-checkbox]:checked'))
            .map(checkbox => checkbox.value);
        const isTurreted = category === 'offensive' && weapon.isTurreted;
        const selectedArcs = target.checked && !isTurreted
            ? target.value
            : checkedArcs.join('');
        weapon.arc = this.getValidWeaponArc(selectedArcs, definition?.isMain, isTurreted);
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
    }

    getConnectedClassData() {
        const linked = this.getConnectedDataByNodeType('Class')[0]?.data;
        return linked?.shipData || null;
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
            hardpoints: coreHardpoints ?? calculatedHardpoints,
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

    getArmorHardpointUse(resources = this.getResourceSources()) {
        const armorHits = this.getArmorHits();
        if (armorHits === null) return null;
        const capacity = resources.hardpoints;
        return capacity === null ? 0 : Math.min(capacity, armorHits);
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

    getGearBurnAnalysis(core = this.getCoreData()) {
        if (!core) return null;
        const effectiveHulls = this.getEffectiveHullCount();
        const classHullCount = this.getClassHullCount();
        const classData = this.getConnectedClassData();
        const availableRemass = this.numericOrNull(classData?.resources?.remass);
        const manifoldEfficiency = this.numericOrNull(core.manifoldEfficiency);
        const totalEntropy = classHullCount === null || manifoldEfficiency === null
            ? null
            : Math.floor(classHullCount * manifoldEfficiency);
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
            totalEntropy,
            thrustPenalty: baseMetrics?.thrustPenalty ?? null,
            availableRemass,
            gears
        };
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

    numericOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
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

    getUtilityDeviceCost() {
        let total = 0;
        for (const collection of ['radiators', 'defenses']) {
            for (const selection of this.outfitData.utilityDevices?.[collection] || []) {
                const definition = this.utilitiesData[collection].find(item => item.id === selection.id);
                total += (Number(definition?.cost) || 0) * this.parseCount(selection.count);
            }
        }
        return total;
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

    getSystemsCost() {
        let total = 0;
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
        for (const item of this.systemsData.entropy) {
            total += (Number(item.cost) || 0) *
                this.parseCount(this.outfitData.systems.entropy[item.id]?.count);
        }
        return total;
    }

    refreshSectionCostLabels() {
        if (!this.element) return;
        const formatSubtotal = value =>
            `Subtotal: ${this.formatOptionCost(value, 'weapons') || '0 CV'}`;
        const utilities = this.element.querySelector(`#${this.id}-utility-cost`);
        if (utilities) utilities.textContent = `Utilities ${formatSubtotal(this.getUtilityCostSubtotal())}`;
        const emplacements = this.element.querySelector(`#${this.id}-emplacement-cost`);
        if (emplacements) emplacements.textContent = `Emplacements ${formatSubtotal(this.getEmplacementCostSubtotal())}`;
        const systems = this.element.querySelector(`#${this.id}-system-cost`);
        if (systems) systems.textContent = `Systems ${formatSubtotal(this.getSystemsCost())}`;
        const core = this.element.querySelector(`#${this.id}-core-cost`);
        if (core) core.textContent = `Core Subtotal: ${this.formatCostTotals(this.getCoreCostTotals())}`;
    }

    // Core and outfit are labelled separately only while the core is node-connected.
    refreshCostMetrics() {
        this.refreshDevelopmentMetric();
        if (this.getConnectedCoreData()) {
            this.setHeaderMetric('cost', '', null);
            this.setHeaderMetric('core', '', null);
            this.setHeaderMetric('outfit', 'Outfit', this.formatCostTotals(this.getConfigurationCostTotals()));
        } else {
            this.setHeaderMetric('core', '', null);
            this.setHeaderMetric('outfit', '', null);
            this.setHeaderMetric('cost', '', this.formatCostTotals(this.getCostTotals()));
        }
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
            ['Threshold', display(core.reactorStability)],
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
            reactorStability: this.numericOrNull(core.reactorStability),
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
            <div class="spinal-weapon-group">
                <h5>Spinal Mount</h5>
                <select id="${this.id}-spinal-weapon" class="weapon-select">
                    <option value="">None</option>
                    ${this.renderWeaponOptions(this.getSpinalWeapons(), this.outfitData.weapons.spinal)}
                </select>
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
            <div id="${this.id}-armor-result" class="outfit-resource-note" aria-live="polite"></div>
        </div>`;
    }

    renderRadiatorsSection() {
        return `<div class="outfit-device-section">
            <div class="outfit-subsection-heading">
                <h5>Radiance</h5>
                <button type="button" data-utility-action="add" data-collection="radiators">Add Radiator</button>
            </div>
            <div id="${this.id}-radiator-rows">${this.renderUtilityDeviceRows('radiators')}</div>
        </div>`;
    }

    renderUtilityDefensesSection() {
        return `<div class="outfit-device-section">
            <div class="outfit-subsection-heading">
                <h5>Defenses</h5>
                <button type="button" data-utility-action="add" data-collection="defenses">Add Defense</button>
            </div>
            <div id="${this.id}-utility-defense-rows">${this.renderUtilityDeviceRows('defenses')}</div>
        </div>`;
    }

    renderUtilityDeviceRows(collection) {
        const rows = this.outfitData.utilityDevices?.[collection] || [];
        if (!rows.length) {
            return `<div class="outfit-resource-note">No ${collection} selected.</div>`;
        }
        return rows.map((selection, index) =>
            this.renderUtilityDeviceRow(collection, selection, index)
        ).join('');
    }

    renderUtilityDeviceRow(collection, selection, index) {
        const items = this.filterByRequiredTech(this.utilitiesData[collection] || []);
        const selected = items.find(item => item.id === selection.id);
        const groupedItems = new Map();
        for (const item of items) {
            const group = item.type || 'Other';
            if (!groupedItems.has(group)) groupedItems.set(group, []);
            groupedItems.get(group).push(item);
        }
        const options = Array.from(groupedItems, ([group, groupItems]) =>
            `<optgroup label="${OutfitWidget.escapeHTML(group)}">${groupItems.map(item =>
                `<option value="${OutfitWidget.escapeHTML(item.id)}" ${item.id === selection.id ? 'selected' : ''}>${OutfitWidget.escapeHTML(item.name)}</option>`
            ).join('')}</optgroup>`
        ).join('');
        return `<div class="outfit-device-row">
            <select aria-label="Select ${collection === 'radiators' ? 'radiator' : 'defense'}" data-utility-device-select="${collection}" data-index="${index}">
                <option value="">Select type...</option>${options}
            </select>
            <label class="outfit-device-quantity">Qty
                <input class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(selection.count)}" data-utility-device-count="${collection}" data-index="${index}">
            </label>
            <span class="outfit-device-stats">${this.renderDeviceStats(selected)}</span>
            <button type="button" data-utility-action="remove" data-collection="${collection}" data-index="${index}" aria-label="Remove ${collection === 'radiators' ? 'radiator' : 'defense'}">×</button>
        </div>`;
    }

    renderDeviceStats(item) {
        if (!item) return '';
        const labels = {
            radiance: 'Radiance',
            offset: 'Offset',
            efficiency: 'Efficiency',
            capacity: 'Capacity',
            limit: 'Limit',
            deployed: 'Deployed',
            reserved: 'Reserved',
            regeneration: 'Regeneration'
        };
        return Object.entries(labels)
            .filter(([key]) => Number.isFinite(item[key]))
            .map(([key, label]) => `${label}: ${item[key]}`)
            .join(' · ');
    }

    renderSystemsSection() {
        return `<div class="outfit-device-section">
            <h5>General Systems</h5>
            <div id="${this.id}-general-system-rows">${this.renderGeneralSystems()}</div>
        </div>
        <div class="outfit-device-section">
            <h5>Entropy Systems</h5>
            <div id="${this.id}-entropy-system-rows">${this.renderEntropySystems()}</div>
        </div>
        <div id="${this.id}-system-cost" class="outfit-section-subtotal" aria-live="polite"></div>`;
    }

    renderGeneralSystems() {
        return this.systemsData.general.map(item => {
            if (item.id === 'laser-generator') {
                const laser = this.outfitData.systems.general.laserGenerator;
                const available = this.getAvailableLaserGeneratorTechs();
                return `<div class="outfit-system-row">
                    <label for="${this.id}-laser-generator-tech">${OutfitWidget.escapeHTML(item.name)}</label>
                    <select id="${this.id}-laser-generator-tech" data-laser-generator-tech aria-label="Laser generator technology">
                        <option value="">Select researched technology...</option>
                        ${available.map(tech =>
                            `<option value="${OutfitWidget.escapeHTML(tech.id)}" ${tech.id === laser.techId ? 'selected' : ''}>${OutfitWidget.escapeHTML(tech.name)}</option>`
                        ).join('')}
                    </select>
                    <input class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(laser.count)}" data-system-count="laserGenerator" aria-label="Laser generator quantity" ${laser.techId ? '' : 'disabled'}>
                </div>`;
            }
            const field = this.getGeneralSystemField(item.id);
            const count = this.parseCount(this.outfitData.systems.general[field]);
            const unavailable = !this.isCatalogItemAvailable(item);
            return `<div class="outfit-system-row">
                <label for="${this.id}-system-${OutfitWidget.escapeHTML(field)}">${OutfitWidget.escapeHTML(item.name)}</label>
                <input id="${this.id}-system-${OutfitWidget.escapeHTML(field)}" class="hull-spin" type="number" min="0" step="1" value="${count}" data-system-count="${OutfitWidget.escapeHTML(field)}" aria-label="${OutfitWidget.escapeHTML(item.name)} quantity" ${unavailable ? 'disabled' : ''}>
            </div>`;
        }).join('');
    }

    renderEntropySystems() {
        return this.systemsData.entropy.map(item => {
            const selection = this.outfitData.systems.entropy[item.id] || { count: 0 };
            const unavailable = !this.isCatalogItemAvailable(item);
            return `<div class="outfit-system-row">
                <label for="${this.id}-entropy-${OutfitWidget.escapeHTML(item.id)}">${OutfitWidget.escapeHTML(item.name)}</label>
                <input id="${this.id}-entropy-${OutfitWidget.escapeHTML(item.id)}" class="hull-spin" type="number" min="0" step="1" value="${this.parseCount(selection.count)}" data-system-count="entropy:${OutfitWidget.escapeHTML(item.id)}" aria-label="${OutfitWidget.escapeHTML(item.name)} quantity" ${unavailable ? 'disabled' : ''}>
                <span class="outfit-device-stats">Radiance: ${item.radiance}</span>
            </div>`;
        }).join('');
    }

    getGeneralSystemField(itemId) {
        return itemId === 'craft-launcher' ? 'craftLauncher' : itemId;
    }

    getAvailableLaserGeneratorTechs() {
        return this.laserGeneratorTechs.filter(tech =>
            this.ignoreRequiredTech || (window.empire?.hasTech?.(tech.id) ?? false)
        );
    }

    isCatalogItemAvailable(item) {
        return this.ignoreRequiredTech ||
            (item.requiredTech || []).every(tech => window.empire?.hasTech?.(tech) ?? false);
    }

    updateUtilityDeviceSelection(target) {
        const collection = target.dataset.utilityDeviceSelect;
        const index = Number(target.dataset.index);
        const selection = this.outfitData.utilityDevices?.[collection]?.[index];
        if (!selection || (collection !== 'radiators' && collection !== 'defenses')) return;
        const item = this.utilitiesData[collection].find(option => option.id === target.value);
        Object.assign(selection, item
            ? { ...item, count: this.parseCount(selection.count) }
            : { id: '', count: 0, requiredTech: [] });
        this.refreshUtilityDeviceRows(collection);
    }

    updateUtilityDeviceCount(target) {
        const collection = target.dataset.utilityDeviceCount;
        const selection = this.outfitData.utilityDevices?.[collection]?.[Number(target.dataset.index)];
        if (!selection) return;
        selection.count = this.parseCount(target.value);
        target.value = String(selection.count);
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
        } else if (field === 'laserGenerator') {
            this.outfitData.systems.general.laserGenerator.count = count;
        } else {
            this.outfitData.systems.general[field] = count;
        }
        target.value = String(count);
    }

    refreshUtilityDeviceRows(collection) {
        const id = collection === 'radiators' ? 'radiator-rows' : 'utility-defense-rows';
        const container = this.element?.querySelector(`#${this.id}-${id}`);
        if (container) container.innerHTML = this.renderUtilityDeviceRows(collection);
    }

    refreshSystemsControls() {
        const general = this.element?.querySelector(`#${this.id}-general-system-rows`);
        const entropy = this.element?.querySelector(`#${this.id}-entropy-system-rows`);
        if (general) general.innerHTML = this.renderGeneralSystems();
        if (entropy) entropy.innerHTML = this.renderEntropySystems();
    }

    refreshCatalogControls() {
        if (this.utilitiesDataLoaded) {
            for (const collection of ['radiators', 'defenses']) {
                this.outfitData.utilityDevices[collection] =
                    this.outfitData.utilityDevices[collection].map(selection => {
                        const item = this.utilitiesData[collection].find(option => option.id === selection.id);
                        return !item || (!this.ignoreRequiredTech && !this.isCatalogItemAvailable(item))
                            ? { id: '', count: 0, requiredTech: [] }
                            : selection;
                    });
            }
        }
        if (this.systemsDataLoaded) {
            const laser = this.outfitData.systems.general.laserGenerator;
            if (laser.techId &&
                (!this.laserGeneratorTechs.some(tech => tech.id === laser.techId) ||
                    (!this.ignoreRequiredTech && !this.getAvailableLaserGeneratorTechs().some(tech => tech.id === laser.techId)))) {
                laser.techId = '';
                laser.count = 0;
            }
        }
        if (!this.ignoreRequiredTech) {
            for (const item of this.systemsDataLoaded ? this.systemsData.general : []) {
                if (item.id === 'laser-generator') continue;
                const field = this.getGeneralSystemField(item.id);
                if (!this.isCatalogItemAvailable(item)) this.outfitData.systems.general[field] = 0;
            }
            for (const item of this.systemsDataLoaded ? this.systemsData.entropy : []) {
                if (!this.isCatalogItemAvailable(item)) {
                    this.outfitData.systems.entropy[item.id] = {
                        count: 0,
                        radiance: item.radiance,
                        requiredTech: [...(item.requiredTech || [])]
                    };
                }
            }
        }
        if (this.systemsDataLoaded) {
            this.outfitData.systems.entropy = Object.fromEntries(
                this.systemsData.entropy.map(item => {
                    const selection = this.outfitData.systems.entropy[item.id] || {};
                    return [item.id, {
                        count: this.parseCount(selection.count),
                        radiance: item.radiance,
                        requiredTech: [...(item.requiredTech || [])]
                    }];
                })
            );
        }
        this.refreshUtilityDeviceRows('radiators');
        this.refreshUtilityDeviceRows('defenses');
        this.refreshSystemsControls();
        this.refreshSectionCostLabels();
        this.refreshWeaponResourceDisplay();
    }

    renderWeaponCategory(category, title) {
        const turretColumn = category === 'offensive';
        const arcColumn = category === 'offensive';
        return `<div class="${category}-weapons-group">
            <h5>${title}</h5>
            <button type="button" data-weapon-action="add" data-category="${category}">Add Weapon</button>
            <table class="weapons-table">
                <thead><tr><th>Weapon</th>${turretColumn ? '<th>Turret</th>' : ''}${arcColumn ? '<th>Arc</th>' : ''}<th>Count</th><th>Cost</th><th></th></tr></thead>
                <tbody id="${this.id}-${category}-weapons-body">${this.renderWeaponRows(category)}</tbody>
            </table>
        </div>`;
    }

    renderWeaponOptions(weapons, selectedId = '') {
        const available = this.filterByRequiredTech(weapons);
        if (selectedId && !available.some(weapon => weapon.id === selectedId)) {
            const selected = weapons.find(weapon => weapon.id === selectedId);
            if (selected) available.push(selected);
        }
        return available.map(weapon =>
            `<option value="${OutfitWidget.escapeHTML(weapon.id)}" ${weapon.id === selectedId ? 'selected' : ''}>${OutfitWidget.escapeHTML(weapon.name)} (${OutfitWidget.escapeHTML(weapon.hp || weapon.categoryName)})</option>`
        ).join('');
    }

    renderWeaponRows(category) {
        const weapons = this.outfitData.weapons?.[category] || [];
        if (!weapons.length) {
            return `<tr class="no-weapons"><td colspan="${category === 'offensive' ? 6 : 4}">No weapons added</td></tr>`;
        }
        return weapons.map((weapon, index) => this.renderWeaponRow(category, weapon, index)).join('');
    }

    renderWeaponRow(category, weapon, index) {
        const all = category === 'offensive' ? this.getOffensiveWeapons() : this.getPDWeapons();
        const weaponOptions = this.renderWeaponOptions(all, weapon.weaponId);
        const selected = all.find(item => item.id === weapon.weaponId);
        const turretDisabled = category === 'offensive' && this.isTurretOptionDisabled(selected);
        const isTurreted = category === 'offensive' && !turretDisabled && !!weapon.isTurreted;
        const arc = this.getValidWeaponArc(weapon.arc, selected?.isMain, isTurreted);
        const arcOption = (value, label) => {
            const disabled = selected?.isMain && (value === 'F' || value === 'A');
            return `<label class="arc-option${disabled ? ' disabled' : ''}"><input type="checkbox" data-arc-checkbox data-category="${category}" data-index="${index}" value="${value}" ${arc.includes(value) ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${label}</label>`;
        };
        const arcField = category === 'offensive'
            ? `<td class="arc-field">${arcOption('F', 'Fore')}${arcOption('P', 'Port')}${arcOption('S', 'Starboard')}${arcOption('A', 'Aft')}</td>`
            : '';
        const turretOption = category === 'offensive'
            ? `<td class="turret-field"><label class="turret-option${turretDisabled ? ' disabled' : ''}"><input type="checkbox" data-weapon-field="isTurreted" data-category="${category}" data-index="${index}" aria-label="Install as turret" ${isTurreted ? 'checked' : ''} ${turretDisabled ? 'disabled' : ''}> Turret</label></td>`
            : '';
        return `<tr>
            <td><select data-weapon-field="weaponId" data-category="${category}" data-index="${index}">
                <option value="">Select weapon...</option>${weaponOptions}
            </select></td>
            ${turretOption}
            ${arcField}
            <td><input type="number" min="0" step="1" value="${this.parseCount(weapon.count)}" data-weapon-field="count" data-category="${category}" data-index="${index}"></td>
            <td class="cost-cell">${OutfitWidget.escapeHTML(this.getWeaponCostDisplay(selected, this.parseCount(weapon.count)))}</td>
            <td><button type="button" data-weapon-action="remove" data-category="${category}" data-index="${index}" aria-label="Remove weapon">×</button></td>
        </tr>`;
    }

    refreshWeapons() {
        if (!this.element) return;
        const spinal = this.element.querySelector(`#${this.id}-spinal-weapon`);
        if (spinal) {
            const selected = this.outfitData.weapons.spinal || '';
            spinal.innerHTML = `<option value="">None</option>${this.renderWeaponOptions(this.getSpinalWeapons(), selected)}`;
            spinal.value = selected;
        }
        for (const category of ['offensive', 'defensive']) {
            const body = this.element.querySelector(`#${this.id}-${category}-weapons-body`);
            if (body) body.innerHTML = this.renderWeaponRows(category);
        }
        this.refreshWeaponCostLabels();
        this.refreshSectionCostLabels();
        this.refreshWeaponResourceDisplay();
    }

    getWeaponResourceUse() {
        const resourceUse = { hardpoints: 0, utilities: 0, emplacements: 0 };
        const addWeapon = (weaponId, count, arc = '', isTurreted = false, hasSelectableArc = false) => {
            const weapon = this.getWeaponDefinition(weaponId);
            if (!weapon || !weapon.resourceType ||
                !Object.prototype.hasOwnProperty.call(resourceUse, weapon.resourceType)) return;
            const validArc = this.getValidWeaponArc(arc, weapon.isMain, isTurreted);
            const arcSurcharge = hasSelectableArc && validArc.length > 1 ? 1 : 0;
            resourceUse[weapon.resourceType] += this.parseCount(count) *
                (this.parseCount(weapon.resourceCount) + arcSurcharge);
        };

        addWeapon(this.outfitData.weapons?.spinal, 1);
        for (const category of ['offensive', 'defensive']) {
            for (const weapon of this.outfitData.weapons?.[category] || []) {
                addWeapon(
                    weapon.weaponId,
                    weapon.count,
                    weapon.arc,
                    category === 'offensive' && weapon.isTurreted,
                    category === 'offensive'
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
        const hardpoints = this.getResourceSources().hardpoints;
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
        return {
            core: core ? this.parseCount(core.powerplantSize) : 0,
            emplacements: weaponUse.emplacements,
            utilities: weaponUse.utilities + utilityDeviceUse,
            systems: generalSystemUse + entropySystemUse,
            hardpoints: weaponUse.hardpoints + this.getArmorHardpointUse({ hardpoints })
        };
    }

    getWeaponCostDisplay(weapon, count = 1) {
        if (!weapon) return '';
        const cost = Number(weapon.cost) || 0;
        return this.formatOptionCost(cost * count, 'weapons', weapon.id);
    }

    refreshWeaponCostLabels() {
        if (!this.element) return;
        for (const category of ['offensive', 'defensive']) {
            const body = this.element.querySelector(`#${this.id}-${category}-weapons-body`);
            if (!body) continue;
            body.querySelectorAll('tr:not(.no-weapons)').forEach(row => {
                const weaponSelect = row.querySelector('[data-weapon-field="weaponId"]');
                const countInput = row.querySelector('[data-weapon-field="count"]');
                const costCell = row.querySelector('.cost-cell');
                if (!weaponSelect || !costCell) return;
                const weapon = this.getAllWeapons().find(item => item.id === weaponSelect.value);
                const count = this.parseCount(countInput?.value ?? 1);
                costCell.textContent = this.getWeaponCostDisplay(weapon, count);
            });
        }
    }

    onTechTreeUpdated() {
        this.refreshWeapons();
        this.refreshCatalogControls();
    }

    onEconomyModeChanged() {
        this.refreshWeaponCostLabels();
        this.refreshSectionCostLabels();
        this.renderCoreProperties(this.getCoreData());
    }

    updateWidgetTitle() {
        const title = this.element?.querySelector('.widget-title');
        if (title) title.textContent = this.title;
    }

    updateTitle(text) {
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

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Core', 'Core', 0, 0.25, {
            sectionId: 'category-core', anchorId: `${this.id}-category-core`, minSpacing: 32
        });
        this.addNode('input', 'Class', 'Class', 0, 0.5, {
            sectionId: 'category-core', anchorId: `${this.id}-category-core`, anchorOffset: 32, minSpacing: 32
        });
        this.addNode('output', 'Statistics', 'Statistics', 1, 0.65, {
            sectionId: 'category-core', anchorId: `${this.id}-category-core`, minSpacing: 32
        });
        this.addNode('output', 'Outfit', 'Outfit', 1, 0.25, {
            sectionId: 'meta', anchorId: `${this.id}-meta`, minSpacing: 32
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
            this.outfitData.role = this.outfitData.customRole.trim();
        }
        if (value('operational')) this.outfitData.operational = value('operational').checked;
        if (value('ignore-required-tech')) {
            this.outfitData.ignoreRequiredTech = value('ignore-required-tech').checked;
        }
        const selectedCore = value('core-select');
        if (selectedCore && !selectedCore.disabled) this.outfitData.coreWidgetId = selectedCore.value;
        const spinal = value('spinal-weapon');
        if (spinal) this.outfitData.weapons.spinal = spinal.value;
        this.element.querySelectorAll('[data-utility-device-select]').forEach(select => {
            const collection = select.dataset.utilityDeviceSelect;
            const index = Number(select.dataset.index);
            const current = this.outfitData.utilityDevices?.[collection]?.[index];
            if (!current || (collection !== 'radiators' && collection !== 'defenses') ||
                !this.utilitiesData[collection].length) return;
            const item = this.utilitiesData[collection].find(option => option.id === select.value);
            this.outfitData.utilityDevices[collection][index] = item
                ? { ...item, count: this.parseCount(current.count) }
                : { id: '', count: 0, requiredTech: [] };
        });
        this.element.querySelectorAll('[data-utility-device-count]').forEach(input =>
            this.updateUtilityDeviceCount(input)
        );
        const laserTech = this.element.querySelector('[data-laser-generator-tech]');
        if (laserTech && this.systemsData.general.length) {
            this.outfitData.systems.general.laserGenerator.techId = laserTech.value;
        }
        this.element.querySelectorAll('[data-system-count]').forEach(input =>
            this.updateSystemCount(input)
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
            this.outfitData.systems.entropy[item.id] = {
                count: this.parseCount(selection.count),
                radiance: item.radiance,
                requiredTech: [...(item.requiredTech || [])]
            };
        }
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
                resourceType: selectedSpinal.resourceType,
                resourceCount: selectedSpinal.resourceCount,
                isSpinal: selectedSpinal.isSpinal,
                requiredTech: [...(selectedSpinal.requiredTech || [])]
            } : null
        };
    }

    applyWeaponRequirements(weapon, category) {
        const definition = this.getAllWeapons().find(item => item.id === weapon.weaponId);
        const required = definition?.requiredTech || weapon.requiredTech || [];
        weapon.name = definition?.name || weapon.name || '';
        weapon.requiredTech = [...required];
        weapon.hp = definition?.hp || weapon.hp || null;
        weapon.resourceType = definition?.resourceType || weapon.resourceType || null;
        weapon.resourceCount = definition?.resourceCount ?? weapon.resourceCount ?? null;
        weapon.isSpinal = definition?.isSpinal ?? weapon.isSpinal ?? false;
        weapon.isMain = definition?.isMain ?? weapon.isMain ?? false;
        weapon.isTurreted = category === 'offensive' && Boolean(weapon.isTurreted);
        this.normalizeWeaponArc(weapon, category);
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
                        'berthing', 'craftLauncher', 'tending'
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
                }
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
        for (const category of ['offensive', 'defensive']) {
            this.outfitData.weapons[category].forEach(weapon => this.applyWeaponRequirements(weapon, category));
        }
        this.outfitData.ignoreRequiredTech =
            data.ignoreRequiredTech ?? incoming.ignoreRequiredTech ?? this.outfitData.ignoreRequiredTech;
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.outfitData.roleMode = incoming.roleMode ?? this.outfitData.roleMode;
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

    onMinimizeStateChanged(isMinimized) {
        if (!isMinimized) this.refreshSummary();
    }
}
