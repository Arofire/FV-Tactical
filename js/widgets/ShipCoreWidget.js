class ShipCoreWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipCore', 'Ship Core', x, y, 260);
        this.coreData = { notes: '' };
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', 'Core Notes');
        infoSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label>Notes</label>
                <textarea id="${this.id}-notes" placeholder="Describe core purpose...">${this.coreData.notes}</textarea>
            </div>
        `;
        sections.appendChild(infoSection.section);

        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.addEventListener('input', (e) => {
                this.coreData.notes = e.target.value;
            });
        }
    }

    createNodes() {
        this.clearNodes();
        this.addNode('output', 'core', 'Core', 1, 0.4, {
            sectionId: 'info',
            anchorId: `${this.id}-info`
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return { ...this.coreData };
    }

    loadSerializedData(data) {
        this.coreData = { ...this.coreData, ...data };
        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.value = this.coreData.notes || '';
        }
    }
}
