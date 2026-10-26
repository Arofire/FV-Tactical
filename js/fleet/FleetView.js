// Fleet page controller: task forces (main panel) and the whole-of-Empire
// ship inventory (secondary panel). Owns all DOM under #fleetView; main.js
// delegates to this via app.updateFleetView().
class FleetView {
    constructor(app) {
        this.app = app;
        this.exportMenuSequence = 0;
    }

    get empire() {
        return this.app.empire;
    }

    // --- Design resolution ---------------------------------------------------

    getClassWidget(ship) {
        const widget = window.widgetManager?.getWidget(ship.classWidgetId);
        return widget?.type === 'ship' ? widget : null;
    }

    getOutfitWidget(ship) {
        const widget = window.widgetManager?.getWidget(ship.outfitWidgetId);
        return widget?.type === 'outfit' ? widget : null;
    }

    getShipStatus(ship) {
        const classWidget = this.getClassWidget(ship);
        const outfitWidget = this.getOutfitWidget(ship);
        return {
            classWidget,
            outfitWidget,
            missing: !classWidget || !outfitWidget
        };
    }

    getStoresMaxima(ship) {
        const classWidget = this.getClassWidget(ship);
        return classWidget
            ? ShipCapacity.getStoresMaxima(classWidget)
            : { cargo: 0, remass: 0 };
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    save() {
        this.app.saveEmpire();
    }

    // --- Rendering -----------------------------------------------------------

    render() {
        const taskForcePanel = document.getElementById('taskForcePanel');
        const inventoryList = document.getElementById('fleetInventoryList');
        if (!taskForcePanel || !inventoryList) return;
        this.renderTaskForces(taskForcePanel);
        this.renderInventory(inventoryList);
    }

    renderTaskForces(panel) {
        panel.replaceChildren();

        if (this.empire.taskForces.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'fleet-empty-state';
            empty.textContent = 'No task forces yet. Create one, then assign ships from the inventory.';
            panel.appendChild(empty);
        }

        for (const taskForce of this.empire.taskForces) {
            panel.appendChild(this.createTaskForceGroup(taskForce));
        }

        const unassigned = this.empire.fleetShips.filter(ship =>
            !ship.taskForceId || !this.empire.taskForces.some(force => force.id === ship.taskForceId)
        );
        if (unassigned.length > 0) {
            const group = document.createElement('section');
            group.className = 'task-force-group task-force-unassigned';
            const header = document.createElement('header');
            header.className = 'task-force-header';
            const title = document.createElement('h2');
            title.textContent = 'Unassigned Ships';
            header.appendChild(title);
            group.appendChild(header);
            const list = document.createElement('div');
            list.className = 'fleet-ship-list';
            for (const ship of unassigned) list.appendChild(this.createShipCard(ship));
            group.appendChild(list);
            panel.appendChild(group);
        }
    }

    createTaskForceGroup(taskForce) {
        const ships = this.empire.getTaskForceShips(taskForce.id);
        const group = document.createElement('section');
        group.className = 'task-force-group';

        const header = document.createElement('header');
        header.className = 'task-force-header';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'task-force-name';
        nameInput.value = taskForce.name;
        nameInput.setAttribute('aria-label', 'Task force name');
        nameInput.addEventListener('change', () => {
            taskForce.name = nameInput.value.trim() || taskForce.name;
            nameInput.value = taskForce.name;
            this.save();
            this.render();
        });

        const count = document.createElement('span');
        count.className = 'task-force-count';
        count.textContent = `${ships.length} ship${ships.length === 1 ? '' : 's'}`;

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'task-force-action';
        resetButton.textContent = 'Reset Stores';
        resetButton.title = 'Reset cargo and remass stores to full for every ship in this task force';
        resetButton.disabled = ships.length === 0;
        resetButton.addEventListener('click', () => {
            for (const ship of ships) this.resetShipStores(ship);
            this.save();
            this.render();
            this.app.showNotification(`Stores reset for ${taskForce.name}.`, 'success');
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'task-force-action task-force-delete';
        deleteButton.textContent = 'Disband';
        deleteButton.title = 'Remove this task force; its ships remain in the inventory';
        deleteButton.addEventListener('click', () => {
            this.empire.removeTaskForce(taskForce.id);
            this.save();
            this.render();
        });

        header.append(nameInput, count, resetButton, deleteButton);
        group.appendChild(header);

        const list = document.createElement('div');
        list.className = 'fleet-ship-list';
        if (ships.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'fleet-empty-state';
            empty.textContent = 'No ships assigned.';
            list.appendChild(empty);
        }
        for (const ship of ships) list.appendChild(this.createShipCard(ship));
        group.appendChild(list);
        return group;
    }

    createShipCard(ship) {
        const { classWidget, outfitWidget, missing } = this.getShipStatus(ship);
        const maxima = this.getStoresMaxima(ship);

        const card = document.createElement('article');
        card.className = 'fleet-ship-card';
        if (missing) card.classList.add('fleet-ship-missing');

        const heading = document.createElement('h2');
        heading.textContent = ship.name || 'Unnamed Ship';

        const subtitle = document.createElement('p');
        subtitle.className = 'fleet-ship-subtitle';
        subtitle.textContent = missing
            ? 'Missing design — the class or outfit widget no longer exists.'
            : `${classWidget.shipData?.name || 'Class'} · ${outfitWidget.outfitData?.name || 'Outfit'}`;

        const fields = document.createElement('div');
        fields.className = 'fleet-ship-fields';

        const nameField = this.createField('Ship name', 'text', ship.name || '');
        nameField.querySelector('input').addEventListener('change', event => {
            ship.name = event.target.value;
            heading.textContent = ship.name || 'Unnamed Ship';
            this.save();
            this.render();
        });

        const roleField = this.createField('Role', 'text', ship.role || '');
        roleField.querySelector('input').addEventListener('change', event => {
            ship.role = event.target.value;
            this.save();
        });

        const assignmentLabel = document.createElement('label');
        assignmentLabel.textContent = 'Task force';
        const assignmentSelect = document.createElement('select');
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'Unassigned';
        assignmentSelect.appendChild(noneOption);
        for (const force of this.empire.taskForces) {
            const option = document.createElement('option');
            option.value = force.id;
            option.textContent = force.name;
            option.selected = ship.taskForceId === force.id;
            assignmentSelect.appendChild(option);
        }
        assignmentSelect.addEventListener('change', () => {
            ship.taskForceId = assignmentSelect.value || null;
            this.save();
            this.render();
        });
        assignmentLabel.appendChild(assignmentSelect);

        fields.append(nameField, roleField, assignmentLabel);

        const stores = document.createElement('div');
        stores.className = 'fleet-ship-stores';
        stores.append(
            this.createStoreRow('Cargo', ship.stores.cargo, maxima.cargo),
            this.createStoreRow('Remass', ship.stores.remass, maxima.remass)
        );

        const actions = document.createElement('div');
        actions.className = 'fleet-ship-actions';

        const contentsButton = document.createElement('button');
        contentsButton.type = 'button';
        contentsButton.textContent = 'Contents';
        contentsButton.title = 'Configure berths, magazine, hangar and hardpoint contents';
        contentsButton.disabled = missing;
        contentsButton.addEventListener('click', () => ShipBuilder.openContentsEditor(this.app, ship));

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.textContent = 'Reset Stores';
        resetButton.disabled = missing;
        resetButton.addEventListener('click', () => {
            this.resetShipStores(ship);
            this.save();
            this.render();
        });

        actions.append(contentsButton, resetButton);
        actions.appendChild(this.createShipExportMenu(ship));

        if (!missing && ShipCapacity.hasTending(outfitWidget)) {
            const tendButton = document.createElement('button');
            tendButton.type = 'button';
            tendButton.className = 'fleet-ship-tend';
            tendButton.textContent = 'Tend Task Force';
            tendButton.title = 'Distribute this ship\'s cargo and remass to other ships in its task force';
            const taskForceShips = ship.taskForceId ? this.empire.getTaskForceShips(ship.taskForceId) : [];
            tendButton.disabled = !ship.taskForceId || taskForceShips.length < 2;
            tendButton.addEventListener('click', () => TendingDialog.open(this.app, ship));
            actions.appendChild(tendButton);
        }

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'fleet-ship-remove';
        removeButton.textContent = 'Remove Ship';
        removeButton.addEventListener('click', () => {
            this.empire.removeFleetShip(ship.id);
            this.save();
            this.render();
        });
        actions.appendChild(removeButton);

        card.append(heading, subtitle, fields, stores, actions);
        return card;
    }

    createShipExportMenu(ship) {
        const root = document.createElement('div');
        root.className = 'fleet-ship-export';
        const menuId = `fleet-ship-export-menu-${++this.exportMenuSequence}`;
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'fleet-ship-export-trigger';
        trigger.textContent = 'Export';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', menuId);

        const menu = document.createElement('div');
        menu.className = 'fleet-ship-export-menu';
        menu.id = menuId;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Unique ship export options');
        menu.hidden = true;
        for (const [format, label] of [['json', 'JSON'], ['pdf', 'PDF']]) {
            const option = document.createElement('button');
            option.type = 'button';
            option.setAttribute('role', 'menuitem');
            option.dataset.exportFormat = format;
            option.textContent = label;
            menu.appendChild(option);
        }

        const closeMenu = restoreFocus => {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            menu.removeEventListener('keydown', handleMenuKeydown);
            document.removeEventListener('pointerdown', handleOutsidePointer);
            if (restoreFocus) trigger.focus();
        };
        const handleOutsidePointer = event => {
            if (!root.contains(event.target)) closeMenu(false);
        };
        const handleMenuKeydown = event => {
            const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu(true);
                return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const activeIndex = items.indexOf(document.activeElement);
            const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                    ? items.length - 1
                    : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[nextIndex].focus();
        };
        trigger.addEventListener('click', () => {
            if (!menu.hidden) {
                closeMenu(false);
                return;
            }
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            menu.addEventListener('keydown', handleMenuKeydown);
            document.addEventListener('pointerdown', handleOutsidePointer);
            menu.querySelector('[role="menuitem"]')?.focus();
        });
        root.addEventListener('focusout', event => {
            if (event.relatedTarget && !root.contains(event.relatedTarget)) closeMenu(false);
        });
        menu.addEventListener('click', async event => {
            const option = event.target instanceof Element
                ? event.target.closest('[data-export-format]')
                : null;
            if (!option) return;
            closeMenu(true);
            const exporter = new UniqueShipExporter(this.app);
            try {
                const payload = option.dataset.exportFormat === 'json'
                    ? await exporter.exportJSON(ship)
                    : await exporter.exportPDF(ship);
                if (payload.warnings.length) {
                    this.app.showNotification(
                        `Unique ship export completed with warnings: ${payload.warnings.join(' ')}`,
                        'warning'
                    );
                } else {
                    this.app.showNotification('Unique ship exported successfully.', 'success');
                }
            } catch (error) {
                console.error(`Unique ship ${option.dataset.exportFormat} export failed`, error);
                this.app.showNotification(
                    `Unique ship ${option.dataset.exportFormat} export failed: ${error.message}`,
                    'error'
                );
            }
        });
        root.append(trigger, menu);
        return root;
    }

    createStoreRow(label, current, max) {
        const row = document.createElement('div');
        row.className = 'fleet-store-row';
        const name = document.createElement('span');
        name.className = 'fleet-store-label';
        name.textContent = label;
        const value = document.createElement('span');
        value.className = 'fleet-store-value';
        value.textContent = `${current} / ${max} t`;
        row.append(name, value);
        return row;
    }

    createField(labelText, type, value) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = String(value);
        label.appendChild(input);
        return label;
    }

    resetShipStores(ship) {
        const maxima = this.getStoresMaxima(ship);
        ship.stores.cargo = maxima.cargo;
        ship.stores.remass = maxima.remass;
    }

    // --- Inventory -----------------------------------------------------------

    renderInventory(list) {
        list.replaceChildren();
        if (this.empire.fleetShips.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'fleet-empty-state';
            empty.textContent = 'No ships built yet.';
            list.appendChild(empty);
            return;
        }
        for (const ship of this.empire.fleetShips) {
            list.appendChild(this.createInventoryRow(ship));
        }
    }

    createInventoryRow(ship) {
        const { classWidget, missing } = this.getShipStatus(ship);
        const maxima = this.getStoresMaxima(ship);
        const taskForce = this.empire.taskForces.find(force => force.id === ship.taskForceId);

        const row = document.createElement('div');
        row.className = 'fleet-inventory-row';
        if (missing) row.classList.add('fleet-ship-missing');

        const name = document.createElement('span');
        name.className = 'fleet-inventory-name';
        name.textContent = ship.name || 'Unnamed Ship';

        const details = document.createElement('span');
        details.className = 'fleet-inventory-details';
        const className = missing ? 'Missing design' : (classWidget.shipData?.name || 'Class');
        details.textContent = `${className} · ${taskForce ? taskForce.name : 'Unassigned'} · ${ship.stores.cargo}/${maxima.cargo}t cargo · ${ship.stores.remass}/${maxima.remass}t remass`;

        row.append(name, details);
        return row;
    }

    // --- Actions -------------------------------------------------------------

    addTaskForce() {
        this.empire.addTaskForce();
        this.save();
        this.render();
    }
}
