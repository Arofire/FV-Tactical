// Munition design widget. Profiles, guidance packages, and payloads are
// sourced from data/munitions.json and gated by researched tech.
class MunitionsWidget extends DesignWidget {
    static ACCURACY_BANDS = ['short', 'medium', 'long', 'distant', 'extreme'];
    static BAND_LABELS = {
        short: 'Short', medium: 'Medium', long: 'Long', distant: 'Distant', extreme: 'Extreme'
    };
    static BAND_MIN = -10;
    static BAND_MAX = 10;
    static BASE_ACCURACY_POOL = 10;

    constructor(x = 100, y = 100) {
        super('munitions', 'New Munition', x, y);
        this.munitionData = {
            name: 'New Munition',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            profile: null,
            guidance: null,
            payload: null,
            payloadCount: 1,
            accuracy: { short: -10, medium: -10, long: -10, distant: -10, extreme: -10 },
            cost: 0,
            requiredTech: []
        };
        this.munitionsData = { profiles: [], guidance: [], payloads: [] };
        this.munitionsDataLoaded = false;
        this.init();
        this.loadMunitionsData();
    }

    get designData() {
        return this.munitionData;
    }

    get defaultTitle() {
        return 'New Munition';
    }

    async loadMunitionsData() {
        try {
            const data = await this.fetchJSON('data/munitions.json');
            if (!Array.isArray(data?.profiles) ||
                !Array.isArray(data?.guidance) ||
                !Array.isArray(data?.payloads)) {
                throw new Error('Munition data must contain profiles, guidance, and payloads arrays');
            }
            this.munitionsData = {
                profiles: data.profiles,
                guidance: data.guidance,
                payloads: data.payloads
            };
        } catch (error) {
            this.reportCatalogueError('Munition catalogue (data/munitions.json)', error);
            this.munitionsData = { profiles: [], guidance: [], payloads: [] };
        }
        this.munitionsDataLoaded = true;
        this.refresh();
    }

    get ignoreRequiredTech() {
        return !!this.munitionData.ignoreRequiredTech;
    }

    filterByRequiredTech(items) {
        return super.filterByRequiredTech(items);
    }

    getProfileOptions() {
        return this.filterByRequiredTech(this.munitionsData.profiles);
    }

    getGuidanceOptions() {
        return this.filterByRequiredTech(this.munitionsData.guidance);
    }

    // Payloads are limited to the size classes the selected profile can mount.
    getPayloadOptions() {
        const capacity = this.findProfile()?.payloadCapacity;
        const payloads = this.filterByRequiredTech(this.munitionsData.payloads);
        if (!capacity) return payloads;
        return payloads.filter(item => Number(capacity[item.size]) > 0);
    }

    findProfile(id = this.munitionData.profile) {
        return this.munitionsData.profiles.find(item => item.id === id) || null;
    }

    findGuidance(id = this.munitionData.guidance) {
        return this.munitionsData.guidance.find(item => item.id === id) || null;
    }

    findPayload(id = this.munitionData.payload) {
        return this.munitionsData.payloads.find(item => item.id === id) || null;
    }

    getMaxPayloadCount() {
        const capacity = this.findProfile()?.payloadCapacity;
        const size = this.findPayload()?.size;
        if (!capacity || !size) return 0;
        return Math.max(0, Number(capacity[size]) || 0);
    }

    getMagazineCells() {
        return Math.max(0, Number(this.findProfile()?.cells) || 0);
    }

    getAccuracyPool() {
        return MunitionsWidget.BASE_ACCURACY_POOL + (Number(this.findGuidance()?.accuracy) || 0);
    }

    getAccuracyUsed() {
        return MunitionsWidget.ACCURACY_BANDS.reduce(
            (sum, band) => sum + (this.munitionData.accuracy[band] - MunitionsWidget.BAND_MIN), 0
        );
    }

    // A band may not exceed double the (offset, non-negative) value of the band
    // one step lower. Offsetting by BAND_MIN keeps the rule meaningful for
    // negative slider values.
    getBandValidMax(index) {
        if (index <= 0) return MunitionsWidget.BAND_MAX;
        const previous = this.munitionData.accuracy[MunitionsWidget.ACCURACY_BANDS[index - 1]];
        const validMax = 2 * (previous - MunitionsWidget.BAND_MIN) + MunitionsWidget.BAND_MIN;
        return Math.max(MunitionsWidget.BAND_MIN, Math.min(MunitionsWidget.BAND_MAX, validMax));
    }

