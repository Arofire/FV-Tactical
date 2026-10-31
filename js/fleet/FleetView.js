// Fleet page controller: selected task force and grouped Empire inventory.
// Owns all DOM under #fleetView; main.js
// delegates to this via app.updateFleetView().
class FleetView {
    constructor(app) {
        this.app = app;
        this.exportMenuSequence = 0;
        this.selectedTaskForceId = null;
        this.selectedShipId = null;
        this.selectedShipIds = new Set();
        this.selectionAnchors = new Map();
        this.expansion = new Map();
        this.sorts = new Map();
        this.metrics = new Map();
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
        const shipIds = new Set(this.empire.fleetShips.map(ship => ship.id));
        for (const id of this.selectedShipIds) {
            if (!shipIds.has(id)) this.selectedShipIds.delete(id);
        }
        for (const [surface, id] of this.selectionAnchors) {
            if (!shipIds.has(id)) this.selectionAnchors.delete(surface);
        }
        this.metrics.clear();
        this.hideTilesTooltip();
        if (this.selectedTaskForceId && !this.empire.taskForces.some(force =>
            force.id === this.selectedTaskForceId)) this.selectedTaskForceId = null;
        this.renderTaskForces(taskForcePanel);
        this.renderInventory(inventoryList);
        this.syncShipSelection();
    }

    getInventorySelectionOrder() {
        const ships = this.expansion.get('unassigned') !== false ? this.getGroupShips(null) : [];
        if (this.expansion.get('forces') !== false) {
            for (const force of this.empire.taskForces) {
                if (this.expansion.get(`force:${force.id}`) !== false) {
                    ships.push(...this.getGroupShips(force.id));
                }
            }
        }
        return ships.map(ship => ship.id);
    }

