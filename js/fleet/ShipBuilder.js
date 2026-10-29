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
        return {
            berths: [],
            magazine: [],
            hangar: [],
            hardpoints: [],
            hardpointLoadout: { devices: [], weapons: [] }
        };
    }

    static open(app) {
        const builder = new ShipBuilder(app);
        builder.openBuildModal().catch(error => {
            console.error('Unable to open ship builder:', error);
            app.showNotification(`Unable to open ship builder: ${error.message}`, 'error');
        });
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
        await ShipLoadoutWidget.loadDeviceCatalogue();
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

        const loadoutSelect = document.createElement('select');
        loadoutSelect.setAttribute('aria-label', 'Default ship loadout');

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
            this.labeledControl('Loadout', loadoutSelect),
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
        const selectedLoadout = () => window.widgetManager?.getWidget(loadoutSelect.value) || null;

        const refreshOutfits = () => {
            outfitSelect.replaceChildren();
            for (const config of configurations.filter(entry => entry.classWidget.id === classSelect.value)) {
                const option = document.createElement('option');
                option.value = config.outfitWidget.id;
                option.textContent = config.outfitWidget.outfitData?.name || 'Unnamed Outfit';
                outfitSelect.appendChild(option);
            }
        };

        const refreshLoadouts = () => {
            const config = selectedConfiguration();
            loadoutSelect.replaceChildren();
            const none = document.createElement('option');
            none.value = '';
            none.textContent = 'None';
            loadoutSelect.appendChild(none);
            for (const loadout of ShipCapacity.getLoadoutsForOutfit(config?.outfitWidget)) {
                const option = document.createElement('option');
                option.value = loadout.id;
                option.textContent = loadout.loadoutData?.name || loadout.title || 'Ship Loadout';
                loadoutSelect.appendChild(option);
            }
            loadoutSelect.value = '';
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
                this.pendingShips.push(this.createPendingShip(classSelect.value, selectedLoadout()));
            }
            this.pendingShips.length = quantity;
            this.renderShipRows(shipList, configureSelected);
            this.refreshTotals(totals, validation, confirmButton);
        };

        classSelect.addEventListener('change', () => {
            refreshOutfits();
            refreshLoadouts();
            refreshCapacities();
            this.pendingShips = [];
            resizeShips();
        });
        outfitSelect.addEventListener('change', () => {
            refreshLoadouts();
            refreshCapacities();
            for (const ship of this.pendingShips) {
                ship.contents = ShipCapacity.createFleetContents(selectedLoadout());
                ship.loadoutWidgetId = selectedLoadout()?.id || '';
            }
            this.renderShipRows(shipList, configureSelected);
            this.refreshTotals(totals, validation, confirmButton);
        });
        loadoutSelect.addEventListener('change', () => {
            for (const ship of this.pendingShips) {
                ship.contents = ShipCapacity.createFleetContents(selectedLoadout());
                ship.loadoutWidgetId = selectedLoadout()?.id || '';
            }
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
                    loadoutWidgetId: pending.loadoutWidgetId || '',
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
        refreshLoadouts();
        refreshCapacities();
        resizeShips();
    }

    createPendingShip(classWidgetId, loadoutWidget = null) {
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
            loadoutWidgetId: loadoutWidget?.id || '',
            contents: ShipCapacity.createFleetContents(loadoutWidget)
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
            hardpoints: (contents.hardpoints || []).map(entry => ({ ...entry })),
            hardpointLoadout: {
                devices: (contents.hardpointLoadout?.devices || []).map(entry => ({
                    ...entry,
                    contents: (entry.contents || []).map(content => ({ ...content }))
                })),
                weapons: (contents.hardpointLoadout?.weapons || []).map(entry => ({ ...entry }))
            }
        };
    }

    describeContents(contents) {
        const counts = [
            (contents.berths || []).length,
            (contents.magazine || []).length,
            (contents.hangar || []).length,
            (contents.hardpoints || []).length,
            (contents.hardpointLoadout?.devices || []).length,
            (contents.hardpointLoadout?.weapons || []).reduce((sum, entry) =>
                sum + ShipCapacity.num(entry.count), 0)
        ];
        const total = counts.reduce((sum, value) => sum + value, 0);
        if (total === 0) return 'No contents configured';
        const parts = [];
        if (counts[0]) parts.push(`${counts[0]} troop`);
        if (counts[1]) parts.push(`${counts[1]} munition`);
        if (counts[2]) parts.push(`${counts[2]} craft`);
        if (counts[3]) parts.push(`${counts[3]} hardpoint`);
        if (counts[4]) parts.push(`${counts[4]} hardpoint device${counts[4] === 1 ? '' : 's'}`);
        if (counts[5]) parts.push(`${counts[5]} mounted weapon${counts[5] === 1 ? '' : 's'}`);
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
            ShipCapacity.getHardpointWeaponOptions(),
            ShipLoadoutWidget.loadDeviceCatalogue()
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
                        return false;
                    }
                    ship.contents = contents;
                    app.saveEmpire();
                    app.updateFleetView();
                    return true;
                }
            });
        }).catch(error => {
            console.error('Unable to load Fleet content options:', error);
            app.showNotification(`Unable to configure ship contents: ${error.message}`, 'error');
        });
    }

    // --- Contents editor dialog ----------------------------------------------

    async openContentsEditorDialog({ title, contents, onApply }) {
        await ShipLoadoutWidget.loadDeviceCatalogue();
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
            const legacyHardpointsUsed = (working.hardpoints || []).reduce((used, entry) => {
                const weapon = this.hardpointWeapons.find(item => item.id === entry.weaponId);
                if (!weapon) return used;
                const count = ShipCapacity.num(entry.count);
                const arcs = String(entry.arc || 'F').length;
                const surcharge = entry.turreted && arcs > 1 ? 1 : 0;
                return used + (ShipCapacity.num(WeaponCatalogue.getMount(weapon).resourceCount) + surcharge) * count;
            }, 0);
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
                this.createShipLoadoutSection(working, summary, refresh),
                this.createHardpointSection(
                    working, this.capacities.hardpoints, legacyHardpointsUsed, refresh
                )
            );
            const materiel = ShipCapacity.getContentsMateriel(summary);
            totals.textContent = `Total: ${materiel} Material (${summary.cost} CV)`;
            const { fits } = ShipCapacity.contentsFit(
                working, this.capacities, this.options, this.hardpointWeapons
            );
            totals.classList.toggle('over-capacity', !fits);
        };

        applyButton.addEventListener('click', () => {
            if (onApply(ShipBuilder.cloneContents(working)) === false) return;
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
        header.textContent = `Legacy direct hardpoint weapons — ${used} / ${capacity}`;
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
                ? `${weapon.name} (${WeaponCatalogue.getMount(weapon).resourceCount ?? 1} hp, ${weapon.cost ?? 0} CV)`
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

        const note = document.createElement('p');
        note.className = 'ship-contents-empty';
        note.textContent = entries.length
            ? 'Install new weapons through a Fixture; this section is retained for existing direct installations.'
            : 'Install weapons through a Fixture in Hardpoint devices.';
        section.appendChild(note);
        return section;
    }

    createShipLoadoutSection(working, summary, refresh) {
        const section = document.createElement('section');
        section.className = 'ship-contents-section';

        const devices = working.hardpointLoadout.devices;
        const deviceDefinitions = ShipLoadoutWidget.getDeviceCatalogue();
        const deviceHeader = document.createElement('h3');
        deviceHeader.textContent =
            `Hardpoint devices — ${summary.used.hardpoints} / ${this.capacities.hardpoints}`;
        if (summary.used.hardpoints > this.capacities.hardpoints) {
            deviceHeader.classList.add('over-capacity');
        }
        section.appendChild(deviceHeader);

        const devicePicker = document.createElement('div');
        devicePicker.className = 'ship-contents-add';
        const deviceSelect = document.createElement('select');
        deviceSelect.setAttribute('aria-label', 'Hardpoint device');
        const deviceOptions = ShipCapacity.getHardpointDeviceOptions();
        for (const device of deviceOptions) {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = `${device.name} (${this.app.formatOptionCost?.(device.cost, 'weapons', device.id) || `${device.cost} CV`})`;
            deviceSelect.appendChild(option);
        }
        const addDevice = document.createElement('button');
        addDevice.type = 'button';
        addDevice.textContent = 'Add';
        addDevice.disabled = summary.used.hardpoints >= this.capacities.hardpoints ||
            deviceOptions.length === 0;
        addDevice.addEventListener('click', () => {
            const device = deviceOptions.find(item => item.id === deviceSelect.value);
            if (!device || summary.used.hardpoints >= this.capacities.hardpoints) return;
            let index = 1;
            const instanceIds = new Set(devices.map(entry => entry.instanceId));
            while (instanceIds.has(`device-${index}`)) index++;
            devices.push({ instanceId: `device-${index}`, deviceId: device.id, contents: [] });
            refresh();
        });
        devicePicker.append(deviceSelect, addDevice);
        section.appendChild(devicePicker);

        const groupedDevices = new Map();
        for (const entry of devices) {
            if (['adapter', 'clamp'].includes(entry.deviceId)) continue;
            const group = groupedDevices.get(entry.deviceId) || [];
            group.push(entry);
            groupedDevices.set(entry.deviceId, group);
        }
        for (const [deviceId, entries] of groupedDevices) {
            const device = deviceDefinitions.find(item => item.id === deviceId);
            const row = document.createElement('div');
            row.className = 'ship-contents-row';
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            const attribute = device?.jumpium ? `${device.jumpium} jumpium` :
                device?.mounts ? `${device.mounts} mount` :
                device?.grapple ? `${device.grapple} grapple` : '';
            name.textContent = `${device?.name || deviceId} ×${entries.length}${attribute ? ` — ${attribute}` : ''}`;
            const cost = document.createElement('span');
            cost.className = 'ship-contents-cost';
            cost.textContent = device
                ? (this.app.formatOptionCost?.(device.cost * entries.length, 'weapons', device.id) ||
                    `${device.cost * entries.length} CV`)
                : 'Unavailable';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ship-contents-remove';
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${device?.name || deviceId}`);
            remove.addEventListener('click', () => {
                const index = devices.findIndex(entry => entry.deviceId === deviceId);
                if (index >= 0) devices.splice(index, 1);
                refresh();
            });
            row.append(name, cost, remove);
            section.appendChild(row);
        }

        devices.forEach((entry, index) => {
            if (!['adapter', 'clamp'].includes(entry.deviceId)) return;
            const device = deviceDefinitions.find(item => item.id === entry.deviceId);
            const row = document.createElement('div');
            row.className = 'ship-contents-row';
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            const attributes = device?.cells ? `${device.cells} cells` :
                device?.bays ? `${device.bays} bays` :
                device?.jumpium ? `${device.jumpium} jumpium` :
                device?.mounts ? `${device.mounts} mount` :
                device?.grapple ? `${device.grapple} grapple` : '1 hardpoint';
            name.textContent = `${device?.name || entry.deviceId} — ${attributes}`;
            const cost = document.createElement('span');
            cost.className = 'ship-contents-cost';
            cost.textContent = device
                ? (this.app.formatOptionCost?.(device.cost, 'weapons', device.id) || `${device.cost} CV`)
                : 'Unavailable';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ship-contents-remove';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `Remove ${device?.name || entry.deviceId}`);
            remove.addEventListener('click', () => {
                devices.splice(index, 1);
                refresh();
            });
            row.append(name, cost, remove);
            section.appendChild(row);

            if (!device || !['adapter', 'clamp'].includes(device.id)) return;
            const isAdapter = device.id === 'adapter';
            const contentType = isAdapter ? 'munitions' : 'craft';
            const contents = entry.contents || (entry.contents = []);
            const contentSection = document.createElement('section');
            contentSection.className = 'ship-contents-section';
            const used = contents.reduce((total, content) => {
                const option = (isAdapter ? this.options.munitions : this.options.craft)
                    .find(item => item.id === content.id);
                return total + (isAdapter ? option?.magazineCells || 0 : option?.baysRequired || 0) *
                    ShipCapacity.num(content.count);
            }, 0);
            const limit = Number(isAdapter ? device.cells : device.bays) || 0;
            const heading = document.createElement('h4');
            heading.textContent = `${device.name} ${index + 1} contents — ${used} / ${limit} ${isAdapter ? 'cells' : 'bays'}`;
            if (used > limit) heading.classList.add('over-capacity');
            contentSection.appendChild(heading);

            const contentPicker = document.createElement('div');
            contentPicker.className = 'ship-contents-add';
            const contentSelect = document.createElement('select');
            contentSelect.setAttribute('aria-label', `${device.name} contents`);
            const candidates = (isAdapter ? this.options.munitions : this.options.craft)
                .filter(item => !isAdapter || !contents.length ||
                    item.profile === this.options.munitions.find(munition => munition.id === contents[0].id)?.profile);
            for (const item of candidates) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = isAdapter
                    ? `${item.name} (${item.magazineCells} cells, ${item.cost} CV)`
                    : `${item.name} (${item.baysRequired} bays, ${item.cost} CV)`;
                contentSelect.appendChild(option);
            }
            const addContent = document.createElement('button');
            addContent.type = 'button';
            addContent.textContent = 'Add';
            addContent.disabled = candidates.length === 0;
            addContent.addEventListener('click', () => {
                const item = candidates.find(candidate => candidate.id === contentSelect.value);
                if (!item) return;
                const current = contents.reduce((total, content) => {
                    const selected = candidates.find(candidate => candidate.id === content.id) ||
                        (isAdapter ? this.options.munitions : this.options.craft)
                            .find(candidate => candidate.id === content.id);
                    return total + (isAdapter ? selected?.magazineCells || 0 : selected?.baysRequired || 0) *
                        ShipCapacity.num(content.count);
                }, 0);
                const itemSize = isAdapter ? item.magazineCells : item.baysRequired;
                if (current + itemSize > limit) return;
                const existing = contents.find(content => content.id === item.id);
                if (existing) existing.count++;
                else contents.push({ id: item.id, count: 1 });
                refresh();
            });
            contentPicker.append(contentSelect, addContent);
            contentSection.appendChild(contentPicker);

            contents.forEach((content, contentIndex) => {
                const item = (isAdapter ? this.options.munitions : this.options.craft)
                    .find(candidate => candidate.id === content.id);
                const contentRow = document.createElement('div');
                contentRow.className = 'ship-contents-row';
                const contentName = document.createElement('span');
                contentName.className = 'ship-contents-name';
                contentName.textContent = `${item?.name || content.id} ×${content.count}`;
                const contentRemove = document.createElement('button');
                contentRemove.type = 'button';
                contentRemove.className = 'ship-contents-remove';
                contentRemove.textContent = '−';
                contentRemove.setAttribute('aria-label', `Remove one ${item?.name || content.id}`);
                contentRemove.addEventListener('click', () => {
                    if (content.count > 1) content.count--;
                    else contents.splice(contentIndex, 1);
                    refresh();
                });
                contentRow.append(contentName, contentRemove);
                contentSection.appendChild(contentRow);
            });
            section.appendChild(contentSection);
        });

        const fixtureCount = devices.reduce((total, entry) => {
            const device = deviceDefinitions.find(item => item.id === entry.deviceId);
            return total + (Number(device?.mounts) || 0);
        }, 0);
        const weaponsSection = document.createElement('section');
        weaponsSection.className = 'ship-contents-section';
        const weaponHeading = document.createElement('h4');
        const mounted = working.hardpointLoadout.weapons.reduce((sum, entry) =>
            sum + ShipCapacity.num(entry.count), 0);
        weaponHeading.textContent = `Fixture-mounted weapons — ${mounted} / ${fixtureCount} mounts`;
        if (mounted > fixtureCount) weaponHeading.classList.add('over-capacity');
        weaponsSection.appendChild(weaponHeading);

        const weaponOptions = this.hardpointWeapons.filter(weapon => !weapon.isMunition);
        const weaponPicker = document.createElement('div');
        weaponPicker.className = 'ship-contents-add';
        const weaponSelect = document.createElement('select');
        weaponSelect.setAttribute('aria-label', 'Hardpoint weapon to mount');
        weaponOptions.forEach(weapon => {
            const option = document.createElement('option');
            option.value = weapon.id;
            option.textContent = `${weapon.name} (${weapon.cost ?? 0} CV)`;
            weaponSelect.appendChild(option);
        });
        const addWeapon = document.createElement('button');
        addWeapon.type = 'button';
        addWeapon.textContent = 'Add';
        addWeapon.disabled = !weaponOptions.length || mounted >= fixtureCount;
        addWeapon.addEventListener('click', () => {
            const weapon = weaponOptions.find(item => item.id === weaponSelect.value);
            if (!weapon || mounted >= fixtureCount) return;
            working.hardpointLoadout.weapons.push({
                weaponId: weapon.id,
                count: 1,
                arc: 'F'
            });
            refresh();
        });
        weaponPicker.append(weaponSelect, addWeapon);
        weaponsSection.appendChild(weaponPicker);

        working.hardpointLoadout.weapons.forEach((entry, index) => {
            const weapon = weaponOptions.find(item => item.id === entry.weaponId);
            const row = document.createElement('div');
            row.className = 'ship-contents-row';
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            name.textContent = `${weapon?.name || entry.weaponId} (${weapon?.cost ?? 0} CV)`;
            const arc = document.createElement('select');
            arc.setAttribute('aria-label', 'Single weapon arc');
            for (const [value, label] of [['F', 'Fore'], ['P', 'Port'], ['S', 'Starboard'], ['A', 'Aft']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                option.selected = (entry.arc || 'F') === value;
                arc.appendChild(option);
            }
            arc.addEventListener('change', () => {
                entry.arc = arc.value;
                refresh();
            });
            const count = document.createElement('input');
            count.type = 'number';
            count.min = '1';
            count.step = '1';
            count.value = String(entry.count || 1);
            count.setAttribute('aria-label', 'Weapon count');
            count.addEventListener('change', () => {
                entry.count = Math.max(1, Math.floor(ShipCapacity.num(count.value)));
                refresh();
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ship-contents-remove';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `Remove ${weapon?.name || entry.weaponId}`);
            remove.addEventListener('click', () => {
                working.hardpointLoadout.weapons.splice(index, 1);
                refresh();
            });
            row.append(name, arc, count, remove);
            weaponsSection.appendChild(row);
        });
        section.appendChild(weaponsSection);
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
