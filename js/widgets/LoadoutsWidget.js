class LoadoutsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('loadouts', 'New Loadout', x, y, null);
        this.loadoutData = {
            name: 'New Loadout',
            items: []
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Configuration');
        this.setSectionContent(configSection, `
            <div class="input-group">
                <label>Loadout Name</label>
                <input type="text" id="${this.id}-name" value="${this.loadoutData.name}">
            </div>
            <button class="add-component-btn" id="${this.id}-add-item">Add Item</button>
            <div class="component-list" id="${this.id}-items-list"></div>
        `);
        sectionsContainer.appendChild(configSection.section);

        this.setupLoadoutListeners();
    }

    setupLoadoutListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.loadoutData.name = e.target.value;
                this.updateTitle();
                this.refreshSummary();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.loadoutData.name || 'New Loadout';
        }
    }

    createNodes() {
        this.clearNodes();

        this.addNode('input', 'Class', 'Class', 0, 0.2, {
            sectionId: 'config',
            anchorId: `${this.id}-config`
        });

        this.addNode('input', 'Craft', 'Craft', 0, 0.45, {
            sectionId: 'config',
            anchorId: `${this.id}-config`,
            anchorOffset: 32
        });

        this.addNode('input', 'Weapon', 'Weapon', 0, 0.65, {
            sectionId: 'config',
            anchorId: `${this.id}-config`,
            anchorOffset: 64
        });

        this.addNode('output', 'Loadout', 'Loadout', 1, 0.45, {
            sectionId: 'config',
            anchorId: `${this.id}-config`
        });

        this.reflowNodes();
    }

    getSerializedData() {
        return this.loadoutData;
    }

    loadSerializedData(data) {
        this.loadoutData = data;
        this.updateTitle();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.loadoutData.name || 'New Loadout';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        this.addSummaryField(gridDiv, 'Items', this.loadoutData.items.length.toString());

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
