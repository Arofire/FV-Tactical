class BasicInfoWidget extends Widget {
    constructor(shipWidget, x = 550, y = 100) {
        super('basic-info', 'Basic Info', x, y, null);
        this.shipWidget = shipWidget; // reference for synchronization
        this.basicData = {
            name: shipWidget?.shipData?.name || 'New Ship Class',
            role: shipWidget?.shipData?.role || 'corvette',
            customRole: shipWidget?.shipData?.customRole || '',
            description: shipWidget?.shipData?.description || '',
            designNotes: shipWidget?.shipData?.designNotes || '',
            appearance: shipWidget?.shipData?.appearance || '',
            text2imgPrompt: shipWidget?.shipData?.text2imgPrompt || ''
        };
        this.defaultRoles = shipWidget?.defaultRoles || [
            'corvette','frigate','destroyer','cruiser','battleship','dreadnought','carrier','fighter','bomber','scout','transport','support','custom'
        ];
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');
        
        // Create Basic Info section
        const basicSection = this.createSection('basic', 'Basic Information');
        this.setSectionContent(basicSection, `
            <div class="input-group">
                <label>Ship Class Name</label>
                <input type="text" id="${this.id}-name" value="${this.basicData.name}" placeholder="Enter ship class name">
            </div>
            <div class="input-group">
                <label>Role</label>
                <select id="${this.id}-role">
                    ${this.defaultRoles.map(role => `<option value="${role}" ${this.basicData.role === role ? 'selected' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`).join('')}
                </select>
                <input type="text" id="${this.id}-custom-role" placeholder="Enter custom role" style="display: ${this.basicData.role === 'custom' ? 'block' : 'none'}; margin-top:4px;" value="${this.basicData.customRole}">
            </div>
        `);
        sectionsContainer.appendChild(basicSection.section);
        
        // Create Documentation section
        const documentationSection = this.createSection('documentation', 'Documentation');
        this.setSectionContent(documentationSection, `
            <div class="input-group">
                <label>Description</label>
                <textarea id="${this.id}-description" placeholder="Ship class description and purpose...">${this.basicData.description}</textarea>
            </div>
            <div class="input-group">
                <label>Design Notes</label>
                <textarea id="${this.id}-design-notes" placeholder="Internal design notes and requirements...">${this.basicData.designNotes}</textarea>
            </div>
            <div class="input-group">
                <label>Appearance</label>
                <textarea id="${this.id}-appearance" placeholder="Visual description for opponents...">${this.basicData.appearance}</textarea>
            </div>
            <div class="input-group">
                <label>Text2Img Prompt</label>
                <textarea id="${this.id}-text2img" placeholder="AI image generation prompt (auto-generated from design criteria)..." readonly>${this.basicData.text2imgPrompt}</textarea>
            </div>
        `);
        sectionsContainer.appendChild(documentationSection.section);
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        super.setupEventListeners();
        const nameInput = document.getElementById(`${this.id}-name`);
        const roleSelect = document.getElementById(`${this.id}-role`);
        const customRoleInput = document.getElementById(`${this.id}-custom-role`);
        const descriptionTextarea = document.getElementById(`${this.id}-description`);
        const designNotesTextarea = document.getElementById(`${this.id}-design-notes`);
        const appearanceTextarea = document.getElementById(`${this.id}-appearance`);

        if (nameInput) nameInput.addEventListener('input', e => {
            this.basicData.name = e.target.value;
            this.updateTitle(this.basicData.name);
            this.syncToShip();
            this.refreshSummary();
        });
        if (roleSelect) roleSelect.addEventListener('change', e => {
            this.basicData.role = e.target.value;
            if (customRoleInput) customRoleInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
            this.syncToShip(true);
            this.refreshSummary();
        });
        if (customRoleInput) customRoleInput.addEventListener('input', e => {
            this.basicData.customRole = e.target.value;
            this.syncToShip(true);
            this.refreshSummary();
        });
        if (descriptionTextarea) descriptionTextarea.addEventListener('input', e => {
            this.basicData.description = e.target.value;
            this.syncToShip();
            this.refreshSummary();
        });
        if (designNotesTextarea) designNotesTextarea.addEventListener('input', e => {
            this.basicData.designNotes = e.target.value;
            this.syncToShip();
            this.refreshSummary();
        });
        if (appearanceTextarea) appearanceTextarea.addEventListener('input', e => {
            this.basicData.appearance = e.target.value;
            this.syncToShip(true);
            this.refreshSummary();
        });
    }

    syncToShip(updatePrompt = false) {
        if (!this.shipWidget) return;
        Object.assign(this.shipWidget.shipData, {
            name: this.basicData.name,
            role: this.basicData.role,
            customRole: this.basicData.customRole,
            description: this.basicData.description,
            designNotes: this.basicData.designNotes,
            appearance: this.basicData.appearance
        });
        if (updatePrompt && this.shipWidget.updateText2ImgPrompt) {
            this.shipWidget.updateText2ImgPrompt();
            this.basicData.text2imgPrompt = this.shipWidget.shipData.text2imgPrompt;
            const promptElement = document.getElementById(`${this.id}-text2img`);
            if (promptElement) promptElement.value = this.basicData.text2imgPrompt;
        }
    }

    syncDataFromForm() {
        // Sync form values to basicData
        const fields = {
            'name': { id: 'name', type: 'text' },
            'role': { id: 'role', type: 'select' },
            'customRole': { id: 'custom-role', type: 'text' },
            'description': { id: 'description', type: 'text' },
            'designNotes': { id: 'design-notes', type: 'text' },
            'appearance': { id: 'appearance', type: 'text' },
            'text2imgPrompt': { id: 'text2img', type: 'text' }
        };
        this.syncFieldsToData(this.basicData, fields);
    }

    syncFormFromData() {
        // Sync basicData values to form
        const fields = {
            'name': { id: 'name', type: 'text' },
            'role': { id: 'role', type: 'select' },
            'customRole': { id: 'custom-role', type: 'text' },
            'description': { id: 'description', type: 'text' },
            'designNotes': { id: 'design-notes', type: 'text' },
            'appearance': { id: 'appearance', type: 'text' },
            'text2imgPrompt': { id: 'text2img', type: 'text' }
        };
        this.syncDataToFields(this.basicData, fields);
        
        // Handle custom role visibility
        const customRoleInput = document.getElementById(`${this.id}-custom-role`);
        if (customRoleInput) {
            customRoleInput.style.display = this.basicData.role === 'custom' ? 'block' : 'none';
        }
    }

    getSerializedData() {
        this.syncDataFromForm();
        return { ...super.getSerializedData(), basicData: this.basicData };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.basicData) {
            this.basicData = { ...this.basicData, ...data.basicData };
            this.syncFormFromData();
        }
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.basicData.name || 'New Ship Class';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        const displayRole = this.basicData.role === 'custom' 
            ? this.basicData.customRole 
            : this.basicData.role;
        if (displayRole) {
            badgesDiv.appendChild(this.createBadge(displayRole, 'role'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        this.addSummaryField(gridDiv, 'Name', this.basicData.name || '—');
        this.addSummaryField(gridDiv, 'Role', displayRole || '—');
        
        const descPreview = this.basicData.description 
            ? (this.basicData.description.substring(0, 50) + (this.basicData.description.length > 50 ? '...' : ''))
            : '—';
        this.addSummaryField(gridDiv, 'Description', descPreview);

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
