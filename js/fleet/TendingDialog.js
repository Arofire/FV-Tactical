// Tending distribution dialog: a ship with the Tending system redistributes
// its cargo/remass stores to the other ships in its task force. Each resource
// has a configurable default strategy; per-ship sliders (with lock checkboxes)
// set final target amounts.
class TendingDialog {
    constructor(app, tender) {
        this.app = app;
        this.tender = tender;
        this.targets = [];
        // Per resource: { budget, state: Map<shipId, {final, max, current, locked}> }
        this.resources = {};
    }

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    static open(app, tender) {
        const dialog = new TendingDialog(app, tender);
        dialog.show();
    }

    resolveTargets() {
        const ships = this.app.empire.getTaskForceShips(this.tender.taskForceId)
            .filter(ship => ship.id !== this.tender.id);
        const resolved = [];
        for (const ship of ships) {
            const classWidget = window.widgetManager?.getWidget(ship.classWidgetId);
            const outfitWidget = window.widgetManager?.getWidget(ship.outfitWidgetId);
            if (classWidget?.type !== 'ship' || outfitWidget?.type !== 'outfit') continue;
            resolved.push({ ship, classWidget, outfitWidget });
        }
        return resolved;
    }

    show() {
        this.targets = this.resolveTargets();
        if (this.targets.length === 0) {
            this.app.showNotification('No other ships with intact designs in this task force.', 'warning');
            return;
        }

        for (const resource of ['cargo', 'remass']) {
            const state = new Map();
            for (const target of this.targets) {
                const maxima = ShipCapacity.getStoresMaxima(target.classWidget);
                state.set(target.ship.id, {
                    final: target.ship.stores[resource],
                    current: target.ship.stores[resource],
                    max: maxima[resource],
                    locked: false
                });
            }
            this.resources[resource] = {
                budget: this.tender.stores[resource] +
                    this.targets.reduce((sum, target) => sum + target.ship.stores[resource], 0),
                state
            };
            this.applyDefaults(resource);
        }

        const { backdrop, dialog, close } = ShipBuilder.createModal(
            `Tend Task Force — ${this.tender.name || 'Unnamed Ship'}`
        );
        dialog.classList.add('ship-builder-dialog', 'tending-dialog');

        const description = document.createElement('p');
        description.textContent =
            'Distribute stores from the tending ship. Sliders set each ship\'s final amount; ' +
            'locked values are left untouched when other ships are reconfigured.';
        dialog.appendChild(description);

        this.resourceRows = { cargo: new Map(), remass: new Map() };
        this.poolLabels = {};

        for (const resource of ['cargo', 'remass']) {
            dialog.appendChild(this.createResourceSection(resource));
        }

        const footer = document.createElement('div');
        footer.className = 'ship-builder-footer';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', close);
        const confirmButton = document.createElement('button');
        confirmButton.type = 'button';
        confirmButton.className = 'ship-builder-confirm';
        confirmButton.textContent = 'Confirm Distribution';
        confirmButton.addEventListener('click', () => {
            this.confirm();
            close();
        });
        footer.append(cancelButton, confirmButton);
        dialog.appendChild(footer);
        this.confirmButton = confirmButton;

        this.refreshAll();
    }

    // Participant descriptors for the tender plus every target ship. The
    // tender participates in the default strategies so its retained share is
    // also equalized/prioritized, not just the residual.
    getParticipants(resource) {
        const participants = [];
        const tenderClass = window.widgetManager?.getWidget(this.tender.classWidgetId);
        const tenderOutfit = window.widgetManager?.getWidget(this.tender.outfitWidgetId);
        const add = (ship, classWidget, outfitWidget, isTender) => {
            const state = this.resources[resource].state.get(ship.id);
            participants.push({
                shipId: ship.id,
                isTender,
                max: isTender
                    ? ShipCapacity.getStoresMaxima(classWidget)[resource]
                    : state.max,
                current: ship.stores[resource],
                consumption: ShipCapacity.getConsumption(classWidget),
                berthingCargo: ShipCapacity.getBerthingCargo(outfitWidget),
                demand: ShipCapacity.getMaxRemassPerBurn(classWidget, outfitWidget)
            });
        };
        add(this.tender, tenderClass, tenderOutfit, true);
        for (const target of this.targets) add(target.ship, target.classWidget, target.outfitWidget, false);
        return participants;
    }

