class FactoriesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('factories', 'New Factory', x, y, 280);
        this.factoryData = {
            name: 'New Factory',
            productionLines: [],
            efficiency: 100
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Factory Configuration');
        configSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Factory Name</label>
                <input type="text" id="${this.id}-name" value="${this.factoryData.name}">
            </div>
            <div class="input-group">
                <label>Production Efficiency</label>
                <input type="range" id="${this.id}-efficiency" min="50" max="150" value="${this.factoryData.efficiency}">
                <span>${this.factoryData.efficiency}%</span>
            </div>
        `;
        sectionsContainer.appendChild(configSection.section);

        const productionSection = this.createSection('production', 'Production Lines');
        productionSection.contentContainer.innerHTML = `
            <div class="component-list" id="${this.id}-production-list"></div>
        `;
        sectionsContainer.appendChild(productionSection.section);

        this.setupFactoryListeners();
    }

    setupFactoryListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.factoryData.name = e.target.value;
                this.updateTitle();
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
}
