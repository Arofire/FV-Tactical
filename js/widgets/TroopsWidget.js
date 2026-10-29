// Troop unit design. Training, features, formations and non-weapon gear come from
// data/troop.json; troop weapons come from the "Troops" category of data/weapons.json.
class TroopsWidget extends DesignWidget {
    static WEAPON_CATEGORY = 'Troops';

    constructor(x = 100, y = 100) {
        super('troops', 'New Troop Unit', x, y);
        this.troopData = TroopsWidget.createDefaultData();
        this.catalogues = { training: [], features: [], formations: [], equipment: [] };
        this.troopWeapons = [];
        this.cataloguesLoaded = false;
        this.init();
        this.loadCatalogues();
    }

    static createDefaultData() {
        return {
            name: 'New Troop Unit',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            training: 'trained',
            features: [],
            formations: ['line'],
            equipment: [],
            berthsRequired: 1,
            cost: 0,
            requiredTech: []
        };
    }

    get designData() {
        return this.troopData;
    }

    get defaultTitle() {
        return 'New Troop Unit';
    }

    async loadCatalogues() {
        const [troops, weapons] = await Promise.allSettled([
            this.fetchJSON('data/troop.json'),
            WeaponCatalogue.load()
        ]);
        if (troops.status === 'fulfilled' && troops.value && typeof troops.value === 'object') {
            for (const key of Object.keys(this.catalogues)) {
                this.catalogues[key] = Array.isArray(troops.value[key]) ? troops.value[key] : [];
            }
        } else {
            console.error('Failed to load troop catalogues (data/troop.json):', troops.reason);
            window.app?.showNotification('Troop catalogues failed to load.', 'error');
        }
        if (weapons.status === 'fulfilled') {
            const category = (weapons.value?.categories || [])
                .find(entry => entry.name === TroopsWidget.WEAPON_CATEGORY);
            this.troopWeapons = Array.isArray(category?.weapons) ? category.weapons : [];
        } else {
            this.reportCatalogueError('Troop weapons catalogue (data/weapons.json)', weapons.reason);
        }
        this.cataloguesLoaded = troops.status === 'fulfilled' && weapons.status === 'fulfilled';
        if (this.cataloguesLoaded) this.normalizeSelections();
        this.refresh();
    }

    getCatalogue(key) {
        return this.catalogues[key] || [];
    }

    findTraining(id = this.troopData.training) {
        return this.getCatalogue('training').find(item => item.id === id) || null;
    }

    getSelectedFeatures() {
        return this.getCatalogue('features').filter(item => this.hasFeature(item.id));
    }

    getSelectedFormations() {
        return (this.troopData.formations || [])
            .map(id => this.getCatalogue('formations').find(item => item.id === id))
            .filter(Boolean);
    }

    hasFeature(id) {
        return (this.troopData.features || []).includes(id);
    }

    // Equipment entries: { id, source: 'gear' | 'weapon', quantity }.
    findEquipment(entry) {
        const gear = this.getCatalogue('equipment').find(item => item.id === entry.id);
        const weapon = this.troopWeapons.find(item => item.id === entry.id);
        if (entry.source === 'weapon') return weapon || null;
        if (entry.source === 'gear') return gear || null;
        return gear || weapon || null;
    }

    normalizeSelections() {
        if (!this.cataloguesLoaded) return;
        const training = this.getCatalogue('training');
        if (training.length && !this.findTraining()) {
            const fallback = TroopsWidget.createDefaultData().training;
            this.troopData.training = this.findTraining(fallback) ? fallback : training[0].id;
        }
        this.troopData.equipment = this.normalizeQuantityEntries(this.troopData.equipment);
        this.enforceFormationRules();
        this.trimEquipmentToCapacity();
    }

    enforceFormationRules() {
        const limit = this.hasFeature('multi-domain') ? 2 : 1;
        const formations = (this.troopData.formations || []).filter(Boolean).slice(0, limit);
        const fallback = this.getCatalogue('formations')[0]?.id || 'line';
        this.troopData.formations = formations.length ? formations : [fallback];
    }

    getEquipmentCapacity() {
        const sources = [this.findTraining(), ...this.getSelectedFeatures(), ...this.getSelectedFormations()];
        return Math.max(0, sources.reduce((sum, item) => sum + Number(item?.equipment || 0), 0));
    }

    getEquipmentUsed() {
        return (this.troopData.equipment || []).reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
    }

    // A unit needs the berths of its most demanding formation.
    getBerthsRequired() {
        const formations = this.getSelectedFormations();
        if (!formations.length) return Math.max(0, Number(this.troopData.berthsRequired ?? 1) || 0);
        return Math.max(...formations.map(item => Math.max(0, Number(item.berths ?? 1) || 0)));
    }

