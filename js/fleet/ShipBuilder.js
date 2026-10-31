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

    formatTotalCost(value, category = 'general', itemId = '') {
        const rounded = Math.ceil(value);
        return (this.app.formatOptionCost?.(rounded, category, itemId) || `${rounded} CV`)
            .replace(/\b\d+(?:\.\d+)?\b/g, amount => String(Math.ceil(Number(amount))));
    }

    static emptyContents() {
        return {
            berths: [],
            magazine: [],
            hangar: [],
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

        const { dialog, body, close } = ShipBuilder.createModal('Build Ships');
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

        dialog.insertBefore(configSection, body);
        dialog.insertBefore(capacitySummary, body);
        dialog.insertBefore(batchControls, body);
        body.appendChild(shipList);
        dialog.appendChild(footer);

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
            const quantity = Math.max(1, Math.min(100, Math.floor(Number(quantityInput.value) || 1)));
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
            try {
                const lastOrder = this.empire.getNextTaskForceOrder(null) + this.pendingShips.length - 1;
                if (!Number.isSafeInteger(lastOrder)) {
                    throw new Error('Task-force membership order exceeds its limit.');
                }
            } catch (error) {
                console.error('Unable to build ships:', error);
                validation.textContent = error.message;
                this.app.showNotification(`Unable to build ships: ${error.message}`, 'error');
                return;
            }
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
                this.configureContents({
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
        this.configureContents({
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
        if (Object.hasOwn(contents, 'hardpoints')) {
            throw new Error('Direct hardpoint contents are not part of the current ship format.');
        }

        return {
            berths: (contents.berths || []).map(entry => ({ ...entry })),
            magazine: (contents.magazine || []).map(entry => ({ ...entry })),
            hangar: (contents.hangar || []).map(entry => ({ ...entry })),
            hardpointLoadout: {
                devices: (contents.hardpointLoadout?.devices || []).map(entry => ({
                    ...entry,
                    contents: (entry.contents || []).map(content => ({ ...content }))
                })),
                weapons: (contents.hardpointLoadout?.weapons || []).map(entry => ({ ...entry }))
            }
        };
    }

    configureContents(options) {
        this.openContentsEditorDialog(options).catch(error => {
            console.error('Unable to configure ship contents:', error);
            this.app.showNotification(`Unable to configure ship contents: ${error.message}`, 'error');
        });
    }

    contentsFit(contents) {
        const result = ShipCapacity.contentsFit(
            contents, this.capacities, this.options, this.hardpointWeapons
        );
        const validCounts = [
            ...(contents.berths || []),
            ...(contents.magazine || []),
            ...(contents.hangar || []),
            ...(contents.hardpointLoadout?.weapons || []),
            ...(contents.hardpointLoadout?.devices || []).flatMap(entry => entry.contents || [])
        ].every(entry => Number.isInteger(entry.count) && entry.count >= 0);
        return { ...result, fits: result.fits && validCounts };
    }

    describeContents(contents) {
        const counts = [
            (contents.berths || []).length,
            (contents.magazine || []).length,
            (contents.hangar || []).length,
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
        if (counts[3]) parts.push(`${counts[3]} hardpoint device${counts[3] === 1 ? '' : 's'}`);
        if (counts[4]) parts.push(`${counts[4]} mounted weapon${counts[4] === 1 ? '' : 's'}`);
        return parts.join(' · ');
    }

    validateAll(validationElement) {
        for (const pending of this.pendingShips) {
            const { fits } = this.contentsFit(pending.contents);
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
            const { fits } = this.contentsFit(pending.contents);
            if (!fits) allFit = false;
        }
        totalsElement.textContent =
            `Total: ${Math.ceil(totalMateriel)} Material (${Math.ceil(totalCost)} CV) · ${this.pendingShips.length} ship${this.pendingShips.length === 1 ? '' : 's'}`;
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
            return builder.openContentsEditorDialog({
                title: `Contents — ${ship.name || 'Unnamed Ship'}`,
                contents: ship.contents,
                onApply: contents => {
                    const { fits } = builder.contentsFit(contents);
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
        const { dialog, body, close } = ShipBuilder.createModal(title);
        dialog.classList.add('ship-builder-dialog', 'ship-contents-dialog');

        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'ship-contents-sections';

        const footer = document.createElement('div');
        footer.className = 'ship-builder-footer';
        const totals = document.createElement('span');
        totals.className = 'ship-builder-totals';
        const validation = document.createElement('span');
        validation.className = 'ship-builder-validation';
        validation.setAttribute('role', 'alert');
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'ship-builder-confirm';
        applyButton.textContent = 'Apply';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', close);
        footer.append(totals, validation, cancelButton, applyButton);

        const inputErrors = new Set();
        const showInputError = (input, message) => {
            input.setCustomValidity(message);
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
            if (message) inputErrors.add(input);
            else inputErrors.delete(input);
            validation.textContent = message;
            applyButton.disabled = inputErrors.size > 0 || !this.contentsFit(working).fits;
            if (!message && inputErrors.size) {
                validation.textContent = [...inputErrors][0].validationMessage;
            }
        };
        const refresh = () => {
            inputErrors.clear();
            sectionsContainer.replaceChildren();
            const summary = ShipCapacity.summarizeContents(
                working, this.options, this.hardpointWeapons
            );
            sectionsContainer.append(
                this.createContentsSection(working, 'berths', 'Berths (troops)',
                    this.capacities.berths, summary.used.berths,
                    this.options.troops, option => `${option.name} (${option.berthsRequired} berths, ${option.cost} CV)`,
                    refresh, showInputError),
                this.createContentsSection(working, 'magazine', 'Magazine (munitions)',
                    this.capacities.magazineCells, summary.used.magazineCells,
                    this.options.munitions, option => `${option.name} (${option.magazineCells} cells, ${option.cost} CV)`,
                    refresh, showInputError),
                this.createContentsSection(working, 'hangar', 'Hangar (craft)',
                    this.capacities.hangarBays, summary.used.hangarBays,
                    this.options.craft, option => `${option.name} (${option.baysRequired} bays, ${option.cost} CV)`,
                    refresh, showInputError),
                this.createShipLoadoutSection(working, summary, refresh, showInputError)
            );
            const materiel = ShipCapacity.getContentsMateriel(summary);
            totals.textContent = `Total: ${Math.ceil(materiel)} Material (${Math.ceil(summary.cost)} CV)`;
            const { fits } = this.contentsFit(working);
            totals.classList.toggle('over-capacity', !fits);
            applyButton.disabled = !fits;
            validation.textContent = fits ? '' : 'Contents are invalid or exceed a device or ship capacity.';
        };

        applyButton.addEventListener('click', () => {
            if (applyButton.disabled || !this.contentsFit(working).fits) return;
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

        body.appendChild(sectionsContainer);
        dialog.appendChild(footer);
        refresh();
    }

    createContentsSection(working, key, title, capacity, used, options, describe, refresh, showInputError) {
        const section = document.createElement('section');
        section.className = 'ship-contents-section';

        const header = document.createElement('h3');
        header.textContent = `${title} — ${used} / ${capacity}`;
        if (used > capacity) header.classList.add('over-capacity');
        section.appendChild(header);

        const entries = working[key] || [];
        const itemSize = item => Number(item?.[{
            berths: 'berthsRequired', magazine: 'magazineCells', hangar: 'baysRequired'
        }[key]]) || 0;
        entries.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'ship-contents-row';

            const option = options.find(item => item.id === entry.id);
            const name = document.createElement('span');
            name.className = 'ship-contents-name';
            name.textContent = option ? describe(option) : `${entry.id || 'Unknown'} (unavailable)`;

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '0';
            countInput.step = '1';
            countInput.value = String(entry.count ?? 0);
            const size = itemSize(option);
            const maximum = size > 0 ? Math.floor((capacity - used + size * entry.count) / size) : null;
            if (maximum !== null) countInput.max = String(maximum);
            countInput.setAttribute('aria-label', 'Count');
            const checkCount = () => {
                const value = Number(countInput.value);
                const valid = countInput.value.trim() !== '' && Number.isInteger(value) &&
                    value >= 0 && (maximum === null || value <= maximum);
                showInputError(countInput, valid ? '' :
                    `${title}: count must be a whole number within capacity.`);
                return valid;
            };
            countInput.addEventListener('input', checkCount);
            countInput.addEventListener('change', () => {
                if (!checkCount()) return;
                entry.count = Number(countInput.value);
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

        const candidates = options.filter(option => used + itemSize(option) <= capacity);
        if (candidates.length > 0) {
            const addRow = document.createElement('div');
            addRow.className = 'ship-contents-add';
            const select = document.createElement('select');
            for (const option of candidates) {
                const element = document.createElement('option');
                element.value = option.id;
                element.textContent = describe(option);
                select.appendChild(element);
            }
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.textContent = 'Add';
            addButton.addEventListener('click', () => {
                const option = candidates.find(item => item.id === select.value);
                if (!option || used + itemSize(option) > capacity) {
                    showInputError(select, `These contents do not fit in ${title}.`);
                    return;
                }
                const existing = entries.find(entry => entry.id === select.value);
                if (existing) existing.count += 1;
                else entries.push({ id: select.value, count: 1 });
                refresh();
            });
            addRow.append(select, addButton);
            section.insertBefore(addRow, header.nextSibling);
        } else {
            const note = document.createElement('p');
            note.className = 'ship-contents-empty';
            note.textContent = options.length ? 'No additional contents fit.' : 'No operational designs available.';
            section.appendChild(note);
        }
        return section;
    }

    createShipLoadoutSection(working, summary, refresh, showInputError) {
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
            if (!device || summary.used.hardpoints >= this.capacities.hardpoints) {
                showInputError(deviceSelect, 'Select an available device with a free hardpoint.');
                return;
            }
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
            const attribute = device?.cells ? `${device.cells * entries.length} cells` :
                device?.bays ? `${device.bays * entries.length} bays` :
                device?.jumpium ? `${device.jumpium * entries.length} jumpium` :
                device?.mounts ? `${device.mounts * entries.length} mounts` :
                device?.grapple ? `${device.grapple * entries.length} grapple` : '';
            name.textContent = `${device?.name || deviceId}${!deviceOptions.some(item => item.id === deviceId) ? ' (unavailable)' : ''}`;
            const quantity = document.createElement('span');
            quantity.className = 'design-entry-quantity';
            quantity.textContent = `×${entries.length}${attribute ? ` · ${attribute}` : ''}`;
            const cost = document.createElement('span');
            cost.className = 'ship-contents-cost';
            cost.textContent = device
                ? this.formatTotalCost(device.cost * entries.length, 'weapons', device.id)
                : 'Unavailable';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ship-contents-remove';
            remove.textContent = '−';
            remove.setAttribute('aria-label', `Remove one ${device?.name || deviceId}`);
            remove.addEventListener('click', () => {
                if (deviceId === 'fixture') {
                    const mountsAfterRemoval = devices.reduce((sum, entry) =>
                        sum + (Number(deviceDefinitions.find(item => item.id === entry.deviceId)?.mounts) || 0), 0) -
                        (Number(device?.mounts) || 0);
                    const installed = working.hardpointLoadout.weapons.reduce((sum, entry) =>
                        sum + ShipCapacity.num(entry.count), 0);
                    if (installed > mountsAfterRemoval) {
                        this.app.showNotification(
                            'Remove enough fixture-mounted weapons before removing this Fixture.', 'error'
                        );
                        return;
                    }
                }
                const index = devices.findIndex(entry => entry.deviceId === deviceId);
                if (index >= 0) devices.splice(index, 1);
                refresh();
            });
            row.classList.add('design-entry');
            name.classList.add('design-entry-name');
            cost.classList.add('design-entry-cost');
            remove.classList.add('widget-remove-action');
            row.append(name, quantity, cost, remove);
            section.appendChild(row);
        }

        const ordinals = { adapter: 0, clamp: 0 };
        devices.forEach(entry => {
            if (!['adapter', 'clamp'].includes(entry.deviceId)) return;
            const ordinal = ++ordinals[entry.deviceId];
            const device = deviceDefinitions.find(item => item.id === entry.deviceId);
            if (!device || !['adapter', 'clamp'].includes(device.id)) return;
            const isAdapter = device.id === 'adapter';
            const contentType = isAdapter ? 'munitions' : 'craft';
            const contents = entry.contents || (entry.contents = []);
            const contentSection = document.createElement('section');
            contentSection.className = 'ship-contents-section design-subsection design-loadout-group ship-device-contents';
            const used = contents.reduce((total, content) => {
                const option = (isAdapter ? this.options.munitions : this.options.craft)
                    .find(item => item.id === content.id);
                return total + (isAdapter ? option?.magazineCells || 0 : option?.baysRequired || 0) *
                    ShipCapacity.num(content.count);
            }, 0);
            const limit = Number(isAdapter ? device.cells : device.bays) || 0;
            const heading = document.createElement('h4');
            heading.textContent = `${device.name} ${ordinal} contents — ${used} / ${limit} ${isAdapter ? 'cells' : 'bays'}`;
            if (used > limit) heading.classList.add('over-capacity');
            contentSection.appendChild(heading);

            const contentPicker = document.createElement('div');
            contentPicker.className = 'ship-contents-add';
            const contentSelect = document.createElement('select');
            contentSelect.setAttribute('aria-label', `${device.name} contents`);
            const candidates = (isAdapter ? this.options.munitions : this.options.craft)
                .filter(() => contents.every(content =>
                    (isAdapter ? this.options.munitions : this.options.craft)
                        .some(item => item.id === content.id)))
                .filter(item => !isAdapter || !contents.length ||
                    item.profile === this.options.munitions.find(munition => munition.id === contents[0].id)?.profile)
                .filter(item => Number(isAdapter ? item.magazineCells : item.baysRequired) + used <= limit);
            for (const item of candidates) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = isAdapter
                    ? `${item.name} (${Math.ceil(item.cost)} CV)`
                    : `${item.name} (${Math.ceil(item.cost)} CV)`;
                contentSelect.appendChild(option);
            }
            const addContent = document.createElement('button');
            addContent.type = 'button';
            addContent.textContent = 'Add';
            addContent.disabled = candidates.length === 0;
            addContent.addEventListener('click', () => {
                const item = candidates.find(candidate => candidate.id === contentSelect.value);
                if (!item) {
                    showInputError(contentSelect, `Select available contents for ${device.name} ${ordinal}.`);
                    return;
                }
                const current = contents.reduce((total, content) => {
                    const selected = candidates.find(candidate => candidate.id === content.id) ||
                        (isAdapter ? this.options.munitions : this.options.craft)
                            .find(candidate => candidate.id === content.id);
                    return total + (isAdapter ? selected?.magazineCells || 0 : selected?.baysRequired || 0) *
                        ShipCapacity.num(content.count);
                }, 0);
                const itemSize = isAdapter ? item.magazineCells : item.baysRequired;
                if (current + itemSize > limit) {
                    showInputError(contentSelect, `${device.name} ${ordinal} has insufficient ${isAdapter ? 'cells' : 'bays'}.`);
                    return;
                }
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
                contentName.textContent = `${item?.name || content.id}${item ? '' : ' (unavailable)'}`;
                const count = document.createElement('input');
                count.type = 'number';
                count.min = '1';
                count.step = '1';
                count.value = String(content.count);
                const size = Number(isAdapter ? item?.magazineCells : item?.baysRequired) || 0;
                const maximum = size > 0 ? Math.floor((limit - used + size * content.count) / size) : null;
                if (maximum !== null) count.max = String(maximum);
                count.setAttribute('aria-label', `${device.name} ${ordinal} ${item?.name || content.id} count`);
                const updateCount = () => {
                    const value = Number(count.value);
                    const valid = count.value.trim() !== '' && Number.isInteger(value) && value >= 1 &&
                        (maximum === null || value <= maximum);
                    showInputError(count, valid ? '' :
                        `${device.name} ${ordinal}: enter a whole count from 1${maximum === null ? '' : ` to ${maximum}`}.`);
                    if (!valid) return;
                    content.count = value;
                    refresh();
                };
                count.addEventListener('input', () => {
                    const value = Number(count.value);
                    showInputError(count, count.value.trim() && Number.isInteger(value) && value >= 1 &&
                        (maximum === null || value <= maximum) ? '' :
                        `${device.name} ${ordinal}: count must be a whole number within this device's capacity.`);
                });
                count.addEventListener('change', updateCount);
                const cost = document.createElement('span');
                cost.className = 'ship-contents-cost design-entry-cost';
                cost.textContent = item
                    ? this.formatTotalCost(item.cost * content.count, isAdapter ? 'munitions' : 'general')
                    : 'Unavailable';
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
                contentRow.classList.add('design-entry');
                contentName.classList.add('design-entry-name');
                count.classList.add('design-entry-quantity');
                contentRemove.classList.add('widget-remove-action');
                contentRow.append(contentName, count, cost, contentRemove);
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
        weaponsSection.hidden = !devices.some(entry => entry.deviceId === 'fixture');
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
            if (!weapon || mounted >= fixtureCount) {
                showInputError(weaponSelect, 'Select an available weapon with a free fixture mount.');
                return;
            }
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
            name.textContent = weapon
                ? `${weapon.name} (${this.formatTotalCost((weapon.cost || 0) * entry.count, 'weapons', weapon.id)})`
                : `${entry.weaponId} (unavailable)`;
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
            count.max = String(Math.max(0, fixtureCount - mounted + entry.count));
            count.step = '1';
            count.value = String(entry.count || 1);
            count.setAttribute('aria-label', 'Weapon count');
            const checkCount = () => {
                const value = Number(count.value);
                const valid = count.value.trim() !== '' && Number.isInteger(value) &&
                    value >= 1 && value <= Number(count.max);
                showInputError(count, valid ? '' : `Weapon count must be a whole number from 1 to ${count.max}.`);
                return valid;
            };
            count.addEventListener('input', checkCount);
            count.addEventListener('change', () => {
                if (!checkCount()) return;
                entry.count = Number(count.value);
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
        backdrop.className = 'technology-modal-backdrop ship-modal-backdrop';
        const dialog = document.createElement('section');
        dialog.className = 'technology-modal ship-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        const header = document.createElement('header');
        header.className = 'ship-modal-header';
        const heading = document.createElement('h2');
        heading.id = `ship-dialog-title-${ShipBuilder.nextDialogId = (ShipBuilder.nextDialogId || 0) + 1}`;
        heading.textContent = title;
        dialog.setAttribute('aria-labelledby', heading.id);
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'widget-control-btn close';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.title = 'Close';
        const close = () => backdrop.remove();
        closeButton.addEventListener('click', close);
        header.append(heading, closeButton);
        const body = document.createElement('div');
        body.className = 'ship-modal-body';
        dialog.append(header, body);
        backdrop.appendChild(dialog);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) close();
        });
        document.body.appendChild(backdrop);
        // Existing TendingDialog appends directly to dialog; it retains its original layout.
        return { backdrop, dialog, body, close };
    }
}
