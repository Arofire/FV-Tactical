// Shared base for compact, catalogue-driven design widgets (Craft, Troops).
// Provides title renaming, the Operational / Ignore Required Tech flag row,
// section counters/subtotals, tech filtering and minimized summaries.
class DesignWidget extends Widget {
    constructor(type, title, x = 100, y = 100) {
        super(type, title, x, y, null);
        this.titleEditHandler = name => this.rename(name);
    }

    create() {
        super.create();
        this.element.classList.add('design-widget');
    }

    // Subclasses return their persisted data object (name, operational, ignoreRequiredTech, ...).
    get designData() {
        return {};
    }

    get defaultTitle() {
        return 'New Design';
    }

    rename(name) {
        this.designData.name = String(name ?? '').trim() || this.defaultTitle;
        this.updateTitle();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    updateTitle() {
        this.title = this.designData.name || this.defaultTitle;
        if (this.titleElement) this.titleElement.textContent = this.title;
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    async fetchJSON(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    reportCatalogueError(catalogue, error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load ${catalogue}:`, error);
        window.app?.showNotification(`${catalogue} failed to load: ${detail}`, 'error');
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

    // Catalogue entries use combatValue; weapons.json entries use cost.
    getItemCost(item) {
        const value = Number(item?.combatValue ?? item?.cost);
        return Number.isFinite(value) ? value : 0;
    }

    formatOptionLabel(item, category = 'general', multiplier = 1) {
        if (!item) return '';
        const hasCost = item.combatValue !== undefined || (item.cost !== undefined && item.cost !== null);
        const cost = hasCost ? this.formatOptionCost(this.getItemCost(item) * multiplier, category, item.id) : '';
        return cost ? `${item.name} (${cost})` : item.name;
    }

    isOptionAvailable(item) {
        if (!item) return false;
        if (this.designData.ignoreRequiredTech) return true;
        const requirements = Array.isArray(item.requiredTech) ? item.requiredTech : [];
        return requirements.every(tech => window.empire?.hasTech?.(tech) ?? false);
    }

    filterByRequiredTech(items = []) {
        return items.filter(item => this.isOptionAvailable(item));
    }

    collectRequiredTech(items) {
        return [...new Set(items.flatMap(item => {
            const requirements = item?.requiredTech;
            return (Array.isArray(requirements) ? requirements : [requirements])
                .filter(value => typeof value === 'string' && value.trim())
                .map(value => value.trim());
        }))];
    }

    // Builds <option>s from available items, keeping a saved but unavailable selection visible.
    buildOptions(items, selectedId, category = 'general', allItems = items) {
        const available = this.filterByRequiredTech(items);
        const options = available.map(item =>
            `<option value="${this.escape(item.id)}"${item.id === selectedId ? ' selected' : ''}>${this.escape(this.formatOptionLabel(item, category))}</option>`
        );
        if (selectedId && !available.some(item => item.id === selectedId)) {
            const saved = allItems.find(item => item.id === selectedId);
            options.push(`<option value="${this.escape(selectedId)}" selected>${this.escape(saved?.name || selectedId)} (unavailable)</option>`);
        }
        return options.join('');
    }

    renderFlags() {
        const data = this.designData;
        return `
            <div class="ship-information-header design-flags">
                <label class="ship-flag"><input type="checkbox" id="${this.id}-operational" ${data.operational ? 'checked' : ''}> Operational</label>
                <label class="ship-flag"><input type="checkbox" id="${this.id}-ignore-required-tech" ${data.ignoreRequiredTech ? 'checked' : ''}> Ignore Required Tech</label>
            </div>`;
    }

    getDesignValue(path) {
        return String(path).split('.').reduce((value, key) => {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor') return undefined;
            return value?.[key];
        }, this.designData);
    }

    setDesignValue(path, value) {
        const keys = String(path).split('.');
        if (keys.some(key => !key || key === '__proto__' || key === 'prototype' || key === 'constructor')) {
            throw new Error(`Invalid design data path: ${path}`);
        }
        const property = keys.pop();
        const target = keys.reduce((current, key) => current?.[key], this.designData);
        if (!target || typeof target !== 'object') {
            throw new Error(`Design data path does not exist: ${path}`);
        }
        target[property] = value;
    }

    // Declarative controls for common scalar fields; catalogue-driven controls can
    // use the same path with buildOptions() and setupDesignFieldListeners().
    renderDesignFields(fields) {
        return fields.map(field => {
            const id = `${this.id}-${field.key}`;
            const value = this.getDesignValue(field.path || field.key);
            const label = this.escape(field.label);
            const className = this.escape(field.className || '');
            const commonAttributes = `id="${this.escape(id)}" data-design-field="${this.escape(field.key)}"`;

            if (field.type === 'textarea') {
                return `<div class="input-group ${className}">
                    <label for="${this.escape(id)}">${label}</label>
                    <textarea ${commonAttributes} rows="${Math.max(1, Number(field.rows) || 2)}" placeholder="${this.escape(field.placeholder || '')}">${this.escape(value ?? '')}</textarea>
                </div>`;
            }
            if (field.type === 'select') {
                const selected = String(value ?? '');
                const options = (field.options || []).map(option => {
                    const optionValue = String(option.value);
                    return `<option value="${this.escape(optionValue)}"${optionValue === selected ? ' selected' : ''}>${this.escape(option.label)}</option>`;
                }).join('');
                return `<div class="input-group ${className}">
                    <label for="${this.escape(id)}">${label}</label>
                    <select ${commonAttributes}>${options}</select>
                </div>`;
            }
            if (field.type === 'checkbox') {
                return `<label class="ship-flag ${className}">
                    <input type="checkbox" ${commonAttributes}${value ? ' checked' : ''}> ${label}
                </label>`;
            }
            if (field.type !== 'text' && field.type !== 'number') {
                throw new Error(`Unsupported design field type: ${field.type}`);
            }
            return `<div class="input-group ${className}">
                <label for="${this.escape(id)}">${label}</label>
                <input type="${field.type}" ${commonAttributes} value="${this.escape(value ?? '')}" placeholder="${this.escape(field.placeholder || '')}">
            </div>`;
        }).join('');
    }

    setupDesignFieldListeners(fields, { onChange } = {}) {
        fields.forEach(field => {
            const input = this.element?.querySelector(`#${this.id}-${field.key}`);
            if (!input) return;
            const eventName = field.type === 'text' || field.type === 'textarea' ? 'input' : 'change';
            input.addEventListener(eventName, event => {
                const value = field.type === 'checkbox'
                    ? event.target.checked
                    : field.type === 'number'
                        ? Number(event.target.value)
                        : event.target.value;
                this.setDesignValue(field.path || field.key, value);
                field.onChange?.(value, event);
                onChange?.(field.key, value, event);
            });
        });
    }

    renderIdentityFields({ rolePlaceholder = 'Optional role', notesPlaceholder = 'Notes' } = {}) {
        const fields = [
            { key: 'role', label: 'Role', type: 'text', placeholder: rolePlaceholder },
            { key: 'notes', label: 'Notes', type: 'textarea', placeholder: notesPlaceholder, rows: 2, className: 'design-notes' }
        ];
        return `${this.renderFlags()}${this.renderDesignFields(fields)}`;
    }

    setupIdentityFieldListeners() {
        const fields = [
            { key: 'role', type: 'text' },
            { key: 'notes', type: 'textarea' }
        ];
        this.setupDesignFieldListeners(fields, {
            onChange: key => {
                if (key === 'role') this.refreshSummary();
            }
        });
    }

    setupFlagListeners(onTechChange) {
        this.element.querySelector(`#${this.id}-operational`)?.addEventListener('change', event => {
            this.designData.operational = event.target.checked;
            this.refreshSummary();
            this.notifyChildrenOfChange();
            window.widgetManager?.notifyOperationalStatusChanged?.(this);
        });
        this.element.querySelector(`#${this.id}-ignore-required-tech`)?.addEventListener('change', event => {
            this.designData.ignoreRequiredTech = event.target.checked;
            onTechChange?.();
            this.refreshSummary();
        });
    }

    syncFlagInputs() {
        const operational = this.element?.querySelector(`#${this.id}-operational`);
        const ignore = this.element?.querySelector(`#${this.id}-ignore-required-tech`);
        if (operational) operational.checked = !!this.designData.operational;
        if (ignore) ignore.checked = !!this.designData.ignoreRequiredTech;
    }

    onOperationalStatusChanged(sourceWidget) {
        if (sourceWidget !== this) this.refresh();
    }

    // Section title: label on the left, optional subtotal and used/capacity counter on the right.
    createDesignSection(sectionId, label, { subtotal = false, counter = false } = {}) {
        const sectionRef = this.createSection(sectionId, label);
        sectionRef.section.classList.add('design-section');
        const title = sectionRef.titleElement;
        if (title) {
            title.classList.add('design-section-title');
            if (subtotal) this.appendSubtotal(title, `${sectionId}-subtotal`);
            if (counter) this.appendCounter(title, `${sectionId}-counter`, label);
        }
        return sectionRef;
    }

    appendSubtotal(container, key) {
        const subtotal = document.createElement('span');
        subtotal.className = 'outfit-section-subtotal outfit-section-subtotal-inline';
        subtotal.id = `${this.id}-${key}`;
        subtotal.setAttribute('aria-live', 'polite');
        container.appendChild(subtotal);
    }

    appendCounter(container, key, label) {
        const counter = document.createElement('span');
        counter.className = 'outfit-resource-counter';
        counter.id = `${this.id}-${key}`;
        counter.setAttribute('aria-label', `${label} used / available`);
        counter.innerHTML = '<span class="outfit-resource-used">0</span> / <span class="outfit-resource-capacity">0</span>';
        container.appendChild(counter);
    }

    setSubtotal(key, value, category = 'general') {
        const element = this.element?.querySelector(`#${this.id}-${key}`);
        if (element) element.textContent = value ? this.formatTotalCost(value, category) : '';
    }

    setCounter(key, used, capacity) {
        const counter = this.element?.querySelector(`#${this.id}-${key}`);
        if (!counter) return;
        const usedElement = counter.querySelector('.outfit-resource-used');
        const capacityElement = counter.querySelector('.outfit-resource-capacity');
        usedElement.textContent = String(used);
        capacityElement.textContent = String(capacity);
        usedElement.classList.toggle('is-over-capacity', used > capacity);
        capacityElement.classList.toggle('has-unused-capacity', used < capacity);
    }

    renderChips(entries) {
        return entries
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([label, value]) => `<span class="design-chip"><span class="design-chip-label">${this.escape(label)}</span> ${this.escape(value)}</span>`)
            .join('');
    }

