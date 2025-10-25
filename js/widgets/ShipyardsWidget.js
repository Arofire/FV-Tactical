class ShipyardsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipyards', 'New Shipyard', x, y, null);
        this.shipyardData = {
            name: 'New Shipyard',
            capabilities: [],
            constructionQueue: []
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Shipyard Configuration');
        this.setSectionContent(configSection, `
            <div class="input-group">
                <label>Shipyard Name</label>
                <input type="text" id="${this.id}-name" value="${this.shipyardData.name}">
            </div>
            <div class="input-group">
                <label>Construction Capacity</label>
                <select id="${this.id}-capacity">
                    <option value="small">Small Craft</option>
                    <option value="medium">Medium Ships</option>
                    <option value="large">Large Ships</option>
                    <option value="capital">Capital Ships</option>
                </select>
            </div>
        `);
        sectionsContainer.appendChild(configSection.section);

        const productionSection = this.createSection('production', 'Construction');
        this.setSectionContent(productionSection, `
            <div class="widget-stats" id="${this.id}-stats">
                <div class="stat-row">
                    <span class="stat-label">Queue:</span>
                    <span class="stat-value">${this.shipyardData.constructionQueue.length} ships</span>
                </div>
            </div>
        `);
        sectionsContainer.appendChild(productionSection.section);

        this.setupShipyardListeners();
    }

    setupShipyardListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipyardData.name = e.target.value;
                this.updateTitle();
                this.refreshSummary();
            });
        }
        
        const capacitySelect = document.getElementById(`${this.id}-capacity`);
        if (capacitySelect) {
            capacitySelect.addEventListener('change', (e) => {
                this.shipyardData.capacity = e.target.value;
                this.refreshSummary();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.shipyardData.name || 'New Shipyard';
        }
    }

    createNodes() {
        this.addNode('input', 'component', 'Ship Designs', 0, 0.3, {
            sectionId: 'config'
        });
        this.addNode('input', 'component', 'Materials', 0, 0.7, {
            sectionId: 'production'
        });
        this.addNode('output', 'component', 'Completed Ships', 1, 0.5, {
            sectionId: 'production'
        });
    }

    getSerializedData() {
        return this.shipyardData;
    }

    loadSerializedData(data) {
        this.shipyardData = data;
        this.updateTitle();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.shipyardData.name || 'New Shipyard';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        if (this.shipyardData.capacity) {
            badgesDiv.appendChild(this.createBadge(this.shipyardData.capacity, 'info'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        this.addSummaryField(gridDiv, 'Capacity', this.shipyardData.capacity || '—');
        this.addSummaryField(gridDiv, 'Queue Length', this.shipyardData.constructionQueue.length.toString());

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
