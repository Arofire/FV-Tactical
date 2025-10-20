class LoadoutsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('loadouts', 'New Loadout', x, y, 280);
        this.loadoutData = {
            name: 'New Loadout',
            items: []
        };
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        const configSection = this.createSection('config', 'Configuration');
        configSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Loadout Name</label>
                <input type="text" id="${this.id}-name" value="${this.loadoutData.name}">
            </div>
            <button class="add-component-btn" id="${this.id}-add-item">Add Item</button>
            <div class="component-list" id="${this.id}-items-list"></div>
        `;
        sectionsContainer.appendChild(configSection.section);

        this.setupLoadoutListeners();
    }

    setupLoadoutListeners() {
        const nameInput = document.getElementById(`${this.id}-name`);
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.loadoutData.name = e.target.value;
                this.updateTitle();
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

        this.addNode('input', 'loadout', 'Class', 0, 0.2, {
            sectionId: 'config',
            anchorId: `${this.id}-config`
        });

        this.createExpandableNodeGroup('craft-slots', {
            baseLabel: 'Craft',
            labelFormatter: (index) => index === 1 ? 'Craft' : `Craft ${index}`,
            direction: 'input',
            nodeType: 'craft',
            sectionId: 'config',
            anchorId: `${this.id}-config`,
            anchorOffset: 32,
            minSpacing: 28,
            relativeX: 0,
            relativeY: 0.45,
            maxFree: 2
        });

        this.createExpandableNodeGroup('weapon-slots', {
            baseLabel: 'Weapon',
            labelFormatter: (index) => index === 1 ? 'Weapon' : `Weapon ${index}`,
            direction: 'input',
            nodeType: 'weapon',
            sectionId: 'config',
            anchorId: `${this.id}-config`,
            anchorOffset: 64,
            minSpacing: 28,
            relativeX: 0,
            relativeY: 0.65,
            maxFree: 2
        });

        this.addNode('output', 'loadout-hull', 'Hull', 1, 0.45, {
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
}
