class ShipyardsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipyards', 'New Shipyard', x, y, 280);
        this.shipyardData = {
            name: 'New Shipyard',
            capabilities: [],
            constructionQueue: []
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Shipyard Configuration');
        configSection.contentContainer.innerHTML = `
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
        `;
        sectionsContainer.appendChild(configSection.section);

        const productionSection = this.createSection('production', 'Construction');
        productionSection.contentContainer.innerHTML = `
            <div class="widget-stats" id="${this.id}-stats">
                <div class="stat-row">
                    <span class="stat-label">Queue:</span>
                    <span class="stat-value">${this.shipyardData.constructionQueue.length} ships</span>
                </div>
            </div>
        `;
        sectionsContainer.appendChild(productionSection.section);

        this.setupShipyardListeners();
    }

    setupShipyardListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.shipyardData.name = e.target.value;
                this.updateTitle();
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
}