    // Default allocations over all ships (ignoring locks), per strategy:
    // - remass: refill ships with gear burns, highest burn demand first
    // - cargo: equalize endurance across ships that consume cargo
    applyDefaults(resource) {
        const resourceData = this.resources[resource];
        const allocations = resource === 'remass'
            ? this.allocateRemass(resourceData.budget, this.getParticipants(resource))
            : this.allocateCargo(resourceData.budget, this.getParticipants(resource));
        for (const [shipId, value] of allocations) {
            const entry = resourceData.state.get(shipId);
            if (entry) entry.final = value;
        }
    }

    // Ships without gear burns keep their current remass; the rest are filled
    // to capacity in order of highest per-burn remass demand.
    allocateRemass(pool, participants) {
        const allocations = new Map();
        const active = [];
        for (const participant of participants) {
            if (participant.demand > 0 && participant.max > 0) {
                active.push(participant);
            } else {
                allocations.set(participant.shipId, participant.current);
            }
        }
        // Highest burn demand first; the tender fills last so it distributes
        // to the task force rather than draining ships to refill itself.
        active.sort((a, b) => (b.demand - a.demand) || (a.isTender ? 1 : 0) - (b.isTender ? 1 : 0));
        let remaining = pool - [...allocations.values()].reduce((sum, value) => sum + value, 0);
        for (const participant of active) {
            const value = Math.max(0, Math.min(participant.max, remaining));
            allocations.set(participant.shipId, value);
            remaining -= value;
        }
        return allocations;
    }

    // Water-filling: find the highest endurance T such that the cargo needed
    // to bring every consumer to T fits the budget. Ships with no consumption
    // keep their current cargo.
    allocateCargo(pool, participants) {
        const allocations = new Map();
        const active = [];
        for (const participant of participants) {
            if (participant.consumption > 0 && participant.max > 0) {
                active.push(participant);
            } else {
                allocations.set(participant.shipId, participant.current);
            }
        }
        const remaining = pool - [...allocations.values()].reduce((sum, value) => sum + value, 0);
        const neededFor = (participant, endurance) => Math.max(0, Math.min(
            participant.max,
            endurance * participant.consumption - participant.berthingCargo
        ));
        let low = 0;
        let high = active.reduce((max, participant) =>
            Math.max(max, (participant.max + participant.berthingCargo) / participant.consumption), 0) || 1;
        for (let iteration = 0; iteration < 60; iteration++) {
            const mid = (low + high) / 2;
            const needed = active.reduce((sum, participant) => sum + neededFor(participant, mid), 0);
            if (needed <= remaining) low = mid;
            else high = mid;
        }
        for (const participant of active) {
            allocations.set(participant.shipId, Math.floor(neededFor(participant, low)));
        }
        return allocations;
    }

    // After a slider moves, redistribute the remaining budget among unlocked
    // ships (plus the tender's retained share) using the default strategy.
    rebalance(resource, fixedShipId) {
        const resourceData = this.resources[resource];
        const fixed = [];
        let committed = 0;
        for (const [shipId, entry] of resourceData.state) {
            if (entry.locked || shipId === fixedShipId) {
                fixed.push(shipId);
                committed += entry.final;
            }
        }
        const participants = this.getParticipants(resource)
            .filter(participant => participant.isTender || !fixed.includes(participant.shipId));
        const remaining = Math.max(0, resourceData.budget - committed);
        const allocations = resource === 'remass'
            ? this.allocateRemass(remaining, participants)
            : this.allocateCargo(remaining, participants);
        for (const [shipId, value] of allocations) {
            const entry = resourceData.state.get(shipId);
            if (entry) entry.final = value;
        }
    }

