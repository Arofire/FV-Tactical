class ShipBerthWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipBerth', 'Ship Berth Plan', x, y, 300);
        this.berthData = {
            label: 'Berth Plan',
            notes: ''
        };
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', 'Berth Details');
        infoSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Plan Name</label>
                <input type="text" id="${this.id}-label" value="${this.berthData.label}">
            </div>
            <div class="input-group">
                <label>Notes</label>
                <textarea id="${this.id}-notes" placeholder="Berthing considerations...">${this.berthData.notes}</textarea>
            </div>
        `;
        sections.appendChild(infoSection.section);

        const labelInput = document.getElementById(`${this.id}-label`);
        if (labelInput) {
            labelInput.addEventListener('input', (e) => {
                this.berthData.label = e.target.value;
                this.title = this.berthData.label || 'Ship Berth Plan';
                this.updateWidgetTitle();
            });
        }

        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.addEventListener('input', (e) => {
                this.berthData.notes = e.target.value;
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

        this.addNode('input', 'berth', 'Outfit', 0, 0.2, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
        });

        this.createExpandableNodeGroup('troop-links', {
            baseLabel: 'Troop',
            labelFormatter: (index) => index === 1 ? 'Troop' : `Troop ${index}`,
            direction: 'input',
            nodeType: 'troop',
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            anchorOffset: 40,
            minSpacing: 28,
            relativeX: 0,
            relativeY: 0.45,
            maxFree: 2
        });

        this.addNode('output', 'staff', 'Staff', 1, 0.45, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
        });

        this.reflowNodes();
    }

    getSerializedData() {
        return { ...this.berthData };
    }

    loadSerializedData(data) {
        this.berthData = { ...this.berthData, ...data };
        this.title = this.berthData.label || 'Ship Berth Plan';
        this.updateWidgetTitle();
        const labelInput = document.getElementById(`${this.id}-label`);
        if (labelInput) {
            labelInput.value = this.berthData.label || '';
        }
        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.value = this.berthData.notes || '';
        }
    }
}
