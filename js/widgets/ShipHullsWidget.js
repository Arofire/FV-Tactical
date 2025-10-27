class ShipHullsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipHulls', 'Hull Plan', x, y, null);
        this.hullData = {
            label: 'Hull Plan',
            notes: ''
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', 'Hull Plan');
        this.setSectionContent(infoSection, `
            <div class="input-group">
                <label>Plan Name</label>
                <input type="text" id="${this.id}-label" value="${this.hullData.label}">
            </div>
            <div class="input-group">
                <label>Notes</label>
                <textarea id="${this.id}-notes" placeholder="Hull allocation notes...">${this.hullData.notes}</textarea>
            </div>
        `);
        sections.appendChild(infoSection.section);

        const labelInput = document.getElementById(`${this.id}-label`);
        if (labelInput) {
            labelInput.addEventListener('input', (e) => {
                this.hullData.label = e.target.value;
                this.title = this.hullData.label || 'Hull Plan';
                this.updateWidgetTitle();
                this.refreshSummary();
            });
        }

        const notesField = document.getElementById(`${this.id}-notes`);
        if (notesField) {
            notesField.addEventListener('input', (e) => {
                this.hullData.notes = e.target.value;
                this.refreshSummary();
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

        this.addNode('input', 'Outfit', 'Outfit', 0, 0.2, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
        });

        this.addNode('input', 'Berth', 'Berth', 0, 0.45, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            anchorOffset: 36,
            minSpacing: 28
        });

        this.addNode('input', 'Loadout', 'Loadout', 0, 0.7, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            anchorOffset: 70,
            minSpacing: 28
        });

        this.addNode('output', 'Statistics', 'Statistics', 1, 0.45, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
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

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.hullData.label || 'Hull Plan';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        const notesPreview = this.hullData.notes 
            ? (this.hullData.notes.substring(0, 50) + (this.hullData.notes.length > 50 ? '...' : ''))
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