    // Quantity rows: [{ key, name, quantity, cost, unavailable }]
    renderEntryRows(container, rows, dataAttribute) {
        if (!container) return;
        container.replaceChildren();
        container.hidden = rows.length === 0;
        rows.forEach(row => {
            const item = document.createElement('div');
            item.className = 'design-entry';
            if (row.unavailable) item.classList.add('is-unavailable');
            const name = document.createElement('span');
            name.className = 'design-entry-name';
            name.textContent = `${row.name}${row.unavailable ? ' (unavailable)' : ''}`;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${row.quantity}`;
            const cost = document.createElement('span');
            cost.className = 'design-entry-cost';
            cost.textContent = row.cost ? this.formatTotalCost(row.cost, row.category || 'equipment') : '';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'widget-remove-action';
            remove.dataset[dataAttribute] = row.key;
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${row.name}`);
            item.append(name, quantity, cost, remove);
            container.appendChild(item);
        });
    }

    normalizeQuantityEntries(entries) {
        if (!Array.isArray(entries)) {
            throw new Error('Quantity selections must be an array.');
        }
        const merged = new Map();
        entries.forEach(entry => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
                typeof entry.id !== 'string' || !entry.id) {
                throw new Error('Quantity selection must contain a non-empty item ID.');
            }
            const quantity = Number(entry.quantity);
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                throw new Error(`Quantity selection for "${entry.id}" must be a positive integer.`);
            }
            const source = typeof entry.source === 'string' ? entry.source : undefined;
            if (entry.source !== undefined && !source) {
                throw new Error(`Quantity selection for "${entry.id}" has an invalid source.`);
            }
            const key = `${source || ''}:${entry.id}`;
            const existing = merged.get(key);
            if (existing) {
                existing.quantity += quantity;
                return;
            }
            const normalized = { id: entry.id, quantity };
            if (source) normalized.source = source;
            merged.set(key, normalized);
        });
        return [...merged.values()];
    }

    refreshSummary() {
        const summary = this.element?.querySelector('.widget-summary');
        if (summary && this.element.classList.contains('minimized')) this.renderSummary(summary);
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) this.refreshSummary();
    }

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
