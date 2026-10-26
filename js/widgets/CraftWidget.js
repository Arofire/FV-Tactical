// Craft design. Profiles, roles, power, features, utilities and non-weapon equipment
// come from data/Craft.json; hardpoints use the ship hardpoint options
// (ShipCapacity.getHardpointWeaponOptions) and craft weapons come from the "Craft"
// category of data/weapons.json.
class CraftWidget extends DesignWidget {
    static WEAPON_CATEGORY = 'Craft';
    static LOADOUT_PICKERS = ['hardpoints', 'utilities', 'equipment'];
    static CAPACITY_LABELS = {
        fuel: 'Fuel', cohesion: 'Cohesion', troops: 'Troops', cells: 'Cells',
        containment: 'Containment', action: 'Actions'
    };

    constructor(x = 100, y = 100) {
        super('craft', 'New Craft', x, y);
        this.craftData = CraftWidget.createDefaultData();
        this.catalogues = { profiles: [], roles: [], power: [], features: [], utilities: [], equipment: [] };
        this.hardpointOptions = [];
        this.craftWeapons = [];
        this.cataloguesLoaded = false;
        this.init();
        this.loadCatalogues();
    }

    static createDefaultData() {
        return {
            name: 'New Craft',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            profile: 'medium',
            roles: [],
            power: 'battery-1',
            loadout: { features: [], hardpoints: [], utilities: [], equipment: [] },
            baysRequired: 0,
            cost: 0,
            requiredTech: []
        };
    }

    get designData() {
        return this.craftData;
    }

    get defaultTitle() {
        return 'New Craft';
    }

    async loadCatalogues() {
        const [craft, weapons] = await Promise.allSettled([
            this.fetchJSON('data/Craft.json'),
            this.fetchJSON('data/weapons.json')
        ]);
        if (craft.status === 'fulfilled' && craft.value && typeof craft.value === 'object') {
            for (const key of Object.keys(this.catalogues)) {
                this.catalogues[key] = Array.isArray(craft.value[key]) ? craft.value[key] : [];
            }
        } else {
            console.error('Failed to load craft catalogues (data/Craft.json):', craft.reason);
            window.app?.showNotification('Craft catalogues failed to load.', 'error');
        }
        if (weapons.status === 'fulfilled') {
            const categories = weapons.value?.categories || [];
            const craftCategory = categories.find(entry => entry.name === CraftWidget.WEAPON_CATEGORY);
            this.craftWeapons = Array.isArray(craftCategory?.weapons) ? craftCategory.weapons : [];
            this.hardpointOptions = typeof ShipCapacity !== 'undefined'
                ? await ShipCapacity.getHardpointWeaponOptions(true)
                : categories.flatMap(entry => (entry.weapons || []).filter(weapon => weapon.resourceType === 'hardpoints'));
        } else {
            console.error('Failed to load craft weapons (data/weapons.json):', weapons.reason);
        }
        this.cataloguesLoaded = true;
        this.normalizeSelections();
        this.refresh();
    }

    getCatalogue(key) {
        return this.catalogues[key] || [];
    }

    getProfile() {
        const profiles = this.getCatalogue('profiles');
        return profiles.find(item => item.id === this.craftData.profile) || profiles[0] || null;
    }

    getSelectedRoles() {
        return this.getCatalogue('roles').filter(item => (this.craftData.roles || []).includes(item.id));
    }

    getPower() {
        return this.getCatalogue('power').find(item => item.id === this.craftData.power) || null;
    }

    getSelectedFeatures() {
        return this.getCatalogue('features').filter(item => (this.craftData.loadout.features || []).includes(item.id));
    }

    getPickerOptions(category) {
        if (category === 'hardpoints') return this.hardpointOptions;
        if (category === 'utilities') return this.getCatalogue('utilities');
        return this.getCatalogue('equipment');
    }

    findLoadoutItem(category, entry) {
        if (category === 'equipment') {
            const gear = this.getCatalogue('equipment').find(item => item.id === entry.id);
            const weapon = this.craftWeapons.find(item => item.id === entry.id);
            if (entry.source === 'weapon') return weapon || null;
            if (entry.source === 'gear') return gear || null;
            return gear || weapon || null;
        }
        return this.getPickerOptions(category).find(item => item.id === entry.id) || null;
    }

