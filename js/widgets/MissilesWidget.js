class MissilesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('missiles', 'New Missile', x, y, 280);
        this.missileData = {
            name: 'New Missile',
            warhead: null,
            guidance: null,
            propulsion: null,
            ignoreTechRequirements: false
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const designSection = this.createSection('design', 'Missile Design');
        this.setSectionContent(designSection, `
            <div class="input-group">
                <label>Missile Name</label>
                <input type="text" id="${this.id}-name" value="${this.missileData.name}">
            </div>
            <div class="input-group">
                <label>Warhead Type</label>
                <select id="${this.id}-warhead">
                    <option value="kinetic">Kinetic</option>
                    <option value="explosive">High Explosive</option>
                    <option value="nuclear">Nuclear</option>
                </select>
            </div>
            <div class="input-group">
                <label>
                    <input type="checkbox" id="${this.id}-ignore-tech" ${this.missileData.ignoreTechRequirements ? 'checked' : ''}>
                    Ignore Tech Requirements
                </label>
            </div>
        `);
        sectionsContainer.appendChild(designSection.section);

        const statsSection = this.createSection('stats', 'Statistics');
        this.setSectionContent(statsSection, `
            <div class="widget-stats" id="${this.id}-stats"></div>
        `);
        sectionsContainer.appendChild(statsSection.section);

        this.setupMissileListeners();
    }

    setupMissileListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.missileData.name = e.target.value;
                this.updateTitle();
            });
        }
    }

    updateTitle() {
        const titleElement = this.element.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.missileData.name || 'New Missile';
        }
    }

    createNodes() {
        this.clearNodes();
        this.addNode('output', 'weapon', 'Weapon', 1, 0.4, {
            sectionId: 'design',
            anchorId: `${this.id}-design`
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return this.missileData;
    }

    loadSerializedData(data) {
        this.missileData = data;
        this.updateTitle();
    }
}
