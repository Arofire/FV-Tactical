// Craft design widget backed by editable JSON catalogues in data/.
class CraftWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('craft', 'New Craft', x, y, null);
        this.craftData = {
            name: 'New Craft',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            profile: 'medium',
            roles: [],
            power: 'battery-1',
            requiredTech: [],
            loadout: { features: [], hardpoints: [], utilities: [], equipment: [] }
        };
        this.catalogues = {};
        this.layoutMode = 'three-column';
        this.init();
        this.loadCatalogues();
    }

    static get defaults() {
        return {
            profiles: [
                { id: 'heavy', name: 'Heavy', cohesion: 6, hardpoints: 6, utilities: 3, equipment: 4, burns: 2, externalQualities: 2, combatValue: 54, baysRequired: 2, roleCount: 3, facing: 'Forward', actions: ['Attack craft', 'Dock', 'Thrust'] },
                { id: 'medium', name: 'Medium', cohesion: 4, hardpoints: 4, utilities: 2, equipment: 3, burns: 3, externalQualities: 1, combatValue: 25, baysRequired: 4, roleCount: 2, facing: 'Forward', actions: ['Attack craft', 'Dock', 'Thrust'] },
                { id: 'light', name: 'Light', cohesion: 3, hardpoints: 2, utilities: 1, equipment: 2, burns: 4, externalQualities: 0, combatValue: 11, baysRequired: 2, roleCount: 1, facing: 'Forward', actions: ['Attack craft', 'Dock', 'Thrust'] },
                { id: 'special', name: 'Special', cohesion: 5, hardpoints: 3, utilities: 3, equipment: 4, burns: 3, externalQualities: 3, combatValue: 5, baysRequired: 1, roleCount: 2, facing: 'Variable', actions: ['Attack craft', 'Dock', 'Thrust'] }
            ],
            roles: [
                ['interceptor', 'Interceptor', ['Orbital'], ['Intercept'], 'medium', false, ['Armored'], { power: 0, fuel: 1, equipment: 0, cohesion: 1, troops: 0, cells: 0 }],
                ['defensive', 'Defensive', ['Defend other', 'Interrupt'], ['Escort'], 'light', false, ['Armored'], { power: 1, fuel: 0, equipment: 0, cohesion: 2, troops: 0, cells: 0 }],
                ['patrol', 'Patrol', ['Radius'], ['Patrol'], 'light', false, ['Reinforced'], { power: 1, fuel: 1, equipment: 1, cohesion: 1, troops: 0, cells: 0 }],
                ['assault', 'Assault', ['Interrupt'], ['Board'], 'medium', false, ['Armored'], { power: 1, fuel: 0, equipment: 0, cohesion: 2, troops: 1, cells: 0 }],
                ['transport', 'Transport', ['Orbital'], ['Deliver'], 'light', false, ['Reinforced'], { power: 1, fuel: 1, equipment: 2, cohesion: 1, troops: 0, cells: 2 }],
                ['picket', 'Picket', ['Defend other', 'Radius'], ['Early warning'], 'special', true, ['Reinforced'], { power: 1, fuel: 1, equipment: 1, cohesion: 1, troops: 0, cells: 1 }],
                ['strike', 'Strike', ['Orbital', 'Radius'], ['Strike target'], 'medium', false, ['Armored'], { power: 1, fuel: 0, equipment: 1, cohesion: 1, troops: 0, cells: 0 }],
                ['attack', 'Attack', ['Defend other'], ['Ground attack'], 'special', true, ['Armored'], { power: 0, fuel: 0, equipment: 1, cohesion: 2, troops: 0, cells: 0 }],
                ['atmospheric', 'Atmospheric', ['Orbital'], ['Atmospheric flight'], 'special', true, ['Reinforced'], { power: 1, fuel: 1, equipment: 1, cohesion: 1, troops: 0, cells: 0 }],
                ['troop', 'Troop', ['Radius'], ['Deploy troops'], 'special', true, ['Reinforced'], { power: 1, fuel: 0, equipment: 1, cohesion: 1, troops: 2, cells: 0 }],
                ['teleporter', 'Teleporter', ['Elite', 'Stable'], ['Teleport personnel'], 'medium', false, ['Reinforced'], { power: 2, fuel: 0, equipment: 1, cohesion: 1, troops: 1, cells: 2 }],
                ['shuttle', 'Shuttle', ['Stable'], ['Transfer'], 'special', true, ['Reinforced'], { power: 1, fuel: 0, equipment: 1, cohesion: 1, troops: 0, cells: 1 }],
                ['stable', 'Stable', ['Stable'], ['Hold formation'], 'special', true, ['Armored'], { power: 0, fuel: 1, equipment: 0, cohesion: 2, troops: 0, cells: 0 }]
            ].map(([id, name, traits, actions, profile, exclusive, tags, capacities]) => ({
                id, name, traits, actions, profile, exclusive, tags, capacities, steps: [`${name} operation`],
                stats: { thrust: 0, defense: 0, power: capacities.power }
            })),
            power: [
                { id: 'battery-1', name: 'Battery 1', power: 10 },
                { id: 'battery-2', name: 'Battery 2', power: 11 },
                { id: 'battery-3', name: 'Battery 3', power: 12 },
                { id: 'battery-4', name: 'Battery 4', power: 13 },
                { id: 'battery-5', name: 'Battery 5', power: 14 },
                { id: 'battery-6', name: 'Battery 6', power: 15 }
            ],
            features: [
                { id: 'reinforced-hull', name: 'Reinforced Hull', hardpoints: 0, utilities: 0, equipment: 0, combatValue: 1 },
                { id: 'sensor-suite', name: 'Sensor Suite', hardpoints: 0, utilities: 1, equipment: 0, combatValue: 0 },
                { id: 'cargo-pod', name: 'Cargo Pod', hardpoints: 0, utilities: 0, equipment: 1, combatValue: 0 }
            ],
            hardpoints: [
                { id: 'light-hardpoint', name: 'Light Hardpoint', capacity: 1, combatValue: 1 },
                { id: 'heavy-hardpoint', name: 'Heavy Hardpoint', capacity: 2, combatValue: 2 }
            ],
            utilities: [
                { id: 'sensor', name: 'Sensor Utility', capacity: 1 },
                { id: 'communications', name: 'Communications Utility', capacity: 1 }
            ],
            equipment: [
                { id: 'countermeasures', name: 'Countermeasures', capacity: 1, combatValue: 1 },
                { id: 'cargo', name: 'Cargo Equipment', capacity: 1 }
            ]
        };
    }

    async loadCatalogues() {
        const path = 'data/Craft.json';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const catalogues = await response.json();
            if (!catalogues || typeof catalogues !== 'object' || Array.isArray(catalogues)) {
                throw new Error('Invalid catalogue data');
            }
            this.catalogues = catalogues;
        } catch (error) {
            console.error(`Failed to load Craft catalogues (${path}):`, error);
            window.app?.showNotification(
                'Craft catalogues failed to load; built-in data is being used.',
                'error'
            );
        }
        this.updateControls();
    }

    getCatalogue(key) {
        return Array.isArray(this.catalogues[key]) ? this.catalogues[key] : CraftWidget.defaults[key];
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
        const info = this.createSection('meta', 'Craft Information');
        this.setSectionContent(info, `
            <div class="input-group"><label for="${this.id}-name">Craft Name</label><input id="${this.id}-name" type="text" placeholder="Enter craft name"></div>
            <div class="input-group"><label for="${this.id}-role">Role</label><input id="${this.id}-role" type="text" placeholder="Optional custom role"></div>
            <div class="input-group"><label for="${this.id}-notes">Notes</label><textarea id="${this.id}-notes" rows="3" placeholder="Craft notes"></textarea></div>
            <div class="ship-information-header">
                <label class="ship-flag"><input id="${this.id}-operational" type="checkbox"> Operational</label>
            </div>
            <div class="input-group"><label><input id="${this.id}-ignore-required-tech" type="checkbox"> Ignore Required Tech</label></div>
        `);
        sections.appendChild(info.section);

        const profile = this.createSection('profile', 'Profile');
        this.setSectionContent(profile, `<div class="input-group"><label for="${this.id}-profile-select">Craft Profile</label><select id="${this.id}-profile-select"></select></div><div id="${this.id}-profile-stats" class="widget-stats"></div>`);
        sections.appendChild(profile.section);

        const roles = this.createSection('roles', 'Role');
        this.setSectionContent(roles, `<div class="input-group"><label>Roles (up to profile limit)</label><div id="${this.id}-role-options" class="component-list"></div></div><div id="${this.id}-role-details"></div>`);
        sections.appendChild(roles.section);

        const power = this.createSection('power', 'Power');
        this.setSectionContent(power, `<div class="input-group"><label for="${this.id}-power-select">Power</label><select id="${this.id}-power-select"></select></div><div id="${this.id}-power-stats" class="widget-stats"></div>`);
        sections.appendChild(power.section);

        const loadout = this.createSection('loadout', 'Loadout');
        this.setSectionContent(loadout, ['features', 'hardpoints', 'utilities', 'equipment'].map(category => `
            <div class="input-group"><label>${category[0].toUpperCase() + category.slice(1)}</label><div id="${this.id}-${category}" class="component-list"></div></div>
        `).join(''));
        sections.appendChild(loadout.section);

        const stats = this.createSection('stats', 'Combined Statistics');
        this.setSectionContent(stats, `<div id="${this.id}-combined-stats" class="widget-stats"></div>`);
        sections.appendChild(stats.section);
        this.setupCraftEventListeners();
        this.updateControls();
        this.updateStats();
    }

    setupCraftEventListeners() {
        const root = this.element;
        root.querySelector(`#${this.id}-name`).addEventListener('input', event => {
            this.craftData.name = event.target.value;
            this.updateTitle();
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-role`).addEventListener('input', event => {
            this.craftData.role = event.target.value;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-notes`).addEventListener('input', event => { this.craftData.notes = event.target.value; });
        root.querySelector(`#${this.id}-operational`).addEventListener('change', event => {
            this.craftData.operational = event.target.checked;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-ignore-required-tech`).addEventListener('change', event => {
            this.craftData.ignoreRequiredTech = event.target.checked;
            this.refreshSummary();
        });
        root.querySelector(`#${this.id}-profile-select`).addEventListener('change', event => {
            this.craftData.profile = event.target.value;
            this.enforceRoleLimit();
            this.updateControls();
            this.updateStats();
        });
        root.querySelector(`#${this.id}-power-select`).addEventListener('change', event => {
            this.craftData.power = event.target.value;
            this.updateStats();
        });
        root.querySelector(`#${this.id}-role-options`).addEventListener('change', event => {
            const input = event.target;
            if (input.type !== 'checkbox') return;
            const selected = new Set(this.craftData.roles || []);
            if (input.checked) {
                const maximum = this.getProfile()?.roleCount || 1;
                if (selected.size >= maximum) { input.checked = false; return; }
                selected.add(input.value);
            } else selected.delete(input.value);
            this.craftData.roles = [...selected];
            this.updateControls();
            this.updateStats();
        });
        ['features', 'hardpoints', 'utilities', 'equipment'].forEach(category => {
            root.querySelector(`#${this.id}-${category}`).addEventListener('change', event => {
                const input = event.target;
                if (input.type !== 'checkbox') return;
                const selected = new Set(this.craftData.loadout[category] || []);
                if (input.checked) selected.add(input.value);
                else selected.delete(input.value);
                this.craftData.loadout[category] = [...selected];
                this.updateControls();
                this.updateStats();
            });
        });
    }

    getProfile() {
        return this.getCatalogue('profiles').find(item => item.id === this.craftData.profile) || this.getCatalogue('profiles')[0];
    }

    getSelectedRequiredTech() {
        const selected = [
            this.getProfile(),
            ...this.getCatalogue('roles').filter(item => (this.craftData.roles || []).includes(item.id)),
            this.getCatalogue('power').find(item => item.id === this.craftData.power),
            ...['features', 'hardpoints', 'utilities', 'equipment'].flatMap(category =>
                this.getCatalogue(category).filter(item => (this.craftData.loadout?.[category] || []).includes(item.id)))
        ];
        return [...new Set(selected.flatMap(item => {
            const requirements = item?.requiredTech;
            return (Array.isArray(requirements) ? requirements : [requirements])
                .filter(value => typeof value === 'string' && value.trim())
                .map(value => value.trim());
        }))];
    }

    enforceRoleLimit() {
        const max = this.getProfile()?.roleCount || 1;
        this.craftData.roles = (this.craftData.roles || []).slice(0, max);
    }

    updateControls() {
        if (!this.element) return;
        const profileSelect = this.element.querySelector(`#${this.id}-profile-select`);
        const powerSelect = this.element.querySelector(`#${this.id}-power-select`);
        if (!profileSelect || !powerSelect) return;
        const options = (items, selected, category = 'general') => items.map(item =>
            `<option value="${this.escape(item.id)}" ${item.id === selected ? 'selected' : ''}>${this.escape(this.formatOptionLabel(item, category))}</option>`
        ).join('');
        profileSelect.innerHTML = options(this.getCatalogue('profiles'), this.craftData.profile);
        powerSelect.innerHTML = options(this.getCatalogue('power'), this.craftData.power);

        const profile = this.getProfile() || {};
        const selectedRoles = new Set(this.craftData.roles || []);
        const roleContainer = this.element.querySelector(`#${this.id}-role-options`);
        roleContainer.replaceChildren();
        this.getCatalogue('roles').forEach(item => {
            const label = document.createElement('label');
            label.className = 'component-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = item.id;
            checkbox.checked = selectedRoles.has(item.id);
            checkbox.disabled = !checkbox.checked && selectedRoles.size >= (profile.roleCount || 1);
            const text = document.createElement('span');
            text.textContent = this.formatOptionLabel(item, 'roles');
            label.append(checkbox, text);
            roleContainer.appendChild(label);
        });
        const details = this.element.querySelector(`#${this.id}-role-details`);
        details.replaceChildren();
        const selected = this.getCatalogue('roles').filter(item => selectedRoles.has(item.id));
        [['Traits', 'traits'], ['Actions', 'actions'], ['Steps', 'steps']].forEach(([label, field]) => {
            const values = [...new Set(selected.flatMap(item => item[field] || []))];
            if (values.length) {
                const row = document.createElement('div');
                row.className = 'stat-row';
                const title = document.createElement('span');
                title.className = 'stat-label';
                title.textContent = `${label}:`;
                const value = document.createElement('span');
                value.className = 'stat-value';
                value.textContent = values.join(', ');
                row.append(title, value);
                details.appendChild(row);
            }
        });

        ['features', 'hardpoints', 'utilities', 'equipment'].forEach(category => {
            const container = this.element.querySelector(`#${this.id}-${category}`);
            const chosen = new Set(this.craftData.loadout[category] || []);
            container.replaceChildren();
            this.getCatalogue(category).forEach(item => {
                const label = document.createElement('label');
                label.className = 'component-item';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = item.id;
                input.checked = chosen.has(item.id);
                const name = document.createElement('span');
                const categoryKey = category === 'features' || category === 'equipment' ? category : 'general';
                name.textContent = this.formatOptionLabel(item, categoryKey);
                label.append(input, name);
                container.appendChild(label);
            });
        });
        const profileStats = this.element.querySelector(`#${this.id}-profile-stats`);
        profileStats.replaceChildren();
        this.renderStatRows(profileStats, profile, ['cohesion', 'hardpoints', 'utilities', 'equipment', 'burns', 'externalQualities', 'combatValue', 'baysRequired', 'roleCount', 'facing']);
    }

    renderStatRows(container, data, keys) {
        keys.forEach(key => {
            const row = document.createElement('div');
            row.className = 'stat-row';
            const label = document.createElement('span');
            label.className = 'stat-label';
            label.textContent = `${key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase())}:`;
            const value = document.createElement('span');
            value.className = 'stat-value';
            const rawValue = data[key] ?? 0;
            const isCost = key === 'combatValue' || key === 'cost';
            const source = key === 'combatValue' ? this.getProfile() : null;
            value.textContent = isCost
                ? this.formatOptionCost(Number(rawValue), 'general', source?.id || '')
                : rawValue;
            row.append(label, value);
            container.appendChild(row);
        });
    }

    calculateStats() {
        const profile = this.getProfile() || {};
        const roles = this.getCatalogue('roles').filter(item => (this.craftData.roles || []).includes(item.id));
        const power = this.getCatalogue('power').find(item => item.id === this.craftData.power) || { power: 0 };
        const output = { ...profile };
        ['thrust', 'defense', 'power'].forEach(key => {
            output[key] = roles.reduce((sum, role) => sum + Number(role.stats?.[key] || 0), 0);
        });
        output.power = Math.max(0, output.power + Number(power.power || 0));
        const loadout = this.craftData.loadout || {};
        ['features', 'hardpoints', 'utilities', 'equipment'].forEach(category => {
            const entries = this.getCatalogue(category).filter(item => (loadout[category] || []).includes(item.id));
            entries.forEach(item => {
                if (category === 'features') {
                    output.hardpoints += Number(item.hardpoints || 0);
                    output.utilities += Number(item.utilities || 0);
                    output.equipment += Number(item.equipment || 0);
                    output.combatValue += Number(item.combatValue || 0);
                } else if (category === 'hardpoints') {
                    output.hardpoints -= Number(item.capacity || 1);
                    output.combatValue += Number(item.combatValue || 0);
                } else if (category === 'utilities') output.utilities -= Number(item.capacity || 1);
                else output.equipment -= Number(item.capacity || 1);
            });
        });
        return output;
    }

    updateStats() {
        if (!this.element) return;
        this.craftData.requiredTech = this.getSelectedRequiredTech();
        const stats = this.calculateStats();
        this.setHeaderMetric('cost', '', this.formatOptionCost(stats.combatValue, 'general', this.getProfile()?.id || ''));
        const statsContainer = this.element.querySelector(`#${this.id}-combined-stats`);
        const powerContainer = this.element.querySelector(`#${this.id}-power-stats`);
        if (!statsContainer || !powerContainer) return;
        statsContainer.replaceChildren();
        this.renderStatRows(statsContainer, stats, ['cohesion', 'hardpoints', 'utilities', 'equipment', 'burns', 'externalQualities', 'combatValue', 'baysRequired', 'roleCount', 'facing', 'thrust', 'defense', 'power']);
        powerContainer.replaceChildren();
        this.renderStatRows(powerContainer, stats, ['power']);
        this.refreshSummary();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Core', 'Core', 0, 0.3, { sectionId: 'meta', anchorId: `${this.id}-meta` });
        this.addNode('output', 'Craft', 'Craft', 1, 0.4, { sectionId: 'profile', anchorId: `${this.id}-profile` });
        this.reflowNodes();
    }

    updateTitle() {
        this.title = this.craftData.name || 'New Craft';
        const title = this.element?.querySelector('.widget-title');
        if (title) title.textContent = this.title;
    }

    getSerializedData() {
        this.craftData.requiredTech = this.getSelectedRequiredTech();
        return this.craftData;
    }

    loadSerializedData(data = {}) {
        const source = data;
        this.craftData = {
            name: source.name ?? 'New Craft',
            role: source.role ?? '',
            notes: source.notes ?? '',
            operational: Boolean(source.operational),
            ignoreRequiredTech: Boolean(source.ignoreRequiredTech),
            profile: source.profile || 'medium',
            roles: Array.isArray(source.roles) ? source.roles.slice() : [],
            power: this.getCatalogue('power').some(item => item.id === source.power)
                ? source.power
                : 'battery-1',
            requiredTech: Array.isArray(source.requiredTech) ? source.requiredTech.slice() : [],
            loadout: {
                features: Array.isArray(source.loadout?.features) ? source.loadout.features.slice() : [],
                hardpoints: Array.isArray(source.loadout?.hardpoints) ? source.loadout.hardpoints.slice() : [],
                utilities: Array.isArray(source.loadout?.utilities) ? source.loadout.utilities.slice() : [],
                equipment: Array.isArray(source.loadout?.equipment) ? source.loadout.equipment.slice() : []
            }
        };
        this.enforceRoleLimit();
        this.updateTitle();
        if (this.element) {
            this.element.querySelector(`#${this.id}-name`).value = this.craftData.name;
            this.element.querySelector(`#${this.id}-role`).value = this.craftData.role;
            this.element.querySelector(`#${this.id}-notes`).value = this.craftData.notes;
            this.element.querySelector(`#${this.id}-operational`).checked = this.craftData.operational;
            this.element.querySelector(`#${this.id}-ignore-required-tech`).checked = this.craftData.ignoreRequiredTech;
            this.updateControls();
            this.updateStats();
        }
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = this.craftData.name || 'New Craft';
        container.appendChild(title);
        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        [this.getProfile()?.name, ...(this.craftData.roles || []).map(id => this.getCatalogue('roles').find(role => role.id === id)?.name).filter(Boolean)]
            .filter(Boolean).forEach(value => badges.appendChild(this.createBadge(value, 'info')));
        if (this.craftData.operational) badges.appendChild(this.createBadge('Operational', 'success'));
        if (this.craftData.ignoreRequiredTech) badges.appendChild(this.createBadge('Required Tech Ignored', 'warning'));
        container.appendChild(badges);
        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        const stats = this.calculateStats();
        [['Role', this.craftData.role || '—'], ['Combat Value', this.formatOptionCost(stats.combatValue, 'general', this.getProfile()?.id || '')], ['Power', stats.power], ['Loadout Items', Object.values(this.craftData.loadout).reduce((sum, list) => sum + list.length, 0)]]
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
