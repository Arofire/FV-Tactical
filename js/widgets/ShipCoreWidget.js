class ShipCoreWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipCore', 'Ship Core', x, y, null);
        this.coreData = { notes: '' };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', 'Core Notes');
        this.setSectionContent(infoSection, `
            <div class="input-group">
                <label>Notes</label>
                <textarea id="${this.id}-notes" placeholder="Describe core purpose...">${this.coreData.notes}</textarea>
            </div>
        `);
        sections.appendChild(infoSection.section);

        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.addEventListener('input', (e) => {
                this.coreData.notes = e.target.value;
                this.refreshSummary();
            });
        }
    }

    createNodes() {
        this.clearNodes();
        this.addNode('output', 'Core', 'Core', 1, 0.4, {
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

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = 'Ship Core';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        const notesPreview = this.coreData.notes 
            ? (this.coreData.notes.substring(0, 50) + (this.coreData.notes.length > 50 ? '...' : ''))
            : '—';
        this.addSummaryField(gridDiv, 'Notes', notesPreview);

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