    trimEquipmentToCapacity() {
        if (!this.cataloguesLoaded) return;
        let remaining = this.getEquipmentCapacity();
        this.troopData.equipment = (this.troopData.equipment || []).flatMap(entry => {
            const quantity = Math.min(Number(entry.quantity || 1), remaining);
            remaining -= quantity;
            return quantity > 0 ? [{ ...entry, quantity }] : [];
        });
    }

    calculateStats() {
        const training = this.findTraining();
        const features = this.getSelectedFeatures();
        const formations = this.getSelectedFormations();
        const trainingCost = this.getItemCost(training);
        const featureCost = features.reduce((sum, item) => sum + this.getItemCost(item), 0);
        const formationCost = formations.reduce((sum, item) => sum + this.getItemCost(item), 0);
        const equipmentCost = (this.troopData.equipment || []).reduce((sum, entry) =>
            sum + this.getItemCost(this.findEquipment(entry)) * Number(entry.quantity || 1), 0);
        return {
            combatValue: trainingCost + featureCost + formationCost + equipmentCost,
            trainingCost,
            featureCost,
            formationCost,
            equipmentCost,
            equipmentCapacity: this.getEquipmentCapacity(),
            equipmentUsed: this.getEquipmentUsed(),
            berthsRequired: this.getBerthsRequired(),
            cohesion: [training, ...features, ...formations].reduce((sum, item) => sum + Number(item?.cohesion || 0), 0),
            action: Number(training?.action || 0)
        };
    }

    getSelectedRequiredTech() {
        return this.collectRequiredTech([
            this.findTraining(),
            ...this.getSelectedFeatures(),
            ...this.getSelectedFormations(),
            ...(this.troopData.equipment || []).map(entry => this.findEquipment(entry))
        ]);
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');

        const unit = this.createDesignSection('unit', '');
        this.setSectionContent(unit, `
            ${this.renderIdentityFields({ rolePlaceholder: 'Optional role', notesPlaceholder: 'Unit notes' })}
        `);
        sections.appendChild(unit.section);

        const training = this.createDesignSection('training-section', 'Training', { subtotal: true });
        this.setSectionContent(training, `
            <select id="${this.id}-training" class="design-select" aria-label="Training"></select>
            <div id="${this.id}-training-details" class="design-details"></div>
        `);
        sections.appendChild(training.section);

        const features = this.createDesignSection('features-section', 'Features', { subtotal: true });
        this.setSectionContent(features, `
            <div id="${this.id}-features" class="design-option-list"></div>
            <div id="${this.id}-feature-details" class="design-details"></div>
        `);
        sections.appendChild(features.section);

        const formations = this.createDesignSection('formations-section', 'Formations', { subtotal: true });
        const berths = document.createElement('span');
        berths.className = 'outfit-resource-counter';
        berths.id = `${this.id}-berths`;
        berths.title = 'Berths required to station this unit aboard a ship';
        formations.titleElement.appendChild(berths);
        this.setSectionContent(formations, `
            <select id="${this.id}-formation-1" class="design-select" aria-label="Formation"></select>
            <select id="${this.id}-formation-2" class="design-select" aria-label="Second formation (Multi-Domain)" hidden></select>
            <div id="${this.id}-formation-details" class="design-details"></div>
        `);
        sections.appendChild(formations.section);

        const equipment = this.createDesignSection('equipment-section', 'Equipment', { subtotal: true, counter: true });
        this.setSectionContent(equipment, `
            <div class="design-picker">
                <select id="${this.id}-equipment-select" class="design-select" aria-label="Equipment to add"></select>
                <button type="button" id="${this.id}-add-equipment" class="widget-add-action">Add</button>
            </div>
            <div id="${this.id}-equipment-list" class="design-entry-list"></div>
        `);
        sections.appendChild(equipment.section);

        this.setupTroopEventListeners();
        this.refresh();
    }

    setupTroopEventListeners() {
        const root = this.element;
        this.setupFlagListeners(() => this.refresh());
        this.setupIdentityFieldListeners();
        root.querySelector(`#${this.id}-training`).addEventListener('change', event => {
            this.troopData.training = event.target.value;
            this.trimEquipmentToCapacity();
            this.refresh();
        });
        root.querySelector(`#${this.id}-features`).addEventListener('change', event => {
            if (event.target.type !== 'checkbox') return;
            const features = new Set(this.troopData.features);
            if (event.target.checked) features.add(event.target.value);
            else features.delete(event.target.value);
            this.troopData.features = [...features];
            if (this.hasFeature('multi-domain') && this.troopData.formations.length < 2) {
                const second = this.filterByRequiredTech(this.getCatalogue('formations'))
                    .find(item => item.id !== this.troopData.formations[0]);
                if (second) this.troopData.formations.push(second.id);
            }
            this.enforceFormationRules();
            this.trimEquipmentToCapacity();
            this.refresh();
        });
        [1, 2].forEach(index => {
            root.querySelector(`#${this.id}-formation-${index}`).addEventListener('change', event => {
                this.troopData.formations[index - 1] = event.target.value;
                this.enforceFormationRules();
                this.trimEquipmentToCapacity();
                this.refresh();
            });
        });
        root.querySelector(`#${this.id}-add-equipment`).addEventListener('click', () => this.addEquipment());
        root.querySelector(`#${this.id}-equipment-list`).addEventListener('click', event => {
            const button = event.target.closest('[data-remove-equipment]');
            if (button) this.removeEquipment(button.dataset.removeEquipment);
        });
    }