    // Resource units one item occupies.
    getItemSize(category, item) {
        if (!item) return 1;
        if (category === 'hardpoints') return Math.max(1, Number(item.resourceCount) || 1);
        return Math.max(1, Number(item.capacity) || 1);
    }

    getRoleCapacity(key) {
        return this.getSelectedRoles().reduce((sum, role) => sum + Number(role.capacities?.[key] || 0), 0);
    }

    getResourceCapacity(category) {
        const profile = this.getProfile() || {};
        const featureBonus = this.getSelectedFeatures().reduce((sum, item) => sum + Number(item[category] || 0), 0);
        const roleBonus = category === 'equipment' ? this.getRoleCapacity('equipment') : 0;
        return Math.max(0, Number(profile[category] || 0) + featureBonus + roleBonus);
    }

    getResourceUsed(category) {
        return (this.craftData.loadout[category] || []).reduce((sum, entry) =>
            sum + this.getItemSize(category, this.findLoadoutItem(category, entry)) * Number(entry.quantity || 1), 0);
    }

    getPowerTotal() {
        return Math.max(0, Number(this.getPower()?.power || 0) + this.getRoleCapacity('power'));
    }

    getLoadoutCost(category) {
        if (category === 'features') {
            return this.getSelectedFeatures().reduce((sum, item) => sum + this.getItemCost(item), 0);
        }
        return (this.craftData.loadout[category] || []).reduce((sum, entry) =>
            sum + this.getItemCost(this.findLoadoutItem(category, entry)) * Number(entry.quantity || 1), 0);
    }

    // Combined craft statistics; the Summary widget shows these when a craft is connected.
    calculateStats() {
        const profile = this.getProfile() || {};
        const roles = this.getSelectedRoles();
        const unique = values => [...new Set(values.filter(Boolean))];
        const profileCost = this.getItemCost(profile);
        const roleCost = roles.reduce((sum, item) => sum + this.getItemCost(item), 0);
        const powerCost = this.getItemCost(this.getPower());
        const loadoutCost = ['features', ...CraftWidget.LOADOUT_PICKERS]
            .reduce((sum, category) => sum + this.getLoadoutCost(category), 0);
        const stats = {
            profile: profile.name || '—',
            roles: roles.map(item => item.name),
            roleCount: roles.length,
            roleLimit: Number(profile.roleCount || 1),
            cohesion: Number(profile.cohesion || 0) + this.getRoleCapacity('cohesion'),
            burns: Number(profile.burns || 0),
            baysRequired: Number(profile.baysRequired || 0),
            facing: profile.facing || '—',
            power: this.getPowerTotal(),
            fuel: this.getRoleCapacity('fuel'),
            troops: this.getRoleCapacity('troops'),
            cells: this.getRoleCapacity('cells'),
            containment: this.getRoleCapacity('containment'),
            action: this.getRoleCapacity('action'),
            traits: unique(roles.flatMap(item => item.traits || [])),
            tags: unique(roles.flatMap(item => item.tags || [])),
            actions: unique([...(profile.actions || []), ...roles.flatMap(item => item.actions || [])]),
            profileCost,
            roleCost,
            powerCost,
            loadoutCost,
            combatValue: profileCost + roleCost + powerCost + loadoutCost
        };
        for (const category of CraftWidget.LOADOUT_PICKERS) {
            stats[category] = this.getResourceCapacity(category);
            stats[`${category}Used`] = this.getResourceUsed(category);
        }
        return stats;
    }

    getSelectedRequiredTech() {
        return this.collectRequiredTech([
            this.getProfile(),
            ...this.getSelectedRoles(),
            this.getPower(),
            ...this.getSelectedFeatures(),
            ...CraftWidget.LOADOUT_PICKERS.flatMap(category =>
                (this.craftData.loadout[category] || []).map(entry => this.findLoadoutItem(category, entry)))
        ]);
    }

    normalizeSelections() {
        if (!this.cataloguesLoaded) return;
        const profiles = this.getCatalogue('profiles');
        if (profiles.length && !profiles.some(item => item.id === this.craftData.profile)) {
            this.craftData.profile = profiles[0].id;
        }
        const power = this.getCatalogue('power');
        if (power.length && !this.getPower()) this.craftData.power = power[0].id;
        this.craftData.loadout.equipment = this.normalizeQuantityEntries(this.craftData.loadout.equipment);
        this.enforceRoleLimit();
    }

