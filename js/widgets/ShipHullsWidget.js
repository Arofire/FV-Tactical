class ShipHullsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipHulls', 'Hull Plan', x, y, 320);
        this.hullData = {
            label: 'Hull Plan',
            notes: ''
        };
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', 'Hull Plan');
        infoSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Plan Name</label>
                <input type="text" id="${this.id}-label" value="${this.hullData.label}">
            </div>
            <div class="input-group">
                <label>Notes</label>
                <textarea id="${this.id}-notes" placeholder="Hull allocation notes...">${this.hullData.notes}</textarea>
            </div>
        `;
        sections.appendChild(infoSection.section);

        const labelInput = document.getElementById(`${this.id}-label`);
        if (labelInput) {
            labelInput.addEventListener('input', (e) => {
                this.hullData.label = e.target.value;
                this.title = this.hullData.label || 'Hull Plan';
                this.updateWidgetTitle();
            });
        }

        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.addEventListener('input', (e) => {
                this.hullData.notes = e.target.value;
            });
        }
    }

    updateWidgetTitle() {
        const titleElement = this.element?.querySelector('.widget-title');
        if (titleElement) {
            titleElement.textContent = this.title;
        }
    }

    createNodes() {
        this.clearNodes();

        this.addNode('input', 'outfit-hull', 'Outfit', 0, 0.2, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
        });

        this.createExpandableNodeGroup('loadout-links', {
            baseLabel: 'Loadout',
            labelFormatter: (index) => index === 1 ? 'Loadout' : `Loadout ${index}`,
            direction: 'input',
            nodeType: 'loadout-hull',
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            anchorOffset: 36,
            minSpacing: 28,
            relativeX: 0,
            relativeY: 0.45,
            maxFree: 2
        });

        this.createExpandableNodeGroup('staff-links', {
            baseLabel: 'Staff',
            labelFormatter: (index) => index === 1 ? 'Staff' : `Staff ${index}`,
            direction: 'input',
            nodeType: 'staff',
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            anchorOffset: 70,
            minSpacing: 28,
            relativeX: 0,
            relativeY: 0.7,
            maxFree: 2
        });

        this.reflowNodes();
    }

    getSerializedData() {
        return { ...this.hullData };
    }

    loadSerializedData(data) {
        this.hullData = { ...this.hullData, ...data };
        this.title = this.hullData.label || 'Hull Plan';
        this.updateWidgetTitle();
        const labelInput = document.getElementById(`${this.id}-label`);
        if (labelInput) {
            labelInput.value = this.hullData.label || '';
        }
        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.value = this.hullData.notes || '';
        }
    }
}