    addEquipment() {
        const select = this.element.querySelector(`#${this.id}-equipment-select`);
        const [source, id] = String(select.value || '').split(':');
        if (!source || !id || this.getEquipmentUsed() >= this.getEquipmentCapacity()) return;
        if (!this.findEquipment({ id, source })) return;
        const existing = this.troopData.equipment.find(entry => entry.id === id && entry.source === source);
        if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
        else this.troopData.equipment.push({ id, source, quantity: 1 });
        this.refresh();
        this.element.querySelector(`#${this.id}-equipment-select`).value = `${source}:${id}`;
    }

    removeEquipment(key) {
        const [source, id] = String(key).split(':');
        const entry = this.troopData.equipment.find(item => item.id === id && item.source === source);
        if (!entry) return;
        if (Number(entry.quantity || 1) > 1) entry.quantity -= 1;
        else this.troopData.equipment = this.troopData.equipment.filter(item => item !== entry);
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
        const training = root.querySelector(`#${this.id}-training`);
        if (!training) return;
        const trainingItems = this.getCatalogue('training');
        training.innerHTML = this.buildOptions(trainingItems, this.troopData.training, 'general');
        const selectedTraining = this.findTraining();
        root.querySelector(`#${this.id}-training-details`).innerHTML = selectedTraining ? `<div class="design-chips">${this.renderChips([
            ['Cohesion', selectedTraining.cohesion],
            ['Actions', selectedTraining.action],
            ['Equipment', selectedTraining.equipment]
        ])}</div>` + (selectedTraining.description ? `<p>${this.escape(selectedTraining.description)}</p>` : '') : '';

        const features = root.querySelector(`#${this.id}-features`);
        features.replaceChildren();
        this.getCatalogue('features')
            .filter(item => this.hasFeature(item.id) || this.isOptionAvailable(item))
            .forEach(item => {
                const label = document.createElement('label');
                label.className = 'design-option';
                label.title = item.effect || '';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = item.id;
                checkbox.checked = this.hasFeature(item.id);
                const name = document.createElement('span');
                name.textContent = `${this.formatOptionLabel(item, 'features')}${this.isOptionAvailable(item) ? '' : ' (unavailable)'}`;
                label.append(checkbox, name);
                features.appendChild(label);
            });
        root.querySelector(`#${this.id}-feature-details`).innerHTML = this.getSelectedFeatures()
            .filter(item => item.effect)
            .map(item => `<div><strong>${this.escape(item.name)}:</strong> ${this.escape(item.effect)}</div>`)
            .join('');

        const formations = this.getCatalogue('formations');
        const first = root.querySelector(`#${this.id}-formation-1`);
        const second = root.querySelector(`#${this.id}-formation-2`);
        first.innerHTML = this.buildOptions(formations, this.troopData.formations[0], 'general');
        second.hidden = !this.hasFeature('multi-domain');
        second.innerHTML = second.hidden ? '' : this.buildOptions(formations, this.troopData.formations[1], 'general');
        root.querySelector(`#${this.id}-formation-details`).innerHTML = this.getSelectedFormations()
            .map(item => `<div><strong>${this.escape(item.name)}:</strong> ${this.escape(item.effect || '')} <span class="design-muted">(${Number(item.berths ?? 1)} berth${Number(item.berths ?? 1) === 1 ? '' : 's'})</span></div>`)
            .join('');

        const capacity = this.getEquipmentCapacity();
        const used = this.getEquipmentUsed();
        const select = root.querySelector(`#${this.id}-equipment-select`);
        const previous = select.value;
        const group = (label, items, source, category) => items.length
            ? `<optgroup label="${this.escape(label)}">${items.map(item =>
                `<option value="${source}:${this.escape(item.id)}">${this.escape(this.formatOptionLabel(item, category))}</option>`).join('')}</optgroup>`
            : '';
        const gear = this.filterByRequiredTech(this.getCatalogue('equipment'));
        const weapons = this.filterByRequiredTech(this.troopWeapons);
        select.innerHTML = group('Gear', gear, 'gear', 'equipment') + group('Weapons', weapons, 'weapon', 'munitions');
        if ([...select.options].some(option => option.value === previous)) select.value = previous;
        select.disabled = used >= capacity || select.options.length === 0;
        root.querySelector(`#${this.id}-add-equipment`).disabled = select.disabled;
        this.renderEntryRows(
            root.querySelector(`#${this.id}-equipment-list`),
            (this.troopData.equipment || []).map(entry => {
                const definition = this.findEquipment(entry);
                const quantity = Number(entry.quantity || 1);
                return {
                    key: `${entry.source || 'gear'}:${entry.id}`,
                    name: definition?.name || entry.id,
                    quantity,
                    cost: this.getItemCost(definition) * quantity,
                    category: entry.source === 'weapon' ? 'munitions' : 'equipment',
                    unavailable: !definition || !this.isOptionAvailable(definition)
                };
            }),
            'removeEquipment'
        );
    }

