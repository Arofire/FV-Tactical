class BasicInfoWidget extends Widget {
    constructor(shipWidget, x = 550, y = 100) {
        super('basic-info', 'Basic Info', x, y, 320, 420);
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
        this.init();
    }

    createContent(contentElement) {
        contentElement.innerHTML = `
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
        `;
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
        });
        if (roleSelect) roleSelect.addEventListener('change', e => {
            this.basicData.role = e.target.value;
            if (customRoleInput) customRoleInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
            this.syncToShip(true);
        });
        if (customRoleInput) customRoleInput.addEventListener('input', e => {
            this.basicData.customRole = e.target.value;
            this.syncToShip(true);
        });
        if (descriptionTextarea) descriptionTextarea.addEventListener('input', e => {
            this.basicData.description = e.target.value;
            this.syncToShip();
        });
        if (designNotesTextarea) designNotesTextarea.addEventListener('input', e => {
            this.basicData.designNotes = e.target.value;
            this.syncToShip();
        });
        if (appearanceTextarea) appearanceTextarea.addEventListener('input', e => {
            this.basicData.appearance = e.target.value;
            this.syncToShip(true);
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

    getSerializedData() {
        return { ...super.getSerializedData(), basicData: this.basicData };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.basicData) {
            this.basicData = { ...this.basicData, ...data.basicData };
        }
    }
}
