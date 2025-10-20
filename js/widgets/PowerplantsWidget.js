class PowerplantsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('powerplants', 'New Powerplant', x, y, 280);
        this.powerplantData = {
            name: 'New Powerplant',
            reactorType: 'fusion',
            output: 1000,
            ignoreTechRequirements: false
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const designSection = this.createSection('design', 'Powerplant Design');
        designSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Powerplant Name</label>
                <input type="text" id="${this.id}-name" value="${this.powerplantData.name}">
            </div>
            <div class="input-group">
                <label>Reactor Type</label>
                <select id="${this.id}-reactor">
                    <option value="fusion">Fusion</option>
                    <option value="fission">Fission</option>
                    <option value="antimatter">Antimatter</option>
                </select>
            </div>
            <div class="input-group">
                <label>
                    <input type="checkbox" id="${this.id}-ignore-tech" ${this.powerplantData.ignoreTechRequirements ? 'checked' : ''}>
                    Ignore Tech Requirements
                </label>
            </div>
        `;
        sectionsContainer.appendChild(designSection.section);

        const statsSection = this.createSection('stats', 'Performance');
        statsSection.contentContainer.innerHTML = `
            <div class="widget-stats" id="${this.id}-stats">
                <div class="stat-row">
                    <span class="stat-label">Power Output:</span>
                    <span class="stat-value">${this.powerplantData.output} MW</span>
                </div>
            </div>
        `;
        sectionsContainer.appendChild(statsSection.section);

        this.setupPowerplantListeners();
    }

    setupPowerplantListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.powerplantData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.powerplantData.name || 'New Powerplant';
        }
    }

    createNodes() {
        this.addNode('output', 'power', 'Power Output', 1, 0.5, {
            sectionId: 'stats'
        });
    }

    getSerializedData() {
        return this.powerplantData;
    }

    loadSerializedData(data) {
        this.powerplantData = data;
        this.updateTitle();
    }
}