    selectShips(shipId, event, order, surface) {
        const anchorIndex = order.indexOf(this.selectionAnchors.get(surface));
        const index = order.indexOf(shipId);
        if (event.shiftKey && anchorIndex >= 0 && index >= 0) {
            for (const id of order.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1)) {
                this.selectedShipIds.add(id);
            }
        } else if (event.ctrlKey || event.metaKey) {
            if (this.selectedShipIds.has(shipId)) this.selectedShipIds.delete(shipId);
            else this.selectedShipIds.add(shipId);
        } else {
            this.selectedShipIds.clear();
            this.selectedShipIds.add(shipId);
        }
        this.selectionAnchors.set(surface, shipId);
        this.syncShipSelection();
    }

    syncShipSelection() {
        document.querySelectorAll('#fleetView [data-fleet-ship-id]').forEach(element => {
            const selected = this.selectedShipIds.has(element.dataset.fleetShipId);
            element.classList.toggle('selected', selected);
            if (element.matches('tr')) element.setAttribute('aria-selected', String(selected));
            const identity = element.querySelector('.fleet-inventory-identity');
            if (identity) identity.setAttribute('aria-pressed', String(selected));
        });
    }

    getMetrics(ship) {
        if (!this.metrics.has(ship.id)) {
            this.metrics.set(ship.id, ShipCapacity.getFleetShipMetrics(ship));
        }
        return this.metrics.get(ship.id);
    }

    number(value) {
        return Number.isFinite(value) ? value : 0;
    }

    format(value) {
        return Number.isFinite(value) ? value.toLocaleString(undefined, {
            maximumFractionDigits: 20
        }) : 'Unavailable';
    }

    formatCost(value) {
        return Number.isFinite(value) ? Math.ceil(value).toLocaleString() : 'Unavailable';
    }

    getGroupShips(taskForceId) {
        return taskForceId ? this.empire.getTaskForceShips(taskForceId) :
            this.empire.getTaskForceShips(null).concat(this.empire.fleetShips.filter(ship =>
                ship.taskForceId && !this.empire.taskForces.some(force => force.id === ship.taskForceId)));
    }

    selectTaskForce(id) {
        this.selectedTaskForceId = id;
        this.render();
    }

    renderTaskForces(panel) {
        panel.replaceChildren();
        const taskForce = this.empire.taskForces.find(force =>
            force.id === this.selectedTaskForceId);
        panel.appendChild(this.createTaskForceGroup(taskForce || null));
    }

    createTaskForceGroup(taskForce) {
        const id = taskForce?.id || null;
        const ships = this.getGroupShips(id);
        const group = document.createDocumentFragment();
        const header = document.createElement('header');
        header.className = 'task-force-header';
        if (taskForce) {
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'task-force-name';
            nameInput.value = taskForce.name;
            nameInput.setAttribute('aria-label', 'Task force name');
            nameInput.addEventListener('change', () => {
                taskForce.name = nameInput.value.trim() || taskForce.name;
                this.save();
                this.render();
            });
            header.appendChild(nameInput);
        } else {
            const title = document.createElement('h2');
            title.textContent = 'Unassigned Ships';
            header.appendChild(title);
        }
        const count = document.createElement('span');
        count.className = 'task-force-count';
        count.textContent = `${ships.length} ship${ships.length === 1 ? '' : 's'}`;
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'task-force-action';
        resetButton.textContent = 'Reset Stores';
        resetButton.title = 'Reset cargo and remass stores to full for every ship in this task force';
        resetButton.disabled = ships.length === 0 || ships.some(ship => this.getMetrics(ship).missing);
        resetButton.addEventListener('click', () => {
            for (const ship of ships) this.resetShipStores(ship);
            this.save();
            this.render();
            this.app.showNotification(`Stores reset for ${taskForce?.name || 'unassigned ships'}.`, 'success');
        });
        header.append(count, resetButton);
        if (taskForce) {
            const deleteButton = this.button('Disband', () => {
                this.empire.removeTaskForce(id);
                this.save();
                this.render();
            }, 'task-force-action task-force-delete');
            deleteButton.title = 'Remove this task force; its ships remain in the inventory';
            header.appendChild(deleteButton);
        }
        group.appendChild(header);
        this.makeDropTarget(header, id);
        if (taskForce) group.appendChild(this.createForceSummary(ships));
        const clear = this.button('Clear Sorting', () => {
            this.sorts.set(id, []);
            this.render();
        }, 'task-force-action fleet-clear-sort');
        clear.disabled = !(this.sorts.get(id)?.length);
        group.appendChild(clear);
        const list = this.createShipTable(ships, id);
        this.makeDropTarget(list, id);
        if (ships.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'fleet-empty-state';
            empty.textContent = 'No ships assigned.';
            group.appendChild(empty);
        }
        group.appendChild(list);
        const selected = ships.find(ship => ship.id === this.selectedShipId);
        if (selected) {
            const detail = this.createShipCard(selected);
            detail.classList.add('fleet-selected-ship');
            const close = this.button('Close Details', () => {
                this.selectedShipId = null;
                this.render();
            }, 'task-force-action');
            detail.prepend(close);
            group.appendChild(detail);
        }
        return group;
    }

    button(text, action, className = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', action);
        return button;
    }

    getColumns() {
        return [
            { key: 'class', label: 'Class', value: ship => this.getClassWidget(ship)?.shipData?.name || 'Missing class' },
            { key: 'outfit', label: 'Outfit', value: ship => this.getOutfitWidget(ship)?.outfitData?.name || 'Missing outfit' },
            { key: 'name', label: 'Name', value: ship => ship.name || 'Unnamed Ship' },
            { key: 'cost', label: 'CV', value: ship => this.getMetrics(ship).cost },
            { key: 'cargo', label: 'Cargo', value: ship => ship.stores?.cargo },
            { key: 'cargoCapacity', label: 'Cargo cap', value: ship => this.getMetrics(ship).storesMaxima.cargo },
            { key: 'remass', label: 'Remass', value: ship => ship.stores?.remass },
            { key: 'remassCapacity', label: 'Remass cap', value: ship => this.getMetrics(ship).storesMaxima.remass },
            { key: 'usedBays', label: 'Bays', value: ship => this.getMetrics(ship).used.hangarBays + this.getMetrics(ship).used.clampBays },
            { key: 'bays', label: 'Bays cap', value: ship => this.getMetrics(ship).capacities.hangarBays + this.getMetrics(ship).deviceResources.bays },
            { key: 'usedCells', label: 'Cells', value: ship => this.getMetrics(ship).used.magazineCells + this.getMetrics(ship).used.adapterCells },
            { key: 'cells', label: 'Cells cap', value: ship => this.getMetrics(ship).capacities.magazineCells + this.getMetrics(ship).deviceResources.cells },
            { key: 'usedBerths', label: 'Berths', value: ship => this.getMetrics(ship).used.berths },
            { key: 'berths', label: 'Berths cap', value: ship => this.getMetrics(ship).capacities.berths },
            { key: 'usedHardpoints', label: 'Hardpoints', value: ship => this.getMetrics(ship).used.hardpoints },
            { key: 'hardpoints', label: 'Hardpoints cap', value: ship => this.getMetrics(ship).capacities.hardpoints },
            // Jumpium consumption is not tracked yet, so ships always carry a full load.
            { key: 'jumpium', label: 'Jumpium', value: ship => this.getMetrics(ship).jumpiumCapacity },
            { key: 'jumpiumCapacity', label: 'Jumpium cap', value: ship => this.getMetrics(ship).jumpiumCapacity }
        ];
    }

    cycleSort(key, id = this.selectedTaskForceId) {
        const sorts = this.sorts.get(id) || [];
        const index = sorts.findIndex(sort => sort.key === key);
        if (index < 0) sorts.push({ key, direction: 1 });
        else if (sorts[index].direction === 1) sorts[index].direction = -1;
        else sorts.splice(index, 1);
        this.sorts.set(id, sorts);
    }

    sortShips(ships, id) {
        const columns = new Map(this.getColumns().map(column => [column.key, column]));
        const sorts = this.sorts.get(id) || [];
        return ships.map((ship, index) => ({ ship, index })).sort((a, b) => {
            for (const sort of sorts) {
                const column = columns.get(sort.key);
                if (!column) continue;
                const left = this.getColumnValue(column, a.ship);
                const right = this.getColumnValue(column, b.ship);
                const leftMissing = left == null || (typeof left === 'number' && !Number.isFinite(left));
                const rightMissing = right == null || (typeof right === 'number' && !Number.isFinite(right));
                if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
                if (leftMissing) continue;
                const comparison = typeof left === 'number' && typeof right === 'number'
                    ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
                if (comparison) return comparison * sort.direction;
            }
            return a.index - b.index;
        }).map(entry => entry.ship);
    }

    getColumnValue(column, ship) {
        const designIndependent = ['class', 'outfit', 'name', 'cargo', 'remass'];
        const metric = this.getMetrics(ship);
        if (metric.missing && !designIndependent.includes(column.key)) return null;
        if (['usedBays', 'usedCells', 'usedBerths', 'usedHardpoints'].includes(column.key) &&
            metric.contentsValid === false) return null;
        return column.value(ship);
    }

    createShipTable(ships, id) {
        const wrapper = document.createElement('div');
        wrapper.className = 'fleet-table-scroll';
        const table = document.createElement('table');
        table.className = 'fleet-ship-table';
        const caption = document.createElement('caption');
        caption.textContent = 'Ships';
        table.appendChild(caption);
        const head = table.createTHead().insertRow();
        const columns = this.getColumns();
        const sorts = this.sorts.get(id) || [];
        for (const column of columns) {
            const cell = document.createElement('th');
            cell.scope = 'col';
            const index = sorts.findIndex(sort => sort.key === column.key);
            const sort = sorts[index];
            cell.setAttribute('aria-sort', index < 0 ? 'none' : index === 0
                ? (sort.direction === 1 ? 'ascending' : 'descending') : 'other');
            const button = this.button(column.label, () => {
                this.cycleSort(column.key, id);
                this.render();
            });
            button.title = index < 0 ? 'Not sorted; activate as lowest priority' :
                `Priority ${index + 1}: ${sort.direction === 1 ? 'ascending' : 'descending'}`;
            if (index >= 0) {
                const badge = document.createElement('span');
                badge.className = 'fleet-sort-priority';
                badge.textContent = `${sort.direction === 1 ? '↑' : '↓'} ${index + 1}`;
                button.appendChild(badge);
            }
            cell.appendChild(button);
            head.appendChild(cell);
        }
        const actions = document.createElement('th');
        actions.scope = 'col';
        actions.textContent = 'Actions';
        head.appendChild(actions);
        const body = table.createTBody();
        const orderedShips = this.sortShips(ships, id);
        const selectionOrder = orderedShips.map(ship => ship.id);
        for (const ship of orderedShips) {
            const row = body.insertRow();
            row.dataset.fleetShipId = ship.id;
            row.classList.toggle('selected', this.selectedShipIds.has(ship.id));
            row.setAttribute('aria-selected', String(this.selectedShipIds.has(ship.id)));
            row.tabIndex = 0;
            const select = event => this.selectShips(ship.id, event, selectionOrder, `main:${id}`);
            row.addEventListener('click', event => {
                if (!event.target.closest('button, input, select, a')) select(event);
            });
            row.addEventListener('keydown', event => {
                if (event.target === row && event.key === ' ') {
                    event.preventDefault();
                    select(event);
                }
            });
            if (this.getMetrics(ship).missing) row.classList.add('fleet-ship-missing');
            this.makeDraggable(row, ship);
            for (const column of columns) {
                const value = this.getColumnValue(column, ship);
                row.insertCell().textContent = typeof value === 'string' ? value :
                    column.key === 'cost' ? this.formatCost(value) : this.format(value);
            }
            const cell = row.insertCell();
            cell.appendChild(this.button('Details', () => {
                this.selectedShipId = ship.id;
                this.render();
            }, 'task-force-action'));
            const configure = this.button('Hardpoints', () =>
                ShipBuilder.openContentsEditor(this.app, ship), 'task-force-action');
            configure.disabled = this.getMetrics(ship).missing;
            cell.appendChild(configure);
            cell.appendChild(this.createTilesButton(ship));
            const remove = this.button('×', () => this.deleteShip(ship), 'widget-remove-action fleet-ship-delete');
            const label = `Delete ${ship.name || 'Unnamed Ship'}`;
            remove.title = label;
            remove.setAttribute('aria-label', label);
            cell.appendChild(remove);
        }
        wrapper.appendChild(table);
        return wrapper;
    }

    createForceSummary(ships) {
        const metrics = ships.map(ship => this.getMetrics(ship));
        const missing = metrics.some(metric => metric.missing);
        const sum = getter => metrics.reduce((total, metric) => total + this.number(getter(metric)), 0);
        const summary = document.createElement('section');
        summary.className = 'fleet-force-summary';
        summary.setAttribute('aria-label', 'Task force resources and capabilities');
        const values = document.createElement('dl');
        const add = (label, value) => {
            const term = document.createElement('dt');
            term.textContent = label;
            const description = document.createElement('dd');
            description.textContent = value;
            values.append(term, description);
        };
        add('Ships', String(ships.length));
        add('Total CV', metrics.some(metric => !Number.isFinite(metric.cost)) ?
            'Unavailable — missing design or contents' : this.formatCost(sum(metric => metric.cost)));
        for (const resource of ['cargo', 'remass']) {
            const current = ships.reduce((total, ship) => total + this.number(ship.stores?.[resource]), 0);
            add(resource === 'cargo' ? 'Cargo' : 'Remass',
                `${this.format(current)} / ${missing ? 'Unavailable' : this.format(sum(metric => metric.storesMaxima[resource]))}`);
        }
        for (const [label, capacity, extra, usedExtra] of [
            ['Troops / Berths', 'berths', null, null],
            ['Munitions / Cells', 'magazineCells', 'cells', 'adapterCells'],
            ['Craft / Bays', 'hangarBays', 'bays', 'clampBays']
        ]) {
            add(label, missing || metrics.some(metric => metric.contentsValid === false) ?
                'Unavailable — missing design or contents' :
                `${this.format(sum(metric => metric.used[capacity] + (usedExtra ? this.number(metric.used[usedExtra]) : 0)))} / ${this.format(sum(metric =>
                    metric.capacities[capacity] + (extra ? this.number(metric.deviceResources[extra]) : 0)))}`);
        }
        add('Hardpoints', missing ? 'Unavailable' : this.format(sum(metric => metric.capacities.hardpoints)));
        add('Jumpium Capacity', missing ? 'Unavailable' : this.format(sum(metric => metric.jumpiumCapacity)));
        const eligible = metrics.filter(metric => !metric.missing &&
            metric.quantum.navigation >= 2 && Number.isFinite(metric.jumpDistance));
        add('Maximum Jump Distance', eligible.length ? this.format(Math.max(...eligible.map(metric => metric.jumpDistance))) :
            'Unavailable — no ship with at least 2 navigation systems');
        const consumption = sum(metric => metric.consumption);
        let endurance;
        if (!ships.length) endurance = 'Unavailable — no ships';
        else if (missing) endurance = 'Unavailable — missing design';
        else if (metrics.some(metric => !Number.isFinite(metric.consumption))) endurance = 'Unavailable — unknown consumption';
        else if (consumption <= 0) endurance = 'No consumption';
        else if (metrics.some(metric => metric.hasTending)) {
            const currentCargo = ships.reduce((total, ship) => total + this.number(ship.stores?.cargo), 0);
            endurance = this.format(Math.floor((currentCargo + sum(metric => metric.berthingCargo)) / consumption));
        } else {
            const finite = metrics.map(metric => metric.endurance).filter(Number.isFinite);
            endurance = finite.length ? this.format(Math.min(...finite)) : 'Unavailable';
        }
        add('Endurance', endurance);
        summary.appendChild(values);
        if (missing) {
            const warning = document.createElement('p');
            warning.className = 'fleet-summary-warning';
            warning.textContent = 'Missing designs — totals unavailable.';
            summary.appendChild(warning);
        }
        if (metrics.some(metric => metric.contentsValid === false)) {
            const warning = document.createElement('p');
            warning.className = 'fleet-summary-warning';
            warning.textContent = 'Unresolved contents — CV and occupied resources unavailable.';
            summary.appendChild(warning);
        }
        const breakdown = document.createElement('details');
        const breakdownKey = `summary:${this.selectedTaskForceId}`;
        breakdown.open = this.expansion.get(breakdownKey) === true;
        breakdown.addEventListener('toggle', () => this.expansion.set(breakdownKey, breakdown.open));
        const heading = document.createElement('summary');
        heading.textContent = 'Contents, devices and per-ship quantum capabilities';
        breakdown.appendChild(heading);
        for (const type of ['troops', 'munitions', 'craft']) {
            const totals = new Map();
            for (const metric of metrics) {
                for (const entry of metric.contentsByType[type] || []) {
                    const existing = totals.get(entry.id) || { name: entry.name, count: 0 };
                    existing.count += this.number(entry.count);
                    totals.set(entry.id, existing);
                }
            }
            const line = document.createElement('p');
            line.textContent = `${{ troops: 'Troops', munitions: 'Munitions', craft: 'Craft' }[type]}: ` +
                (totals.size ? [...totals.values()].map(entry => `${entry.name} × ${this.format(entry.count)}`).join(', ') : 'None');
            breakdown.appendChild(line);
        }
        const resourceLabels = {
            adapters: 'Adapters', cells: 'Adapter Cells', clamps: 'Clamps', bays: 'Clamp Bays',
            cradles: 'Cradles', jumpium: 'Cradle Jumpium', fixtures: 'Fixtures', mounts: 'Mounts',
            grapples: 'Grapples', grapple: 'Grapple', survey: 'Survey',
            zParticleSails: 'Z-Particle Sails', laserFoci: 'Laser Foci'
        };
        const deviceLine = document.createElement('p');
        deviceLine.textContent = 'Devices: ' + (Object.entries(resourceLabels).map(([key, label]) => {
            const value = sum(metric => metric.deviceResources[key]);
            return value ? `${label} ${this.format(value)}` : null;
        }).filter(Boolean).join(' · ') || 'None');
        breakdown.appendChild(deviceLine);
        ships.forEach((ship, index) => {
            const metric = metrics[index];
            if (metric.missing) return;
            const capabilities = (metric.quantumCapabilities || []).map(([label, value]) =>
                `${label} ${this.format(value)}`);
            if (!capabilities.length) return;
            const line = document.createElement('p');
            line.textContent = `${ship.name || 'Unnamed Ship'}: ${capabilities.join(' · ')}`;
            breakdown.appendChild(line);
        });
        summary.appendChild(breakdown);
        return summary;
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
            this.assignShip(ship.id, assignmentSelect.value || null);
        });
        assignmentLabel.appendChild(assignmentSelect);

        fields.append(nameField, roleField, assignmentLabel);

        const stores = document.createElement('div');
        stores.className = 'fleet-ship-stores';
        stores.append(
            this.createStoreRow('Cargo', ship.stores.cargo, maxima.cargo),
            this.createStoreRow('Remass', ship.stores.remass, maxima.remass)
        );
        const capabilities = document.createElement('dl');
        capabilities.className = 'fleet-ship-capabilities';
        capabilities.setAttribute('aria-label', 'Ship quantum capabilities');
        if (!missing) {
            for (const [label, value] of this.getMetrics(ship).quantumCapabilities || []) {
                const term = document.createElement('dt');
                term.textContent = label;
                const description = document.createElement('dd');
                description.textContent = this.format(value);
                capabilities.append(term, description);
            }
        }

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
        removeButton.addEventListener('click', () => this.deleteShip(ship));
        actions.appendChild(removeButton);

        card.append(heading, subtitle, fields, stores);
        if (this.getMetrics(ship).contentsValid === false) {
            const warning = document.createElement('p');
            warning.className = 'fleet-summary-warning';
            warning.textContent = 'Unresolved contents — CV and occupied resources unavailable.';
            card.appendChild(warning);
        }
        if (capabilities.children.length) card.appendChild(capabilities);
        card.appendChild(actions);
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
        value.textContent = `${this.format(current)} / ${this.format(max)}`;
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
        if (this.getShipStatus(ship).missing) return;
        const maxima = this.getStoresMaxima(ship);
        ship.stores ||= { cargo: 0, remass: 0 };
        ship.stores.cargo = maxima.cargo;
        ship.stores.remass = maxima.remass;
    }

    // --- Inventory -----------------------------------------------------------

    renderInventory(list) {
        list.replaceChildren();
        const unassignedShips = this.getGroupShips(null);
        const unassigned = this.createInventoryCategory('unassigned', 'Unassigned Ships', true,
            unassignedShips.length);
        this.makeDropTarget(unassigned.group, null);
        unassigned.header.appendChild(this.createSelectForceButton(null, 'Unassigned Ships'));
        for (const ship of unassignedShips) unassigned.content.appendChild(this.createInventoryRow(ship));
        if (!unassignedShips.length) unassigned.content.appendChild(this.emptyInventory('No unassigned ships.'));
        list.appendChild(unassigned.group);
        const assignedCount = this.empire.fleetShips.length - unassignedShips.length;
        const forces = this.createInventoryCategory('forces', 'Task Forces', true, assignedCount);
        for (const force of this.empire.taskForces) {
            const ships = this.getGroupShips(force.id);
            const category = this.createInventoryCategory(`force:${force.id}`, force.name, false, ships.length);
            category.group.classList.toggle('selected', this.selectedTaskForceId === force.id);
            category.header.appendChild(this.createSelectForceButton(force.id, force.name));
            this.makeDropTarget(category.group, force.id);
            for (const ship of ships) category.content.appendChild(this.createInventoryRow(ship));
            if (!ships.length) category.content.appendChild(this.emptyInventory('No ships assigned.'));
            forces.content.appendChild(category.group);
        }
        if (!this.empire.taskForces.length) forces.content.appendChild(this.emptyInventory('No task forces yet.'));
        list.appendChild(forces.group);
    }

    emptyInventory(text) {
        const paragraph = document.createElement('p');
        paragraph.className = 'fleet-empty-state';
        paragraph.textContent = text;
        return paragraph;
    }

    createInventoryCategory(key, title, supercategory, count) {
        const prefix = supercategory ? 'tech-supercategory' : 'tech-category';
        const group = document.createElement('section');
        group.className = `${prefix} fleet-inventory-category`;
        if (key === 'unassigned') group.classList.toggle('selected', this.selectedTaskForceId === null);
        const expanded = this.expansion.get(key) !== false;
        group.classList.toggle('expanded', expanded);
        const header = document.createElement('header');
        header.className = `${prefix}-header`;
        const container = document.createElement('div');
        container.className = `${prefix}-content`;
        const content = document.createElement('div');
        content.className = `${prefix}-content-inner`;
        const toggle = this.button(`${expanded ? '▾' : '▸'} ${title} (${count})`, () => {
            const next = !group.classList.contains('expanded');
            this.expansion.set(key, next);
            group.classList.toggle('expanded', next);
            toggle.textContent = `${next ? '▾' : '▸'} ${title} (${count})`;
            toggle.setAttribute('aria-expanded', String(next));
        }, 'fleet-category-toggle');
        toggle.setAttribute('aria-expanded', String(expanded));
        header.appendChild(toggle);
        container.appendChild(content);
        group.append(header, container);
        return { group, header, content };
    }

    createSelectForceButton(id, name) {
        const button = this.button('↗', () => this.selectTaskForce(id), 'fleet-force-select');
        button.title = `View ${name} in main panel`;
        button.setAttribute('aria-label', `View ${name} in main panel`);
        button.setAttribute('aria-pressed', String(this.selectedTaskForceId === id));
        return button;
    }

    createInventoryRow(ship) {
        const { classWidget, outfitWidget, missing } = this.getShipStatus(ship);
        const row = document.createElement('article');
        row.className = 'fleet-inventory-ship';
        if (missing) row.classList.add('fleet-ship-missing');
        row.dataset.fleetShipId = ship.id;
        row.classList.toggle('selected', this.selectedShipIds.has(ship.id));
        this.makeDraggable(row, ship);
        const select = event => this.selectShips(ship.id, event, this.getInventorySelectionOrder(), 'inventory');
        row.addEventListener('click', event => {
            if (!event.target.closest('button, input, select, a')) select(event);
        });
        const identity = this.button('', event => {
            select(event);
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;
            this.selectedShipId = ship.id;
            this.selectTaskForce(this.empire.taskForces.some(force => force.id === ship.taskForceId)
                ? ship.taskForceId : null);
        }, 'fleet-inventory-identity');
        identity.setAttribute('aria-pressed', String(this.selectedShipIds.has(ship.id)));
        const title = document.createElement('strong');
        title.textContent = `${classWidget?.shipData?.name || 'Missing class'} · ${outfitWidget?.outfitData?.name || 'Missing outfit'}`;
        const subtitle = document.createElement('span');
        subtitle.textContent = ship.name || 'Unnamed Ship';
        identity.append(title, subtitle);
        const cost = document.createElement('span');
        cost.className = 'fleet-inventory-cost';
        cost.textContent = `${this.formatCost(this.getMetrics(ship).cost)} CV`;
        row.append(identity, cost);
        this.attachPanelTilesHover(row, ship);
        return row;
    }

    // Inventory hover: the diagram sits just right of the inventory panel and
    // follows only the cursor's vertical position.
    attachPanelTilesHover(row, ship) {
        const panelRight = () =>
            (document.getElementById('fleetInventoryPanel') || row).getBoundingClientRect().right + 2;
        const position = event => this.positionTilesTooltip(event.clientX, event.clientY, panelRight());
        row.addEventListener('mouseenter', event => {
            if (this.showTilesTooltip(ship)) position(event);
        });
        row.addEventListener('mousemove', position);
        row.addEventListener('mouseleave', () => this.hideTilesTooltip());
    }

    deleteShip(ship) {
        if (!window.confirm(`Delete ${ship.name || 'Unnamed Ship'}? This cannot be undone.`)) return false;
        this.empire.removeFleetShip(ship.id);
        if (this.selectedShipId === ship.id) this.selectedShipId = null;
        this.selectedShipIds.delete(ship.id);
        this.save();
        this.render();
        return true;
    }

    createTilesButton(ship) {
        const button = this.button('Tiles', () => {}, 'task-force-action fleet-tiles-button');
        button.disabled = this.getMetrics(ship).missing;
        button.setAttribute('aria-label', `Hull tiles for ${ship.name || 'Unnamed Ship'}`);
        const show = (x, y) => {
            const tooltip = this.showTilesTooltip(ship);
            if (tooltip) {
                button.setAttribute('aria-describedby', tooltip.id);
                this.positionTilesTooltip(x, y);
            }
        };
        button.addEventListener('mouseenter', event => show(event.clientX, event.clientY));
        button.addEventListener('mousemove', event => this.positionTilesTooltip(event.clientX, event.clientY));
        button.addEventListener('focus', () => {
            const rect = button.getBoundingClientRect();
            show(rect.right, rect.top + rect.height / 2);
        });
        for (const type of ['mouseleave', 'blur', 'mousedown']) {
            button.addEventListener(type, () => {
                button.removeAttribute('aria-describedby');
                this.hideTilesTooltip();
            });
        }
        return button;
    }

    // Builds the same tile diagram as the Design view's Hull Tiles widget
    // from the ship's outfit and its parent class/core designs.
    getHullTilesComponents(ship) {
        const types = { ship: 'Class', shipCore: 'Core', outfit: 'Outfit' };
        const components = [];
        const visited = new Set();
        const add = (widget, inputType) => {
            if (!widget || visited.has(widget.id) || typeof widget.getSerializedData !== 'function') return;
            visited.add(widget.id);
            components.push({
                inputType,
                sourceWidgetId: widget.id,
                sourceWidgetType: widget.type,
                sourceWidgetTitle: widget.title,
                data: widget.getSerializedData()
            });
            for (const parentId of widget.parents || []) {
                const parent = window.widgetManager?.getWidget(parentId);
                if (types[parent?.type]) add(parent, types[parent.type]);
            }
        };
        add(this.getClassWidget(ship), 'Class');
        add(this.getOutfitWidget(ship), 'Outfit');
        return components;
    }

    showTilesTooltip(ship) {
        if (this.getMetrics(ship).missing) return null;
        let tooltip = this.tilesTooltip;
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'fleetTilesTooltip';
            tooltip.className = 'fleet-tiles-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            this.tilesTooltip = tooltip;
        }
        const plan = document.createElement('div');
        plan.className = 'hull-plan-view';
        try {
            const renderer = Object.create(HullTilesWidget.prototype);
            renderer.renderPlan(plan, renderer.getModel(this.getHullTilesComponents(ship)));
        } catch (error) {
            plan.replaceChildren();
            const message = document.createElement('div');
            message.className = 'hull-plan-empty';
            message.textContent = `Hull tiles unavailable: ${error.message}`;
            plan.appendChild(message);
        }
        tooltip.replaceChildren(plan);
        if (!tooltip.isConnected) document.body.appendChild(tooltip);
        return tooltip;
    }

    // Floats beside the cursor (or, with anchorLeft, at a fixed left edge),
    // vertically centred on the cursor, and kept inside the viewport.
    positionTilesTooltip(x, y, anchorLeft = null) {
        const tooltip = this.tilesTooltip;
        if (!tooltip?.isConnected) return;
        const margin = 8;
        const offset = 16;
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        let left = anchorLeft ?? x + offset;
        if (anchorLeft == null && left + width > window.innerWidth - margin) left = x - offset - width;
        left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
        const top = Math.max(margin, Math.min(y - height / 2, window.innerHeight - margin - height));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    hideTilesTooltip() {
        this.tilesTooltip?.remove();
    }

    makeDraggable(element, ship) {
        element.draggable = true;
        element.title = 'Drag to a task force or Unassigned Ships to transfer';
        element.addEventListener('dragstart', event => {
            this.hideTilesTooltip();
            if (!this.selectedShipIds.has(ship.id)) {
                this.selectedShipIds.clear();
                this.selectedShipIds.add(ship.id);
                this.syncShipSelection();
            }
            this.draggedShipId = ship.id;
            this.draggedShipIds = [...this.selectedShipIds];
            event.dataTransfer.setData('application/x-fv-fleet-ships', JSON.stringify(this.draggedShipIds));
            event.dataTransfer.setData('application/x-fv-fleet-ship', ship.id);
            event.dataTransfer.setData('text/plain', ship.id);
            event.dataTransfer.effectAllowed = 'move';
            element.classList.add('fleet-dragging');
        });
        element.addEventListener('dragend', () => {
            this.draggedShipId = null;
            this.draggedShipIds = null;
            element.classList.remove('fleet-dragging');
            document.querySelectorAll('#fleetView .fleet-drop-active').forEach(target =>
                target.classList.remove('fleet-drop-active'));
        });
    }

    makeDropTarget(element, taskForceId) {
        const isFleetDrag = event => this.draggedShipId ||
            Array.from(event.dataTransfer?.types || []).some(type =>
                ['application/x-fv-fleet-ship', 'application/x-fv-fleet-ships'].includes(type));
        element.addEventListener('dragover', event => {
            if (!isFleetDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            element.classList.add('fleet-drop-active');
        });
        element.addEventListener('dragleave', event => {
            if (!element.contains(event.relatedTarget)) element.classList.remove('fleet-drop-active');
        });
        element.addEventListener('drop', event => {
            if (!isFleetDrag(event)) return;
            event.preventDefault();
            event.stopPropagation();
            const payload = event.dataTransfer.getData('application/x-fv-fleet-ships');
            let shipIds;
            try {
                shipIds = payload ? JSON.parse(payload) : this.draggedShipIds ||
                    [event.dataTransfer.getData('application/x-fv-fleet-ship') || this.draggedShipId];
            } catch (error) {
                this.app.showNotification(`Unable to assign ships: ${error.message}`, 'error');
                this.draggedShipId = null;
                this.draggedShipIds = null;
                element.classList.remove('fleet-drop-active');
                return;
            }
            this.draggedShipId = null;
            this.draggedShipIds = null;
            element.classList.remove('fleet-drop-active');
            this.assignShips(shipIds, taskForceId);
        });
    }

    assignShip(shipId, taskForceId) {
        this.assignShips([shipId], taskForceId);
    }

    assignShips(shipIds, taskForceId) {
        try {
            this.empire.assignFleetShips(shipIds, taskForceId);
            this.save();
        } catch (error) {
            this.app.showNotification(`Unable to assign ships: ${error.message}`, 'error');
        }
        this.render();
    }

    // --- Actions -------------------------------------------------------------

    addTaskForce() {
        const force = this.empire.addTaskForce();
        if (force?.id) this.selectedTaskForceId = force.id;
        this.save();
        this.render();
    }
}