    updateTotals() {
        const stats = this.calculateStats();
        this.troopData.cost = stats.combatValue;
        this.troopData.berthsRequired = stats.berthsRequired;
        this.troopData.requiredTech = this.getSelectedRequiredTech();
        this.setHeaderMetric('cost', '', this.formatTotalCost(stats.combatValue, 'general'));
        this.setSubtotal('training-section-subtotal', stats.trainingCost);
        this.setSubtotal('features-section-subtotal', stats.featureCost, 'features');
        this.setSubtotal('formations-section-subtotal', stats.formationCost);
        this.setSubtotal('equipment-section-subtotal', stats.equipmentCost, 'equipment');
        this.setCounter('equipment-section-counter', stats.equipmentUsed, stats.equipmentCapacity);
        const berths = this.element?.querySelector(`#${this.id}-berths`);
        if (berths) berths.textContent = `${stats.berthsRequired} berth${stats.berthsRequired === 1 ? '' : 's'}`;
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
        this.addNode('output', 'Troop', 'Troop', 1, 0.4, {
            sectionId: 'unit', anchorId: `${this.id}-unit`, optional: true
        });
        this.reflowNodes();
    }

    getSerializedData() {
        if (this.cataloguesLoaded) {
            const stats = this.calculateStats();
            this.troopData.cost = stats.combatValue;
            this.troopData.berthsRequired = stats.berthsRequired;
            this.troopData.requiredTech = this.getSelectedRequiredTech();
        }
        return this.troopData;
    }

    loadSerializedData(data = {}) {
        const defaults = TroopsWidget.createDefaultData();
        const equipment = this.normalizeQuantityEntries(data.equipment);
        if (equipment.some(entry => entry.source !== 'gear' && entry.source !== 'weapon')) {
            throw new Error('Troop equipment selections must identify their gear or weapon source.');
        }
        this.troopData = {
            ...defaults,
            name: data.name || defaults.name,
            role: data.role ?? '',
            notes: data.notes ?? '',
            operational: Boolean(data.operational),
            ignoreRequiredTech: Boolean(data.ignoreRequiredTech),
            training: data.training || defaults.training,
            features: Array.isArray(data.features) ? [...new Set(data.features)] : [],
            formations: Array.isArray(data.formations) ? data.formations.slice(0, 2) : [...defaults.formations],
            equipment,
            berthsRequired: Math.max(0, Number(data.berthsRequired ?? 1) || 0),
            cost: Number(data.cost) || 0,
            requiredTech: Array.isArray(data.requiredTech) ? data.requiredTech.slice() : []
        };
        this.updateTitle();
        this.normalizeSelections();
        if (this.element) {
            this.syncFlagInputs();
            this.element.querySelector(`#${this.id}-role`).value = this.troopData.role;
            this.element.querySelector(`#${this.id}-notes`).value = this.troopData.notes;
            if (this.cataloguesLoaded) this.refresh();
        }
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = this.troopData.name || this.defaultTitle;
        container.appendChild(title);
        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        const training = this.findTraining();
        if (training) badges.appendChild(this.createBadge(training.name, 'info'));
        if (this.troopData.operational) badges.appendChild(this.createBadge('Operational', 'success'));
        if (this.troopData.ignoreRequiredTech) badges.appendChild(this.createBadge('Required Tech Ignored', 'warning'));
        container.appendChild(badges);
        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        const stats = this.calculateStats();
        [
            ['Role', this.troopData.role || '—'],
            ['Cost', this.formatTotalCost(stats.combatValue, 'general')],
            ['Formations', this.getSelectedFormations().map(item => item.name).join(', ') || '—'],
            ['Berths', stats.berthsRequired],
            ['Equipment', `${stats.equipmentUsed}/${stats.equipmentCapacity}`]
        ].forEach(([label, value]) => this.addSummaryField(grid, label, String(value)));
        container.appendChild(grid);
    }
}