    enforceRoleLimit() {
        const limit = Number(this.getProfile()?.roleCount || 1);
        this.craftData.roles = (this.craftData.roles || []).slice(0, limit);
    }

    subtitle(label, extra = '') {
        return `<div class="design-subtitle"><span>${this.escape(label)}</span>${extra}</div>`;
    }

    counterMarkup(key, label) {
        return `<span class="outfit-resource-counter" id="${this.id}-${key}" aria-label="${this.escape(label)} used / available"><span class="outfit-resource-used">0</span> / <span class="outfit-resource-capacity">0</span></span>`;
    }

    subtotalMarkup(key) {
        return `<span class="outfit-section-subtotal outfit-section-subtotal-inline" id="${this.id}-${key}" aria-live="polite"></span>`;
    }

    pickerMarkup(category, label) {
        return `
            <div class="design-subsection design-loadout-group">
                ${this.subtitle(label, this.subtotalMarkup(`${category}-subtotal`) + this.counterMarkup(`${category}-counter`, label))}
                <div class="design-picker">
                    <select id="${this.id}-${category}-select" class="design-select" aria-label="${this.escape(label)} to add"></select>
                    <button type="button" class="widget-add-action" data-add-loadout="${category}">Add</button>
                </div>
                <div id="${this.id}-${category}-list" class="design-entry-list"></div>
            </div>`;
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');

        const meta = this.createDesignSection('meta', '');
        this.setSectionContent(meta, `
            ${this.renderIdentityFields({ rolePlaceholder: 'Optional custom role', notesPlaceholder: 'Craft notes' })}
        `);
        sections.appendChild(meta.section);

        const configuration = this.createDesignSection('configuration', 'Configuration');
        this.setSectionContent(configuration, `
            <div class="design-subsection">
                ${this.subtitle('Profile', this.subtotalMarkup('profile-subtotal'))}
                <select id="${this.id}-profile-select" class="design-select" aria-label="Craft profile"></select>
                <div id="${this.id}-profile-stats" class="design-chips"></div>
            </div>
            <div class="design-subsection">
                ${this.subtitle('Roles', this.subtotalMarkup('roles-subtotal') + this.counterMarkup('roles-counter', 'Roles'))}
                <div id="${this.id}-role-options" class="design-option-list"></div>
                <div id="${this.id}-role-details" class="design-details"></div>
            </div>
            <div class="design-subsection">
                ${this.subtitle('Power', `<span class="outfit-resource-counter" id="${this.id}-power-total"></span>`)}
                <select id="${this.id}-power-select" class="design-select" aria-label="Power"></select>
            </div>
            <div class="design-subsection design-loadout">
                ${this.subtitle('Loadout', this.subtotalMarkup('loadout-subtotal'))}
                <div class="design-subsection design-loadout-group">
                    ${this.subtitle('Features', this.subtotalMarkup('features-subtotal'))}
                    <div id="${this.id}-features" class="design-option-list design-option-list-single"></div>
                </div>
                ${this.pickerMarkup('hardpoints', 'Hardpoints')}
                ${this.pickerMarkup('utilities', 'Utilities')}
                ${this.pickerMarkup('equipment', 'Equipment')}
            </div>
        `);
        sections.appendChild(configuration.section);

        this.setupCraftEventListeners();
        this.refresh();
    }

