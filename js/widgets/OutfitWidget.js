// Outfit configuration for a Ship Class, with core-derived resources.
class OutfitWidget extends Widget {
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
            ignoreTechRequirements: false,
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
        this.ignoreTechRequirements = false;
        this.weaponsData = { categories: [] };
        this.weaponsDataLoaded = false;
        this.layoutMode = 'three-column';
        this.titleEditHandler = name => {
            this.outfitData.name = name;
            this.updateTitle(name);
        };
        this.ensureRoleAvailable(this.outfitData.role);
        this.init();
        this.onEconomyModeChanged();
        this.loadWeaponsData();
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

    refreshArmorDisplay(resources = this.getResourceSources()) {
        const input = this.element?.querySelector(`#${this.id}-armor`);
        if (input) input.value = this.parseCount(this.outfitData.defenses?.armor);
        const result = this.element?.querySelector(`#${this.id}-armor-result`);
        if (result) {
            const capacity = resources.hardpoints;
            const used = this.getArmorHardpointUse(resources);
            result.textContent = `Armor hits: ${this.getArmorHits()} · Hardpoints used: ${used} / ${capacity ?? '—'} · Effective hulls: ${this.getEffectiveHullCount() ?? '—'}`;
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

    filterWeaponsByTech(weapons) {
        if (this.ignoreTechRequirements) return weapons;
        return weapons.filter(weapon =>
            !weapon.techRequirement || (window.empire?.hasTech?.(weapon.techRequirement) ?? false)
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
            <div class="input-group">
                <label for="${this.id}-role">Role</label>
                <select id="${this.id}-role">${this.getRoleOptions()}</select>
                <input id="${this.id}-custom-role" type="text" placeholder="Custom role" value="${OutfitWidget.escapeHTML(this.outfitData.customRole)}">
            </div>
            <div class="input-group">
                <label for="${this.id}-notes">Notes</label>
                <textarea id="${this.id}-notes" placeholder="Doctrine and deployment notes">${OutfitWidget.escapeHTML(this.outfitData.notes)}</textarea>
            </div>
            <div class="ship-information-header outfit-flags">
                <label class="ship-flag"><input id="${this.id}-operational" type="checkbox" ${this.outfitData.operational ? 'checked' : ''}> Operational</label>
                <label class="ship-flag"><input id="${this.id}-ignore-tech" type="checkbox" ${this.outfitData.ignoreTechRequirements ? 'checked' : ''}> Ignore Tech</label>
            </div>
        `);
        sections.appendChild(identity.section);

        const armor = this.createSection('category-armor', 'Armor');
        this.setSectionContent(armor, this.renderArmorSection());
        sections.appendChild(armor.section);

        const core = this.createSection('category-core', 'Core');
        this.addResourceCounter(core.titleElement, 'core');
        this.setSectionContent(core, `
            <div class="input-group" id="${this.id}-core-source">
                <select id="${this.id}-core-select" aria-label="Select operational core"></select>
            </div>
            <div class="outfit-core-properties" id="${this.id}-core-properties" aria-live="polite"></div>
        `);
        sections.appendChild(core.section);

        for (const category of ['emplacements', 'utilities']) {
            const title = category[0].toUpperCase() + category.slice(1);
            const section = this.createSection(`category-${category}`, title);
            this.addResourceCounter(section.titleElement, category);
            const weapons = category === 'emplacements'
                ? this.renderEmplacementWeaponsSection()
                : `<div class="outfit-utilities-subcategory">
                    <h5 class="outfit-utilities-subcategory-title">Defenses</h5>
                    ${this.renderWeaponCategory('defensive', 'Defensive Weapons')}
                </div>`;
            const categoryContent = `${weapons}<div class="outfit-resource-note" id="${this.id}-resource-${category}-note"></div>`;
            this.setSectionContent(section, categoryContent);
            if (category === 'utilities') {
                const defensesTitle = section.section.querySelector('.outfit-utilities-subcategory-title');
                this.addResourceCounter(defensesTitle, 'hardpoints');
            }
            sections.appendChild(section.section);
        }

        const systems = this.createSection('category-systems', 'Systems');
        this.addResourceCounter(systems.titleElement, 'systems');
        this.setSectionContent(systems, `<div class="outfit-resource-note" id="${this.id}-resource-systems-note"></div>`);
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
            }
            this.refreshWeaponResourceDisplay();
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
            } else if (target.id === `${this.id}-ignore-tech`) {
                this.outfitData.ignoreTechRequirements = target.checked;
                this.ignoreTechRequirements = target.checked;
                this.refreshWeapons();
            } else if (target.id === `${this.id}-core-select`) {
                this.outfitData.coreWidgetId = target.value;
                this.refreshCoreOptions();
                this.refreshResourceDisplay();
            } else if (target.id === `${this.id}-spinal-weapon`) {
                this.outfitData.weapons.spinal = target.value;
            } else if (target.dataset.weaponField) {
                this.updateWeaponField(target, target.dataset.weaponField, target.value);
                this.refreshWeapons();
            } else if (target.dataset.arcCheckbox !== undefined) {
                this.updateWeaponArc(target);
            }
            this.refreshWeaponResourceDisplay();
            this.onOutfitDataChanged();
            this.refreshSummary();
        });

        this.element.addEventListener('click', event => {
            const button = event.target.closest('[data-weapon-action]');
            if (!button) return;
            const category = button.dataset.category;
            if (button.dataset.weaponAction === 'add') {
                this.outfitData.weapons[category].push({
                    weaponId: '', arc: '', count: 0,
                    requiredTech: [], techRequirement: null
                });
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
            weapon.requiredTech = selected?.techRequirement ? [selected.techRequirement] : [];
            weapon.techRequirement = selected?.techRequirement || null;
            weapon.name = selected?.name || '';
            weapon.arc = this.getValidWeaponArc(weapon.arc, selected?.isMain);
        }
    }

    getValidWeaponArc(arc, isMain = false) {
        const validArcs = Array.from(new Set(String(arc || '').split('')
            .filter(value => (isMain ? 'PS' : 'FPSA').includes(value))));
        return (isMain ? validArcs.slice(0, 1) : validArcs).sort().join('');
    }

    getWeaponDefinition(weaponId) {
        return this.getAllWeapons().find(item => item.id === weaponId);
    }

    normalizeWeaponArc(weapon) {
        if (weapon) weapon.arc = this.getValidWeaponArc(
            weapon.arc,
            this.getWeaponDefinition(weapon.weaponId)?.isMain
        );
    }

    updateWeaponArc(target) {
        const category = target.dataset.category;
        const index = Number(target.dataset.index);
        const weapon = this.outfitData.weapons?.[category]?.[index];
        const row = target.closest('tr');
        if (!weapon || !row) return;
        const definition = this.getWeaponDefinition(weapon.weaponId);
        const checkedArcs = Array.from(row.querySelectorAll('[data-arc-checkbox]:checked'))
            .map(checkbox => checkbox.value);
        if (definition?.isMain && target.checked) {
            weapon.arc = this.getValidWeaponArc(target.value, true);
            row.querySelectorAll('[data-arc-checkbox]').forEach(checkbox => {
                checkbox.checked = checkbox.value === weapon.arc;
            });
        } else {
            weapon.arc = this.getValidWeaponArc(checkedArcs.join(''), definition?.isMain);
        }
    }

    parseCount(value) {
        const count = Number.parseInt(value, 10);
        return Number.isFinite(count) ? Math.max(0, count) : 0;
    }

    getConnectedCoreData() {
        const linked = this.getConnectedDataByNodeType('Core')[0]?.data;
        if (!linked) return null;
        return linked.coreData || linked;
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
        return linked?.shipData || linked || null;
    }

    getResourceSources() {
        const classData = this.getConnectedClassData();
        const composition = classData?.hullComposition || {};
        const coreData = this.getCoreData();
        const coreSize = this.numericOrNull(coreData?.powerplantSize ?? coreData?.size);
        const optionalNumber = (...values) => {
            const value = values.find(item => item !== undefined && item !== null && item !== '');
            return value === undefined ? null : this.numericOrNull(value);
        };
        const containmentHulls = optionalNumber(classData?.containmentHulls) ??
            (optionalNumber(composition.freight, composition.Freight) === null &&
            optionalNumber(composition.tankage, composition.Tankage) === null
                ? null
                : (optionalNumber(composition.freight, composition.Freight) || 0) +
                    (optionalNumber(composition.tankage, composition.Tankage) || 0));
        const systemCapacity = optionalNumber(composition.system, composition.System);
        const availableSystems = systemCapacity === null
            ? null
            : Math.max(0, systemCapacity - this.getQuantumSystemSize());
        const coreHardpoints = optionalNumber(coreData?.hardpoints);
        const calculatedHardpoints = containmentHulls === null
            ? null
            : Math.floor(
                Math.pow(containmentHulls, 2 / 3) +
                    Number.EPSILON * Math.max(1, Math.pow(containmentHulls, 2 / 3))
            );
        return {
            utilities: coreSize === null ? null : coreSize * 2,
            emplacements: optionalNumber(composition.emplacement, composition.Emplacement),
            systems: availableSystems,
            hardpoints: coreHardpoints ?? calculatedHardpoints,
            core: optionalNumber(composition.core, composition.Core),
            containmentHulls
        };
    }

    getArmorEfficiency() {
        const classEfficiency = this.getConnectedClassData()?.armorEfficiency;
        const coreEfficiency = this.getCoreData()?.armorEfficiency;
        const efficiency = this.numericOrNull(classEfficiency ?? coreEfficiency);
        return efficiency === null ? 1 : Math.max(0, efficiency);
    }

    getArmorHits() {
        return this.parseCount(this.outfitData.defenses?.armor) * this.getArmorEfficiency();
    }

    getArmorHardpointUse(resources = this.getResourceSources()) {
        const capacity = resources.hardpoints;
        return capacity === null ? 0 : Math.min(capacity, this.getArmorHits());
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

    getQuantumSystemSize() {
        const modules = Array.isArray(this.outfitData.systemsData?.modules)
            ? this.outfitData.systemsData.modules
            : [];
        return modules.reduce((sum, module) => {
            if (!module || typeof module !== 'object') return sum;
            if (!/quantum|\bqsystem\b/i.test(`${module.moduleId || ''} ${module.name || ''}`)) return sum;
            const size = module.systemHulls ?? module.size ?? module.systemSize ?? module.hulls ?? 1;
            return sum + this.parseCount(size);
        }, 0);
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
        const quantumSize = this.getQuantumSystemSize();
        const systemNote = this.element.querySelector(`#${this.id}-resource-systems-note`);
        if (systemNote) {
            systemNote.textContent = quantumSize > 0
                ? `QSystem allocation: ${quantumSize} system resources and hulls`
                : '';
        }
        const core = this.getCoreData();
        this.outfitData.selectedCore = core ? this.serializeCore(core) : null;
        this.renderCoreProperties(core);
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.refreshWeapons();
    }

    renderCoreProperties(core) {
        const container = this.element?.querySelector(`#${this.id}-core-properties`);
        if (!container) return;
        container.replaceChildren();
        if (!core) return;

        const display = value => value === undefined || value === null || value === '' ? '—' : String(value);
        const gears = Array.isArray(core.gears)
            ? core.gears.map((gear, index) =>
                `${gear.name || `Gear ${index + 1}`} (Instability ${display(gear.instability)})`
            ).join(', ')
            : '—';
        const properties = [
            ['Operational', core.operational ? 'Yes' : 'No'],
            ['Armor efficiency', display(core.armorEfficiency ?? this.getArmorEfficiency())],
            ['Effective hulls for thrust', display(core.effectiveHulls ?? this.getEffectiveHullCount())],
            ['Reactor', display(core.reactor)],
            ['Engine', display(core.engine)],
            ['Manifold', display(core.manifold)],
            ['Reactor Distribution', display(core.reactorValue)],
            ['Engine Distribution', display(core.engineValue)],
            ['Manifold Distribution', display(core.manifoldValue)],
            ['Reactor Stability', display(core.reactorStability)],
            ['Engine Efficiency', display(core.engineEfficiency)],
            ['Manifold Efficiency', display(core.manifoldEfficiency)],
            ['Gears', gears]
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
            size: this.numericOrNull(core.size ?? core.powerplantSize),
            armorEfficiency: this.numericOrNull(core.armorEfficiency) ?? 1,
            hardpoints: this.numericOrNull(core.hardpoints),
            effectiveHulls: this.getEffectiveHullCount(),
            reactor: core.reactor || '',
            engine: core.engine || '',
            manifold: core.manifold || '',
            requiredTech: Array.from(new Set(techs)),
            techRequirement: Array.from(new Set(techs))
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

    renderWeaponCategory(category, title) {
        return `<div class="${category}-weapons-group">
            <h5>${title}</h5>
            <button type="button" data-weapon-action="add" data-category="${category}">Add Weapon</button>
            <table class="weapons-table">
                <thead><tr><th>Weapon</th><th>Arc</th><th>Count</th><th>Cost</th><th></th></tr></thead>
                <tbody id="${this.id}-${category}-weapons-body">${this.renderWeaponRows(category)}</tbody>
            </table>
        </div>`;
    }

    renderWeaponOptions(weapons, selectedId = '') {
        const available = this.filterWeaponsByTech(weapons);
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
        if (!weapons.length) return '<tr class="no-weapons"><td colspan="5">No weapons added</td></tr>';
        return weapons.map((weapon, index) => this.renderWeaponRow(category, weapon, index)).join('');
    }

    renderWeaponRow(category, weapon, index) {
        const all = category === 'offensive' ? this.getOffensiveWeapons() : this.getPDWeapons();
        const weaponOptions = this.renderWeaponOptions(all, weapon.weaponId);
        const selected = all.find(item => item.id === weapon.weaponId);
        const arc = this.getValidWeaponArc(weapon.arc, selected?.isMain);
        const arcOption = (value, label) => {
            const disabled = selected?.isMain && (value === 'F' || value === 'A');
            return `<label class="arc-option${disabled ? ' disabled' : ''}"><input type="checkbox" data-arc-checkbox data-category="${category}" data-index="${index}" value="${value}" ${arc.includes(value) ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${label}</label>`;
        };
        return `<tr>
            <td><select data-weapon-field="weaponId" data-category="${category}" data-index="${index}">
                <option value="">Select weapon...</option>${weaponOptions}
            </select></td>
            <td class="arc-field">${arcOption('F', 'Fore')}${arcOption('P', 'Port')}${arcOption('S', 'Starboard')}${arcOption('A', 'Aft')}</td>
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
        this.refreshWeaponResourceDisplay();
    }

    getWeaponResourceUse() {
        const resourceUse = { hardpoints: 0, utilities: 0, emplacements: 0 };
        const addWeapon = (weaponId, count, arc = '') => {
            const weapon = this.getWeaponDefinition(weaponId);
            if (!weapon || !weapon.resourceType ||
                !Object.prototype.hasOwnProperty.call(resourceUse, weapon.resourceType)) return;
            const validArc = this.getValidWeaponArc(arc, weapon.isMain);
            const arcSurcharge = validArc.length > 1 ? 1 : 0;
            resourceUse[weapon.resourceType] += this.parseCount(count) *
                (this.parseCount(weapon.resourceCount) + arcSurcharge);
        };

        addWeapon(this.outfitData.weapons?.spinal, 1);
        for (const category of ['offensive', 'defensive']) {
            for (const weapon of this.outfitData.weapons?.[category] || []) {
                addWeapon(weapon.weaponId, weapon.count, weapon.arc);
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

    getSystemResourceUse() {
        const systemsData = this.outfitData.systemsData || {};
        const modules = Array.isArray(systemsData.modules) ? systemsData.modules : [];
        if (modules.length === 0) return this.parseCount(systemsData.usedSystemHulls);
        return modules.reduce((sum, module) => {
            if (!module || typeof module !== 'object' ||
                /quantum|\bqsystem\b/i.test(`${module.moduleId || ''} ${module.name || ''}`)) {
                return sum;
            }
            const size = module.systemHulls ?? module.size ?? module.systemSize ?? module.hulls ?? 1;
            return sum + this.parseCount(size);
        }, 0);
    }

    getResourceUse() {
        const weaponUse = this.getWeaponResourceUse();
        const core = this.getCoreData();
        const hardpoints = this.getResourceSources().hardpoints;
        return {
            core: core ? this.parseCount(core.powerplantSize ?? core.size) : 0,
            emplacements: weaponUse.emplacements,
            utilities: weaponUse.utilities,
            systems: this.getSystemResourceUse(),
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
    }

    onEconomyModeChanged() {
        this.refreshWeaponCostLabels();
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
        if (value('ignore-tech')) {
            this.outfitData.ignoreTechRequirements = value('ignore-tech').checked;
            this.ignoreTechRequirements = this.outfitData.ignoreTechRequirements;
        }
        const selectedCore = value('core-select');
        if (selectedCore && !selectedCore.disabled) this.outfitData.coreWidgetId = selectedCore.value;
        const spinal = value('spinal-weapon');
        if (spinal) this.outfitData.weapons.spinal = spinal.value;
    }

    getSelectedTechRequirements() {
        const requirements = [];
        const add = value => {
            if (typeof value === 'string' && value.trim()) requirements.push(value.trim());
            else if (Array.isArray(value)) value.forEach(add);
        };
        const core = this.outfitData.selectedCore;
        if (core) {
            add(core.requiredTech);
            add(core.techRequirement);
            add(core.reactor);
            add(core.engine);
            add(core.manifold);
        }
        for (const weapon of this.outfitData.weapons.offensive.concat(this.outfitData.weapons.defensive)) {
            add(weapon.requiredTech);
            add(weapon.techRequirement);
        }
        const spinal = this.getAllWeapons().find(weapon => weapon.id === this.outfitData.weapons.spinal);
        add(spinal?.techRequirement);
        return Array.from(new Set(requirements));
    }

    getSerializedData() {
        this.syncDataFromForm();
        this.outfitData.resources = this.getResourceSources();
        this.outfitData.resourceUse = this.getResourceUse();
        this.refreshArmorDisplay(this.outfitData.resources);
        const core = this.getCoreData();
        this.outfitData.selectedCore = core ? this.serializeCore(core) : null;
        this.outfitData.ignoreTechRequirements = this.ignoreTechRequirements = !!this.outfitData.ignoreTechRequirements;
        this.outfitData.weapons.offensive.forEach(weapon => this.applyWeaponRequirements(weapon));
        this.outfitData.weapons.defensive.forEach(weapon => this.applyWeaponRequirements(weapon));
        const requiredTech = this.getSelectedTechRequirements();
        this.outfitData.requiredTech = requiredTech;
        this.outfitData.techRequirement = requiredTech;
        const selectedSpinal = this.getAllWeapons().find(weapon => weapon.id === this.outfitData.weapons.spinal);
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        return {
            ...super.getSerializedData(),
            outfitData: this.outfitData,
            ignoreTechRequirements: this.ignoreTechRequirements,
            requiredTech,
            techRequirement: requiredTech,
            spinalWeapon: selectedSpinal ? {
                id: selectedSpinal.id,
                name: selectedSpinal.name,
                hp: selectedSpinal.hp,
                resourceType: selectedSpinal.resourceType,
                resourceCount: selectedSpinal.resourceCount,
                isSpinal: selectedSpinal.isSpinal,
                requiredTech: selectedSpinal.techRequirement ? [selectedSpinal.techRequirement] : [],
                techRequirement: selectedSpinal.techRequirement || null
            } : null
        };
    }

    applyWeaponRequirements(weapon) {
        const definition = this.getAllWeapons().find(item => item.id === weapon.weaponId);
        const required = definition?.techRequirement || weapon.techRequirement || null;
        weapon.name = definition?.name || weapon.name || '';
        weapon.requiredTech = required ? [required] : [];
        weapon.techRequirement = required;
        weapon.hp = definition?.hp || weapon.hp || null;
        weapon.resourceType = definition?.resourceType || weapon.resourceType || null;
        weapon.resourceCount = definition?.resourceCount ?? weapon.resourceCount ?? null;
        weapon.isSpinal = definition?.isSpinal ?? weapon.isSpinal ?? false;
        weapon.isMain = definition?.isMain ?? weapon.isMain ?? false;
        this.normalizeWeaponArc(weapon);
    }

    loadSerializedData(data = {}) {
        super.loadSerializedData(data);
        const incoming = data.outfitData || {};
        this.outfitData = {
            ...this.outfitData,
            ...incoming,
            operational: Boolean(incoming.operational ?? incoming.developed),
            resources: { ...this.outfitData.resources, ...(incoming.resources || {}) },
            defenses: { ...this.outfitData.defenses, ...(incoming.defenses || {}) },
            resourceUse: { ...this.outfitData.resourceUse, ...(incoming.resourceUse || {}) },
            selectedCore: incoming.selectedCore || null,
            weapons: {
                ...this.outfitData.weapons,
                ...(incoming.weapons || {}),
                offensive: Array.isArray(incoming.weapons?.offensive) ? incoming.weapons.offensive.map(item => {
                    const weapon = { ...item };
                    delete weapon.mount;
                    return weapon;
                }) : [],
                defensive: Array.isArray(incoming.weapons?.defensive) ? incoming.weapons.defensive.map(item => {
                    const weapon = { ...item };
                    delete weapon.mount;
                    return weapon;
                }) : []
            }
        };
        delete this.outfitData.developed;
        for (const category of ['offensive', 'defensive']) {
            this.outfitData.weapons[category].forEach(weapon => this.applyWeaponRequirements(weapon));
        }
        this.ignoreTechRequirements = data.ignoreTechRequirements ?? incoming.ignoreTechRequirements ?? false;
        this.outfitData.ignoreTechRequirements = this.ignoreTechRequirements;
        this.outfitData.weaponResourceUse = this.getWeaponResourceUse();
        this.outfitData.roleMode = incoming.roleMode || (incoming.customRole ? 'custom' : 'dropdown');
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
        const ignore = this.element.querySelector(`#${this.id}-ignore-tech`);
        if (operational) operational.checked = this.outfitData.operational;
        if (ignore) ignore.checked = this.ignoreTechRequirements;
        this.updateWidgetTitle();
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
        const effectiveHulls = this.getEffectiveHullCount();
        if (effectiveHulls !== null) {
            const hulls = document.createElement('div');
            hulls.className = 'summary-item';
            hulls.textContent = `Effective hulls for thrust: ${effectiveHulls}`;
            summary.appendChild(hulls);
        }
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
