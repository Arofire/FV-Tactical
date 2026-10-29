// Pure helper functions for deriving fleet-ship capacities, stores, and
// buildable configurations from design-canvas widgets. Formulas mirror
// SummaryWidget/OutfitWidget — see the noted source methods.
class ShipCapacity {
    static num(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    static numOrNull(value) {
        if (value === undefined || value === null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    // --- Graph queries -----------------------------------------------------

    // All outfit widgets whose Class input is connected to this ship widget.
    static getOutfitsForClass(shipWidget) {
        if (!shipWidget || !window.nodeSystem) return [];
        const outfits = [];
        for (const connection of window.nodeSystem.connections.values()) {
            const sourceNode = window.nodeSystem.getNodeById(connection.sourceNodeId);
            const targetNode = window.nodeSystem.getNodeById(connection.targetNodeId);
            if (!sourceNode || !targetNode) continue;
            if (sourceNode.widgetId === shipWidget.id && sourceNode.nodeType === 'Class') {
                const target = window.widgetManager?.getWidget(targetNode.widgetId);
                if (target?.type === 'outfit') outfits.push(target);
            }
        }
        return outfits;
    }

    static getLoadoutsForOutfit(outfitWidget) {
        if (!outfitWidget || !window.nodeSystem) return [];
        const loadouts = new Map();
        for (const node of outfitWidget.nodes.values()) {
            if (node.type !== 'input' || node.nodeType !== 'Loadout') continue;
            for (const connectionId of node.connections || []) {
                const connection = window.nodeSystem.connections.get(connectionId);
                if (!connection) continue;
                const sourceNodeId = node.id === connection.targetNodeId
                    ? connection.sourceNodeId
                    : connection.targetNodeId;
                const sourceNode = window.nodeSystem.getNodeById(sourceNodeId);
                const widget = sourceNode && window.widgetManager?.getWidget(sourceNode.widgetId);
                const requiredTech = widget?.getStats?.().requiredTech ||
                    widget?.loadoutData?.requiredTech || [];
                if (widget?.type === 'shipLoadout' && widget.loadoutData?.operational &&
                    requiredTech
                        .every(tech => window.empire?.hasTech?.(tech) ?? false)) {
                    loadouts.set(widget.id, widget);
                }
            }
        }
        return [...loadouts.values()];
    }

    static createFleetContents(loadoutWidget = null) {
        const data = loadoutWidget?.type === 'shipLoadout'
            ? loadoutWidget.loadoutData
            : null;
        return {
            berths: (data?.berths || []).map(entry => ({ id: entry.id, count: entry.count })),
            magazine: (data?.magazine || []).map(entry => ({ id: entry.id, count: entry.count })),
            hangar: (data?.hangar || []).map(entry => ({ id: entry.id, count: entry.count })),
            hardpoints: [],
            hardpointLoadout: {
                devices: (data?.hardpointDevices || []).map(entry => ({
                    instanceId: entry.instanceId,
                    deviceId: entry.deviceId,
                    contents: (entry.contents || []).map(content => ({
                        id: content.id,
                        count: content.count
                    }))
                })),
                weapons: (data?.weapons || []).map(entry => ({
                    weaponId: entry.weaponId,
                    count: entry.count,
                    arc: entry.arc
                }))
            }
        };
    }

    // The ship core feeding an outfit, via Core node connection first and the
    // outfit's dropdown fallback second (mirrors OutfitWidget.getCoreData).
    static getCoreForOutfit(outfitWidget) {
        if (!outfitWidget) return null;
        if (window.nodeSystem) {
            for (const connection of window.nodeSystem.connections.values()) {
                const sourceNode = window.nodeSystem.getNodeById(connection.sourceNodeId);
                const targetNode = window.nodeSystem.getNodeById(connection.targetNodeId);
                if (!sourceNode || !targetNode) continue;
                if (targetNode.widgetId === outfitWidget.id && targetNode.nodeType === 'Core') {
                    const source = window.widgetManager?.getWidget(sourceNode.widgetId);
                    if (source?.type === 'shipCore') return source;
                }
            }
        }
        const fallback = window.widgetManager?.getWidget?.(outfitWidget.outfitData?.coreWidgetId);
        return fallback?.type === 'shipCore' ? fallback : null;
    }

    // Every (class, outfit, core) triple that is fully operational and may be
    // built in the Fleet view.
    static getBuildableConfigurations() {
        const configurations = [];
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        for (const widget of widgets) {
            if (widget.type !== 'ship' || !widget.shipData?.operational) continue;
            for (const outfit of ShipCapacity.getOutfitsForClass(widget)) {
                if (!outfit.outfitData?.operational) continue;
                const core = ShipCapacity.getCoreForOutfit(outfit);
                if (!core?.coreData?.operational) continue;
                configurations.push({ classWidget: widget, outfitWidget: outfit, coreWidget: core });
            }
        }
        return configurations;
    }

    // --- Capacities --------------------------------------------------------
    // Sources: SummaryWidget.getModel/getMetrics, OutfitWidget.getResourceSources.

    static getHardpointCapacity(hardpoints, armorHits) {
        const capacity = ShipCapacity.numOrNull(hardpoints);
        const armor = ShipCapacity.numOrNull(armorHits);
        if (capacity === null) return null;
        return Math.max(0, armor === null ? capacity : Math.min(capacity, armor));
    }

    static getCapacities(classWidget, outfitWidget) {
        const classData = classWidget?.shipData || {};
        const outfitData = outfitWidget?.outfitData || {};
        const composition = classData.hullComposition || {};

        // Berths: berthing systems * 5, less 1 per 10 cargo tons allocated to
        // berthing (SummaryWidget.getMetrics crew-capacity fallback).
        const generalSystems = outfitData.systems?.general || {};
        const berthingSystems = ShipCapacity.num(generalSystems.berthing);
        const berthingCargo = Math.min(
            ShipCapacity.num(generalSystems.berthingCargo),
            berthingSystems * 50
        );
        const berths = Math.max(0, berthingSystems * 5 - berthingCargo / 10);

        // Armour caps capacity rather than occupying slots. Loadout devices
        // are counted in Fleet contents, not subtracted again from capacity.
        let hardpoints = null;
        if (typeof outfitWidget?.getResourceSources === 'function') {
            hardpoints = ShipCapacity.numOrNull(outfitWidget.getResourceSources().hardpoints);
        }
        if (hardpoints === null) {
            const coreData = outfitWidget?.getCoreData?.() || null;
            const coreHardpoints = ShipCapacity.numOrNull(coreData?.hardpoints);
            const containment = ShipCapacity.getContainmentHulls(classWidget);
            hardpoints = coreHardpoints ?? (containment === null
                ? 0
                : Math.floor(Math.pow(containment, 2 / 3) + Number.EPSILON * Math.max(1, Math.pow(containment, 2 / 3))));
        }
        if (hardpoints !== null) {
            const outfitWeaponUse = ShipCapacity.num(
                outfitWidget?.getWeaponResourceUse?.().hardpoints ??
                outfitData.resourceUse?.hardpoints
            );
            const armorHits = ShipCapacity.numOrNull(outfitWidget?.getArmorHits?.()) ??
                ShipCapacity.numOrNull(outfitData.armorHits) ??
                (ShipCapacity.numOrNull(classData.armorEfficiency) === null
                    ? null
                    : ShipCapacity.num(outfitData.defenses?.armor) * ShipCapacity.num(classData.armorEfficiency));
            hardpoints = ShipCapacity.getHardpointCapacity(hardpoints, armorHits);
            hardpoints = Math.max(0, hardpoints - outfitWeaponUse);
        }

        return {
            berths: Math.floor(berths),
            magazineCells: ShipCapacity.num(composition.magazine) * 25,
            hangarBays: ShipCapacity.num(composition.hangar) * 4,
            hardpoints: hardpoints ?? 0
        };
    }

    static getContainmentHulls(classWidget) {
        const classData = classWidget?.shipData || {};
        const composition = classData.hullComposition || {};
        const explicit = ShipCapacity.numOrNull(classData.containmentHulls);
        if (explicit !== null) return explicit;
        const freight = ShipCapacity.numOrNull(composition.freight);
        const tankage = ShipCapacity.numOrNull(composition.tankage);
        if (freight === null && tankage === null) return null;
        return (freight || 0) + (tankage || 0);
    }

    // --- Stores ------------------------------------------------------------

    static getStoresMaxima(classWidget) {
        const resources = classWidget?.shipData?.resources || {};
        return {
            cargo: ShipCapacity.num(resources.cargo),
            remass: ShipCapacity.num(resources.remass)
        };
    }

    // Cargo consumed per day by every hull except Freight and Tankage.
    static getHullConsumption(hullComposition) {
        const composition = hullComposition || {};
        return ['emplacement', 'hangar', 'magazine', 'system', 'core']
            .reduce((total, type) => total + ShipCapacity.num(composition[type]), 0);
    }

    static getConsumption(classWidget) {
        return ShipCapacity.getHullConsumption(classWidget?.shipData?.hullComposition);
    }

    static getBerthingCargo(outfitWidget) {
        return ShipCapacity.num(outfitWidget?.outfitData?.systems?.general?.berthingCargo);
    }

    static getEndurance(classWidget, outfitWidget, cargo) {
        const consumption = ShipCapacity.getConsumption(classWidget);
        if (consumption <= 0) return null;
        const totalCargo = ShipCapacity.num(cargo) + ShipCapacity.getBerthingCargo(outfitWidget);
        return Math.floor(totalCargo / consumption);
    }

    // Per-gear remass burn profiles (OutfitWidget.getGearBurnAnalysis).
    static getGearBurns(classWidget, outfitWidget) {
        if (typeof outfitWidget?.getGearBurnAnalysis === 'function') {
            const analysis = outfitWidget.getGearBurnAnalysis();
            if (analysis?.gears) return analysis.gears;
        }
        return [];
    }

    // Highest remass demand across the ship's gears (used by tending defaults).
    static getMaxRemassPerBurn(classWidget, outfitWidget) {
        return ShipCapacity.getGearBurns(classWidget, outfitWidget).reduce(
            (max, gear) => Math.max(max, ShipCapacity.num(gear.remassPerBurn)),
            0
        );
    }

    static hasTending(outfitWidget) {
        return ShipCapacity.num(outfitWidget?.outfitData?.systems?.general?.tending) > 0;
    }

    // --- Content options ---------------------------------------------------
    // Operational designs from the canvas; hardpoint weapons from the
    // weapons catalogue gated by researched tech.

    static getContentOptions() {
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        const options = { troops: [], craft: [], munitions: [], hardpointWeapons: [] };
        const isAvailable = widget => {
            const requiredTech = widget.getSelectedRequiredTech?.() ||
                widget[widget.type === 'troops' ? 'troopData' :
                    widget.type === 'craft' ? 'craftData' : 'munitionData']?.requiredTech || [];
            return (Array.isArray(requiredTech) ? requiredTech : [])
                .every(tech => window.empire?.hasTech?.(tech) ?? false);
        };
        for (const widget of widgets) {
            if (widget.type === 'troops' && widget.troopData?.operational && isAvailable(widget)) {
                const stats = typeof widget.calculateStats === 'function' ? widget.calculateStats() : {};
                options.troops.push({
                    id: widget.id,
                    name: widget.troopData.name || 'Troop Unit',
                    berthsRequired: Math.max(0, ShipCapacity.num(
                        widget.getBerthsRequired?.() ?? widget.troopData.berthsRequired ?? 1
                    )),
                    cost: ShipCapacity.num(stats.combatValue),
                    requiredTech: widget.troopData.requiredTech || []
                });
            } else if (widget.type === 'craft' && widget.craftData?.operational && isAvailable(widget)) {
                const stats = typeof widget.calculateStats === 'function' ? widget.calculateStats() : {};
                options.craft.push({
                    id: widget.id,
                    name: widget.craftData.name || 'Craft',
                    baysRequired: Math.max(0, ShipCapacity.num(
                        widget.craftData.baysRequired ?? widget.getProfile?.()?.baysRequired
                    )),
                    cost: ShipCapacity.num(stats.combatValue),
                    requiredTech: widget.craftData.requiredTech || []
                });
            } else if (widget.type === 'munitions' && widget.munitionData?.operational && isAvailable(widget)) {
                options.munitions.push({
                    id: widget.id,
                    name: widget.munitionData.name || 'Munition',
                    profile: widget.munitionData.profile || '',
                    magazineCells: Math.max(0, ShipCapacity.num(
                        typeof widget.getMagazineCells === 'function' ? widget.getMagazineCells() : 0
                    )),
                    cost: ShipCapacity.num(widget.munitionData.cost),
                    requiredTech: widget.getSelectedRequiredTech?.() || widget.munitionData.requiredTech || []
                });
            }
        }
        return options;
    }

    static getHardpointDeviceOptions(ignoreRequiredTech = false) {
        const devices = ShipLoadoutWidget.getDeviceCatalogue();
        return devices.filter(device => ignoreRequiredTech ||
            (device.requiredTech || []).every(tech => window.empire?.hasTech?.(tech) ?? false));
    }

    static async ensureWeaponsData() {
        return WeaponCatalogue.load();
    }

    // Hardpoint-mountable weapons, tech-gated unless bypassed. Operational
    // munition designs from the canvas are always offered alongside them.
    static async getHardpointWeaponOptions(ignoreRequiredTech = false) {
        const data = await ShipCapacity.ensureWeaponsData();
        const weapons = data.categories.flatMap(category =>
            (category.weapons || []).filter(weapon =>
                WeaponCatalogue.getMount(weapon).resourceType === 'hardpoints' &&
                (ignoreRequiredTech || (weapon.requiredTech || [])
                    .every(tech => window.empire?.hasTech?.(tech) ?? false)))
        );
        const munitions = (window.widgetManager?.getAllWidgets?.() || [])
            .filter(widget => widget.type === 'munitions' && widget.munitionData?.operational &&
                (ignoreRequiredTech || (widget.getSelectedRequiredTech?.() ||
                    widget.munitionData?.requiredTech || [])
                    .every(tech => window.empire?.hasTech?.(tech) ?? false)))
            .map(widget => typeof widget.toWeaponDefinition === 'function'
                ? widget.toWeaponDefinition()
                : null)
            .filter(Boolean);
        if (ignoreRequiredTech) return [...weapons, ...munitions];
        return [...weapons, ...munitions];
    }

    // --- Content accounting ------------------------------------------------

    // contents: { berths: [{id,count}], magazine: [{id,count}], hangar: [{id,count}],
    //             hardpoints: [{weaponId,count,arc,turreted}] }
    // Returns { used: {...}, cost: totalCv } given capacities and option lists.
    static summarizeContents(contents, options, hardpointWeapons = []) {
        const lookup = (list, id) => list.find(item => item.id === id);
        const used = {
            berths: 0, magazineCells: 0, hangarBays: 0, hardpoints: 0,
            fixtureMounts: 0, adapterCells: 0, clampBays: 0
        };
        // Cost buckets keyed by campaign cost-rule category for Materiel totals.
        const costByCategory = { equipment: 0, munitions: 0, general: 0, weapons: 0 };
        let valid = true;
        let cost = 0;
        for (const entry of contents.berths || []) {
            const option = lookup(options.troops, entry.id);
            if (!option) {
                valid = false;
                continue;
            }
            const count = ShipCapacity.num(entry.count);
            used.berths += option.berthsRequired * count;
            costByCategory.equipment += option.cost * count;
        }
        for (const entry of contents.magazine || []) {
            const option = lookup(options.munitions, entry.id);
            if (!option) {
                valid = false;
                continue;
            }
            const count = ShipCapacity.num(entry.count);
            used.magazineCells += option.magazineCells * count;
            costByCategory.munitions += option.cost * count;
        }
        for (const entry of contents.hangar || []) {
            const option = lookup(options.craft, entry.id);
            if (!option) {
                valid = false;
                continue;
            }
            const count = ShipCapacity.num(entry.count);
            used.hangarBays += option.baysRequired * count;
            costByCategory.general += option.cost * count;
        }
        for (const entry of contents.hardpointLoadout?.devices || []) {
            const device = ShipLoadoutWidget.getDeviceCatalogue()
                .find(item => item.id === entry.deviceId);
            if (!device) {
                valid = false;
                used.hardpoints++;
                continue;
            }
            used.hardpoints++;
            costByCategory.weapons += ShipCapacity.num(device.cost);
            if (device.id === 'adapter') {
                let cells = 0;
                let profile = '';
                for (const content of entry.contents || []) {
                    const munition = lookup(options.munitions, content.id);
                    if (!munition) {
                        valid = false;
                        continue;
                    }
                    if (profile && profile !== munition.profile) valid = false;
                    profile = munition.profile || profile;
                    const count = ShipCapacity.num(content.count);
                    cells += munition.magazineCells * count;
                    costByCategory.munitions += munition.cost * count;
                }
                used.adapterCells += cells;
                if (cells > ShipCapacity.num(device.cells)) valid = false;
            } else if (device.id === 'clamp') {
                let bays = 0;
                for (const content of entry.contents || []) {
                    const craft = lookup(options.craft, content.id);
                    if (!craft) {
                        valid = false;
                        continue;
                    }
                    const count = ShipCapacity.num(content.count);
                    bays += craft.baysRequired * count;
                    costByCategory.general += craft.cost * count;
                }
                used.clampBays += bays;
                if (bays > ShipCapacity.num(device.bays)) valid = false;
            } else if ((entry.contents || []).length) {
                valid = false;
            }
        }
        const fixtureMounts = (contents.hardpointLoadout?.devices || []).reduce((sum, entry) => {
            const device = ShipLoadoutWidget.getDeviceCatalogue()
                .find(item => item.id === entry.deviceId);
            return sum + (Number(device?.mounts) || 0);
        }, 0);
        for (const entry of contents.hardpointLoadout?.weapons || []) {
            const weapon = lookup(hardpointWeapons, entry.weaponId);
            if (!weapon || weapon.isMunition) {
                valid = false;
                continue;
            }
            const count = ShipCapacity.num(entry.count);
            if (String(entry.arc || 'F').length !== 1 ||
                !'FPSA'.includes(String(entry.arc || 'F').toUpperCase())) valid = false;
            used.fixtureMounts += count;
            costByCategory.weapons += ShipCapacity.num(weapon.cost) * count;
        }
        if (used.fixtureMounts > fixtureMounts) valid = false;
        for (const entry of contents.hardpoints || []) {
            const weapon = lookup(hardpointWeapons, entry.weaponId);
            if (!weapon) {
                valid = false;
                continue;
            }
            const count = ShipCapacity.num(entry.count);
            // Multi-arc mounts (turreted only) use one additional hardpoint,
            // mirroring OutfitWidget.getWeaponResourceUse.
            const arcs = String(entry.arc || 'F').length;
            const surcharge = entry.turreted && arcs > 1 ? 1 : 0;
            used.hardpoints += (ShipCapacity.num(WeaponCatalogue.getMount(weapon).resourceCount) + surcharge) * count;
            costByCategory.weapons += ShipCapacity.num(weapon.cost) * count;
        }
        cost = Object.values(costByCategory).reduce((sum, value) => sum + value, 0);
        return { used, cost, costByCategory, valid };
    }

    static getContentsMateriel(summary) {
        return Object.entries(summary.costByCategory || {}).reduce(
            (sum, [category, value]) => sum + ShipCapacity.getMaterielCost(value, category),
            0
        );
    }

    static contentsFit(contents, capacities, options, hardpointWeapons = []) {
        const summary = ShipCapacity.summarizeContents(contents, options, hardpointWeapons);
        const { used } = summary;
        return {
            used,
            fits: used.berths <= capacities.berths &&
                used.magazineCells <= capacities.magazineCells &&
                used.hangarBays <= capacities.hangarBays &&
                used.hardpoints <= capacities.hardpoints &&
                summary.valid
        };
    }

    // Materiel value of a base cost under the campaign cost rules.
    static getMaterielCost(value, category = 'munitions', itemId = '') {
        const cost = ShipCapacity.num(value);
        const rules = window.empire?.campaignCostRules || { categories: {}, items: {} };
        const rule = rules.items?.[itemId] ||
            rules.categories?.[String(category).toLowerCase()] || 'split';
        if (rule === 'materiel') return cost;
        if (rule === 'industry') return 0;
        return Math.round(cost * 100 / 2) / 100;
    }
}
