// Ship hardpoint equipment and per-ship default contents.
class ShipLoadoutWidget extends DesignWidget {
    static cataloguePromise = null;
    static deviceCatalogue = null;

    constructor(x = 100, y = 100) {
        super('shipLoadout', 'New Ship Loadout', x, y);
        this.loadoutData = ShipLoadoutWidget.createDefaultData();
        this.devices = [];
        this.weapons = [];
        this.cataloguesLoaded = false;
        this.init();
        this.loadCatalogues();
    }

    static createDefaultData() {
        return {
            name: 'New Ship Loadout',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            hardpointDevices: [],
            weapons: [],
            berths: [],
            magazine: [],
            hangar: [],
            requiredTech: []
        };
    }

    static async loadDeviceCatalogue() {
        if (this.deviceCatalogue) return this.deviceCatalogue;
        if (!this.cataloguePromise) {
            this.cataloguePromise = fetch('data/Hardpoints.json')
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    if (!data || !Array.isArray(data.devices) ||
                        data.devices.some(item => !item || typeof item.id !== 'string' ||
                            typeof item.name !== 'string' || !Number.isFinite(Number(item.cost)) ||
                            !Array.isArray(item.requiredTech))) {
                        throw new Error('Hardpoints catalogue must contain valid devices and requiredTech arrays.');
                    }
                    this.deviceCatalogue = data.devices;
                    return this.deviceCatalogue;
                })
                .catch(error => {
                    this.cataloguePromise = null;
                    throw error;
                });
        }
        return this.cataloguePromise;
    }

    static getDeviceCatalogue() {
        return this.deviceCatalogue || [];
    }

    get designData() {
        return this.loadoutData;
    }

    get defaultTitle() {
        return 'New Ship Loadout';
    }

    async loadCatalogues() {
        const [devices, weapons] = await Promise.allSettled([
            ShipLoadoutWidget.loadDeviceCatalogue(),
            WeaponCatalogue.load()
        ]);
        if (devices.status === 'fulfilled') {
            this.devices = devices.value;
        } else {
            this.reportCatalogueError('Hardpoints catalogue (data/Hardpoints.json)', devices.reason);
        }
        if (weapons.status === 'fulfilled') {
            this.weapons = (weapons.value?.categories || [])
                .flatMap(category => (category.weapons || []).map(weapon => ({
                    ...weapon,
                    categoryName: category.name || ''
                })))
                .filter(weapon => WeaponCatalogue.getMount(weapon).resourceType === 'hardpoints');
        } else {
            this.reportCatalogueError('Hardpoint weapons catalogue (data/weapons.json)', weapons.reason);
        }
        this.cataloguesLoaded = devices.status === 'fulfilled' && weapons.status === 'fulfilled';
        if (this.cataloguesLoaded) this.normalizeSelections();
        this.refresh();
        window.app?.runPreflightCheck?.();
    }

    normalizeSelections() {
        if (!Array.isArray(this.loadoutData.hardpointDevices) ||
            !Array.isArray(this.loadoutData.weapons) ||
            !Array.isArray(this.loadoutData.berths) ||
            !Array.isArray(this.loadoutData.magazine) ||
            !Array.isArray(this.loadoutData.hangar)) {
            throw new Error('Ship Loadout selections must be arrays.');
        }
        const instanceIds = new Set();
        this.loadoutData.hardpointDevices = this.loadoutData.hardpointDevices.map((entry, index) => {
            if (!entry || typeof entry !== 'object' ||
                typeof entry.deviceId !== 'string' || !entry.deviceId) {
                throw new Error('Hardpoint device selection must contain a device ID.');
            }
            const instanceId = typeof entry.instanceId === 'string' && entry.instanceId
                ? entry.instanceId
                : `device-${index + 1}`;
            if (instanceIds.has(instanceId)) {
                throw new Error(`Duplicate hardpoint device instance ID "${instanceId}".`);
            }
            instanceIds.add(instanceId);
            const contents = Array.isArray(entry.contents)
                ? this.normalizeQuantityEntries(entry.contents).map(item => ({ ...item }))
                : [];
            return { instanceId, deviceId: entry.deviceId, contents };
        });
        this.loadoutData.weapons = this.loadoutData.weapons.map(entry => {
            if (!entry || typeof entry !== 'object' ||
                typeof entry.weaponId !== 'string' || !entry.weaponId) {
                throw new Error('Mounted weapon selection must contain a weapon ID.');
            }
            const count = Number(entry.count ?? 1);
            if (!Number.isSafeInteger(count) || count < 1) {
                throw new Error(`Mounted weapon quantity for "${entry.weaponId}" must be a positive integer.`);
            }
            const arc = ShipLoadoutWidget.normalizeArc(entry.arc);
            return { weaponId: entry.weaponId, count, arc };
        });
        this.loadoutData.berths = this.normalizeCountEntries(this.loadoutData.berths, 'Troop');
        this.loadoutData.magazine = this.normalizeCountEntries(this.loadoutData.magazine, 'Munition');
        this.loadoutData.hangar = this.normalizeCountEntries(this.loadoutData.hangar, 'Craft');
    }

    normalizeCountEntries(entries, label) {
        const merged = new Map();
        for (const entry of entries) {
            if (!entry || typeof entry !== 'object' ||
                typeof entry.id !== 'string' || !entry.id) {
                throw new Error(`${label} selection must contain an item ID.`);
            }
            const count = Number(entry.count ?? 1);
            if (!Number.isSafeInteger(count) || count < 1) {
                throw new Error(`${label} quantity for "${entry.id}" must be a positive integer.`);
            }
            merged.set(entry.id, (merged.get(entry.id) || 0) + count);
        }
        return Array.from(merged, ([id, count]) => ({ id, count }));
    }

    static normalizeArc(arc) {
        const value = String(arc || 'F').toUpperCase();
        if (!['F', 'P', 'S', 'A'].includes(value)) {
            throw new Error(`Invalid single weapon arc: "${value}".`);
        }
        return value;
    }

    findDevice(id) {
        return this.devices.find(item => item.id === id) || null;
    }

    findWeapon(id) {
        return this.weapons.find(item => item.id === id) || null;
    }

    getOperationalDesigns(type) {
        const wantedType = { troops: 'troops', craft: 'craft', munitions: 'munitions' }[type];
        return (window.widgetManager?.getAllWidgets?.() || [])
            .filter(widget => widget.type === wantedType && widget[{
                troops: 'troopData',
                craft: 'craftData',
                munitions: 'munitionData'
            }[type]]?.operational);
    }

    getDesignRequiredTech(widget) {
        return widget?.getSelectedRequiredTech?.() ||
            widget?.[widget.type === 'troops' ? 'troopData' :
                widget?.type === 'craft' ? 'craftData' : 'munitionData']?.requiredTech || [];
    }

    isOperationalDesignAvailable(widget) {
        return !!widget?.[{
            troops: 'troopData',
            craft: 'craftData',
            munitions: 'munitionData'
        }[widget.type]]?.operational &&
            (this.loadoutData.ignoreRequiredTech || this.getDesignRequiredTech(widget)
                .every(tech => window.empire?.hasTech?.(tech) ?? false));
    }

    getDesignItem(type, id) {
        const widget = window.widgetManager?.getWidget(id);
        if (!widget || widget.type !== type) return null;
        if (type === 'troops') {
            return {
                widget,
                name: widget.troopData?.name || 'Troop Unit',
                cost: Number(widget.calculateStats?.().combatValue) || 0,
                required: Math.max(0, Number(widget.getBerthsRequired?.() ??
                    widget.troopData?.berthsRequired ?? 1) || 0)
            };
        }
        if (type === 'craft') {
            return {
                widget,
                name: widget.craftData?.name || 'Craft',
                cost: Number(widget.calculateStats?.().combatValue) || 0,
                required: Math.max(0, Number(widget.getProfile?.()?.baysRequired ??
                    widget.craftData?.baysRequired ?? 0) || 0)
            };
        }
        if (type === 'munitions') {
            return {
                widget,
                name: widget.munitionData?.name || 'Munition',
                profile: widget.munitionData?.profile || '',
                cells: Math.max(0, Number(widget.getMagazineCells?.()) || 0),
                cost: Math.max(0, Number(widget.munitionData?.cost) || 0)
            };
        }
        return null;
    }

    getConnectedClassData() {
        return this.getConnectedDataByNodeType('Class')[0]?.data?.shipData || null;
    }

    getAvailableMagazineCells() {
        const classData = this.getConnectedClassData();
        if (!classData) return null;
        const explicitValue = classData.resources?.magazineCells;
        if (explicitValue !== undefined && explicitValue !== null && explicitValue !== '') {
            const explicit = Number(explicitValue);
            return Number.isFinite(explicit) ? Math.max(0, Math.floor(explicit)) : 0;
        }
        const hulls = Number(classData.hullComposition?.magazine);
        return Number.isFinite(hulls) ? Math.max(0, Math.floor(hulls)) * 25 : 0;
    }

    getAvailableHangarBays() {
        const classData = this.getConnectedClassData();
        if (!classData) return null;
        const explicitValue = classData.resources?.hangarBays;
        if (explicitValue !== undefined && explicitValue !== null && explicitValue !== '') {
            const explicit = Number(explicitValue);
            return Number.isFinite(explicit) ? Math.max(0, Math.floor(explicit)) : 0;
        }
        const hulls = Number(classData.hullComposition?.hangar);
        return Number.isFinite(hulls) ? Math.max(0, Math.floor(hulls)) * 4 : 0;
    }

    getAvailableHardpoints() {
        const classData = this.getConnectedClassData();
        if (!classData) return null;
        const explicitHardpoints = classData.resources?.hardpoints ?? classData.hardpoints;
        if (explicitHardpoints !== undefined && explicitHardpoints !== null &&
            explicitHardpoints !== '') {
            const value = Number(explicitHardpoints);
            return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
        }
        const composition = classData.hullComposition || {};
        const explicit = [classData.containmentHulls, composition.freight, composition.tankage]
            .map(value => value === undefined || value === null || value === '' ? null : Number(value));
        if (explicit.some(value => value !== null && !Number.isFinite(value))) return null;
        const containment = explicit[0] !== null
            ? explicit[0]
            : explicit[1] === null && explicit[2] === null
                ? null
                : (explicit[1] || 0) + (explicit[2] || 0);
        if (containment === null) return null;
        const exact = Math.pow(Math.max(0, containment), 2 / 3);
        return Math.floor(exact + Number.EPSILON * Math.max(1, exact));
    }

    getDeviceCount(deviceId) {
        return this.loadoutData.hardpointDevices.filter(entry => entry.deviceId === deviceId).length;
    }

    getDeviceAttributes() {
        const totals = {
            adapters: 0, cells: 0, clamps: 0, bays: 0, cradles: 0, jumpium: 0,
            fixtures: 0, mounts: 0, grapples: 0, grapple: 0, survey: 0,
            zParticleSails: 0, laserFoci: 0
        };
        for (const entry of this.loadoutData.hardpointDevices) {
            const device = this.findDevice(entry.deviceId);
            if (!device) continue;
            if (device.id === 'adapter') {
                totals.adapters++;
                totals.cells += Number(device.cells) || 0;
            } else if (device.id === 'clamp') {
                totals.clamps++;
                totals.bays += Number(device.bays) || 0;
            } else if (device.id === 'cradle') {
                totals.cradles++;
                totals.jumpium += Number(device.jumpium) || 0;
            } else if (device.id === 'fixture') {
                totals.fixtures++;
                totals.mounts += Number(device.mounts) || 0;
            } else if (device.id === 'grapple') {
                totals.grapples++;
                totals.grapple += Number(device.grapple) || 0;
            } else if (device.id === 'survey') {
                totals.survey++;
            } else if (device.id === 'zparticle-sail') {
                totals.zParticleSails++;
            } else if (device.id === 'laser-focus') {
                totals.laserFoci++;
            }
        }
        totals.mountsAvailable = Math.max(0, totals.mounts - this.loadoutData.weapons
            .reduce((sum, entry) => sum + entry.count, 0));
        return totals;
    }

    getUsedHardpoints() {
        return this.loadoutData.hardpointDevices.length;
    }

    getAdapterCellsUsed(device) {
        return device.contents.reduce((sum, entry) => {
            const item = this.getDesignItem('munitions', entry.id);
            return sum + (item?.cells || 0) * entry.count;
        }, 0);
    }

    getClampBaysUsed(device) {
        return device.contents.reduce((sum, entry) => {
            const item = this.getDesignItem('craft', entry.id);
            return sum + (item?.required || 0) * entry.count;
        }, 0);
    }

    getResourceCapacity(type) {
        return type === 'magazine'
            ? this.getAvailableMagazineCells()
            : this.getAvailableHangarBays();
    }

    getResourceUsed(type) {
        const entries = this.loadoutData[type];
        return entries.reduce((sum, entry) => {
            const item = this.getDesignItem(type === 'magazine' ? 'munitions' : 'craft', entry.id);
            const unitSize = type === 'magazine' ? item?.cells : item?.required;
            return sum + (Number(unitSize) || 0) * entry.count;
        }, 0);
    }

    getResourceItemType(type) {
        return type === 'magazine' ? 'munitions' : 'craft';
    }

    getResourceItemCostCategory(type) {
        return type === 'magazine' ? 'munitions' : 'general';
    }

    getContentCostTotals(entries, type) {
        const totals = { equipment: 0, munitions: 0, general: 0, weapons: 0 };
        const itemType = this.getResourceItemType(type);
        const category = this.getResourceItemCostCategory(type);
        for (const entry of entries) {
            const item = this.getDesignItem(itemType, entry.id);
            if (item) totals[category] += item.cost * entry.count;
        }
        return totals;
    }

    getStats() {
        const attributes = this.getDeviceAttributes();
        const availableHardpoints = this.getAvailableHardpoints();
        const costByCategory = { equipment: 0, munitions: 0, general: 0, weapons: 0 };
        let requiredTech = [];
        const addTech = values => {
            if (Array.isArray(values)) requiredTech = requiredTech.concat(values);
        };
        for (const entry of this.loadoutData.hardpointDevices) {
            const device = this.findDevice(entry.deviceId);
            if (!device) continue;
            costByCategory.weapons += Number(device.cost) || 0;
            addTech(device.requiredTech);
            const contentType = entry.deviceId === 'adapter' ? 'munitions' :
                entry.deviceId === 'clamp' ? 'craft' : '';
            if (contentType) {
                for (const content of entry.contents) {
                    const item = this.getDesignItem(contentType, content.id);
                    if (!item) continue;
                    costByCategory[contentType === 'munitions' ? 'munitions' : 'general'] +=
                        item.cost * content.count;
                    addTech(this.getDesignRequiredTech(item.widget));
                }
            }
        }
        for (const entry of this.loadoutData.berths) {
            const item = this.getDesignItem('troops', entry.id);
            if (!item) continue;
            costByCategory.equipment += item.cost * entry.count;
            addTech(this.getDesignRequiredTech(item.widget));
        }
        for (const [type, category] of [['magazine', 'munitions'], ['hangar', 'general']]) {
            const itemType = this.getResourceItemType(type);
            for (const entry of this.loadoutData[type]) {
                const item = this.getDesignItem(itemType, entry.id);
                if (!item) continue;
                costByCategory[category] += item.cost * entry.count;
                addTech(this.getDesignRequiredTech(item.widget));
            }
        }
        for (const entry of this.loadoutData.weapons) {
            const weapon = this.findWeapon(entry.weaponId);
            costByCategory.weapons += (Number(weapon?.cost) || 0) * entry.count;
            addTech(weapon?.requiredTech);
        }
        const totalCost = Object.values(costByCategory).reduce((sum, value) => sum + value, 0);
        return {
            hardpointsUsed: this.getUsedHardpoints(),
            hardpointsAvailable: availableHardpoints,
            attributes,
            costByCategory,
            totalCost,
            requiredTech: [...new Set(requiredTech.filter(value => typeof value === 'string' && value))]
        };
    }

    getValidationIssues() {
        if (!this.cataloguesLoaded) return [];
        const issues = [];
        const available = this.getAvailableHardpoints();
        if (available !== null && this.getUsedHardpoints() > available) {
            issues.push(`uses ${this.getUsedHardpoints()} of ${available} available hardpoints`);
        }
        for (const entry of this.loadoutData.hardpointDevices) {
            const device = this.findDevice(entry.deviceId);
            if (!device) {
                issues.push(`contains an unknown hardpoint device "${entry.deviceId}"`);
                continue;
            }
            if (device.id === 'adapter') {
                const profiles = new Set(entry.contents.map(content =>
                    this.getDesignItem('munitions', content.id)?.profile).filter(Boolean));
                if (profiles.size > 1) issues.push('an Adapter contains more than one munition profile');
                const cells = this.getAdapterCellsUsed(entry);
                if (cells > Number(device.cells)) {
                    issues.push(`an Adapter uses ${cells} of ${device.cells} cells`);
                }
            } else if (device.id === 'clamp') {
                const bays = this.getClampBaysUsed(entry);
                if (bays > Number(device.bays)) {
                    issues.push(`a Clamp uses ${bays} of ${device.bays} bays`);
                }
            }
        }
        const mounts = this.getDeviceAttributes().mounts;
        const mounted = this.loadoutData.weapons.reduce((sum, entry) => sum + entry.count, 0);
        if (mounted > mounts) issues.push(`uses ${mounted} of ${mounts} fixture mounts`);
        for (const type of ['magazine', 'hangar']) {
            const capacity = this.getResourceCapacity(type);
            const used = this.getResourceUsed(type);
            if (capacity !== null && used > capacity) {
                issues.push(`uses ${used} of ${capacity} ${type === 'magazine' ? 'magazine cells' : 'hangar bays'}`);
            }
            const itemType = this.getResourceItemType(type);
            for (const entry of this.loadoutData[type]) {
                if (!this.getDesignItem(itemType, entry.id)) {
                    issues.push(`contains an unknown ${type === 'magazine' ? 'munition' : 'craft'} design "${entry.id}"`);
                }
            }
        }
        return issues;
    }

    formatLoadoutCost(stats) {
        if (window.empire?.economyMode !== 'campaign') {
            return this.formatTotalCost(stats.totalCost, 'weapons');
        }
        return Object.entries(stats.costByCategory)
            .filter(([, value]) => value > 0)
            .map(([category, value]) => this.formatTotalCost(value, category))
            .join(' + ');
    }

    getDeviceCostTotals(devices) {
        const totals = { equipment: 0, munitions: 0, general: 0, weapons: 0 };
        for (const entry of devices) {
            const device = this.findDevice(entry.deviceId);
            if (!device) continue;
            totals.weapons += Number(device.cost) || 0;
        }
        return totals;
    }

    formatCostTotals(costByCategory) {
        const totalCost = Object.values(costByCategory).reduce((sum, value) => sum + value, 0);
        return this.formatLoadoutCost({ totalCost, costByCategory });
    }

    renderSummary(container) {
        container.replaceChildren();
        const stats = this.getStats();
        const values = [
            ['Hardpoints', `${stats.hardpointsUsed} / ${stats.hardpointsAvailable ?? '—'}`],
            ['Devices', String(this.loadoutData.hardpointDevices.length)],
            ['Mounted weapons', String(this.loadoutData.weapons.reduce((sum, item) => sum + item.count, 0))],
            ['Berths', String(this.loadoutData.berths.reduce((sum, item) => sum + item.count, 0))],
            ['Munitions', String(this.loadoutData.magazine.reduce((sum, item) => sum + item.count, 0))],
            ['Craft', String(this.loadoutData.hangar.reduce((sum, item) => sum + item.count, 0))],
            ['Cost', this.formatLoadoutCost(stats) || '0 CV']
        ];
        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        values.forEach(([label, value]) => this.addSummaryField(grid, label, value));
        container.appendChild(grid);
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const identity = this.createDesignSection('meta', '');
        this.setSectionContent(identity, this.renderFlags());
        sections.appendChild(identity.section);

        const hardpoints = this.createDesignSection('hardpoints', 'Hardpoints');
        this.addSubtotal(hardpoints.titleElement, 'hardpoint-cost');
        this.addCounter(hardpoints.titleElement, 'hardpoints-counter', 'Hardpoints');
        this.setSectionContent(hardpoints, `
            <div class="design-picker">
                <select id="${this.id}-device-select" class="design-select" aria-label="Hardpoint device"></select>
                <button type="button" class="widget-add-action" data-action="add-device">Add</button>
            </div>
            <div class="design-entry-list" id="${this.id}-device-list"></div>
        `);
        sections.appendChild(hardpoints.section);

        const deviceSections = document.createElement('div');
        deviceSections.id = `${this.id}-device-sections`;
        deviceSections.className = 'design-device-sections';
        sections.appendChild(deviceSections);

        const fixtures = this.createDesignSection('fixtures', 'Fixtures');
        this.addSubtotal(fixtures.titleElement, 'fixture-cost');
        this.addCounter(fixtures.titleElement, 'mount-counter', 'Mounts');
        this.setSectionContent(fixtures, `
            <div class="design-picker">
                <select id="${this.id}-weapon-select" class="design-select" aria-label="Weapon to mount"></select>
                <button type="button" class="widget-add-action" data-action="add-weapon">Add</button>
            </div>
            <div class="design-entry-list" id="${this.id}-weapon-list"></div>
        `);
        fixtures.section.hidden = true;
        sections.appendChild(fixtures.section);

        const berths = this.createDesignSection('berths', 'Berths');
        this.addSubtotal(berths.titleElement, 'berths-cost');
        this.setSectionContent(berths, `
            <div class="design-picker">
                <select id="${this.id}-troop-select" class="design-select" aria-label="Troop unit to add"></select>
                <button type="button" class="widget-add-action" data-action="add-troop">Add</button>
            </div>
            <div class="design-entry-list" id="${this.id}-troop-list"></div>
        `);
        sections.appendChild(berths.section);

        for (const [type, label, resourceLabel] of [
            ['magazine', 'Magazine', 'Cells'],
            ['hangar', 'Hangar', 'Bays']
        ]) {
            const section = this.createDesignSection(type, label);
            this.addSubtotal(section.titleElement, `${type}-cost`);
            this.addCounter(section.titleElement, `${type}-counter`, resourceLabel);
            this.setSectionContent(section, `
                <div class="design-picker">
                    <select id="${this.id}-${type}-select" class="design-select" aria-label="${label} item to add"></select>
                    <button type="button" class="widget-add-action" data-add-resource="${type}">Add</button>
                </div>
                <div class="design-entry-list" id="${this.id}-${type}-list"></div>
            `);
            sections.appendChild(section.section);
        }

        this.setupFlagListeners(() => this.refresh());
        this.element.addEventListener('click', event => this.handleAction(event));
        this.element.addEventListener('change', event => this.handleChange(event));
        this.refresh();
    }

    addSubtotal(container, key) {
        if (!container) return;
        const subtotal = document.createElement('span');
        subtotal.className = 'outfit-section-subtotal outfit-section-subtotal-inline';
        subtotal.id = `${this.id}-${key}`;
        subtotal.setAttribute('aria-live', 'polite');
        container.appendChild(subtotal);
    }

    addCounter(container, key, label) {
        if (!container) return;
        const counter = document.createElement('span');
        counter.className = 'outfit-resource-counter';
        counter.id = `${this.id}-${key}`;
        counter.setAttribute('aria-label', `${label} used / available`);
        counter.innerHTML = '<span class="outfit-resource-used">0</span> / <span class="outfit-resource-capacity">—</span>';
        container.appendChild(counter);
    }

    setCounter(key, used, capacity) {
        const counter = this.element?.querySelector(`#${this.id}-${key}`);
        if (!counter) return;
        const usedElement = counter.querySelector('.outfit-resource-used');
        const capacityElement = counter.querySelector('.outfit-resource-capacity');
        usedElement.textContent = String(used);
        capacityElement.textContent = capacity === null ? '—' : String(capacity);
        usedElement.classList.toggle('is-over-capacity', capacity !== null && used > capacity);
        capacityElement.classList.toggle('has-unused-capacity', capacity !== null && used < capacity);
    }

    getPickerOptions(type, selectedId = '') {
        return this.getOperationalDesigns(type)
            .filter(widget => this.isOperationalDesignAvailable(widget) || widget.id === selectedId)
            .map(widget => this.getDesignItem(type, widget.id))
            .filter(Boolean);
    }

    fillSelect(select, options, selectedId, type, placeholder, costCategory = null) {
        if (!select) return;
        const previous = selectedId || select.value;
        select.replaceChildren();
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = placeholder;
        select.appendChild(blank);
        for (const item of options) {
            const option = document.createElement('option');
            option.value = item.widget?.id || item.id;
            const category = costCategory || {
                troops: 'equipment',
                munitions: 'munitions',
                craft: 'general'
            }[type] || 'general';
            option.textContent = `${item.name} (${this.formatOptionCost(item.cost, category) || `${item.cost} CV`})`;
            option.disabled = !!item.widget && !this.isOperationalDesignAvailable(item.widget);
            select.appendChild(option);
        }
        if (previous && [...select.options].some(option => option.value === previous)) {
            select.value = previous;
        } else {
            select.value = '';
        }
    }

    getEntryRows(container, entries, type, removeAttribute, getCostCategory) {
        if (!container) return;
        container.replaceChildren();
        container.hidden = entries.length === 0;
        entries.forEach((entry, index) => {
            const item = this.getDesignItem(type, entry.id);
            const row = document.createElement('div');
            row.className = 'design-entry';
            const name = document.createElement('span');
            name.className = 'design-entry-name';
            name.textContent = `${item?.name || entry.id}${item && !this.isOperationalDesignAvailable(item.widget) ? ' (unavailable)' : ''}`;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${entry.count}`;
            const cost = document.createElement('span');
            cost.className = 'design-entry-cost';
            cost.textContent = item?.cost
                ? this.formatTotalCost(item.cost * entry.count, getCostCategory(type))
                : '';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'widget-remove-action';
            remove.dataset[removeAttribute] = String(index);
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${item?.name || entry.id}`);
            row.append(name, quantity, cost, remove);
            container.appendChild(row);
        });
    }

    renderDevices() {
        const deviceSelect = this.element.querySelector(`#${this.id}-device-select`);
        const previous = deviceSelect.value;
        deviceSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = this.cataloguesLoaded ? 'Select device' : 'Loading devices…';
        deviceSelect.appendChild(placeholder);
        for (const item of this.devices.filter(device => this.isOptionAvailable(device))) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (${this.formatOptionCost(Number(item.cost) || 0, 'weapons', item.id)})`;
            deviceSelect.appendChild(option);
        }
        if ([...deviceSelect.options].some(option => option.value === previous)) {
            deviceSelect.value = previous;
        }

        const list = this.element.querySelector(`#${this.id}-device-list`);
        list.replaceChildren();
        const attributes = this.getDeviceAttributes();
        const groupedDevices = new Map();
        for (const entry of this.loadoutData.hardpointDevices) {
            const group = groupedDevices.get(entry.deviceId) || [];
            group.push(entry);
            groupedDevices.set(entry.deviceId, group);
        }
        for (const [deviceId, entries] of groupedDevices) {
            const device = this.findDevice(deviceId);
            const row = document.createElement('div');
            row.className = 'design-entry';
            const name = document.createElement('span');
            name.className = 'design-entry-name';
            name.textContent = device?.name || deviceId;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${entries.length}`;
            const cost = document.createElement('span');
            cost.className = 'design-entry-cost';
            cost.textContent = device
                ? this.formatTotalCost((Number(device.cost) || 0) * entries.length, 'weapons', device.id)
                : 'Unavailable';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'widget-remove-action';
            remove.dataset.removeDeviceType = deviceId;
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${device?.name || deviceId}`);
            row.append(name, quantity, cost, remove);
            list.appendChild(row);
        }
        this.element.querySelector(`#${this.id}-hardpoint-cost`).textContent =
            this.formatCostTotals(this.getDeviceCostTotals(this.loadoutData.hardpointDevices));
        const fixtureSection = this.element.querySelector(`#${this.id}-fixtures`);
        fixtureSection.hidden = attributes.fixtures === 0;
        const weaponCost = this.loadoutData.weapons.reduce((sum, entry) =>
            sum + (Number(this.findWeapon(entry.weaponId)?.cost) || 0) * entry.count, 0);
        this.element.querySelector(`#${this.id}-fixture-cost`).textContent =
            weaponCost ? this.formatTotalCost(weaponCost, 'weapons') : '';
        this.renderDeviceSections();
        const stats = this.getStats();
        this.setCounter('hardpoints-counter', stats.hardpointsUsed, stats.hardpointsAvailable);
        this.setHeaderMetric('cost', '', this.formatLoadoutCost(stats) || '0 CV');
    }

    renderDeviceSections() {
        const container = this.element.querySelector(`#${this.id}-device-sections`);
        container.replaceChildren();
        for (const deviceId of ['adapter', 'clamp']) {
            const devices = this.loadoutData.hardpointDevices
                .filter(entry => entry.deviceId === deviceId);
            if (!devices.length) continue;
            const isAdapter = deviceId === 'adapter';
            const category = this.createDesignSection(
                `${deviceId}-contents`,
                isAdapter ? 'Adapters' : 'Clamps'
            );
            this.addSubtotal(category.titleElement, `${deviceId}-cost`);
            this.setSectionContent(category, '');
            container.appendChild(category.section);
            const categoryContents = devices.flatMap(device => device.contents);
            category.titleElement.querySelector(`#${this.id}-${deviceId}-cost`).textContent =
                this.formatCostTotals(this.getContentCostTotals(
                    categoryContents, isAdapter ? 'magazine' : 'hangar'
                ));
            for (const entry of devices) {
                const device = this.findDevice(entry.deviceId);
                if (!device) continue;
                const instance = document.createElement('div');
                instance.className = 'design-subsection design-loadout-group design-device-instance';
                const title = document.createElement('div');
                title.className = 'design-subtitle';
                title.appendChild(document.createTextNode(device.name || deviceId));
                instance.appendChild(title);
                category.section.appendChild(instance);
                const contentType = isAdapter ? 'munitions' : 'craft';
                const entries = entry.contents;
                const used = isAdapter ? this.getAdapterCellsUsed(entry) : this.getClampBaysUsed(entry);
                const capacity = Number(isAdapter ? device.cells : device.bays) || 0;
                const counterKey = `device-${entry.instanceId}-counter`;
                this.addCounter(title, counterKey, isAdapter ? 'Cells' : 'Bays');
                this.setCounter(counterKey, used, capacity);
                const picker = document.createElement('div');
                picker.className = 'design-picker';
                const select = document.createElement('select');
                select.className = 'design-select';
                select.setAttribute('aria-label', `${device.name} ${contentType} to add`);
                select.dataset.devicePicker = entry.instanceId;
                const currentProfile = isAdapter
                    ? this.getDesignItem('munitions', entries[0]?.id)?.profile
                    : '';
                const options = this.getPickerOptions(contentType, entries[0]?.id || '')
                    .filter(item => !isAdapter || !currentProfile || item.profile === currentProfile)
                    .filter(item => this.isOperationalDesignAvailable(item.widget));
                const blank = document.createElement('option');
                blank.value = '';
                blank.textContent = options.length
                    ? `Select ${isAdapter ? 'munition variant' : 'craft'}`
                    : `No operational ${contentType} available`;
                select.appendChild(blank);
                options.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.widget.id;
                    option.textContent = `${item.name} (${isAdapter ? `${item.cells} cells` : `${item.required} bays`}, ${this.formatOptionCost(item.cost, isAdapter ? 'munitions' : 'general')})`;
                    select.appendChild(option);
                });
                const add = document.createElement('button');
                add.type = 'button';
                add.className = 'widget-add-action';
                add.dataset.addDeviceContent = entry.instanceId;
                add.textContent = 'Add';
                picker.append(select, add);

                const list = document.createElement('div');
                list.className = 'design-entry-list';
                entries.forEach((content, contentIndex) => {
                    const item = this.getDesignItem(contentType, content.id);
                    const row = document.createElement('div');
                    row.className = 'design-entry';
                    const name = document.createElement('span');
                    name.className = 'design-entry-name';
                    name.textContent = `${item?.name || content.id}${item && !this.isOperationalDesignAvailable(item.widget) ? ' (unavailable)' : ''}`;
                    const quantity = document.createElement('span');
                    quantity.className = 'design-entry-quantity';
                    quantity.textContent = `×${content.count}`;
                    const cost = document.createElement('span');
                    cost.className = 'design-entry-cost';
                    cost.textContent = item
                        ? this.formatTotalCost(item.cost * content.count, isAdapter ? 'munitions' : 'general')
                        : '';
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'widget-remove-action';
                    remove.dataset.removeDeviceContent = entry.instanceId;
                    remove.dataset.contentIndex = String(contentIndex);
                    remove.textContent = '−';
                    remove.setAttribute('aria-label', `Remove one ${item?.name || content.id}`);
                    row.append(name, quantity, cost, remove);
                    list.appendChild(row);
                });
                instance.append(picker, list);
            }
        }
    }

    renderResourceSection(type) {
        const itemType = this.getResourceItemType(type);
        const select = this.element.querySelector(`#${this.id}-${type}-select`);
        const previous = select.value;
        const capacity = this.getResourceCapacity(type);
        const used = this.getResourceUsed(type);
        const items = this.getPickerOptions(itemType).filter(item => {
            const size = type === 'magazine' ? item.cells : item.required;
            return capacity === null || used + size <= capacity;
        });
        this.fillSelect(select, items, previous, itemType,
            items.length ? `Select operational ${type === 'magazine' ? 'munitions' : 'craft'}`
                : `No operational ${type === 'magazine' ? 'munitions' : 'craft'} available`,
            this.getResourceItemCostCategory(type));

        const list = this.element.querySelector(`#${this.id}-${type}-list`);
        list.replaceChildren();
        list.hidden = this.loadoutData[type].length === 0;
        this.loadoutData[type].forEach((entry, index) => {
            const item = this.getDesignItem(itemType, entry.id);
            const row = document.createElement('div');
            row.className = 'design-entry';
            const name = document.createElement('span');
            name.className = 'design-entry-name';
            name.textContent = `${item?.name || entry.id}${item && !this.isOperationalDesignAvailable(item.widget) ? ' (unavailable)' : ''}`;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${entry.count}`;
            const cost = document.createElement('span');
            cost.className = 'design-entry-cost';
            cost.textContent = item
                ? this.formatTotalCost(
                    item.cost * entry.count,
                    this.getResourceItemCostCategory(type)
                )
                : '';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'widget-remove-action';
            remove.dataset.removeResource = type;
            remove.dataset.resourceIndex = String(index);
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${item?.name || entry.id}`);
            row.append(name, quantity, cost, remove);
            list.appendChild(row);
        });
        const costTotals = this.getContentCostTotals(this.loadoutData[type], type);
        this.element.querySelector(`#${this.id}-${type}-cost`).textContent =
            this.formatCostTotals(costTotals);
        this.setCounter(`${type}-counter`, used, capacity);
    }

    renderWeapons() {
        const select = this.element.querySelector(`#${this.id}-weapon-select`);
        const previous = select.value;
        select.replaceChildren();
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = this.weapons.length ? 'Select hardpoint weapon' : 'No hardpoint weapons available';
        select.appendChild(blank);
        this.weapons.filter(item => this.isOptionAvailable(item)).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (${this.formatOptionCost(Number(item.cost) || 0, 'weapons', item.id)})`;
            select.appendChild(option);
        });
        if ([...select.options].some(option => option.value === previous)) select.value = previous;

        const list = this.element.querySelector(`#${this.id}-weapon-list`);
        list.replaceChildren();
        this.loadoutData.weapons.forEach((entry, index) => {
            const weapon = this.findWeapon(entry.weaponId);
            const row = document.createElement('div');
            row.className = 'design-entry';
            const name = document.createElement('span');
            name.className = 'design-entry-name';
            name.textContent = weapon?.name || entry.weaponId;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${entry.count}`;
            const arc = document.createElement('select');
            arc.setAttribute('aria-label', 'Single weapon arc');
            arc.dataset.weaponArc = String(index);
            for (const [value, label] of [['F', 'Fore'], ['P', 'Port'], ['S', 'Starboard'], ['A', 'Aft']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                option.selected = entry.arc === value;
                arc.appendChild(option);
            }
            const cost = document.createElement('span');
            cost.className = 'design-entry-cost';
            cost.textContent = weapon
                ? this.formatTotalCost((Number(weapon.cost) || 0) * entry.count, 'weapons', weapon.id)
                : 'Unavailable';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'widget-remove-action';
            remove.dataset.removeWeapon = String(index);
            remove.textContent = '−';
            row.append(name, arc, quantity, cost, remove);
            list.appendChild(row);
        });
        const mounts = this.getDeviceAttributes().mounts;
        const used = this.loadoutData.weapons.reduce((sum, item) => sum + item.count, 0);
        this.setCounter('mount-counter', used, mounts);
    }

    renderBerths() {
        const select = this.element.querySelector(`#${this.id}-troop-select`);
        const previous = select.value;
        const options = this.getPickerOptions('troops');
        this.fillSelect(select, options, previous, 'troops', options.length
            ? 'Select operational troops'
            : 'No operational troops available');
        this.getEntryRows(
            this.element.querySelector(`#${this.id}-troop-list`),
            this.loadoutData.berths,
            'troops',
            'removeTroop',
            type => type === 'troops' ? 'equipment' : 'general'
        );
        const cost = this.loadoutData.berths.reduce((sum, entry) =>
            sum + (this.getDesignItem('troops', entry.id)?.cost || 0) * entry.count, 0);
        this.element.querySelector(`#${this.id}-berths-cost`).textContent =
            cost ? this.formatTotalCost(cost, 'equipment') : '';
    }

    refresh() {
        if (!this.element) return;
        this.syncFlagInputs();
        this.renderDevices();
        this.renderWeapons();
        this.renderBerths();
        this.renderResourceSection('magazine');
        this.renderResourceSection('hangar');
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    handleAction(event) {
        const button = event.target.closest('button[data-action],button[data-remove-device],button[data-remove-device-type],button[data-add-device-content],button[data-remove-device-content],button[data-remove-weapon],button[data-remove-troop],button[data-add-resource],button[data-remove-resource]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'add-device') {
            const id = this.element.querySelector(`#${this.id}-device-select`).value;
            if (!id || !this.findDevice(id)) return;
            const available = this.getAvailableHardpoints();
            if (available !== null && this.getUsedHardpoints() + 1 > available) return;
            let index = 1;
            const usedIds = new Set(this.loadoutData.hardpointDevices.map(entry => entry.instanceId));
            while (usedIds.has(`device-${index}`)) index++;
            this.loadoutData.hardpointDevices.push({ instanceId: `device-${index}`, deviceId: id, contents: [] });
            this.refresh();
            return;
        }
        if (action === 'add-weapon') {
            const weaponId = this.element.querySelector(`#${this.id}-weapon-select`).value;
            const weapon = this.findWeapon(weaponId);
            if (!weapon || this.loadoutData.weapons.reduce((sum, entry) => sum + entry.count, 0) >=
                this.getDeviceAttributes().mounts) return;
            const existing = this.loadoutData.weapons.find(entry => entry.weaponId === weaponId && entry.arc === 'F');
            if (existing) existing.count++;
            else this.loadoutData.weapons.push({ weaponId, count: 1, arc: 'F' });
            this.refresh();
            return;
        }
        if (action === 'add-troop') {
            const id = this.element.querySelector(`#${this.id}-troop-select`).value;
            if (!id || !this.getDesignItem('troops', id)) return;
            this.incrementEntry(this.loadoutData.berths, id);
            this.refresh();
            return;
        }
        if (button.dataset.addResource) {
            this.addResourceContent(button.dataset.addResource);
            return;
        }
        if (button.dataset.addDeviceContent) {
            this.addDeviceContent(button.dataset.addDeviceContent);
            return;
        }
        if (button.dataset.removeDevice) {
            this.loadoutData.hardpointDevices = this.loadoutData.hardpointDevices
                .filter(entry => entry.instanceId !== button.dataset.removeDevice);
            this.refresh();
            return;
        }
        if (button.dataset.removeDeviceType) {
            const index = this.loadoutData.hardpointDevices.findIndex(entry =>
                entry.deviceId === button.dataset.removeDeviceType);
            if (index >= 0) this.loadoutData.hardpointDevices.splice(index, 1);
            this.refresh();
            return;
        }
        if (button.dataset.removeDeviceContent) {
            const device = this.loadoutData.hardpointDevices.find(entry =>
                entry.instanceId === button.dataset.removeDevice);
            const index = Number(button.dataset.contentIndex);
            const content = device?.contents[index];
            if (content) {
                if (content.count > 1) content.count--;
                else device.contents.splice(index, 1);
            }
            this.refresh();
            return;
        }
        if (button.dataset.removeWeapon !== undefined) {
            const index = Number(button.dataset.removeWeapon);
            const entry = this.loadoutData.weapons[index];
            if (entry) {
                if (entry.count > 1) entry.count--;
                else this.loadoutData.weapons.splice(index, 1);
            }
            this.refresh();
            return;
        }
        if (button.dataset.removeTroop !== undefined) {
            const index = Number(button.dataset.removeTroop);
            const entry = this.loadoutData.berths[index];
            if (entry) {
                if (entry.count > 1) entry.count--;
                else this.loadoutData.berths.splice(index, 1);
            }
            this.refresh();
            return;
        }
        if (button.dataset.removeResource) {
            const type = button.dataset.removeResource;
            const index = Number(button.dataset.resourceIndex);
            const entry = this.loadoutData[type]?.[index];
            if (entry) {
                if (entry.count > 1) entry.count--;
                else this.loadoutData[type].splice(index, 1);
            }
            this.refresh();
        }
    }

    incrementEntry(entries, id) {
        const entry = entries.find(item => item.id === id);
        if (entry) entry.count++;
        else entries.push({ id, count: 1 });
    }

    addResourceContent(type) {
        if (!['magazine', 'hangar'].includes(type)) return;
        const itemType = this.getResourceItemType(type);
        const select = this.element.querySelector(`#${this.id}-${type}-select`);
        const id = select?.value || '';
        const item = this.getDesignItem(itemType, id);
        if (!item || !this.isOperationalDesignAvailable(item.widget)) return;
        const capacity = this.getResourceCapacity(type);
        const used = this.getResourceUsed(type);
        const size = type === 'magazine' ? item.cells : item.required;
        if (capacity !== null && used + size > capacity) return;
        this.incrementEntry(this.loadoutData[type], id);
        this.refresh();
    }

    addDeviceContent(instanceId) {
        const device = this.loadoutData.hardpointDevices.find(entry => entry.instanceId === instanceId);
        const definition = this.findDevice(device?.deviceId);
        if (!device || !definition) return;
        const type = definition.id === 'adapter' ? 'munitions' :
            definition.id === 'clamp' ? 'craft' : '';
        if (!type) return;
        const select = this.element.querySelector(`[data-device-picker="${instanceId}"]`);
        const id = select?.value || '';
        const item = this.getDesignItem(type, id);
        if (!item || !this.isOperationalDesignAvailable(item.widget)) return;
        if (type === 'munitions') {
            const profile = this.getDesignItem('munitions', device.contents[0]?.id)?.profile;
            if (profile && profile !== item.profile) return;
            const used = this.getAdapterCellsUsed(device);
            if (used + item.cells > Number(definition.cells)) return;
        } else if (this.getClampBaysUsed(device) + item.required > Number(definition.bays)) {
            return;
        }
        this.incrementEntry(device.contents, id);
        this.refresh();
    }

    handleChange(event) {
        const target = event.target;
        if (target.matches('[data-design-field]')) {
            const key = target.dataset.designField;
            this.setDesignValue(key, target.value);
            if (key === 'role') this.refreshSummary();
            return;
        }
        const weaponArc = target.closest('[data-weapon-arc]');
        if (weaponArc) {
            const entry = this.loadoutData.weapons[Number(weaponArc.dataset.weaponArc)];
            if (entry) entry.arc = ShipLoadoutWidget.normalizeArc(weaponArc.value);
            this.refresh();
        }
    }

    static arcLabel(arc) {
        return ({ F: 'Fore', P: 'Port', S: 'Starboard', A: 'Aft' })[arc] || 'Fore';
    }

    onTechTreeUpdated() {
        this.refresh();
    }

    onEconomyModeChanged() {
        this.refresh();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.refresh();
    }

    onParentDataChanged() {
        this.refresh();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Class', 'Class', 0, 0.3, {
            sectionId: 'hardpoints',
            anchorId: `${this.id}-hardpoints`,
            minSpacing: 32,
            optional: true
        });
        this.addNode('output', 'Loadout', 'Loadout', 1, 0.3, {
            sectionId: 'hardpoints',
            anchorId: `${this.id}-hardpoints`,
            minSpacing: 32
        });
        this.reflowNodes();
    }

    getSerializedData() {
        const stats = this.getStats();
        this.loadoutData.requiredTech = stats.requiredTech;
        return {
            ...super.getSerializedData(),
            loadoutData: JSON.parse(JSON.stringify(this.loadoutData)),
            ignoreRequiredTech: this.loadoutData.ignoreRequiredTech,
            hardpointsUsed: stats.hardpointsUsed,
            requiredTech: stats.requiredTech
        };
    }

    loadSerializedData(data = {}) {
        super.loadSerializedData(data);
        const saved = data.loadoutData || {};
        const requiredArrays = ['hardpointDevices', 'weapons', 'berths', 'magazine', 'hangar'];
        for (const key of requiredArrays) {
            if (saved[key] !== undefined && !Array.isArray(saved[key])) {
                throw new Error(`Saved Ship Loadout ${key} must be an array.`);
            }
        }
        this.loadoutData = {
            ...ShipLoadoutWidget.createDefaultData(),
            ...saved,
            hardpointDevices: Array.isArray(saved.hardpointDevices) ? saved.hardpointDevices : [],
            weapons: Array.isArray(saved.weapons) ? saved.weapons : [],
            berths: Array.isArray(saved.berths) ? saved.berths : [],
            magazine: Array.isArray(saved.magazine) ? saved.magazine : [],
            hangar: Array.isArray(saved.hangar) ? saved.hangar : [],
            ignoreRequiredTech: !!(saved.ignoreRequiredTech ?? data.ignoreRequiredTech)
        };
        this.normalizeSelections();
        this.updateTitle();
        this.syncFlagInputs();
        this.refresh();
    }
}