    setupCraftEventListeners() {
        const root = this.element;
        this.setupFlagListeners(() => this.refresh());
        this.setupIdentityFieldListeners();
        root.querySelector(`#${this.id}-profile-select`).addEventListener('change', event => {
            this.craftData.profile = event.target.value;
            this.enforceRoleLimit();
            this.refresh();
        });
        root.querySelector(`#${this.id}-power-select`).addEventListener('change', event => {
            this.craftData.power = event.target.value;
            this.refresh();
        });
        root.querySelector(`#${this.id}-role-options`).addEventListener('change', event => {
            const input = event.target;
            if (input.type !== 'checkbox') return;
            const selected = new Set(this.craftData.roles || []);
            if (input.checked) {
                if (selected.size >= Number(this.getProfile()?.roleCount || 1)) {
                    input.checked = false;
                    return;
                }
                selected.add(input.value);
            } else selected.delete(input.value);
            this.craftData.roles = [...selected];
            this.refresh();
        });
        root.querySelector(`#${this.id}-features`).addEventListener('change', event => {
            const input = event.target;
            if (input.type !== 'checkbox') return;
            const selected = new Set(this.craftData.loadout.features || []);
            if (input.checked) selected.add(input.value);
            else selected.delete(input.value);
            this.craftData.loadout.features = [...selected];
            this.refresh();
        });
        root.querySelector(`#${this.id}-configuration`).addEventListener('click', event => {
            const add = event.target.closest('[data-add-loadout]');
            if (add) {
                this.addLoadoutItem(add.dataset.addLoadout);
                return;
            }
            const remove = event.target.closest('[data-remove-loadout]');
            if (remove) this.removeLoadoutItem(remove.dataset.removeLoadout);
        });
    }

    addLoadoutItem(category) {
        const select = this.element.querySelector(`#${this.id}-${category}-select`);
        const value = String(select?.value || '');
        if (!value) return;
        const [source, id] = category === 'equipment' ? value.split(':') : [undefined, value];
        const entry = source ? { id, source } : { id };
        const item = this.findLoadoutItem(category, entry);
        if (!item) return;
        const size = this.getItemSize(category, item);
        if (this.getResourceUsed(category) + size > this.getResourceCapacity(category)) return;
        const entries = this.craftData.loadout[category];
        const existing = entries.find(candidate => candidate.id === id && candidate.source === source);
        if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
        else entries.push({ ...entry, quantity: 1 });
        this.refresh();
        const refreshed = this.element.querySelector(`#${this.id}-${category}-select`);
        if ([...refreshed.options].some(option => option.value === value)) refreshed.value = value;
    }

    removeLoadoutItem(key) {
        const [category, source, id] = String(key).split('|');
        const entries = this.craftData.loadout[category] || [];
        const entry = entries.find(candidate => candidate.id === id && (candidate.source || '') === source);
        if (!entry) return;
        if (Number(entry.quantity || 1) > 1) entry.quantity -= 1;
        else this.craftData.loadout[category] = entries.filter(candidate => candidate !== entry);
        this.refresh();
    }

