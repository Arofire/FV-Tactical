// Troop force builder backed by the training, feature, formation, and equipment catalogues.
class TroopsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('troops', 'New Troop Unit', x, y, null);
        this.troopData = {
            name: 'New Troop Unit',
            role: '',
            operational: false,
            ignoreRequiredTech: false,
            training: 'basic',
            features: [],
            formations: ['line'],
            equipment: [],
            requiredTech: []
        };
        this.catalogues = {};
        this.layoutMode = 'three-column';
        this.init();
        this.loadCatalogues();
    }

    static get defaults() {
        return {
            training: [
                { id: 'green', name: 'Green', combatValue: 5, cohesion: 1, action: 1, equipment: 1, description: 'Green troops are less survivable in defence and much less effective when attacking. Green troops cannot use the Support action. Irregular, militia or just plain undrained.' },
                { id: 'trained', name: 'Trained', combatValue: 12, cohesion: 1, action: 1, equipment: 1 },
                { id: 'professional', name: 'Professional', combatValue: 20, cohesion: 2, action: 2, equipment: 1 },
                { id: 'veteran', name: 'Veteran', combatValue: 28, cohesion: 2, action: 2, equipment: 1 },
                { id: 'elite', name: 'Elite', combatValue: 42, cohesion: 2, action: 2, equipment: 1, description: 'Elite troops are more effective with any equipment, and improve the TN of any roll by 1.' }
            ],
            features: [
                { id: 'protected', name: 'Protected', effect: 'Provides basic personal protection.', combatValue: 1, equipment: 1 },
                { id: 'reinforced', name: 'Reinforced', effect: 'Improves resilience under fire.', combatValue: 1, equipment: 1 },
                { id: 'plasma-field', name: 'Plasma Field', effect: 'Adds a defensive plasma field.', combatValue: 2, equipment: 1 },
                { id: 'enhanced', name: 'Enhanced', effect: 'Improves physical and tactical capability.', combatValue: 2, equipment: 1 },
                { id: 'multi-domain', name: 'Multi-Domain', effect: 'Allows a second formation to be selected.', combatValue: 1, equipment: 1 },
                { id: 'shock', name: 'Shock', effect: 'Specialized assault capability.', combatValue: 2, equipment: 1 }
            ],
            formations: [
                { id: 'line', name: 'Line', effect: 'Balanced unit deployment.', combatValue: 0, equipment: 1 },
                { id: 'column', name: 'Column', effect: 'Rapid movement and deployment.', combatValue: 0, equipment: 1 },
                { id: 'wedge', name: 'Wedge', effect: 'Concentrated forward assault.', combatValue: 1, equipment: 1 },
                { id: 'dispersed', name: 'Dispersed', effect: 'Widely distributed deployment.', combatValue: 0, equipment: 1 }
            ],
            equipment: [
                { id: 'armor', name: 'Personal Armor', combatValue: 1 },
                { id: 'rifle', name: 'Assault Rifle', combatValue: 1 },
                { id: 'heavy-weapon', name: 'Heavy Weapon', combatValue: 2 },
                { id: 'communications', name: 'Communications Gear', combatValue: 0 },
                { id: 'medical-kit', name: 'Medical Kit', combatValue: 0 }
            ]
        };
    }

    async loadCatalogues() {
        const path = 'data/troop.json';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const catalogues = await response.json();
            if (!catalogues || typeof catalogues !== 'object' || Array.isArray(catalogues)) {
                throw new Error('Invalid catalogue data');
            }
            this.catalogues = catalogues;
        } catch (error) {
            console.error(`Failed to load troop catalogues (${path}):`, error);
            window.app?.showNotification(
                'Troop catalogues failed to load; built-in data is being used.',
                'error'
            );
        }
        this.updateControls();
    }

    getCatalogue(key) {
        return Array.isArray(this.catalogues[key]) ? this.catalogues[key] : TroopsWidget.defaults[key];
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    formatOptionCost(value, category = 'general', itemId = '') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '';
        try {
            if (typeof window.app?.formatOptionCost === 'function') {
                return window.app.formatOptionCost(value, category, itemId);
            }
        } catch (error) {
            // Fall back to CV when the application economy context is unavailable.
        }
        return `${value} CV`;
    }

    getOptionCostLabels(item, category = 'general') {
        if (!item) return [];
        const labels = [];
        if (typeof item.combatValue === 'number' && Number.isFinite(item.combatValue)) {
            labels.push(this.formatOptionCost(item.combatValue, category, item.id));
        }
        if (typeof item.cost === 'number' && Number.isFinite(item.cost)) {
            labels.push(this.formatOptionCost(item.cost, category, item.id));
        }
        return labels.filter(Boolean);
    }

    formatOptionLabel(item, category = 'general') {
        const amounts = this.getOptionCostLabels(item, category);
        return `${item.name}${amounts.length ? ` (${amounts.join('; ')})` : ''}`;
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const info = this.createSection('unit-info-section', 'Unit Information');
        this.setSectionContent(info, `
            <div class="input-group"><label for="${this.id}-name">Unit Name</label><input id="${this.id}-name" type="text" placeholder="Enter unit name"></div>
            <div class="input-group"><label for="${this.id}-role">Cosmetic Role</label><input id="${this.id}-role" type="text" placeholder="Optional role description"></div>
            <div class="ship-information-header">
                <label class="ship-flag"><input id="${this.id}-operational" type="checkbox"> Operational</label>
            </div>
            <div class="input-group"><label><input id="${this.id}-ignore-required-tech" type="checkbox"> Ignore Required Tech</label></div>
        `);
        sections.appendChild(info.section);

        const training = this.createSection('training-section', 'Training');
        this.setSectionContent(training, `<div class="input-group"><label for="${this.id}-training">Training (select one)</label><select id="${this.id}-training"></select></div><div id="${this.id}-training-details"></div>`);
        sections.appendChild(training.section);

        const features = this.createSection('features-section', 'Features');
        this.setSectionContent(features, `<div id="${this.id}-features" class="component-list"></div><div id="${this.id}-feature-details"></div>`);
        sections.appendChild(features.section);

        const formations = this.createSection('formations-section', 'Formations');
        this.setSectionContent(formations, `
            <div class="input-group"><label for="${this.id}-formation-1">Formation</label><select id="${this.id}-formation-1"></select></div>
            <div class="input-group" id="${this.id}-formation-2-group" hidden><label for="${this.id}-formation-2">Second Formation (Multi-Domain)</label><select id="${this.id}-formation-2"></select></div>
        `);
        sections.appendChild(formations.section);

        const equipment = this.createSection('equipment-section', 'Equipment');
        this.setSectionContent(equipment, `
            <div class="input-group"><label for="${this.id}-equipment-select">Available equipment (<span id="${this.id}-equipment-capacity">0</span> total)</label>
                <div style="display:flex;gap:8px"><select id="${this.id}-equipment-select" style="flex:1"></select><button type="button" id="${this.id}-add-equipment">Add</button></div>
            </div>
            <div id="${this.id}-equipment-list" class="component-list"></div>
        `);
        sections.appendChild(equipment.section);

        const stats = this.createSection('stats-section', 'Statistics');
        this.setSectionContent(stats, `<div id="${this.id}-stats" class="widget-stats"></div>`);
        sections.appendChild(stats.section);
        this.setupTroopEventListeners();
        this.updateControls();
        this.updateStats();
    }

    setupTroopEventListeners() {
        const root = this.element;
        root.querySelector(`#${this.id}-name`).addEventListener('input', event => {
            this.troopData.name = event.target.value;
            this.updateTitle();
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-role`).addEventListener('input', event => {
            this.troopData.role = event.target.value;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-operational`).addEventListener('change', event => {
            this.troopData.operational = event.target.checked;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-ignore-required-tech`).addEventListener('change', event => {
            this.troopData.ignoreRequiredTech = event.target.checked;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-training`).addEventListener('change', event => {
            this.troopData.training = event.target.value;
            this.updateControls();
            this.updateStats();
        });
        root.querySelector(`#${this.id}-features`).addEventListener('change', event => {
            if (event.target.type !== 'checkbox') return;
            const features = new Set(this.troopData.features);
            if (event.target.checked) features.add(event.target.value);
            else features.delete(event.target.value);
            this.troopData.features = [...features];
            this.enforceFormationRules();
            this.updateControls();
            this.updateStats();
        });
        root.querySelector(`#${this.id}-formation-1`).addEventListener('change', event => {
            this.troopData.formations[0] = event.target.value;
            this.updateStats();
        });
        root.querySelector(`#${this.id}-formation-2`).addEventListener('change', event => {
            this.troopData.formations[1] = event.target.value;
            this.updateStats();
        });
        root.querySelector(`#${this.id}-add-equipment`).addEventListener('click', () => this.addEquipment());
        root.querySelector(`#${this.id}-equipment-list`).addEventListener('click', event => {
            const button = event.target.closest('[data-remove-equipment]');
            if (button) this.removeEquipment(button.dataset.removeEquipment);
        });
    }

    hasFeature(id) { return (this.troopData.features || []).includes(id); }

    enforceFormationRules() {
        const forms = (this.troopData.formations || []).filter(Boolean).slice(0, this.hasFeature('multi-domain') ? 2 : 1);
        this.troopData.formations = forms.length ? forms : [this.getCatalogue('formations')[0]?.id || 'line'];
    }

    getEquipmentCapacity() {
        const training = this.getCatalogue('training').find(item => item.id === this.troopData.training);
        const features = this.getCatalogue('features').filter(item => this.hasFeature(item.id));
        const formations = this.getCatalogue('formations').filter(item => (this.troopData.formations || []).includes(item.id));
        return Math.max(0, Number(training?.equipment || 0)
            + features.reduce((sum, item) => sum + Number(item.equipment || 0), 0)
            + formations.reduce((sum, item) => sum + Number(item.equipment || 0), 0));
    }

    getSelectedRequiredTech() {
        const selected = [
            this.getCatalogue('training').find(item => item.id === this.troopData.training),
            ...this.getCatalogue('features').filter(item => this.hasFeature(item.id)),
            ...this.getCatalogue('formations').filter(item => (this.troopData.formations || []).includes(item.id)),
            ...this.getCatalogue('equipment').filter(item => (this.troopData.equipment || []).some(entry => entry.id === item.id))
        ];
        return [...new Set(selected.flatMap(item => {
            const requirements = item?.requiredTech;
            return (Array.isArray(requirements) ? requirements : [requirements])
                .filter(value => typeof value === 'string' && value.trim())
                .map(value => value.trim());
        }))];
    }

    updateControls() {
        if (!this.element) return;
        const setOptions = (select, items, selected, category = 'general') => {
            select.innerHTML = items.map(item => `<option value="${this.escape(item.id)}">${this.escape(this.formatOptionLabel(item, category))}</option>`).join('');
            if (selected && items.some(item => item.id === selected)) select.value = selected;
        };
        const training = this.element.querySelector(`#${this.id}-training`);
        setOptions(training, this.getCatalogue('training'), this.troopData.training);
        const selectedTraining = this.getCatalogue('training').find(item => item.id === this.troopData.training);
        const trainingDetails = this.element.querySelector(`#${this.id}-training-details`);
        trainingDetails.textContent = selectedTraining?.description || '';

        const features = this.element.querySelector(`#${this.id}-features`);
        features.replaceChildren();
        this.getCatalogue('features').forEach(item => {
            const label = document.createElement('label');
            label.className = 'component-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = item.id;
            checkbox.checked = this.hasFeature(item.id);
            const name = document.createElement('span');
            name.textContent = this.formatOptionLabel(item, 'features');
            label.append(checkbox, name);
            features.appendChild(label);
        });
        const featureDetails = this.element.querySelector(`#${this.id}-feature-details`);
        featureDetails.replaceChildren();
        this.getCatalogue('features').filter(item => this.hasFeature(item.id)).forEach(item => {
            const line = document.createElement('div');
            const amounts = this.getOptionCostLabels(item, 'features');
            line.textContent = `${item.name}: ${item.effect}${amounts.length ? ` ${amounts.join('; ')}` : ''}`;
            featureDetails.appendChild(line);
        });

        const forms = this.getCatalogue('formations');
        this.enforceFormationRules();
        this.trimEquipmentToCapacity();
        const first = this.element.querySelector(`#${this.id}-formation-1`);
        const second = this.element.querySelector(`#${this.id}-formation-2`);
        setOptions(first, forms, this.troopData.formations[0]);
        setOptions(second, forms, this.troopData.formations[1] || forms[0]?.id);
        this.element.querySelector(`#${this.id}-formation-2-group`).hidden = !this.hasFeature('multi-domain');

        const capacity = this.getEquipmentCapacity();
        const capacityLabel = this.element.querySelector(`#${this.id}-equipment-capacity`);
        capacityLabel.textContent = String(capacity);
        const equipSelect = this.element.querySelector(`#${this.id}-equipment-select`);
        const choices = this.getCatalogue('equipment');
        equipSelect.innerHTML = choices.map(item =>
            `<option value="${this.escape(item.id)}">${this.escape(this.formatOptionLabel(item, 'equipment'))}</option>`
        ).join('');
        const used = (this.troopData.equipment || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
        equipSelect.disabled = used >= capacity || choices.length === 0;
        this.element.querySelector(`#${this.id}-add-equipment`).disabled = equipSelect.disabled;
        this.updateEquipmentList();
    }

    addEquipment() {
        const select = this.element.querySelector(`#${this.id}-equipment-select`);
        const item = this.getCatalogue('equipment').find(entry => entry.id === select.value);
        if (!item) return;
        const used = (this.troopData.equipment || []).reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
        if (used >= this.getEquipmentCapacity()) return;
        const existing = this.troopData.equipment.find(entry => entry.id === item.id);
        if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
        else this.troopData.equipment.push({ id: item.id, quantity: 1 });
        this.updateControls();
        this.updateStats();
    }

    removeEquipment(id) {
        const entry = this.troopData.equipment.find(item => item.id === id);
        if (!entry) return;
        if (Number(entry.quantity || 1) > 1) entry.quantity -= 1;
        else this.troopData.equipment = this.troopData.equipment.filter(item => item.id !== id);
        this.updateControls();
        this.updateStats();
    }

    updateEquipmentList() {
        const container = this.element?.querySelector(`#${this.id}-equipment-list`);
        if (!container) return;
        container.replaceChildren();
        (this.troopData.equipment || []).forEach(entry => {
            const definition = this.getCatalogue('equipment').find(item => item.id === entry.id);
            if (!definition) return;
            const row = document.createElement('div');
            row.className = 'component-item';
            const name = document.createElement('span');
            const quantity = Number(entry.quantity || 1);
            const costLabels = this.getOptionCostLabels({
                ...definition,
                combatValue: typeof definition.combatValue === 'number' ? definition.combatValue * quantity : undefined,
                cost: typeof definition.cost === 'number' ? definition.cost * quantity : undefined
            }, 'equipment');
            name.textContent = `${definition.name} × ${quantity}${costLabels.length ? ` (${costLabels.join('; ')})` : ''}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'component-remove';
            remove.dataset.removeEquipment = entry.id;
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove ${definition.name}`);
            row.append(name, remove);
            container.appendChild(row);
        });
    }

    calculateStats() {
        const training = this.getCatalogue('training').find(item => item.id === this.troopData.training) || {};
        const features = this.getCatalogue('features').filter(item => this.hasFeature(item.id));
        const formations = this.getCatalogue('formations').filter(item => (this.troopData.formations || []).includes(item.id));
        const equipment = this.troopData.equipment || [];
        const equipmentDefinitions = equipment.map(entry => ({
            ...entry,
            definition: this.getCatalogue('equipment').find(item => item.id === entry.id)
        })).filter(entry => entry.definition);
        const combatValue = Number(training.combatValue || 0)
            + features.reduce((sum, item) => sum + Number(item.combatValue || 0), 0)
            + formations.reduce((sum, item) => sum + Number(item.combatValue || 0), 0)
            + equipmentDefinitions.reduce((sum, entry) => sum + Number(entry.definition.combatValue || 0) * Number(entry.quantity || 1), 0);
        return { combatValue, equipmentCapacity: this.getEquipmentCapacity(), equipmentUsed: equipment.reduce((sum, item) => sum + Number(item.quantity || 1), 0) };
    }

    updateStats() {
        const stats = this.calculateStats();
        this.setHeaderMetric('cost', '', this.formatOptionCost(stats.combatValue, 'general'));
        const container = this.element?.querySelector(`#${this.id}-stats`);
        if (!container) return;
        this.troopData.requiredTech = this.getSelectedRequiredTech();
        container.replaceChildren();
        [['Combat Value', stats.combatValue], ['Equipment Capacity', `${stats.equipmentUsed}/${stats.equipmentCapacity}`],
            ['Training', this.getCatalogue('training').find(item => item.id === this.troopData.training)?.name || '—'],
            ['Formations', (this.troopData.formations || []).map(id => this.getCatalogue('formations').find(item => item.id === id)?.name).filter(Boolean).join(', ') || '—']]
            .forEach(([label, value]) => {
                const row = document.createElement('div');
                row.className = 'stat-row';
                const key = document.createElement('span');
                key.className = 'stat-label';
                key.textContent = `${label}:`;
                const result = document.createElement('span');
                result.className = 'stat-value';
                result.textContent = label === 'Combat Value'
                    ? this.formatOptionCost(Number(value), 'general')
                    : String(value);
                row.append(key, result);
                container.appendChild(row);
            });
        this.updateControls();
        this.refreshSummary();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('output', 'Troop', 'Troop', 1, 0.4, { sectionId: 'unit-info-section', anchorId: `${this.id}-unit-info-section` });
        this.reflowNodes();
    }

    updateTitle() {
        this.title = this.troopData.name || 'New Troop Unit';
        const title = this.element?.querySelector('.widget-title');
        if (title) title.textContent = this.title;
    }

    getSerializedData() {
        this.troopData.requiredTech = this.getSelectedRequiredTech();
        return this.troopData;
    }

    loadSerializedData(data = {}) {
        const source = data;
        const equipment = Array.isArray(source.equipment)
            ? source.equipment
                .filter(item => item && typeof item === 'object' && typeof item.id === 'string')
                .map(item => ({ id: item.id, quantity: Math.max(1, Number(item.quantity || 1)) }))
            : [];
        this.troopData = {
            name: source.name || 'New Troop Unit',
            role: source.role ?? '',
            operational: Boolean(source.operational),
            ignoreRequiredTech: Boolean(source.ignoreRequiredTech),
            training: source.training || 'basic',
            features: Array.isArray(source.features) ? [...new Set(source.features)] : [],
            formations: Array.isArray(source.formations) ? source.formations.slice(0, 2) : ['line'],
            equipment,
            requiredTech: Array.isArray(source.requiredTech) ? source.requiredTech.slice() : []
        };
        this.enforceFormationRules();
        this.updateTitle();
        if (this.element) {
            this.element.querySelector(`#${this.id}-name`).value = this.troopData.name;
            this.element.querySelector(`#${this.id}-role`).value = this.troopData.role;
            this.element.querySelector(`#${this.id}-operational`).checked = this.troopData.operational;
            this.element.querySelector(`#${this.id}-ignore-required-tech`).checked = this.troopData.ignoreRequiredTech;
            this.trimEquipmentToCapacity();
            this.updateControls();
            this.updateStats();
        }
    }

    trimEquipmentToCapacity() {
        let remaining = this.getEquipmentCapacity();
        this.troopData.equipment = (this.troopData.equipment || []).flatMap(item => {
            const quantity = Math.min(Number(item.quantity || 1), remaining);
            remaining -= quantity;
            return quantity > 0 ? [{ ...item, quantity }] : [];
        });
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = this.troopData.name || 'New Troop Unit';
        container.appendChild(title);
        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        const training = this.getCatalogue('training').find(item => item.id === this.troopData.training);
        if (training) badges.appendChild(this.createBadge(training.name, 'info'));
        if (this.troopData.operational) badges.appendChild(this.createBadge('Operational', 'success'));
        if (this.troopData.ignoreRequiredTech) badges.appendChild(this.createBadge('Required Tech Ignored', 'warning'));
        container.appendChild(badges);
        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        const stats = this.calculateStats();
        [['Role', this.troopData.role || '—'], ['Combat Value', this.formatOptionCost(stats.combatValue, 'general')],
            ['Features', (this.troopData.features || []).length], ['Equipment', `${stats.equipmentUsed}/${stats.equipmentCapacity}`]]
            .forEach(([label, value]) => this.addSummaryField(grid, label, String(value)));
        container.appendChild(grid);
    }

    refreshSummary() {
        const summary = this.element?.querySelector('.widget-summary');
        if (summary && this.element.classList.contains('minimized')) this.renderSummary(summary);
    }

    onEconomyModeChanged() {
        if (!this.element) return;
        this.updateControls();
        this.updateStats();
        this.refreshSummary();
    }

    onMinimizeStateChanged(isMinimized) { if (isMinimized) this.refreshSummary(); }

    addSummaryField(container, label, value) {
        const name = document.createElement('div');
        name.className = 'summary-label';
        name.textContent = label;
        const text = document.createElement('div');
        text.className = 'summary-value';
        text.textContent = value;
        container.append(name, text);
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}