    isBandValid(index) {
        const band = MunitionsWidget.ACCURACY_BANDS[index];
        return this.munitionData.accuracy[band] <= this.getBandValidMax(index);
    }

    getInvalidBands() {
        return MunitionsWidget.ACCURACY_BANDS.filter((band, index) => !this.isBandValid(index));
    }

    // weapons.json-shaped definition so operational munitions can be offered
    // wherever catalogue weapons are (fleet magazine/hardpoint filling, exports).
    toWeaponDefinition() {
        const profile = this.findProfile();
        const payload = this.findPayload();
        const tags = [...(profile?.tags || []), ...(payload?.notes || [])];
        return {
            id: this.id,
            name: this.munitionData.name || 'New Munition',
            accuracy: MunitionsWidget.ACCURACY_BANDS.map(band => this.munitionData.accuracy[band]),
            damage: MunitionsWidget.ACCURACY_BANDS.map(() => profile?.damage ?? null),
            tagsDescription: this.formatTags(tags),
            cost: Number(this.munitionData.cost) || 0,
            requiredTech: this.getSelectedRequiredTech(),
            hp: 'H01',
            categoryName: 'Munitions',
            isMunition: true
        };
    }

    getSelectedRequiredTech() {
        const tech = new Set();
        for (const item of [this.findProfile(), this.findGuidance(), this.findPayload()]) {
            for (const techId of item?.requiredTech || []) tech.add(techId);
        }
        return Array.from(tech);
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    formatOptionCost(value, category = 'munitions', itemId = '') {
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

    formatOptionLabel(item, category = 'munitions') {
        const costLabel = this.formatOptionCost(Number(item.cost) || 0, category, item.id);
        return costLabel ? `${item.name} (${costLabel})` : item.name;
    }

    formatTags(tags = []) {
        return tags.map(tag => tag.value !== undefined && tag.value !== null
            ? `${tag.name}(${tag.value})` : tag.name).join(', ');
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const identitySection = this.createDesignSection('meta', '');
        this.setSectionContent(identitySection, this.renderFlags());
        sectionsContainer.appendChild(identitySection.section);

        const componentsSection = this.createDesignSection('components', 'Components');
        this.setSectionContent(componentsSection, `
            <div class="input-group">
                <label for="${this.id}-profile">Profile</label>
                <select id="${this.id}-profile"></select>
            </div>
            <div id="${this.id}-profile-stats" class="design-details"></div>
            <div class="input-group">
                <label for="${this.id}-guidance">Guidance</label>
                <select id="${this.id}-guidance"></select>
            </div>
            <div class="input-group">
                <label for="${this.id}-payload">Payload</label>
                <div class="payload-select-row">
                    <select id="${this.id}-payload"></select>
                    <input type="number" class="hull-spin" id="${this.id}-payload-count" min="1" step="1" value="${this.munitionData.payloadCount}" aria-label="Payload count">
                </div>
            </div>
            <div class="input-group">
                <label for="${this.id}-cost">Cost</label>
                <input type="number" id="${this.id}-cost" min="0" step="0.5" value="${this.munitionData.cost}">
            </div>
        `);
        sectionsContainer.appendChild(componentsSection.section);

        const accuracySection = this.createDesignSection('accuracy', 'Accuracy');
        this.setSectionContent(accuracySection, `
            <div class="accuracy-sliders">
                ${MunitionsWidget.ACCURACY_BANDS.map(band => `
                    <div class="accuracy-item">
                        <input type="range" class="accuracy-slider" id="${this.id}-accuracy-${band}"
                            min="${MunitionsWidget.BAND_MIN}" max="${MunitionsWidget.BAND_MAX}" step="1"
                            value="${this.munitionData.accuracy[band]}" data-band="${band}"
                            aria-label="${MunitionsWidget.BAND_LABELS[band]} accuracy">
                        <span class="accuracy-value" id="${this.id}-accuracy-${band}-value">${this.munitionData.accuracy[band]}</span>
                        <span class="accuracy-label">${MunitionsWidget.BAND_LABELS[band]}</span>
                    </div>
                `).join('')}
            </div>
        `);
        this.addAccuracyCounter(accuracySection.titleElement);
        sectionsContainer.appendChild(accuracySection.section);

        const statsSection = this.createDesignSection('stats', 'Statistics');
        this.setSectionContent(statsSection, `
            <div class="widget-stats" id="${this.id}-stats"></div>
        `);
        sectionsContainer.appendChild(statsSection.section);

        this.setupMunitionListeners();
        this.refreshSelectors();
        this.syncFormFromData();
        this.refreshStats();
    }

    addAccuracyCounter(titleElement) {
        if (!titleElement) return;
        const counter = document.createElement('span');
        counter.className = 'outfit-resource-counter';
        counter.id = `${this.id}-accuracy-counter`;
        counter.setAttribute('aria-label', 'accuracy used / available');
        const used = document.createElement('span');
        used.className = 'outfit-resource-used';
        used.textContent = '0';
        const capacity = document.createElement('span');
        capacity.className = 'outfit-resource-capacity';
        capacity.textContent = '0';
        counter.append(used, document.createTextNode(' / '), capacity);
        titleElement.appendChild(counter);
    }

    setupMunitionListeners() {
        // Lookups must be scoped to this.element: createContent runs before the
        // widget is attached to the document, so document.getElementById fails.
        const root = this.element;
        const profileSelect = root.querySelector(`#${this.id}-profile`);
        if (profileSelect) {
            profileSelect.addEventListener('change', (e) => {
                this.munitionData.profile = e.target.value || null;
                // Clear a payload whose size the new profile cannot mount.
                if (this.munitionData.payload && this.getMaxPayloadCount() === 0) {
                    this.munitionData.payload = null;
                }
                this.munitionData.payloadCount = this.clampPayloadCount(this.munitionData.payloadCount);
                this.refreshSelectors();
                this.refreshStats();
            });
        }

        const guidanceSelect = root.querySelector(`#${this.id}-guidance`);
        if (guidanceSelect) {
            guidanceSelect.addEventListener('change', (e) => {
                this.munitionData.guidance = e.target.value || null;
                this.refreshAccuracyUI();
                this.refreshStats();
            });
        }

        const payloadSelect = root.querySelector(`#${this.id}-payload`);
        if (payloadSelect) {
            payloadSelect.addEventListener('change', (e) => {
                this.munitionData.payload = e.target.value || null;
                this.munitionData.payloadCount = this.clampPayloadCount(this.munitionData.payloadCount);
                this.syncFormFromData();
                this.refreshStats();
            });
        }

        const countInput = root.querySelector(`#${this.id}-payload-count`);
        if (countInput) {
            countInput.addEventListener('change', (e) => {
                this.munitionData.payloadCount = this.clampPayloadCount(Number(e.target.value));
                this.syncFormFromData();
                this.refreshStats();
            });
        }

        const costInput = root.querySelector(`#${this.id}-cost`);
        if (costInput) {
            costInput.addEventListener('change', (e) => {
                this.munitionData.cost = Math.max(0, Number(e.target.value) || 0);
                this.syncFormFromData();
                this.refreshStats();
            });
        }

        this.setupFlagListeners(() => {
            this.refresh();
        });

        for (const [index, band] of MunitionsWidget.ACCURACY_BANDS.entries()) {
            const slider = root.querySelector(`#${this.id}-accuracy-${band}`);
            if (!slider) continue;
            slider.addEventListener('input', (e) => {
                const value = Math.max(MunitionsWidget.BAND_MIN,
                    Math.min(MunitionsWidget.BAND_MAX, Number(e.target.value) || 0));
                this.munitionData.accuracy[band] = value;
                this.refreshAccuracyUI();
                this.refreshStats();
            });
        }
    }

    clampPayloadCount(count) {
        const max = this.getMaxPayloadCount();
        const value = Math.max(1, Math.floor(Number(count) || 1));
        return max > 0 ? Math.min(value, max) : value;
    }

    buildOptions(select, items, selectedId, placeholder, { showCost = true, preserveUnavailable = true } = {}) {
        if (!select) return;
        const options = [`<option value="">${this.escape(placeholder)}</option>`];
        for (const item of items) {
            const selected = item.id === selectedId ? ' selected' : '';
            const label = showCost ? this.formatOptionLabel(item) : item.name;
            options.push(`<option value="${this.escape(item.id)}"${selected}>${this.escape(label)}</option>`);
        }
        // Preserve saved selections that are no longer tech-eligible so loads don't silently lose data.
        if (preserveUnavailable && selectedId && !items.some(item => item.id === selectedId)) {
            options.push(`<option value="${this.escape(selectedId)}" selected>${this.escape(selectedId)} (unavailable)</option>`);
        }
        select.innerHTML = options.join('');
    }

    refreshSelectors() {
        if (!this.element) return;
        this.buildOptions(this.element.querySelector(`#${this.id}-profile`), this.getProfileOptions(), this.munitionData.profile, 'Select profile');
        this.buildOptions(this.element.querySelector(`#${this.id}-guidance`), this.getGuidanceOptions(), this.munitionData.guidance, 'Select guidance');
        const payloads = this.getPayloadOptions();
        if (this.munitionsDataLoaded && this.munitionData.payload &&
            !payloads.some(item => item.id === this.munitionData.payload)) {
            this.munitionData.payload = null;
            this.munitionData.payloadCount = 1;
        }
        this.buildOptions(this.element.querySelector(`#${this.id}-payload`), payloads, this.munitionData.payload, 'Select payload', {
            showCost: false,
            preserveUnavailable: false
        });
        this.syncFormFromData();
        this.renderProfileStats();
        this.refreshAccuracyUI();
    }

    renderProfileStats() {
        const container = this.element?.querySelector(`#${this.id}-profile-stats`);
        if (!container) return;
        const profile = this.findProfile();
        if (!profile) {
            container.innerHTML = '';
            return;
        }
        const capacity = Object.entries(profile.payloadCapacity || {})
            .map(([size, count]) => `${count}× ${size}`)
            .join(', ');
        const rows = [
            ['Tags', this.formatTags(profile.tags) || '—'],
            ['Damage', profile.damage ?? '—'],
            ['Cells', profile.cells ?? '—'],
            ['Payloads', capacity || '—']
        ];
        container.innerHTML = `<div class="design-chips">${this.renderChips(rows)}</div>` +
            (profile.description ? `<p>${this.escape(profile.description)}</p>` : '');
    }

    syncFormFromData() {
        if (!this.element) return;
        const operationalInput = this.element.querySelector(`#${this.id}-operational`);
        if (operationalInput) operationalInput.checked = this.munitionData.operational;
        const ignoreTechInput = this.element.querySelector(`#${this.id}-ignore-required-tech`);
        if (ignoreTechInput) ignoreTechInput.checked = this.munitionData.ignoreRequiredTech;
        const countInput = this.element.querySelector(`#${this.id}-payload-count`);
        if (countInput) {
            const max = this.getMaxPayloadCount();
            countInput.value = this.munitionData.payloadCount;
            if (max > 0) countInput.max = String(max);
            else countInput.removeAttribute('max');
            countInput.disabled = !this.munitionData.payload;
        }
        const costInput = this.element.querySelector(`#${this.id}-cost`);
        if (costInput) costInput.value = this.munitionData.cost;
    }

    refreshAccuracyUI() {
        if (!this.element) return;
        const pool = this.getAccuracyPool();
        const used = this.getAccuracyUsed();

        const counter = this.element.querySelector(`#${this.id}-accuracy-counter`);
        if (counter) {
            const usedElement = counter.querySelector('.outfit-resource-used');
            const capacityElement = counter.querySelector('.outfit-resource-capacity');
            usedElement.textContent = String(used);
            capacityElement.textContent = String(pool);
            usedElement.classList.toggle('is-over-capacity', used > pool);
            capacityElement.classList.toggle('has-unused-capacity', used < pool);
        }

        for (const [index, band] of MunitionsWidget.ACCURACY_BANDS.entries()) {
            const value = this.munitionData.accuracy[band];
            const slider = this.element.querySelector(`#${this.id}-accuracy-${band}`);
            const valueElement = this.element.querySelector(`#${this.id}-accuracy-${band}-value`);
            const valid = this.isBandValid(index);
            if (slider) {
                if (Number(slider.value) !== value) slider.value = String(value);
                slider.classList.toggle('is-invalid', !valid);
                slider.setAttribute('aria-invalid', String(!valid));
            }
            if (valueElement) {
                valueElement.textContent = String(value);
                valueElement.classList.toggle('is-invalid', !valid);
            }
            // The next band's valid zone is derived from this band's value.
            const nextBand = MunitionsWidget.ACCURACY_BANDS[index + 1];
            if (nextBand) {
                const nextSlider = this.element.querySelector(`#${this.id}-accuracy-${nextBand}`);
                if (nextSlider) {
                    const range = MunitionsWidget.BAND_MAX - MunitionsWidget.BAND_MIN;
                    const pct = (this.getBandValidMax(index + 1) - MunitionsWidget.BAND_MIN) / range * 100;
                    nextSlider.style.setProperty('--accuracy-valid', `${pct}%`);
                }
            }
        }
        const firstSlider = this.element.querySelector(`#${this.id}-accuracy-${MunitionsWidget.ACCURACY_BANDS[0]}`);
        if (firstSlider) firstSlider.style.setProperty('--accuracy-valid', '100%');
    }

    refreshStats() {
        this.munitionData.requiredTech = this.getSelectedRequiredTech();
        this.refreshDevelopmentMetric();
        const totalCost = this.munitionData.cost;
        this.setHeaderMetric('cost', '', this.formatTotalCost(totalCost) || '0 CV');

        const statsContainer = this.element?.querySelector(`#${this.id}-stats`);
        if (statsContainer) {
            const payload = this.findPayload();
            const rows = [
                ['Cost', this.formatTotalCost(totalCost) || `${Math.ceil(totalCost)} CV`],
                ['Magazine Cells', this.getMagazineCells()],
                ['Profile', this.findProfile()?.name || '—'],
                ['Guidance', this.findGuidance()?.name || '—'],
                ['Payload', payload ? `${this.munitionData.payloadCount}× ${payload.name}` : '—'],
                ['Damage', this.findProfile()?.damage ?? '—'],
                ['Accuracy', `${this.getAccuracyUsed()} / ${this.getAccuracyPool()}`]
            ];
            statsContainer.innerHTML = rows.map(([label, value]) => `
                <div class="stat-row">
                    <span class="stat-label">${this.escape(label)}</span>
                    <span class="stat-value">${this.escape(value)}</span>
                </div>
            `).join('');
        }
        this.refreshAccuracyUI();
        this.refreshSummary();
    }

    refresh() {
        if (!this.element) return;
        this.refreshSelectors();
        this.refreshStats();
    }

    updateTitle(text = this.munitionData.name) {
        if (typeof text === 'string') this.title = text || 'New Munition';
        const titleElement = this.element?.querySelector('.widget-title');
        if (titleElement) titleElement.textContent = this.title;
    }

    // Munitions are standalone designs with no input or output nodes.
    createNodes() {
        this.clearNodes();
        this.reflowNodes();
    }

    getSerializedData() {
        this.munitionData.requiredTech = this.getSelectedRequiredTech();
        return this.munitionData;
    }

    loadSerializedData(data) {
        data = data && typeof data === 'object' ? data : {};
        const accuracy = { short: -10, medium: -10, long: -10, distant: -10, extreme: -10 };
        for (const band of MunitionsWidget.ACCURACY_BANDS) {
            const value = Number(data.accuracy?.[band]);
            if (Number.isFinite(value)) {
                accuracy[band] = Math.max(MunitionsWidget.BAND_MIN,
                    Math.min(MunitionsWidget.BAND_MAX, value));
            }
        }
        this.munitionData = {
            name: typeof data.name === 'string' && data.name.trim() ? data.name : this.defaultTitle,
            role: typeof data.role === 'string' ? data.role : '',
            notes: typeof data.notes === 'string' ? data.notes : '',
            operational: Boolean(data.operational),
            ignoreRequiredTech: Boolean(data.ignoreRequiredTech),
            profile: data.profile ?? null,
            guidance: data.guidance ?? null,
            payload: data.payload ?? null,
            payloadCount: Math.max(1, Math.floor(Number(data.payloadCount) || 1)),
            accuracy,
            cost: Math.max(0, Number(data.cost) || 0),
            requiredTech: Array.isArray(data.requiredTech) ? [...data.requiredTech] : []
        };
        this.updateTitle(this.munitionData.name);
        this.refreshSelectors();
        this.syncFormFromData();
        this.refreshStats();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.munitionData.name || 'New Munition';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';

        if (this.munitionData.operational) {
            badgesDiv.appendChild(this.createBadge('Operational', 'success'));
        }

        if (this.munitionData.ignoreRequiredTech) {
            badgesDiv.appendChild(this.createBadge('Required Tech Ignored', 'warning'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        const payload = this.findPayload();
        this.addSummaryField(gridDiv, 'Profile', this.findProfile()?.name || this.munitionData.profile || '—');
        this.addSummaryField(gridDiv, 'Guidance', this.findGuidance()?.name || this.munitionData.guidance || '—');
        this.addSummaryField(gridDiv, 'Payload', payload
            ? `${this.munitionData.payloadCount}× ${payload.name}`
            : this.munitionData.payload || '—');
        this.addSummaryField(gridDiv, 'Cells', this.getMagazineCells());

        container.appendChild(gridDiv);
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

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) {
            this.refreshSummary();
        }
    }

    onEconomyModeChanged() {
        this.refreshSelectors();
        this.refreshStats();
    }

    onTechTreeUpdated() {
        this.refresh();
    }

    addSummaryField(container, label, value) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'summary-label';
        labelDiv.textContent = label;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'summary-value';
        valueDiv.textContent = value;

        container.appendChild(labelDiv);
        container.appendChild(valueDiv);
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}
