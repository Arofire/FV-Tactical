class FactoriesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('factories', 'New Factory', x, y, null);
        this.factoryData = {
            name: 'New Factory',
            productionLines: [],
            efficiency: 100
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Factory Configuration');
        this.setSectionContent(configSection, `
            <div class="input-group">
                <label>Factory Name</label>
                <input type="text" id="${this.id}-name" value="${this.factoryData.name}">
            </div>
            <div class="input-group">
                <label>Production Efficiency</label>
                <input type="range" id="${this.id}-efficiency" min="50" max="150" value="${this.factoryData.efficiency}">
                <span>${this.factoryData.efficiency}%</span>
            </div>
        `);
        sectionsContainer.appendChild(configSection.section);

        const productionSection = this.createSection('production', 'Production Lines');
        this.setSectionContent(productionSection, `
            <div class="component-list" id="${this.id}-production-list"></div>
        `);
        sectionsContainer.appendChild(productionSection.section);

        this.setupFactoryListeners();
    }

    setupFactoryListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.factoryData.name = e.target.value;
                this.updateTitle();
                this.refreshSummary();
            });
        }
        
        const efficiencyInput = document.getElementById(`${this.id}-efficiency`);
        if (efficiencyInput) {
            efficiencyInput.addEventListener('input', (e) => {
                this.factoryData.efficiency = parseInt(e.target.value) || 100;
                this.refreshSummary();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.factoryData.name || 'New Factory';
        }
    }

    createNodes() {
        this.addNode('input', 'component', 'Components', 0, 0.5, {
            sectionId: 'production'
        });
        this.addNode('output', 'component', 'Products', 1, 0.5, {
            sectionId: 'production'
        });
    }

    getSerializedData() {
        return this.factoryData;
    }

    loadSerializedData(data) {
        this.factoryData = data;
        this.updateTitle();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.factoryData.name || 'New Factory';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        if (this.factoryData.efficiency !== 100) {
            badgesDiv.appendChild(this.createBadge(`${this.factoryData.efficiency}% Efficiency`, 'info'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        this.addSummaryField(gridDiv, 'Efficiency', `${this.factoryData.efficiency}%`);
        this.addSummaryField(gridDiv, 'Production Lines', this.factoryData.productionLines.length.toString());

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