    refresh() {
        if (!this.element) return;
        this.updateControls();
        this.updateTotals();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    updateControls() {
        const root = this.element;
        const profileSelect = root.querySelector(`#${this.id}-profile-select`);
        if (!profileSelect) return;
        profileSelect.innerHTML = this.buildOptions(this.getCatalogue('profiles'), this.craftData.profile);
        root.querySelector(`#${this.id}-power-select`).innerHTML =
            this.buildOptions(this.getCatalogue('power'), this.craftData.power);

        const profile = this.getProfile() || {};
        root.querySelector(`#${this.id}-profile-stats`).innerHTML = this.renderChips([
            ['Cohesion', profile.cohesion],
            ['Burns', profile.burns],
            ['Bays', profile.baysRequired],
            ['Facing', profile.facing],
            ['Actions', (profile.actions || []).join(', ')]
        ]);

        const selectedRoles = new Set(this.craftData.roles || []);
        const roleLimit = Number(profile.roleCount || 1);
        const roleContainer = root.querySelector(`#${this.id}-role-options`);
        roleContainer.replaceChildren();
        this.getCatalogue('roles')
            .filter(item => selectedRoles.has(item.id) || this.isOptionAvailable(item))
            .forEach(item => {
                const label = document.createElement('label');
                label.className = 'design-option';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = item.id;
                checkbox.checked = selectedRoles.has(item.id);
                checkbox.disabled = !checkbox.checked && selectedRoles.size >= roleLimit;
                const text = document.createElement('span');
                text.textContent = `${this.formatOptionLabel(item, 'roles')}${this.isOptionAvailable(item) ? '' : ' (unavailable)'}`;
                label.append(checkbox, text);
                roleContainer.appendChild(label);
            });
        root.querySelector(`#${this.id}-role-details`).innerHTML = this.getSelectedRoles().map(role => {
            const capacityChips = Object.entries(role.capacities || {})
                .filter(([key, value]) => Number(value) !== 0 && CraftWidget.CAPACITY_LABELS[key])
                .map(([key, value]) => [CraftWidget.CAPACITY_LABELS[key], `${value > 0 ? '+' : ''}${value}`]);
            const lists = [['Traits', role.traits], ['Tags', role.tags], ['Actions', role.actions]]
                .filter(([, values]) => Array.isArray(values) && values.length)
                .map(([label, values]) => [label, values.join(', ')]);
            return `<div class="design-role-detail"><strong>${this.escape(role.name)}</strong> ${this.renderChips([...lists, ...capacityChips])}</div>`;
        }).join('');

        const selectedFeatures = new Set(this.craftData.loadout.features || []);
        const features = root.querySelector(`#${this.id}-features`);
        features.replaceChildren();
        this.getCatalogue('features')
            .filter(item => selectedFeatures.has(item.id) || this.isOptionAvailable(item))
            .forEach(item => {
                const label = document.createElement('label');
                label.className = 'design-option';
                const bonuses = ['hardpoints', 'utilities', 'equipment']
                    .filter(key => Number(item[key]))
                    .map(key => `+${item[key]} ${key}`);
                label.title = bonuses.join(', ');
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = item.id;
                input.checked = selectedFeatures.has(item.id);
                const name = document.createElement('span');
                name.textContent = `${this.formatOptionLabel(item, 'features')}${bonuses.length ? ` · ${bonuses.join(', ')}` : ''}`;
                label.append(input, name);
                features.appendChild(label);
            });

        for (const category of CraftWidget.LOADOUT_PICKERS) this.updatePicker(category);
    }

    updatePicker(category) {
        const select = this.element.querySelector(`#${this.id}-${category}-select`);
        const previous = select.value;
        const capacity = this.getResourceCapacity(category);
        const remaining = capacity - this.getResourceUsed(category);
        const optionMarkup = (items, prefix, costCategory) => items
            .filter(item => this.getItemSize(category, item) <= remaining)
            .map(item => `<option value="${prefix}${this.escape(item.id)}">${this.escape(this.formatOptionLabel(item, costCategory))}</option>`)
            .join('');
        if (category === 'equipment') {
            const gear = optionMarkup(this.filterByRequiredTech(this.getCatalogue('equipment')), 'gear:', 'equipment');
            const weapons = optionMarkup(this.filterByRequiredTech(this.craftWeapons), 'weapon:', 'munitions');
            select.innerHTML = (gear ? `<optgroup label="Equipment">${gear}</optgroup>` : '')
                + (weapons ? `<optgroup label="Weapons">${weapons}</optgroup>` : '');
        } else {
            select.innerHTML = optionMarkup(this.filterByRequiredTech(this.getPickerOptions(category)), '', category === 'hardpoints' ? 'munitions' : 'general');
        }
        if ([...select.options].some(option => option.value === previous)) select.value = previous;
        select.disabled = select.options.length === 0;
        this.element.querySelector(`[data-add-loadout="${category}"]`).disabled = select.disabled;
        this.renderEntryRows(
            this.element.querySelector(`#${this.id}-${category}-list`),
            (this.craftData.loadout[category] || []).map(entry => {
                const item = this.findLoadoutItem(category, entry);
                const quantity = Number(entry.quantity || 1);
                return {
                    key: `${category}|${entry.source || ''}|${entry.id}`,
                    name: item?.name || entry.id,
                    quantity,
                    cost: this.getItemCost(item) * quantity,
                    category: category === 'utilities' ? 'general' : (entry.source === 'gear' ? 'equipment' : 'munitions'),
                    unavailable: !item || !this.isOptionAvailable(item)
                };
            }),
            'removeLoadout'
        );
    }

    updateTotals() {
        const stats = this.calculateStats();
        this.craftData.cost = stats.combatValue;
        this.craftData.baysRequired = stats.baysRequired;
        this.craftData.requiredTech = this.getSelectedRequiredTech();
        this.setHeaderMetric('cost', '', this.formatOptionCost(stats.combatValue, 'general', this.getProfile()?.id || ''));
        this.setSubtotal('profile-subtotal', stats.profileCost);
        this.setSubtotal('roles-subtotal', stats.roleCost, 'roles');
        this.setSubtotal('loadout-subtotal', stats.loadoutCost);
        this.setSubtotal('features-subtotal', this.getLoadoutCost('features'), 'features');
        this.setCounter('roles-counter', stats.roleCount, stats.roleLimit);
        for (const category of CraftWidget.LOADOUT_PICKERS) {
            this.setSubtotal(`${category}-subtotal`, this.getLoadoutCost(category), category === 'equipment' ? 'equipment' : 'general');
            this.setCounter(`${category}-counter`, stats[`${category}Used`], stats[category]);
        }
        const power = this.element?.querySelector(`#${this.id}-power-total`);
        if (power) power.textContent = `${stats.power} power`;
    }

    onTechTreeUpdated() {
        if (this.element) this.refresh();
    }

    onEconomyModeChanged() {
        if (!this.element) return;
        this.updateControls();
        this.updateTotals();
        this.refreshSummary();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Core', 'Core', 0, 0.3, { sectionId: 'meta', anchorId: `${this.id}-meta` });
        this.addNode('output', 'Craft', 'Craft', 1, 0.4, { sectionId: 'meta', anchorId: `${this.id}-meta` });
        this.reflowNodes();
    }

    getSerializedData() {
        if (this.cataloguesLoaded) {
            const stats = this.calculateStats();
            this.craftData.cost = stats.combatValue;
            this.craftData.baysRequired = stats.baysRequired;
            this.craftData.requiredTech = this.getSelectedRequiredTech();
        }
        return this.craftData;
    }

    loadSerializedData(data = {}) {
        const defaults = CraftWidget.createDefaultData();
        const loadout = data.loadout || {};
        const hardpoints = this.normalizeQuantityEntries(loadout.hardpoints);
        const equipment = this.normalizeQuantityEntries(loadout.equipment);
        if (equipment.some(entry => entry.source !== 'gear' && entry.source !== 'weapon')) {
            throw new Error('Craft equipment selections must identify their gear or weapon source.');
        }
        this.craftData = {
            ...defaults,
            name: data.name || defaults.name,
            role: data.role ?? '',
            notes: data.notes ?? '',
            operational: Boolean(data.operational),
            ignoreRequiredTech: Boolean(data.ignoreRequiredTech),
            profile: data.profile || defaults.profile,
            roles: Array.isArray(data.roles) ? [...new Set(data.roles)] : [],
            power: data.power || defaults.power,
            loadout: {
                features: Array.isArray(loadout.features) ? [...new Set(loadout.features.filter(id => typeof id === 'string'))] : [],
                hardpoints: hardpoints.map(({ id, quantity }) => ({ id, quantity })),
                utilities: this.normalizeQuantityEntries(loadout.utilities).map(({ id, quantity }) => ({ id, quantity })),
                equipment
            },
            baysRequired: Number(data.baysRequired) || 0,
            cost: Number(data.cost) || 0,
            requiredTech: Array.isArray(data.requiredTech) ? data.requiredTech.slice() : []
        };
        this.updateTitle();
        this.normalizeSelections();
        if (this.element) {
            this.syncFlagInputs();
            this.element.querySelector(`#${this.id}-role`).value = this.craftData.role;
            this.element.querySelector(`#${this.id}-notes`).value = this.craftData.notes;
            if (this.cataloguesLoaded) this.refresh();
        }
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = this.craftData.name || this.defaultTitle;
        container.appendChild(title);
        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        const profile = this.getProfile();
        if (profile) badges.appendChild(this.createBadge(profile.name, 'info'));
        if (this.craftData.operational) badges.appendChild(this.createBadge('Operational', 'success'));
        if (this.craftData.ignoreRequiredTech) badges.appendChild(this.createBadge('Required Tech Ignored', 'warning'));
        container.appendChild(badges);
        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        const stats = this.calculateStats();
        [
            ['Role', this.craftData.role || stats.roles.join(', ') || '—'],
            ['Cost', this.formatOptionCost(stats.combatValue, 'general', profile?.id || '')],
            ['Bays', stats.baysRequired],
            ['Hardpoints', `${stats.hardpointsUsed}/${stats.hardpoints}`]
        ].forEach(([label, value]) => this.addSummaryField(grid, label, String(value)));
        container.appendChild(grid);
    }
}
