class MissilesWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('missiles', 'New Missile', x, y, null);
        this.missileData = {
            name: 'New Missile',
            warhead: null,
            guidance: null,
            propulsion: null,
            ignoreTechRequirements: false
        };
        this.layoutMode = 'three-column';
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
                this.refreshSummary();
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

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.missileData.name || 'New Missile';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        if (this.missileData.warhead) {
            badgesDiv.appendChild(this.createBadge(this.missileData.warhead, 'info'));
        }
        
        if (this.missileData.ignoreTechRequirements) {
            badgesDiv.appendChild(this.createBadge('Tech Unlocked', 'warning'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        this.addSummaryField(gridDiv, 'Warhead', this.missileData.warhead || '—');
        this.addSummaryField(gridDiv, 'Guidance', this.missileData.guidance || '—');
        this.addSummaryField(gridDiv, 'Propulsion', this.missileData.propulsion || '—');

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
