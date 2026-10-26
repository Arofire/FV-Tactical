// Ship construction modal: build one ship or a batch from an operational
// class + outfit (with operational core), assign names/roles, and configure
// berth, magazine, hangar and hardpoint contents with a Materiel cost total.
class ShipBuilder {
    constructor(app) {
        this.app = app;
        this.pendingShips = [];
        this.capacities = { berths: 0, magazineCells: 0, hangarBays: 0, hardpoints: 0 };
        this.options = { troops: [], craft: [], munitions: [] };
        this.hardpointWeapons = [];
    }

    get empire() {
        return this.app.empire;
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    static emptyContents() {
        return { berths: [], magazine: [], hangar: [], hardpoints: [] };
    }

    static open(app) {
        new ShipBuilder(app).openBuildModal();
    }

    // --- Build mode ----------------------------------------------------------

    async openBuildModal() {
        const configurations = ShipCapacity.getBuildableConfigurations();
        if (configurations.length === 0) {
            this.app.showNotification(
                'No buildable ships: you need an operational class connected to an operational outfit with an operational core.',
                'warning'
            );
            return;
        }

        this.options = ShipCapacity.getContentOptions();
        this.hardpointWeapons = await ShipCapacity.getHardpointWeaponOptions();

        const { backdrop, dialog, close } = ShipBuilder.createModal('Build Ships');
        dialog.classList.add('ship-builder-dialog');

        const configSection = document.createElement('div');
        configSection.className = 'ship-builder-config';

        const classSelect = document.createElement('select');
        classSelect.setAttribute('aria-label', 'Ship class');
        const classIds = [...new Set(configurations.map(config => config.classWidget.id))];
        for (const classId of classIds) {
            const widget = window.widgetManager.getWidget(classId);
            const option = document.createElement('option');
            option.value = classId;
            option.textContent = widget?.shipData?.name || 'Unnamed Class';
            classSelect.appendChild(option);
        }

        const outfitSelect = document.createElement('select');
        outfitSelect.setAttribute('aria-label', 'Outfit');

        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.max = '100';
        quantityInput.step = '1';
        quantityInput.value = '1';
        quantityInput.setAttribute('aria-label', 'Number of ships');

        configSection.append(
            this.labeledControl('Class', classSelect),
            this.labeledControl('Outfit', outfitSelect),
            this.labeledControl('Quantity', quantityInput)
        );

        const capacitySummary = document.createElement('p');
        capacitySummary.className = 'ship-builder-capacities';

        const batchControls = document.createElement('div');
        batchControls.className = 'ship-builder-batch-controls';
        const configureSelected = document.createElement('button');
        configureSelected.type = 'button';
        configureSelected.textContent = 'Configure Selected';
        configureSelected.addEventListener('click', () => this.configureSelectedShips());
        batchControls.appendChild(configureSelected);

        const shipList = document.createElement('div');
        shipList.className = 'ship-builder-ship-list';

        const footer = document.createElement('div');
        footer.className = 'ship-builder-footer';
        const totals = document.createElement('span');
        totals.className = 'ship-builder-totals';
        const validation = document.createElement('span');
        validation.className = 'ship-builder-validation';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', close);
        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'ship-builder-confirm';
        confirmButton.textContent = 'Confirm Build';
        footer.append(totals, validation, cancelButton, confirmButton);

        dialog.append(configSection, capacitySummary, batchControls, shipList, footer);

        const selectedConfiguration = () => configurations.find(config =>
            config.classWidget.id === classSelect.value && config.outfitWidget.id === outfitSelect.value
        );

        const refreshOutfits = () => {
            outfitSelect.replaceChildren();
            for (const config of configurations.filter(entry => entry.classWidget.id === classSelect.value)) {
                const option = document.createElement('option');
                option.value = config.outfitWidget.id;
                option.textContent = config.outfitWidget.outfitData?.name || 'Unnamed Outfit';
                outfitSelect.appendChild(option);
            }
        };

        const refreshCapacities = () => {
            const config = selectedConfiguration();
            this.capacities = config
                ? ShipCapacity.getCapacities(config.classWidget, config.outfitWidget)
                : { berths: 0, magazineCells: 0, hangarBays: 0, hardpoints: 0 };
            capacitySummary.textContent =
                `Per ship — Berths: ${this.capacities.berths} · Magazine: ${this.capacities.magazineCells} cells · ` +
                `Hangar: ${this.capacities.hangarBays} bays · Hardpoints: ${this.capacities.hardpoints}`;
        };

        const resizeShips = () => {
            const quantity = Math.max(1, Math.min(100, Number(quantityInput.value) || 1));
            quantityInput.value = String(quantity);
            while (this.pendingShips.length < quantity) {
                this.pendingShips.push(this.createPendingShip(classSelect.value));
            }
            this.pendingShips.length = quantity;
            this.renderShipRows(shipList, configureSelected);
            this.refreshTotals(totals, validation, confirmButton);
        };

        classSelect.addEventListener('change', () => {
            refreshOutfits();
            refreshCapacities();
            this.pendingShips = [];
            resizeShips();
        });
        outfitSelect.addEventListener('change', () => {
            refreshCapacities();
            for (const ship of this.pendingShips) ship.contents = ShipBuilder.emptyContents();
            this.renderShipRows(shipList, configureSelected);
            this.refreshTotals(totals, validation, confirmButton);
        });
        quantityInput.addEventListener('change', resizeShips);

        confirmButton.addEventListener('click', () => {
            const config = selectedConfiguration();
            if (!config) return;
            if (!this.validateAll(validation)) return;
            for (const pending of this.pendingShips) {
                this.empire.addFleetShip({
                    classWidgetId: config.classWidget.id,
                    outfitWidgetId: config.outfitWidget.id,
                    name: pending.name,
                    role: pending.role,
                    contents: pending.contents,
                    stores: ShipCapacity.getStoresMaxima(config.classWidget)
                });
            }
            this.app.saveEmpire();
            this.app.updateFleetView();
            close();
            this.app.showNotification(
                `Built ${this.pendingShips.length} ship${this.pendingShips.length === 1 ? '' : 's'}.`,
                'success'
            );
        });

        this.renderShipRowsImpl = { shipList, configureSelected };
        refreshOutfits();
        refreshCapacities();
        resizeShips();
    }

    createPendingShip(classWidgetId) {
        const classWidget = window.widgetManager?.getWidget(classWidgetId);
        const baseName = classWidget?.shipData?.name || 'Ship';
        const existingNames = new Set([
            ...this.empire.fleetShips.map(ship => ship.name),
            ...this.pendingShips.map(ship => ship.name)
        ]);
        let index = this.empire.fleetShips.length + this.pendingShips.length + 1;
        let name = `${baseName} ${index}`;
        while (existingNames.has(name)) {
            index += 1;
            name = `${baseName} ${index}`;
        }
        return {
            selected: false,
            name,
            role: classWidget?.shipData?.role || '',
            contents: ShipBuilder.emptyContents()
        };
    }

    renderShipRows(shipList, configureSelected) {
        shipList.replaceChildren();
        this.pendingShips.forEach((pending, index) => {
            const row = document.createElement('div');
            row.className = 'ship-builder-ship-row';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = pending.selected;
            checkbox.setAttribute('aria-label', `Select ${pending.name}`);
            checkbox.addEventListener('change', () => {
                pending.selected = checkbox.checked;
                this.updateConfigureSelectedState(configureSelected);
            });

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = pending.name;
            nameInput.setAttribute('aria-label', 'Ship name');
            nameInput.addEventListener('input', () => { pending.name = nameInput.value; });

            const roleInput = document.createElement('input');
            roleInput.type = 'text';
            roleInput.value = pending.role;
            roleInput.setAttribute('aria-label', 'Ship role');
            roleInput.addEventListener('input', () => { pending.role = roleInput.value; });

            const summary = document.createElement('span');
            summary.className = 'ship-builder-contents-summary';
            summary.textContent = this.describeContents(pending.contents);

            const configureButton = document.createElement('button');
            configureButton.type = 'button';
            configureButton.textContent = 'Configure';
            configureButton.addEventListener('click', () => {
                this.openContentsEditorDialog({
                    title: `Contents — ${pending.name || `Ship ${index + 1}`}`,
                    contents: pending.contents,
                    onApply: contents => {
                        pending.contents = contents;
                        this.renderShipRows(shipList, configureSelected);
                    }
                });
            });

            row.append(checkbox, nameInput, roleInput, summary, configureButton);
            shipList.appendChild(row);
        });
        this.updateConfigureSelectedState(configureSelected);
    }

    updateConfigureSelectedState(button) {
        const count = this.pendingShips.filter(ship => ship.selected).length;
        button.disabled = count === 0;
        button.textContent = count > 0 ? `Configure Selected (${count})` : 'Configure Selected';
    }

    configureSelectedShips() {
        const selected = this.pendingShips.filter(ship => ship.selected);
        if (selected.length === 0) return;
        const template = selected[0];
        this.openContentsEditorDialog({
            title: `Contents — ${selected.length} selected ships`,
            contents: template.contents,
            onApply: contents => {
                for (const ship of selected) {
                    ship.contents = ShipBuilder.cloneContents(contents);
                }
                const { shipList, configureSelected } = this.renderShipRowsImpl;
                this.renderShipRows(shipList, configureSelected);
            }
        });
    }

    static cloneContents(contents) {
        return {
            berths: (contents.berths || []).map(entry => ({ ...entry })),
            magazine: (contents.magazine || []).map(entry => ({ ...entry })),
            hangar: (contents.hangar || []).map(entry => ({ ...entry })),
            hardpoints: (contents.hardpoints || []).map(entry => ({ ...entry }))
        };
    }

    describeContents(contents) {
        const counts = [
            (contents.berths || []).length,
            (contents.magazine || []).length,
            (contents.hangar || []).length,
            (contents.hardpoints || []).length
        ];
        const total = counts.reduce((sum, value) => sum + value, 0);
        if (total === 0) return 'No contents configured';
        const parts = [];
        if (counts[0]) parts.push(`${counts[0]} troop`);
        if (counts[1]) parts.push(`${counts[1]} munition`);
        if (counts[2]) parts.push(`${counts[2]} craft`);
        if (counts[3]) parts.push(`${counts[3]} hardpoint`);
        return parts.join(' · ');
    }

    validateAll(validationElement) {
        for (const pending of this.pendingShips) {
            const { fits } = ShipCapacity.contentsFit(
                pending.contents, this.capacities, this.options, this.hardpointWeapons
            );
            if (!fits) {
                validationElement.textContent = `"${pending.name || 'Unnamed'}" exceeds its capacities.`;
                return false;
            }
        }
        validationElement.textContent = '';
        return true;
    }

    refreshTotals(totalsElement, validationElement, confirmButton) {
        let totalCost = 0;
        let totalMateriel = 0;
        let allFit = true;
        for (const pending of this.pendingShips) {
            const summary = ShipCapacity.summarizeContents(
                pending.contents, this.options, this.hardpointWeapons
            );
            totalCost += summary.cost;
            totalMateriel += ShipCapacity.getContentsMateriel(summary);
            const { fits } = ShipCapacity.contentsFit(
                pending.contents, this.capacities, this.options, this.hardpointWeapons
            );
            if (!fits) allFit = false;
        }
        totalsElement.textContent =
            `Total: ${totalMateriel} Material (${totalCost} CV) · ${this.pendingShips.length} ship${this.pendingShips.length === 1 ? '' : 's'}`;
        if (!allFit) {
            validationElement.textContent = 'One or more ships exceed their capacities.';
        } else if (validationElement.textContent) {
            validationElement.textContent = '';
        }
        confirmButton.disabled = !allFit || this.pendingShips.length === 0;
    }

    // --- Edit mode (existing fleet ship) --------------------------------------

    static openContentsEditor(app, ship) {
        const classWidget = window.widgetManager?.getWidget(ship.classWidgetId);
        const outfitWidget = window.widgetManager?.getWidget(ship.outfitWidgetId);
        if (classWidget?.type !== 'ship' || outfitWidget?.type !== 'outfit') {
            app.showNotification('This ship\'s design no longer exists.', 'warning');
            return;
        }
        const builder = new ShipBuilder(app);
        builder.capacities = ShipCapacity.getCapacities(classWidget, outfitWidget);
        Promise.all([
            Promise.resolve(ShipCapacity.getContentOptions()),
            ShipCapacity.getHardpointWeaponOptions()
        ]).then(([options, hardpointWeapons]) => {
            builder.options = options;
            builder.hardpointWeapons = hardpointWeapons;
            builder.openContentsEditorDialog({
                title: `Contents — ${ship.name || 'Unnamed Ship'}`,
                contents: ship.contents,
                onApply: contents => {
                    const { fits } = ShipCapacity.contentsFit(
                        contents, builder.capacities, builder.options, builder.hardpointWeapons
                    );
                    if (!fits) {
                        app.showNotification('Contents exceed this ship\'s capacities.', 'error');
                        return;
                    }
                    ship.contents = contents;
                    app.saveEmpire();
                    app.updateFleetView();
                }
            });
        });
    }

    // --- Contents editor dialog ----------------------------------------------

    async openContentsEditorDialog({ title, contents, onApply }) {
        if (this.hardpointWeapons.length === 0) {
            this.hardpointWeapons = await ShipCapacity.getHardpointWeaponOptions();
        }
        const working = ShipBuilder.cloneContents(contents);
        const { backdrop, dialog, close } = ShipBuilder.createModal(title);
        dialog.classList.add('ship-builder-dialog', 'ship-contents-dialog');

        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'ship-contents-sections';

        const footer = document.createElement('div');
        footer.className = 'ship-builder-footer';
        const totals = document.createElement('span');
        totals.className = 'ship-builder-totals';
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'ship-builder-confirm';
        applyButton.textContent = 'Apply';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', close);
        footer.append(totals, cancelButton, applyButton);

        const refresh = () => {
            sectionsContainer.replaceChildren();
            const summary = ShipCapacity.summarizeContents(
                working, this.options, this.hardpointWeapons
            );
            sectionsContainer.append(
                this.createContentsSection(working, 'berths', 'Berths (troops)',
                    this.capacities.berths, summary.used.berths,
                    this.options.troops, option => `${option.name} (${option.berthsRequired} berths, ${option.cost} CV)`,
                    refresh),
                this.createContentsSection(working, 'magazine', 'Magazine (munitions)',
                    this.capacities.magazineCells, summary.used.magazineCells,
                    this.options.munitions, option => `${option.name} (${option.magazineCells} cells, ${option.cost} CV)`,
                    refresh),
                this.createContentsSection(working, 'hangar', 'Hangar (craft)',
                    this.capacities.hangarBays, summary.used.hangarBays,
                    this.options.craft, option => `${option.name} (${option.baysRequired} bays, ${option.cost} CV)`,
                    refresh),
                this.createHardpointSection(working, this.capacities.hardpoints, summary.used.hardpoints, refresh)
            );
            const materiel = ShipCapacity.getContentsMateriel(summary);
            totals.textContent = `Total: ${materiel} Material (${summary.cost} CV)`;
            const fits = summary.used.berths <= this.capacities.berths &&
                summary.used.magazineCells <= this.capacities.magazineCells &&
                summary.used.hangarBays <= this.capacities.hangarBays &&
                summary.used.hardpoints <= this.capacities.hardpoints;
            totals.classList.toggle('over-capacity', !fits);
        };

        applyButton.addEventListener('click', () => {
            onApply(ShipBuilder.cloneContents(working));
            const { shipList, configureSelected } = this.renderShipRowsImpl || {};
            if (shipList) {
                this.renderShipRows(shipList, configureSelected);
                const footerEl = shipList.closest('.ship-builder-dialog')?.querySelector('.ship-builder-footer');
                if (footerEl) {
                    this.refreshTotals(
                        footerEl.querySelector('.ship-builder-totals'),
                        footerEl.querySelector('.ship-builder-validation'),
                        footerEl.querySelector('.ship-builder-confirm')
                    );
                }
            }
            close();
        });

        dialog.append(sectionsContainer, footer);
        refresh();
    }

    createContentsSection(working, key, title, capacity, used, options, describe, refresh) {
        const section = document.createElement('section');
        section.className = 'ship-contents-section';

        const header = document.createElement('h3');
        header.textContent = `${title} — ${used} / ${capacity}`;
        if (used > capacity) header.classList.add('over-capacity');
        section.appendChild(header);

        const entries = working[key] || [];
        entries.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'ship-contents-row';

            const option = options.find(item => item.id === entry.id);
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            name.textContent = option ? describe(option) : (entry.id || 'Unknown');

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '0';
            countInput.step = '1';
            countInput.value = String(entry.count ?? 0);
            countInput.setAttribute('aria-label', 'Count');
            countInput.addEventListener('change', () => {
                entry.count = Math.max(0, Number(countInput.value) || 0);
                refresh();
            });

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'ship-contents-remove';
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => {
                entries.splice(index, 1);
                refresh();
            });

            row.append(name, countInput, removeButton);
            section.appendChild(row);
        });

        if (options.length > 0) {
            const addRow = document.createElement('div');
            addRow.className = 'ship-contents-add';
            const select = document.createElement('select');
            for (const option of options) {
                const element = document.createElement('option');
                element.value = option.id;
                element.textContent = describe(option);
                select.appendChild(element);
            }
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.textContent = 'Add';
            addButton.addEventListener('click', () => {
                const existing = entries.find(entry => entry.id === select.value);
                if (existing) existing.count += 1;
                else entries.push({ id: select.value, count: 1 });
                refresh();
            });
            addRow.append(select, addButton);
            section.appendChild(addRow);
        } else {
            const note = document.createElement('p');
            note.className = 'ship-contents-empty';
            note.textContent = 'No operational designs available.';
            section.appendChild(note);
        }
        return section;
    }

    createHardpointSection(working, capacity, used, refresh) {
        const section = document.createElement('section');
        section.className = 'ship-contents-section';

        const header = document.createElement('h3');
        header.textContent = `Hardpoints (weapons) — ${used} / ${capacity}`;
        if (used > capacity) header.classList.add('over-capacity');
        section.appendChild(header);

        const entries = working.hardpoints || [];
        entries.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'ship-contents-row';

            const weapon = this.hardpointWeapons.find(item => item.id === entry.weaponId);
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            name.textContent = weapon
                ? `${weapon.name} (${weapon.resourceCount ?? 1} hp, ${weapon.cost ?? 0} CV)`
                : (entry.weaponId || 'Unknown');

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '0';
            countInput.step = '1';
            countInput.value = String(entry.count ?? 0);
            countInput.setAttribute('aria-label', 'Count');
            countInput.addEventListener('change', () => {
                entry.count = Math.max(0, Number(countInput.value) || 0);
                refresh();
            });

            const arcSelect = document.createElement('select');
            arcSelect.setAttribute('aria-label', 'Arc');
            for (const [value, label] of [['F', 'Fore'], ['P', 'Port'], ['S', 'Starboard'], ['A', 'Aft']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                option.selected = (entry.arc || 'F') === value;
                arcSelect.appendChild(option);
            }
            arcSelect.addEventListener('change', () => { entry.arc = arcSelect.value; refresh(); });

            const turretLabel = document.createElement('label');
            turretLabel.className = 'ship-contents-turret';
            const turretCheckbox = document.createElement('input');
            turretCheckbox.type = 'checkbox';
            turretCheckbox.checked = !!entry.turreted;
            turretCheckbox.addEventListener('change', () => { entry.turreted = turretCheckbox.checked; refresh(); });
            turretLabel.append(turretCheckbox, ' Turreted');

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'ship-contents-remove';
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => {
                entries.splice(index, 1);
                refresh();
            });

            row.append(name, countInput, arcSelect, turretLabel, removeButton);
            section.appendChild(row);
        });

        if (this.hardpointWeapons.length > 0) {
            const addRow = document.createElement('div');
            addRow.className = 'ship-contents-add';
            const select = document.createElement('select');
            for (const weapon of this.hardpointWeapons) {
                const element = document.createElement('option');
                element.value = weapon.id;
                element.textContent = `${weapon.name} (${weapon.resourceCount ?? 1} hp, ${weapon.cost ?? 0} CV)`;
                select.appendChild(element);
            }
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.textContent = 'Add';
            addButton.addEventListener('click', () => {
                const existing = entries.find(entry => entry.weaponId === select.value && !entry.turreted);
                if (existing) existing.count += 1;
                else entries.push({ weaponId: select.value, count: 1, arc: 'F', turreted: false });
                refresh();
            });
            addRow.append(select, addButton);
            section.appendChild(addRow);
        } else {
            const note = document.createElement('p');
            note.className = 'ship-contents-empty';
            note.textContent = 'No hardpoint weapons available (research required technology).';
            section.appendChild(note);
        }
        return section;
    }

    labeledControl(labelText, control) {
        const label = document.createElement('label');
        label.className = 'ship-builder-field';
        const text = document.createElement('span');
        text.textContent = labelText;
        label.append(text, control);
        return label;
    }

    static createModal(title) {
        const backdrop = document.createElement('div');
        backdrop.className = 'technology-modal-backdrop';
        const dialog = document.createElement('section');
        dialog.className = 'technology-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        const heading = document.createElement('h2');
        heading.textContent = title;
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'technology-modal-close';
        closeButton.textContent = '×';
        const close = () => backdrop.remove();
        closeButton.addEventListener('click', close);
        dialog.append(heading, closeButton);
        backdrop.appendChild(dialog);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) close();
        });
        document.body.appendChild(backdrop);
        return { backdrop, dialog, close };
    }
}
