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
            'corvette', 'frigate', 'destroyer', 'cruiser', 'battleship',
            'dreadnought', 'carrier', 'fighter', 'bomber', 'scout',
            'transport', 'support'
        ];
        this.availableRoles = shipWidget?.availableRoles ||
            (typeof ShipWidget !== 'undefined' ? ShipWidget.loadStoredRoles(this.defaultRoles) : [...this.defaultRoles]);
        if (this.basicData.role === 'custom' && this.basicData.customRole) {
            this.basicData.role = this.basicData.customRole;
        }
        this.roleMode = this.basicData.customRole ? 'custom' : 'dropdown';
        this.ensureRoleAvailable(this.basicData.role);
        this.init();
    }

    static escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    ensureRoleAvailable(role) {
        const normalized = typeof role === 'string' ? role.trim() : '';
        if (!normalized) return;
        if (this.shipWidget?.ensureRoleAvailable) {
            this.shipWidget.ensureRoleAvailable(normalized);
            this.availableRoles = this.shipWidget.availableRoles;
        } else if (!this.availableRoles.includes(normalized)) {
            this.availableRoles.push(normalized);
            this.availableRoles.sort((a, b) => a.localeCompare(b));
            if (typeof ShipWidget !== 'undefined') {
                ShipWidget.saveStoredRoles(this.availableRoles);
            }
        }
    }

    getRoleInputValue() {
        return this.roleMode === 'custom'
            ? this.basicData.customRole || this.basicData.role || ''
            : this.basicData.role || '';
    }

    getRoleOptionsHTML(selectedRole = this.basicData.role) {
        return this.availableRoles
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map(role => {
                const safeRole = BasicInfoWidget.escapeHTML(role);
                const selected = role === selectedRole ? ' selected' : '';
                const label = role.charAt(0).toUpperCase() + role.slice(1);
                return `<option value="${safeRole}"${selected}>${BasicInfoWidget.escapeHTML(label)}</option>`;
            })
            .join('');
    }

    applyRoleMode(mode) {
        this.roleMode = mode;
        const roleSelect = this.element?.querySelector(`#${this.id}-role`);
        const customRoleInput = this.element?.querySelector(`#${this.id}-custom-role`);
        const roleToggleButton = this.element?.querySelector(`#${this.id}-role-toggle`);
        if (roleSelect) {
            roleSelect.style.display = mode === 'dropdown' ? '' : 'none';
            if (mode === 'dropdown') {
                roleSelect.innerHTML = this.getRoleOptionsHTML();
                roleSelect.value = this.basicData.role;
            }
        }
        if (customRoleInput) {
            customRoleInput.style.display = mode === 'custom' ? '' : 'none';
            if (mode === 'custom') {
                customRoleInput.value = this.getRoleInputValue();
                customRoleInput.focus();
            }
        }
        if (roleToggleButton) {
            roleToggleButton.textContent = mode === 'dropdown' ? '🖉' : '🌳';
            roleToggleButton.title = mode === 'dropdown' ? 'Use custom role' : 'Use role list';
        }
    }

    toggleRoleMode() {
        if (this.roleMode === 'dropdown') {
            this.applyRoleMode('custom');
            return;
        }

        const customValue = this.element?.querySelector(`#${this.id}-custom-role`)?.value.trim() || '';
        if (customValue) {
            this.ensureRoleAvailable(customValue);
            this.basicData.role = customValue;
        }
        this.basicData.customRole = '';
        this.applyRoleMode('dropdown');
    }

    removeRolePreset(role) {
        const removedRole = typeof role === 'string' ? role.trim() : '';
        if (!removedRole || !this.availableRoles.includes(removedRole)) return;
        if (this.shipWidget?.removeRolePreset) {
            this.shipWidget.removeRolePreset(removedRole);
            this.availableRoles = [...this.shipWidget.availableRoles];
        } else {
            this.availableRoles = this.availableRoles.filter(availableRole => availableRole !== removedRole);
            if (typeof ShipWidget !== 'undefined') {
                ShipWidget.saveStoredRoles(this.availableRoles);
            }
        }
        const activeRole = this.roleMode === 'custom'
            ? this.element?.querySelector(`#${this.id}-custom-role`)?.value.trim() ||
                this.basicData.customRole || this.basicData.role
            : this.basicData.role;
        if (activeRole === removedRole) {
            this.basicData.role = this.availableRoles[0] || '';
            this.basicData.customRole = '';
            this.roleMode = 'dropdown';
        }
        this.applyRoleMode(this.roleMode);
        this.syncToShip(true);
        this.refreshSummary();
    }

    syncShipRoleControls() {
        if (!this.shipWidget) return;
        this.shipWidget.roleMode = this.roleMode;
        const roleSelect = this.shipWidget.roleSelectElement ||
            this.shipWidget.element?.querySelector(`#${this.shipWidget.id}-role-select`);
        const customRoleInput = this.shipWidget.roleCustomInput ||
            this.shipWidget.element?.querySelector(`#${this.shipWidget.id}-role-custom`);
        const roleToggleButton = this.shipWidget.roleToggleButton ||
            this.shipWidget.element?.querySelector(`#${this.shipWidget.id}-role-toggle`);
        if (roleSelect) {
            roleSelect.style.display = this.roleMode === 'dropdown' ? '' : 'none';
            if (this.roleMode === 'dropdown') {
                this.shipWidget.populateRoleSelect?.(roleSelect, this.basicData.role);
                roleSelect.value = this.basicData.role;
            }
        }
        if (customRoleInput) {
            customRoleInput.style.display = this.roleMode === 'custom' ? '' : 'none';
            const value = this.basicData.customRole || this.basicData.role || '';
            if (customRoleInput.value !== value) customRoleInput.value = value;
        }
        if (roleToggleButton) {
            roleToggleButton.textContent = this.roleMode === 'dropdown' ? '🖉' : '🌳';
            roleToggleButton.title = this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list';
        }
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
            <div class="input-group role-group">
                <label>Role</label>
                <div class="role-controls">
                    <select id="${this.id}-role" class="role-select" ${this.roleMode === 'custom' ? 'style="display:none;"' : ''}>
                        ${this.getRoleOptionsHTML()}
                    </select>
                    <input type="text" id="${this.id}-custom-role" class="role-input" placeholder="Enter custom role" value="${BasicInfoWidget.escapeHTML(this.getRoleInputValue())}" ${this.roleMode === 'dropdown' ? 'style="display:none;"' : ''}>
                    <button type="button" class="role-toggle-btn" id="${this.id}-role-toggle" title="${this.roleMode === 'dropdown' ? 'Use custom role' : 'Use role list'}">${this.roleMode === 'dropdown' ? '🖉' : '🌳'}</button>
                    <button type="button" class="widget-remove-action" id="${this.id}-role-remove" title="Remove current role preset" aria-label="Remove current role preset">−</button>
                </div>
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
        const roleToggleButton = document.getElementById(`${this.id}-role-toggle`);
        const roleRemoveButton = document.getElementById(`${this.id}-role-remove`);

        if (nameInput) nameInput.addEventListener('input', e => {
            this.basicData.name = e.target.value;
            this.updateTitle(this.basicData.name);
            this.syncToShip();
            this.refreshSummary();
        });
        if (roleSelect) roleSelect.addEventListener('change', e => {
            this.basicData.role = e.target.value;
            this.basicData.customRole = '';
            this.applyRoleMode('dropdown');
            this.syncToShip(true);
            this.refreshSummary();
        });
        if (customRoleInput) customRoleInput.addEventListener('input', e => {
            this.basicData.customRole = e.target.value;
            this.basicData.role = e.target.value;
            this.syncToShip(true);
            this.refreshSummary();
        });
        if (customRoleInput) customRoleInput.addEventListener('change', e => {
            this.ensureRoleAvailable(e.target.value);
        });
        if (roleToggleButton) roleToggleButton.addEventListener('click', () => {
            this.toggleRoleMode();
            this.syncToShip(true);
            this.refreshSummary();
        });
        if (roleRemoveButton) roleRemoveButton.addEventListener('click', () => {
            const role = this.roleMode === 'custom'
                ? customRoleInput?.value.trim() || this.basicData.customRole || this.basicData.role
                : roleSelect?.value || this.basicData.role;
            this.removeRolePreset(role);
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
        this.syncShipRoleControls();
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
            'description': { id: 'description', type: 'text' },
            'designNotes': { id: 'design-notes', type: 'text' },
            'appearance': { id: 'appearance', type: 'text' },
            'text2imgPrompt': { id: 'text2img', type: 'text' }
        };
        this.syncFieldsToData(this.basicData, fields);
        if (this.roleMode === 'custom') {
            this.basicData.customRole = this.element?.querySelector(`#${this.id}-custom-role`)?.value || '';
            this.basicData.role = this.basicData.customRole;
        } else {
            this.basicData.role = this.element?.querySelector(`#${this.id}-role`)?.value || this.basicData.role;
            this.basicData.customRole = '';
        }
    }

    syncFormFromData() {
        // Sync basicData values to form
        const fields = {
            'name': { id: 'name', type: 'text' },
            'description': { id: 'description', type: 'text' },
            'designNotes': { id: 'design-notes', type: 'text' },
            'appearance': { id: 'appearance', type: 'text' },
            'text2imgPrompt': { id: 'text2img', type: 'text' }
        };
        this.syncDataToFields(this.basicData, fields);
        this.ensureRoleAvailable(this.basicData.role);
        this.applyRoleMode(this.basicData.customRole ? 'custom' : 'dropdown');
    }

    getSerializedData() {
        this.syncDataFromForm();
        return { ...super.getSerializedData(), basicData: this.basicData };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        const incoming = data.basicData;
        if (!incoming || typeof incoming !== 'object') return;

        this.basicData = {
            name: incoming.name ?? this.basicData.name,
            role: incoming.role ?? this.basicData.role,
            customRole: incoming.customRole ?? this.basicData.customRole,
            description: incoming.description ?? this.basicData.description,
            designNotes: incoming.designNotes ?? this.basicData.designNotes,
            appearance: incoming.appearance ?? this.basicData.appearance,
            text2imgPrompt: incoming.text2imgPrompt ?? this.basicData.text2imgPrompt
        };
        if (this.basicData.role === 'custom' && this.basicData.customRole) {
            this.basicData.role = this.basicData.customRole;
        }
        this.roleMode = this.basicData.customRole ? 'custom' : 'dropdown';
        this.syncFormFromData();
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
        
        const displayRole = this.basicData.customRole || this.basicData.role;
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