    createResourceSection(resource) {
        const section = document.createElement('section');
        section.className = 'tending-resource-section';

        const header = document.createElement('h3');
        const label = resource === 'cargo' ? 'Cargo' : 'Remass';
        const poolLabel = document.createElement('span');
        poolLabel.className = 'tending-pool';
        header.textContent = `${label} — `;
        header.appendChild(poolLabel);
        this.poolLabels[resource] = poolLabel;
        section.appendChild(header);

        for (const target of this.targets) {
            const entry = this.resources[resource].state.get(target.ship.id);
            const row = document.createElement('div');
            row.className = 'tending-row';

            const name = document.createElement('span');
            name.className = 'tending-ship-name';
            name.textContent = target.ship.name || 'Unnamed Ship';

            const currentLabel = document.createElement('span');
            currentLabel.className = 'tending-current';
            currentLabel.textContent = `${entry.current} / ${entry.max}`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = String(entry.max);
            slider.step = '1';
            slider.value = String(entry.final);
            slider.setAttribute('aria-label', `${label} for ${target.ship.name || 'ship'}`);

            const valueLabel = document.createElement('span');
            valueLabel.className = 'tending-value';
            valueLabel.textContent = `${entry.final}`;

            const lockLabel = document.createElement('label');
            lockLabel.className = 'tending-lock';
            const lockCheckbox = document.createElement('input');
            lockCheckbox.type = 'checkbox';
            lockCheckbox.checked = entry.locked;
            lockCheckbox.addEventListener('change', () => {
                entry.locked = lockCheckbox.checked;
            });
            lockLabel.append(lockCheckbox, ' Lock');

            slider.addEventListener('input', () => {
                entry.final = Math.max(0, Math.min(entry.max, Number(slider.value) || 0));
                valueLabel.textContent = `${entry.final}`;
                this.rebalance(resource, target.ship.id);
                this.refreshResource(resource);
            });

            this.resourceRows[resource].set(target.ship.id, { slider, valueLabel });
            row.append(name, currentLabel, slider, valueLabel, lockLabel);
            section.appendChild(row);
        }
        return section;
    }

    tenderRetains(resource) {
        const resourceData = this.resources[resource];
        const allocated = [...resourceData.state.values()].reduce((sum, entry) => sum + entry.final, 0);
        return resourceData.budget - allocated;
    }

    refreshResource(resource) {
        const resourceData = this.resources[resource];
        for (const target of this.targets) {
            const entry = resourceData.state.get(target.ship.id);
            const row = this.resourceRows[resource].get(target.ship.id);
            if (row && row.slider !== document.activeElement) {
                row.slider.value = String(entry.final);
            }
            if (row) row.valueLabel.textContent = `${entry.final}`;
        }
        const retains = this.tenderRetains(resource);
        this.poolLabels[resource].textContent = `tender retains ${retains}`;
        this.poolLabels[resource].classList.toggle('over-capacity', retains < 0);
        if (this.confirmButton) {
            this.confirmButton.disabled =
                this.tenderRetains('cargo') < 0 || this.tenderRetains('remass') < 0;
        }
    }

    refreshAll() {
        this.refreshResource('cargo');
        this.refreshResource('remass');
    }

    confirm() {
        for (const resource of ['cargo', 'remass']) {
            const retains = Math.max(0, this.tenderRetains(resource));
            const tenderMaxima = ShipCapacity.getStoresMaxima(
                window.widgetManager?.getWidget(this.tender.classWidgetId)
            );
            // Stores returning to the tender beyond its own capacity are lost.
            this.tender.stores[resource] = Math.min(tenderMaxima[resource], retains);
            for (const target of this.targets) {
                const entry = this.resources[resource].state.get(target.ship.id);
                target.ship.stores[resource] = Math.max(0, Math.min(entry.max, entry.final));
            }
        }
        this.app.saveEmpire();
        this.app.updateFleetView();
        this.app.showNotification('Stores redistributed.', 'success');
    }
}
