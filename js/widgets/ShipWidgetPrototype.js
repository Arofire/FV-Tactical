// Prototype ship design widget leveraging the three-column layout
class ShipWidgetPrototype extends ShipWidget {
    constructor(x = 140, y = 140) {
        super(x, y);
    }

    init() {
        this.type = 'shipPrototype';
        this.layoutMode = 'three-column';
        this.title = this.shipData?.name || 'New Ship Class';
        super.init();
        if (this.element) {
            this.element.classList.add('ship-widget-prototype');
        }
        if (this.minimized) {
            this.refreshSummary();
        }
    }

    setupEventListeners() {
        super.setupEventListeners();
        if (this._prototypeEventsBound) return;
        this._prototypeEventsBound = true;

        const handler = () => this.refreshSummary();
        const content = this.element?.querySelector('.widget-content');
        if (content) {
            content.addEventListener('input', handler);
            content.addEventListener('change', handler);
        }
    }

    isShipFamily(widget) {
        return widget && (widget.type === 'ship' || widget.type === 'shipPrototype');
    }

    getParentShipWidget() {
        if (!this.parents || this.parents.size === 0 || !window.widgetManager) return null;
        for (const parentId of this.parents) {
            const parentWidget = window.widgetManager.getWidget(parentId);
            if (this.isShipFamily(parentWidget)) {
                return parentWidget;
            }
        }
        return null;
    }

    notifyShipChildrenToRefresh() {
        if (!this.children || this.children.size === 0 || !window.widgetManager) return;
        this.children.forEach(childId => {
            const childWidget = window.widgetManager.getWidget(childId);
            if (this.isShipFamily(childWidget) && typeof childWidget.updateSubclassState === 'function') {
                childWidget.updateSubclassState();
            }
        });
    }

    onParentLinked(parentWidget) {
        if (this.isShipFamily(parentWidget)) {
            this.updateSubclassState();
        }
    }

    onParentUnlinked(parentWidget) {
        if (this.isShipFamily(parentWidget)) {
            this.updateSubclassState();
        }
    }

    updateStats() {
        super.updateStats();
        this.refreshSummary();
    }

    syncFormFromData() {
        super.syncFormFromData();
        this.refreshSummary();
    }

    updateSubclassState() {
        super.updateSubclassState();
        this.refreshSummary();
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) {
            this.refreshSummary();
        }
    }

    renderSummary(container) {
        if (!container) return;

    const data = this.shipData || {};
    const resources = data.resources || {};
    const hardpoints = data.hardpoints || {};
    const power = data.powerAndPropulsion || {};
    const heat = data.heatManagement || {};

        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = data.name || 'New Ship Class';

        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        if (data.operational) {
            badges.appendChild(this.createBadge('Operational', 'caution'));
        }
        if (data.ignoreTechRequirements) {
            badges.appendChild(this.createBadge('Ignores Tech', 'warning'));
        }

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'summary-grid';

        const roleLabel = this.formatRoleLabel(this.getRoleInputValue()) || '—';
        const hullSummary = this.formatHullSummary();
        const foundationSummary = this.formatFoundations();

        const fields = [
            { label: 'Role', value: roleLabel },
            { label: 'DvP Cost', value: this.formatOptionalNumber(data.developmentCost) },
            { label: 'Hull Sections', value: hullSummary },
            { label: 'Cargo', value: this.formatOptionalNumber(resources.cargo, ' t') },
            { label: 'Remass', value: this.formatOptionalNumber(resources.remass, ' t') },
            { label: 'Hardpoints', value: this.formatHardpoints(hardpoints) },
            { label: 'Propulsion', value: this.formatPropulsion(power) },
            { label: 'Heat', value: this.formatHeat(heat) }
        ];

        if (foundationSummary) {
            fields.push({ label: 'Foundations', value: foundationSummary });
        }

        fields
            .filter(field => field.value && field.value !== '')
            .forEach(field => {
                const wrapper = document.createElement('div');
                wrapper.className = 'summary-field';

                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = field.label;

                const value = document.createElement('span');
                value.className = 'value';
                value.textContent = field.value;

                wrapper.appendChild(label);
                wrapper.appendChild(value);
                summaryGrid.appendChild(wrapper);
            });

        container.innerHTML = '';
        container.appendChild(title);
        if (badges.childElementCount > 0) {
            container.appendChild(badges);
        }
        container.appendChild(summaryGrid);
    }

    refreshSummary() {
        if (!this.summaryElement || !this.minimized) return;
        this.summaryElement.innerHTML = '';
        this.renderSummary(this.summaryElement);
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = 'summary-badge';
        if (variant) {
            badge.classList.add(variant);
        }
        badge.textContent = text;
        return badge;
    }

    formatHullSummary() {
        const composition = this.shipData?.hullComposition || {};
        const total = this.getTotalHulls();
        if (!total) return 'None';

        const ordered = [
            ...this.militaryHullTypes,
            ...this.civilHullTypes
        ];

        const parts = ordered
            .map(({ key, label }) => ({ count: composition[key] || 0, label }))
            .filter(entry => entry.count > 0)
            .map(entry => `${entry.count} ${entry.label}`);

        if (!parts.length) return String(total);

        const truncated = parts.slice(0, 3).join(', ');
        const remainder = parts.length > 3 ? ` +${parts.length - 3} more` : '';
        return `${total} (${truncated}${remainder})`;
    }

    formatFoundations() {
        const foundations = this.shipData?.foundations || {};
        const active = this.foundationKeys
            .filter(key => foundations[key])
            .map(key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()));
        if (!active.length) return '';
        const truncated = active.slice(0, 4).join(', ');
        return active.length > 4 ? `${truncated} +${active.length - 4} more` : truncated;
    }

    formatHardpoints(hardpoints = {}) {
        const { utility, totalValue, SHP, PHP, MHP } = hardpoints;
        const parts = [];
        if (utility != null) parts.push(`U ${utility}`);
        if (totalValue != null) parts.push(`Total ${totalValue}`);
        const highValue = [
            ['SHP', SHP],
            ['PHP', PHP],
            ['MHP', MHP]
        ].filter(([, value]) => value != null && value !== 0);
        if (highValue.length) {
            parts.push(highValue.map(([label, value]) => `${label} ${value}`).join(' '));
        }
        return parts.length ? parts.join(' · ') : '—';
    }

    formatPropulsion(power = {}) {
        const { thrust, burnRating, heatEfficiency, supplyRating } = power;
        const parts = [];
        if (thrust != null) parts.push(`Thrust ${thrust}`);
        if (burnRating != null) parts.push(`Burn ${burnRating}`);
        if (heatEfficiency != null) parts.push(`HeatEff ${heatEfficiency}`);
        if (supplyRating != null) parts.push(`Supply ${supplyRating}`);
        return parts.length ? parts.join(' · ') : '—';
    }

    formatHeat(heat = {}) {
        const capacity = heat.capacity;
        const dissipation = heat.dissipation;
        const warning = heat.thresholds?.warning;
        const critical = heat.thresholds?.critical;
        const parts = [];
        if (capacity != null) parts.push(`Cap ${capacity}`);
        if (dissipation != null) parts.push(`Diss ${dissipation}`);
        const thresholds = [warning, critical].filter(value => value != null);
        if (thresholds.length) {
            parts.push(`Thresh ${thresholds.join('/')}`);
        }
        return parts.length ? parts.join(' · ') : '—';
    }

    formatOptionalNumber(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }
}
