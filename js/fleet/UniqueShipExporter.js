class UniqueShipExporter {
    static STORE_LIMIT = 5;
    static WEAPON_LIMIT = 6;
    static TROOP_LIMIT = 5;
    static HULL_ROWS_ABOVE = 15;
    static HULL_ROWS_BELOW = 6;

    constructor(app) {
        this.app = app;
    }

    static getWidget(id) {
        return id ? window.widgetManager?.getWidget(id) || null : null;
    }

    static getFormFieldNames() {
        const names = ['Player', 'ClassOutfit', 'ShipName', 'CombatValue'];
        for (let index = 1; index <= 13; index++) {
            names.push(
                `SpecificDamage${index}Name`,
                `SpecificDamage${index}Degraded`,
                `SpecificDamage${index}Damaged`,
                `SpecificDamage${index}Disabled`,
                `SpecificDamage${index}Destroyed`
            );
        }
        for (let index = 1; index <= this.STORE_LIMIT; index++) {
            names.push(`Store${index}Name`, `Store${index}Value`, `Store${index}Capacity`);
        }
        for (let index = 1; index <= this.HULL_ROWS_ABOVE + this.HULL_ROWS_BELOW; index++) {
            names.push(`HullGridRow${String(index).padStart(2, '0')}`);
        }
        const weaponColumns = [
            'Name', 'Tags', 'Arc', 'Type',
            'ShortHit', 'ShortDam', 'MediumHit', 'MediumDam',
            'LongHit', 'LongDam', 'FarHit', 'FarDam',
            'ExtremeHit', 'ExtremeDam', 'Charge', 'Expend'
        ];
        for (let index = 1; index <= this.WEAPON_LIMIT; index++) {
            weaponColumns.forEach(column => names.push(`Weapon${index}${column}`));
        }
        for (let index = 1; index <= this.TROOP_LIMIT; index++) {
            names.push(`Troop${index}Name`, `Troop${index}Formation`, `Troop${index}Count`);
        }
        for (let index = 1; index <= 4; index++) {
            names.push(`Burn${index}Remass`, `Burn${index}Instability`, `Burn${index}Expelled`);
        }
        names.push(
            'CoreInitiative', 'CoreInterval', 'CoreInstability', 'CoreExpelled',
            'Systems', 'Hardpoints', 'Features', 'ThrustDirection', 'QDefence'
        );
        for (let index = 1; index <= 6; index++) {
            names.push(
                `EntropyLevel${index}`,
                `EntropyCapacity${index}`,
                `EntropyRadiance${index}`
            );
        }
        names.push('RadiationPassive', 'RadiationActive', 'RadiationDeployed');
        return names;
    }

    static createEmptyFormFields() {
        return Object.fromEntries(this.getFormFieldNames().map(name => [name, null]));
    }

    static number(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    static numeric(value) {
        return Math.max(0, Math.floor(this.number(value)));
    }

    static blockTable(count, columns, code) {
        return SummaryWidget.prototype.blockTable.call(this, count, columns, code);
    }

    static optionalNumber(value) {
        if (value === undefined || value === null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    static formatWeaponRange(value) {
        return value === undefined || value === null || value === '' ? null : value;
    }

    static getWeaponNotes(weapon) {
        const notes = Array.isArray(weapon?.notes) ? weapon.notes : [];
        const findNote = name => notes.find(note =>
            String(note?.name || '').toLowerCase() === name.toLowerCase()
        );
        const chargeNote = findNote('Charge');
        const expendableNote = findNote('Expendable');
        return {
            charge: weapon?.charge ?? chargeNote?.value ?? null,
            expend: weapon?.expend ?? expendableNote?.value ?? null
        };
    }

    static getWeaponDefinitionMap(outfitWidget, catalogue) {
        const definitions = new Map();
        for (const weapon of outfitWidget?.getAllWeapons?.() || []) {
            if (weapon?.id) definitions.set(weapon.id, weapon);
        }
        for (const category of catalogue?.categories || []) {
            for (const weapon of category.weapons || []) {
                if (weapon?.id) {
                    definitions.set(weapon.id, {
                        ...weapon,
                        categoryName: category.name || ''
                    });
                }
            }
        }
        // Operational munition designs can fill hardpoint cells like catalogue weapons.
        for (const widget of window.widgetManager?.getAllWidgets?.() || []) {
            if (widget?.type === 'munitions' && widget.munitionData?.operational &&
                    typeof widget.toWeaponDefinition === 'function') {
                const definition = widget.toWeaponDefinition();
                if (definition.id) definitions.set(definition.id, definition);
            }
        }
        return definitions;
    }

    static addWeaponConfiguration(configurations, weapon, count, arc, turreted = false) {
        const quantity = Math.floor(this.number(count));
        if (!weapon || quantity < 1) return;
        const arcs = Array.from(new Set(
            String(arc || '').toUpperCase().split('').filter(value => 'FPSAO'.includes(value))
        )).sort((first, second) => 'FPSAO'.indexOf(first) - 'FPSAO'.indexOf(second));
        const key = JSON.stringify([weapon.id || weapon.weaponId || weapon.name, arcs, Boolean(turreted)]);
        const existing = configurations.get(key);
        if (existing) {
            existing.count += quantity;
            return;
        }
        configurations.set(key, {
            key,
            weapon,
            count: quantity,
            arcs,
            turreted: Boolean(turreted)
        });
    }

    static getWeaponConfigurations(ship, outfitWidget, weaponDefinitions) {
        const configurations = new Map();
        const outfit = outfitWidget?.outfitData || {};
        const weapons = outfit.weapons || {};
        const spinalId = typeof weapons.spinal === 'string'
            ? weapons.spinal
            : weapons.spinal?.weaponId || weapons.spinal?.id;
        if (spinalId) {
            const spinal = weaponDefinitions.get(spinalId) || {
                id: spinalId,
                name: spinalId,
                resourceType: 'emplacements'
            };
            this.addWeaponConfiguration(configurations, spinal, 1, 'F', false);
        }
        for (const [category, entries] of [
            ['offensive', Array.isArray(weapons.offensive) ? weapons.offensive : []],
            ['defensive', Array.isArray(weapons.defensive) ? weapons.defensive : []]
        ]) {
            for (const weapon of entries) {
                if (!weapon || (weapon.resourceType !== 'emplacements' &&
                    !(category === 'defensive' && weapon.resourceType === 'utilities'))) continue;
                const definition = weaponDefinitions.get(weapon.weaponId) || {
                    ...weapon,
                    id: weapon.weaponId,
                    name: weapon.name || weapon.weaponId
                };
                this.addWeaponConfiguration(
                    configurations,
                    definition,
                    weapon.count,
                    category === 'defensive' ? 'O' : weapon.arc,
                    weapon.isTurreted
                );
            }
        }
        for (const entry of ship.contents?.hardpoints || []) {
            const definition = weaponDefinitions.get(entry.weaponId) || {
                id: entry.weaponId,
                name: entry.weaponId || 'Unknown hardpoint weapon',
                resourceType: 'hardpoints'
            };
            this.addWeaponConfiguration(
                configurations,
                definition,
                entry.count,
                entry.arc,
                entry.turreted
            );
        }
        return Array.from(configurations.values());
    }

    static getTroopRows(ship) {
        const grouped = new Map();
        for (const entry of ship.contents?.berths || []) {
            const count = Math.floor(this.number(entry.count));
            if (count < 1) continue;
            const widget = this.getWidget(entry.id);
            const troop = widget?.type === 'troops' ? widget.troopData : null;
            const formations = (troop?.formations || []).map(id => {
                const formation = (widget.catalogues?.formations || []).find(item => item.id === id);
                return formation?.name || id;
            });
            const row = grouped.get(entry.id);
            if (row) row.count += count;
            else {
                grouped.set(entry.id, {
                    id: entry.id,
                    name: troop?.name || entry.id || 'Troop unit',
                    formation: formations.join(', '),
                    count
                });
            }
        }
        return Array.from(grouped.values());
    }

    static getStoreRows(ship, classWidget, hardpointCapacities, weaponDefinitions) {
        const classData = classWidget?.shipData || {};
        const composition = classData.hullComposition || {};
        const magazineCapacity = this.number(composition.magazine) * 25;
        const hasClassData = Boolean(classWidget?.shipData);
        const stores = [
            {
                name: 'Cargo',
                current: this.number(ship.stores?.cargo),
                capacity: hasClassData ? this.number(classData.resources?.cargo) : null,
                resourceType: 'cargo'
            },
            {
                name: 'Remass',
                current: this.number(ship.stores?.remass),
                capacity: hasClassData ? this.number(classData.resources?.remass) : null,
                resourceType: 'remass'
            }
        ];
        for (const entry of ship.contents?.magazine || []) {
            const count = Math.floor(this.number(entry.count));
            if (count < 1) continue;
            const munition = this.getWidget(entry.id);
            if (munition?.type !== 'munitions') {
                stores.push({
                    name: entry.id || 'Unknown munition',
                    current: count,
                    capacity: null,
                    resourceType: 'munition',
                    resourceId: entry.id
                });
                continue;
            }
            const cellsPerUnit = typeof munition.getMagazineCells === 'function'
                ? this.number(munition.getMagazineCells())
                : 0;
            stores.push({
                name: munition.munitionData?.name || entry.id,
                current: count,
                capacity: hasClassData && cellsPerUnit > 0
                    ? Math.floor(magazineCapacity / cellsPerUnit)
                    : null,
                resourceType: 'munition',
                resourceId: entry.id
            });
        }
        for (const entry of ship.contents?.hardpoints || []) {
            const weapon = weaponDefinitions.get(entry.weaponId);
            const expend = this.getWeaponNotes(weapon).expend;
            if (expend === null || expend === undefined || expend === '') continue;
            const count = Math.floor(this.number(entry.count));
            if (count < 1) continue;
            const resourceCount = Math.max(1, this.number(weapon?.resourceCount));
            const arcSurcharge = entry.turreted && String(entry.arc || '').length > 1 ? 1 : 0;
            const slotCost = resourceCount + arcSurcharge;
            stores.push({
                name: weapon?.name || entry.weaponId || 'Unknown hardpoint weapon',
                current: count,
                capacity: hasClassData && hardpointCapacities !== null && slotCost > 0
                    ? Math.floor(this.number(hardpointCapacities) / slotCost)
                    : null,
                resourceType: 'expendableHardpointWeapon',
                resourceId: entry.weaponId
            });
        }
        return stores;
    }

    static getHullGrid(classData, outfitData) {
        const composition = classData?.hullComposition || {};
        const counts = {
            Emplacement: this.number(composition.emplacement),
            Hangar: this.number(composition.hangar),
            Magazine: this.number(composition.magazine),
            System: this.number(composition.system),
            Freight: this.number(composition.freight),
            Tankage: this.number(composition.tankage),
            Core: this.number(composition.core)
        };
        const layout = SummaryWidget.prototype.createLayout.call(this, counts);
        const columns = Math.max(1, layout.cols);
        const armor = outfitData?.armorHits ??
            outfitData?.defenses?.armor ?? 0;
        const hardpoints = outfitData?.resources?.hardpoints ?? 0;
        const utilities = outfitData?.resources?.utilities ?? 0;
        const armorRows = SummaryWidget.prototype.buildArmorTable.call(
            this, armor, hardpoints, columns
        );
        const utilityRows = SummaryWidget.prototype.blockTable.call(
            this, utilities, columns, 'U'
        );
        const upperRows = armorRows.concat(utilityRows).map(row =>
            row.map(code => code || '')
        );
        const lowerRows = Array.from(
            { length: layout.rows },
            () => new Array(columns).fill('')
        );
        for (const cell of layout.cells) {
            lowerRows[cell.row][cell.col] = SummaryWidget.HULL_CODES[cell.category] || '';
        }
        return {
            upperRows,
            lowerRows,
            counts,
            columns,
            layout: {
                rows: layout.rows,
                columns: layout.cols,
                missingSlots: layout.missing
            }
        };
    }

    static getOutfitDeviceLines(outfitWidget) {
        if (typeof outfitWidget?.getHullPlanExportDevices === 'function') {
            const devices = outfitWidget.getHullPlanExportDevices();
            const format = entries => (entries || [])
                .filter(entry => entry?.name && this.number(entry.count) > 0)
                .map(entry => this.number(entry.count) > 1
                    ? `${entry.name} x${Math.floor(this.number(entry.count))}`
                    : entry.name);
            return {
                systems: format(devices.systems),
                utilities: format(devices.utilities)
            };
        }
        return { systems: [], utilities: [] };
    }

    static getRadiation(outfitData) {
        let passive = 0;
        let active = 0;
        let deployed = 0;
        for (const selection of Object.values(outfitData?.systems?.entropy || {})) {
            passive += this.number(selection?.radiance) * this.number(selection?.count);
        }
        for (const radiator of outfitData?.utilityDevices?.radiators || []) {
            const count = this.number(radiator.count);
            active += this.number(radiator.radiance) * count;
            deployed += this.number(radiator.deployed) * count;
        }
        return { passive, active, deployed };
    }

    static getEntropyValues(classData) {
        if (!classData?.hullComposition ||
            typeof classData.hullComposition !== 'object') {
            return { capacities: [], radiance: [] };
        }
        const composition = classData?.hullComposition || {};
        const capacity = 2 * (
            this.number(composition.emplacement) + this.number(composition.system)
        );
        const capacities = SummaryWidget.calculateEntropyBands(capacity) || [];
        let radianceValue = 0;
        return {
            capacities,
            radiance: capacities.map((current, index) => {
                const next = capacities[index + 1];
                if (next !== undefined && current < next) return radianceValue++;
                return 5;
            })
        };
    }

    static getShipResourceCost(widgets) {
        let value = 0;
        let found = false;
        const hasOutfit = widgets.some(widget => widget?.type === 'outfit');
        const units = window.empire?.economyMode === 'campaign'
            ? ['IP', 'MP', 'EP']
            : ['CV'];
        const visited = new Set();
        for (const widget of widgets) {
            if (!widget?.id || visited.has(widget.id)) continue;
            if (hasOutfit && widget.type === 'shipCore') continue;
            visited.add(widget.id);
            const costs = widget.getCostTotals?.() || {};
            for (const unit of units) {
                if (Number.isFinite(costs[unit])) {
                    value += costs[unit];
                    found = true;
                }
            }
        }
        return found ? value : null;
    }

    static async getExportData(ship, app) {
        const classWidget = this.getWidget(ship.classWidgetId);
        const outfitWidget = this.getWidget(ship.outfitWidgetId);
        const classData = classWidget?.type === 'ship' ? classWidget.shipData || {} : {};
        const outfitData = outfitWidget?.type === 'outfit' ? outfitWidget.outfitData || {} : {};
        const coreWidget = outfitWidget
            ? ShipCapacity.getCoreForOutfit(outfitWidget)
                || this.getWidget(outfitData.coreWidgetId)
            : null;
        const coreData = coreWidget?.coreData || outfitWidget?.getCoreData?.() ||
            outfitData.selectedCore || {};
        const weaponCatalogue = await ShipCapacity.ensureWeaponsData();
        const weaponDefinitions = this.getWeaponDefinitionMap(outfitWidget, weaponCatalogue);
        const weapons = this.getWeaponConfigurations(ship, outfitWidget, weaponDefinitions);
        const troops = this.getTroopRows(ship);
        const hardpointCapacity = outfitWidget
            ? outfitData.resources?.hardpoints ?? null
            : null;
        const stores = this.getStoreRows(ship, classWidget, hardpointCapacity, weaponDefinitions);
        const hullGrid = this.getHullGrid(classData, outfitData);
        const formFields = this.createEmptyFormFields();
        const warnings = [];

        if (!classWidget || !outfitWidget) {
            warnings.push('The ship class or outfit design is missing; unavailable design fields are blank.');
        }
        if (stores.length > this.STORE_LIMIT) {
            warnings.push(`The sheet shows ${this.STORE_LIMIT} of ${stores.length} store resources.`);
        }
        if (weapons.length > this.WEAPON_LIMIT) {
            warnings.push(`The sheet shows ${this.WEAPON_LIMIT} of ${weapons.length} weapon configurations.`);
        }
        if (troops.length > this.TROOP_LIMIT) {
            warnings.push(`The sheet shows ${this.TROOP_LIMIT} of ${troops.length} troop entries.`);
        }
        const missingTroopDesigns = (ship.contents?.berths || []).filter(entry =>
            this.number(entry.count) > 0 && this.getWidget(entry.id)?.type !== 'troops'
        );
        if (missingTroopDesigns.length) {
            warnings.push(
                `${missingTroopDesigns.length} troop design(s) could not be resolved; their Fleet counts remain in JSON.`
            );
        }
        const missingMunitions = (ship.contents?.magazine || []).filter(entry =>
            this.number(entry.count) > 0 && this.getWidget(entry.id)?.type !== 'munitions'
        );
        if (missingMunitions.length) {
            warnings.push(
                `${missingMunitions.length} munition design(s) could not be resolved; their names use Fleet IDs.`
            );
        }
        const missingHardpointWeapons = (ship.contents?.hardpoints || []).filter(entry =>
            this.number(entry.count) > 0 && !weaponDefinitions.has(entry.weaponId)
        );
        if (missingHardpointWeapons.length) {
            warnings.push(
                `${missingHardpointWeapons.length} hardpoint weapon definition(s) could not be resolved.`
            );
        }
        const selectedOutfitWeapons = [
            ...(Array.isArray(outfitData.weapons?.offensive)
                ? outfitData.weapons.offensive.filter(weapon =>
                    weapon?.resourceType === 'emplacements')
                : []),
            ...(Array.isArray(outfitData.weapons?.defensive)
                ? outfitData.weapons.defensive.filter(weapon =>
                    weapon?.resourceType === 'emplacements' ||
                    weapon?.resourceType === 'utilities')
                : [])
        ];
        const missingOutfitWeapons = selectedOutfitWeapons.filter(weapon =>
            !weaponDefinitions.has(weapon.weaponId)
        );
        if (missingOutfitWeapons.length) {
            warnings.push(
                `${missingOutfitWeapons.length} outfit weapon definition(s) could not be resolved; their detailed weapon fields may be blank.`
            );
        }
        if (hullGrid.upperRows.length > this.HULL_ROWS_ABOVE) {
            warnings.push(
                `The sheet shows ${this.HULL_ROWS_ABOVE} of ${hullGrid.upperRows.length} armor, hardpoint, and utility rows.`
            );
        }
        if (hullGrid.lowerRows.length > this.HULL_ROWS_BELOW) {
            warnings.push(
                `The sheet shows ${this.HULL_ROWS_BELOW} of ${hullGrid.lowerRows.length} ship hull rows.`
            );
        }
        if ((ship.contents?.hardpoints || []).length && !weaponCatalogue.categories.length) {
            throw new Error('The weapon catalogue could not be loaded to resolve this ship\'s hardpoint weapons.');
        }

        const className = classData.name || classWidget?.title || null;
        const outfitName = outfitData.name || outfitWidget?.title || null;
        const designs = [classWidget, outfitWidget, coreWidget].filter(Boolean);
        formFields.Player = app.empire?.name || null;
        formFields.ClassOutfit = [className, outfitName].filter(Boolean).join(' / ') || null;
        formFields.ShipName = ship.name || null;
        formFields.CombatValue = this.getShipResourceCost(designs);

        stores.slice(0, this.STORE_LIMIT).forEach((store, index) => {
            const row = index + 1;
            formFields[`Store${row}Name`] = store.name;
            formFields[`Store${row}Value`] = store.current;
            formFields[`Store${row}Capacity`] = store.capacity;
        });
        for (let index = 0; index < this.HULL_ROWS_ABOVE; index++) {
            const rowNumber = this.HULL_ROWS_ABOVE - index;
            const sourceIndex = hullGrid.upperRows.length - index - 1;
            formFields[`HullGridRow${String(rowNumber).padStart(2, '0')}`] =
                hullGrid.upperRows[sourceIndex]?.join('') || null;
        }
        for (let index = 0; index < this.HULL_ROWS_BELOW; index++) {
            const rowNumber = this.HULL_ROWS_ABOVE + index + 1;
            formFields[`HullGridRow${String(rowNumber).padStart(2, '0')}`] =
                hullGrid.lowerRows[index]?.join('') || null;
        }
        weapons.slice(0, this.WEAPON_LIMIT).forEach((configuration, index) => {
            const prefix = `Weapon${index + 1}`;
            const weapon = configuration.weapon;
            const notes = this.getWeaponNotes(weapon);
            const ranges = Array.isArray(weapon.ranges) ? weapon.ranges : [];
            const rangeNames = ['Short', 'Medium', 'Long', 'Far', 'Extreme'];
            const quantitySuffix = configuration.count > 1 ? ` x${configuration.count}` : '';
            const tags = [
                weapon.tagsDescription,
                configuration.turreted ? 'Turreted' : null
            ].filter(Boolean).join(', ');
            formFields[`${prefix}Name`] = `${weapon.name || 'Weapon'}${quantitySuffix}`;
            formFields[`${prefix}Tags`] = tags || null;
            formFields[`${prefix}Arc`] = configuration.arcs.join('');
            rangeNames.forEach((range, rangeIndex) => {
                formFields[`${prefix}${range}Hit`] =
                    this.formatWeaponRange(ranges[rangeIndex]?.accuracy);
                formFields[`${prefix}${range}Dam`] =
                    this.formatWeaponRange(ranges[rangeIndex]?.damage);
            });
            formFields[`${prefix}Expend`] = notes.expend;
        });
        troops.slice(0, this.TROOP_LIMIT).forEach((troop, index) => {
            const prefix = `Troop${index + 1}`;
            formFields[`${prefix}Name`] = troop.name;
            formFields[`${prefix}Formation`] = troop.formation || null;
            formFields[`${prefix}Count`] = troop.count;
        });

        const burnAnalysis = outfitWidget?.getGearBurnAnalysis?.(coreData);
        for (let index = 0; index < 4; index++) {
            const gear = burnAnalysis?.gears?.[index];
            if (!gear) continue;
            formFields[`Burn${index + 1}Remass`] = gear.remassPerBurn;
            formFields[`Burn${index + 1}Instability`] = gear.instability;
            const useful = this.optionalNumber(gear.useful);
            formFields[`Burn${index + 1}Expelled`] =
                useful === null ? null : Math.floor(useful);
        }
        const devices = this.getOutfitDeviceLines(outfitWidget);
        const systemsCount = outfitData.resources?.systems;
        const radiation = this.getRadiation(outfitData);
        const entropy = this.getEntropyValues(classData);
        formFields.Systems = devices.systems.join('\n') || (systemsCount ?? null);
        formFields.Hardpoints = (ship.contents?.hardpoints || [])
            .map(entry => {
                const weapon = weaponDefinitions.get(entry.weaponId);
                if (!weapon) return null;
                const arc = entry.arc ? ` ${entry.arc}` : '';
                const turreted = entry.turreted ? ' Turreted' : '';
                const count = this.number(entry.count) > 1 ? ` x${this.number(entry.count)}` : '';
                return `${weapon.name}${arc}${turreted}${count}`;
            })
            .filter(Boolean)
            .join('\n') || (hardpointCapacity ?? null);
        formFields.Features = Object.entries(classData.foundations || {})
            .filter(([, enabled]) => Boolean(enabled))
            .map(([key]) => classWidget?.foundationLabels?.[key] || key)
            .join(', ') || null;
        entropy.capacities.forEach((value, index) => {
            formFields[`EntropyCapacity${index + 1}`] = value;
        });
        entropy.radiance.forEach((value, index) => {
            formFields[`EntropyRadiance${index + 1}`] = value;
        });
        formFields.RadiationPassive = radiation.passive || null;
        formFields.RadiationActive = radiation.active || null;
        formFields.RadiationDeployed = radiation.deployed || null;

        const intentionallyBlankFields = new Set([
            ...Array.from({ length: 13 }, (_, index) => {
                const prefix = `SpecificDamage${index + 1}`;
                return [
                    `${prefix}Name`,
                    `${prefix}Degraded`,
                    `${prefix}Damaged`,
                    `${prefix}Disabled`,
                    `${prefix}Destroyed`
                ];
            }).flat(),
            ...Array.from({ length: this.WEAPON_LIMIT }, (_, index) => [
                `Weapon${index + 1}Type`,
                `Weapon${index + 1}Charge`
            ]).flat(),
            ...Array.from({ length: 6 }, (_, index) => `EntropyLevel${index + 1}`)
        ]);
        const unavailableFormFields = Object.entries(formFields)
            .filter(([name, value]) =>
                value === null && !intentionallyBlankFields.has(name)
            )
            .map(([name]) => name);
        if (unavailableFormFields.length) {
            warnings.push(
                `${unavailableFormFields.length} sheet field(s) have no available Fleet or design value; see unavailableFormFields in JSON.`
            );
        }
        return {
            schema: 'fv-tactical.unique-ship/v1',
            ship: {
                id: ship.id,
                name: ship.name || null,
                role: ship.role || null,
                taskForce: app.empire?.taskForces
                    ?.find(force => force.id === ship.taskForceId)?.name || null,
                classWidgetId: ship.classWidgetId || null,
                outfitWidgetId: ship.outfitWidgetId || null,
                stores: { ...(ship.stores || {}) },
                contents: ShipBuilder.cloneContents(ship.contents || ShipBuilder.emptyContents())
            },
            design: {
                class: classData,
                outfit: outfitData,
                core: coreData
            },
            stores,
            troops,
            weapons: weapons.map(configuration => ({
                id: configuration.weapon.id || configuration.weapon.weaponId || null,
                name: configuration.weapon.name || 'Weapon',
                count: configuration.count,
                arcs: configuration.arcs,
                turreted: configuration.turreted,
                resourceType: configuration.weapon.resourceType || null,
                details: {
                    tags: [
                        configuration.weapon.tagsDescription,
                        configuration.turreted ? 'Turreted' : null
                    ].filter(Boolean).join(', ') || null,
                    ranges: configuration.weapon.ranges || [],
                    expend: this.getWeaponNotes(configuration.weapon).expend
                }
            })),
            hullGrid,
            formFields,
            unavailableFormFields,
            warnings,
            mappingNotes: {
                specificDamage: 'All specific-damage fields are deliberately left blank.',
                blankColumns: 'Weapon Type and Charge, and entropy Level fields, are deliberately left blank.',
                jumpnium: 'Fleet does not currently store Jumpnium, so it is not exported.',
                overflow: 'PDF row groups are capped at their visible capacity; the full arrays remain in the JSON.'
            }
        };
    }

    static downloadBlob(blob, filename) {
        return SummaryWidget.prototype.downloadBlob.call(this, blob, filename);
    }

    static getFilename(ship, extension) {
        const name = String(ship.name || 'unique-ship')
            .trim()
            .replace(/[^\w.-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'unique-ship';
        return `${name}.${extension}`;
    }

    async exportJSON(ship) {
        const payload = await UniqueShipExporter.getExportData(ship, this.app);
        UniqueShipExporter.downloadBlob.call(
            UniqueShipExporter,
            new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
            UniqueShipExporter.getFilename(ship, 'json')
        );
        return payload;
    }

    async exportPDF(ship) {
        const payload = await UniqueShipExporter.getExportData(ship, this.app);
        const pdfLib = await SummaryWidget.prototype.loadPdfLibrary.call(UniqueShipExporter);
        const response = await fetch('data/Unique-Ship-Sheet.pdf');
        if (!response.ok) {
            throw new Error(`Unable to load the Unique Ship Sheet PDF template (${response.status}).`);
        }
        const document = await pdfLib.PDFDocument.load(await response.arrayBuffer());
        const form = document.getForm();
        const templateNames = form.getFields().map(field => field.getName());
        const dataNames = Object.keys(payload.formFields);
        const unmappedNames = templateNames.filter(name => !dataNames.includes(name));
        const missingNames = dataNames.filter(name => !templateNames.includes(name));
        if (unmappedNames.length || missingNames.length) {
            throw new Error(
                `Unique Ship Sheet fields do not match the export mapping. ` +
                `Unmapped template fields: ${unmappedNames.join(', ') || 'none'}. ` +
                `Missing template fields: ${missingNames.join(', ') || 'none'}.`
            );
        }
        for (const [name, value] of Object.entries(payload.formFields)) {
            const field = form.getField(name);
            if (field instanceof pdfLib.PDFCheckBox) {
                if (value) field.check();
                else field.uncheck();
            } else if (field instanceof pdfLib.PDFTextField) {
                field.setText(value === null || value === undefined
                    ? ''
                    : SummaryWidget.prototype.formatPdfFieldValue.call(this, value));
            } else {
                throw new Error(`PDF field "${name}" has an unsupported form-field type.`);
            }
        }
        form.acroForm.dict.set(pdfLib.PDFName.of('NeedAppearances'), pdfLib.PDFBool.True);
        const bytes = await document.save({ updateFieldAppearances: false });
        UniqueShipExporter.downloadBlob.call(
            UniqueShipExporter,
            new Blob([bytes], { type: 'application/pdf' }),
            UniqueShipExporter.getFilename(ship, 'pdf')
        );
        return payload;
    }
}
