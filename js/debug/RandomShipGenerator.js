// DEBUG / TEST ONLY: temporary random ship generator.
// Remove this file, its script tag, the debug button, and its main.js binding together.
// Do not treat this testing tool as production ship-generation behavior.
(() => {
    const CLASS_TEMPLATES = [
        'Asterion', 'Cinder', 'Distant', 'Eidolon', 'Farpoint',
        'Glasswing', 'Horizon', 'Kepler', 'Luminous', 'Wayfarer'
    ];
    const CORE_TEMPLATES = [
        'Helios', 'Kestrel', 'Meridian', 'Nightfall', 'Orion',
        'Peregrine', 'Solstice', 'Tantalus', 'Vanguard', 'Zenith'
    ];
    const OUTFIT_TEMPLATES = [
        'Aegis', 'Arrow', 'Bulwark', 'Comet', 'Drift',
        'Glaive', 'Longwatch', 'Pioneer', 'Ranger', 'Tempest'
    ];
    const POSITION_STEP = 48;
    const POSITION_MARGIN = 32;
    const GROUP_GAP = 72;

    function randomInteger(minimum, maximum) {
        return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
    }

    function randomItem(items) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Cannot choose a random value from an empty list.');
        }
        return items[randomInteger(0, items.length - 1)];
    }

    function randomSubset(items, minimum = 1, maximum = 2) {
        if (!Array.isArray(items) || items.length === 0) return [];
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index--) {
            const swapIndex = randomInteger(0, index);
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled.slice(0, randomInteger(
            Math.min(minimum, shuffled.length),
            Math.min(maximum, shuffled.length)
        ));
    }

    function randomName(templates) {
        return `${randomItem(templates)} ${randomInteger(100, 999)}`;
    }

    function widgetBounds(widget) {
        return {
            left: widget.x,
            top: widget.y,
            right: widget.x + (widget.element?.offsetWidth || widget.width || 300),
            bottom: widget.y + (widget.element?.offsetHeight || widget.height || 200)
        };
    }

    function overlaps(first, second, margin = POSITION_MARGIN) {
        return first.left < second.right + margin &&
            first.right + margin > second.left &&
            first.top < second.bottom + margin &&
            first.bottom + margin > second.top;
    }

    function findGroupPosition(canvas, newWidgets, existingWidgets) {
        const sizes = newWidgets.map(widget => ({
            width: widget.element?.offsetWidth || widget.width || 300,
            height: widget.element?.offsetHeight || widget.height || 200
        }));
        const groupWidth = sizes.reduce((sum, size) => sum + size.width, 0) +
            GROUP_GAP * (sizes.length - 1);
        const groupHeight = Math.max(...sizes.map(size => size.height));
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;

        for (let top = POSITION_MARGIN; top + groupHeight <= canvasHeight; top += POSITION_STEP) {
            for (let left = POSITION_MARGIN; left + groupWidth <= canvasWidth; left += POSITION_STEP) {
                let nextLeft = left;
                const proposed = sizes.map(size => {
                    const rect = {
                        left: nextLeft,
                        top,
                        right: nextLeft + size.width,
                        bottom: top + size.height
                    };
                    nextLeft += size.width + GROUP_GAP;
                    return rect;
                });
                if (proposed.every(rect =>
                    existingWidgets.every(widget => !overlaps(rect, widgetBounds(widget)))
                )) {
                    return proposed.map(rect => ({ x: rect.left, y: rect.top }));
                }
            }
        }
        throw new Error('No non-overlapping space remains on the design canvas for another ship group.');
    }

    function chooseWeaponEntries(items, category, outfit) {
        return randomSubset(items).map(weapon => {
            const isTurreted = category === 'offensive' &&
                !outfit.isTurretOptionDisabled(weapon) && Math.random() < 0.5;
            return {
                weaponId: weapon.id,
                count: randomInteger(1, 2),
                ...(category === 'offensive' ? {
                    isTurreted,
                    arc: 'FPSA'
                } : {})
            };
        });
    }

    function randomizeShipClass(ship, plan) {
        const {
            coreCount, emplacementCapacity, systemCapacity, containmentHulls,
            armorEfficiency, cargo, remass
        } = plan;
        const role = randomItem(ship.defaultRoles);
        ship.shipData = {
            ...ship.shipData,
            name: randomName(CLASS_TEMPLATES),
            role,
            customRole: '',
            description: randomItem([
                'Experimental debug hull.',
                'Randomized test configuration.',
                'Temporary generated design for testing.'
            ]),
            appearance: randomItem([
                'angular armored hull', 'sleek segmented frame',
                'compact utilitarian silhouette', 'broad industrial structure'
            ]),
            operational: true,
            ignoreRequiredTech: true,
            armorEfficiency,
            hullComposition: {
                magazine: 0,
                hangar: 0,
                system: systemCapacity,
                emplacement: emplacementCapacity,
                core: coreCount,
                freight: 0,
                tankage: 0
            },
            containmentHulls,
            foundations: Object.fromEntries(ship.foundationKeys.map(key =>
                [key, Math.random() < 0.5]
            )),
            powerAndPropulsion: {
                thrust: randomInteger(1, 10),
                burnRating: randomInteger(1, 5),
                heatEfficiency: randomInteger(1, 5),
                supplyRating: randomInteger(1, 5)
            },
            heatManagement: (() => {
                const warning = randomInteger(1, 3);
                const critical = randomInteger(warning + 1, 7);
                return {
                    capacity: randomInteger(1, 10),
                    thresholds: {
                        warning,
                        critical,
                        maximum: randomInteger(critical + 1, 12)
                    },
                    dissipation: randomInteger(1, 10)
                };
            })(),
            resources: { cargo, remass }
        };
        ship.updateCargoRemassAllocation(cargo);
        ship.updateTitle();
        ship.refresh();
    }

    function randomizeCore(core, coreCount) {
        const options = core.coreOptions;
        const components = ['reactor', 'engine', 'manifold'];
        for (const component of components) {
            const keys = Object.keys(options?.[component]?.options || {});
            core.coreData[component] = randomItem(keys);
        }
        core.coreData.name = randomName(CORE_TEMPLATES);
        core.coreData.operational = true;
        core.coreData.ignoreRequiredTech = true;
        core.coreData.powerplantSize = coreCount;
        core.coreData.developmentCost = randomInteger(1, 20);
        core.coreData.gears = Array.from({ length: randomInteger(1, 4) }, () => ({
            instability: randomInteger(1, 3)
        }));
        core.coreData.gears.sort((first, second) => first.instability - second.instability);
        [
            core.coreData.reactorValue,
            core.coreData.engineValue,
            core.coreData.manifoldValue
        ] = core.getTriangleValues([
            randomInteger(1, 12), randomInteger(1, 12), randomInteger(1, 12)
        ]);
        core.updateTitle();
        core.refresh();
        core.recomputeStats();
    }

    function getSystemUse(systems) {
        const general = systems.general;
        const generalUse = general.berthing + general.craftLauncher +
            (general.laserGenerator.techId ? general.laserGenerator.count : 0) +
            general.tending;
        const entropyUse = Object.values(systems.entropy)
            .reduce((sum, selection) => sum + selection.count, 0);
        return generalUse + entropyUse;
    }

    function randomizeSystems(outfit) {
        const general = {
            berthing: 0,
            berthingCargo: 0,
            craftLauncher: 0,
            laserGenerator: { techId: '', count: 0 },
            tending: 0
        };
        const generalOptions = randomSubset(outfit.systemsData.general, 1, 3);
        for (const item of generalOptions) {
            const count = randomInteger(1, 3);
            if (item.id === 'laser-generator') {
                if (outfit.laserGeneratorTechs.length) {
                    general.laserGenerator = {
                        techId: randomItem(outfit.laserGeneratorTechs).id,
                        count
                    };
                }
            } else if (item.id === 'craft-launcher') {
                general.craftLauncher = count;
            } else if (item.id === 'berthing') {
                general.berthing = count;
                general.berthingCargo = randomInteger(0, count * 5) * 10;
            } else if (item.id === 'tending') {
                general.tending = count;
            }
        }

        const entropy = Object.fromEntries(outfit.systemsData.entropy.map(item => [
            item.id,
            {
                count: Math.random() < 0.5 ? randomInteger(1, 3) : 0,
                radiance: item.radiance,
                requiredTech: [...(item.requiredTech || [])]
            }
        ]));
        if (getSystemUse({ general, entropy }) === 0) {
            const first = outfit.systemsData.general[0];
            if (first.id === 'laser-generator' && outfit.laserGeneratorTechs.length) {
                general.laserGenerator = {
                    techId: randomItem(outfit.laserGeneratorTechs).id,
                    count: randomInteger(1, 3)
                };
            } else if (first.id === 'craft-launcher') {
                general.craftLauncher = randomInteger(1, 3);
            } else if (first.id === 'berthing') {
                general.berthing = randomInteger(1, 3);
                general.berthingCargo = randomInteger(0, general.berthing * 5) * 10;
            } else {
                general.tending = randomInteger(1, 3);
            }
        }
        return { general, entropy };
    }

    function randomizeWeapons(outfit, utilityCapacity) {
        const spinalWeapons = outfit.getSpinalWeapons();
        const offensiveWeapons = outfit.getOffensiveWeapons();
        const defensiveWeapons = outfit.getPDWeapons();
        const emplacements = offensiveWeapons.filter(weapon =>
            WeaponCatalogue.getMount(weapon).resourceType === 'emplacements' &&
            WeaponCatalogue.getMount(weapon).resourceCount > 0
        );
        if (!spinalWeapons.length || !emplacements.length) {
            throw new Error('The weapon catalogue lacks a spinal weapon or an emplacement weapon.');
        }

        for (let attempt = 0; attempt < 40; attempt++) {
            const selectedOffensive = [randomItem(emplacements)];
            if (offensiveWeapons.length > 1 && Math.random() < 0.5) {
                const optionalWeapons = offensiveWeapons.filter(weapon =>
                    weapon.id !== selectedOffensive[0].id
                );
                if (optionalWeapons.length) selectedOffensive.push(randomItem(optionalWeapons));
            }
            const weapons = {
                spinal: randomItem(spinalWeapons).id,
                offensive: chooseWeaponEntries(selectedOffensive, 'offensive', outfit),
                defensive: defensiveWeapons.length && Math.random() < 0.7
                    ? chooseWeaponEntries([randomItem(defensiveWeapons)], 'defensive', outfit)
                    : []
            };
            outfit.outfitData.weapons = weapons;
            if (outfit.getWeaponResourceUse().utilities <= utilityCapacity) return;
        }

        const compatibleSpinalWeapons = spinalWeapons.filter(weapon => {
            outfit.outfitData.weapons = { spinal: weapon.id, offensive: [], defensive: [] };
            return outfit.getWeaponResourceUse().utilities <= utilityCapacity;
        });
        if (!compatibleSpinalWeapons.length) {
            throw new Error('No selected spinal weapon fits the core utility capacity.');
        }
        outfit.outfitData.weapons = {
            spinal: randomItem(compatibleSpinalWeapons).id,
            offensive: [randomItem(emplacements)].map(weapon => ({
                weaponId: weapon.id,
                count: 1,
                isTurreted: false,
                arc: 'F'
            })),
            defensive: []
        };
        if (outfit.getWeaponResourceUse().utilities > utilityCapacity) {
            throw new Error('No legal weapon selection fits the generated utility capacity.');
        }
    }

    function fillUtilityCapacity(outfit, utilityCapacity) {
        const weaponUse = outfit.getWeaponResourceUse().utilities;
        let remaining = utilityCapacity - weaponUse;
        if (remaining < 0) throw new Error('Generated weapons exceed utility capacity.');

        const utilityDevices = { radiators: [], defenses: [] };
        const usableDefenses = outfit.utilitiesData.defenses.filter(item =>
            !Number.isFinite(Number(item.limit)) || Number(item.limit) >= 1
        );
        if (remaining > 0 && usableDefenses.length && Math.random() < 0.5) {
            const defense = randomItem(usableDefenses);
            const limit = Number.isFinite(Number(defense.limit))
                ? Math.max(1, Math.floor(Number(defense.limit)))
                : remaining;
            const count = Math.min(remaining, randomInteger(1, Math.min(remaining, limit)));
            utilityDevices.defenses.push({ ...defense, count });
            remaining -= count;
        }
        if (remaining > 0) {
            utilityDevices.radiators.push({
                ...randomItem(outfit.utilitiesData.radiators),
                count: remaining
            });
        }
        outfit.outfitData.utilityDevices = utilityDevices;
    }

    function randomizeOutfit(outfit, core) {
        const roles = outfit.availableRoles;
        outfit.outfitData = {
            ...outfit.outfitData,
            name: randomName(OUTFIT_TEMPLATES),
            role: randomItem(roles),
            customRole: '',
            roleMode: 'dropdown',
            notes: 'DEBUG / TEST: randomly generated outfit.',
            operational: true,
            ignoreRequiredTech: true,
            coreWidgetId: core.id,
            defenses: { armor: 0 },
            utilityDevices: { radiators: [], defenses: [] },
            systems: randomizeSystems(outfit),
            weapons: { spinal: '', offensive: [], defensive: [] }
        };
        randomizeWeapons(outfit, Number(core.coreData.powerplantSize) * 2);
        fillUtilityCapacity(outfit, Number(core.coreData.powerplantSize) * 2);
        outfit.outfitData.weapons.offensive.forEach(weapon =>
            outfit.normalizeWeaponArc(weapon, 'offensive')
        );
        outfit.outfitData.weapons.defensive.forEach(weapon =>
            outfit.normalizeWeaponArc(weapon, 'defensive')
        );
        outfit.updateTitle();
        outfit.syncFormFromData();
        outfit.refresh();
    }

    function getHardpointCapacity(containmentHulls) {
        const capacity = Math.pow(containmentHulls, 2 / 3);
        return Math.floor(capacity + Number.EPSILON * Math.max(1, capacity));
    }

    function findNode(widget, direction, nodeType) {
        return [...widget.nodes.entries()].find(([, node]) =>
            node.type === direction && node.nodeType === nodeType
        )?.[0] || null;
    }

    function connect(nodeSystem, sourceWidget, sourceDirection, targetWidget, targetDirection, nodeType) {
        const sourceId = findNode(sourceWidget, sourceDirection, nodeType);
        const targetId = findNode(targetWidget, targetDirection, nodeType);
        if (!sourceId || !targetId || !nodeSystem.canConnect(sourceId, targetId)) {
            throw new Error(`Unable to connect generated ${nodeType} nodes.`);
        }
        const sourceNode = nodeSystem.getNodeById(sourceId);
        const targetNode = nodeSystem.getNodeById(targetId);
        const priorConnectionCount = sourceNode?.connections?.size || 0;
        nodeSystem.connectNodesRespectingDirection(sourceId, targetId);
        if ((sourceNode?.connections?.size || 0) <= priorConnectionCount ||
            !targetNode?.connections?.size) {
            throw new Error(`The generated ${nodeType} connection was not created.`);
        }
    }

    function findShipPlan(core, outfit) {
        const coreCount = Number(core.coreData.powerplantSize);
        const weaponUse = outfit.getWeaponResourceUse();
        const emplacementCapacity = weaponUse.emplacements;
        const systemCapacity = getSystemUse(outfit.outfitData.systems);
        const activeHullCount = coreCount + emplacementCapacity + systemCapacity;
        const armorEfficiency = randomInteger(1, 5);
        const minimumContainment = Math.max(1, 5 * coreCount - activeHullCount);
        const maximumContainment = Math.min(
            10 * coreCount - activeHullCount,
            200 - activeHullCount
        );
        if (minimumContainment > maximumContainment) return null;

        const candidates = [];
        for (let containmentHulls = minimumContainment;
            containmentHulls <= maximumContainment;
            containmentHulls++) {
            const hardpoints = getHardpointCapacity(containmentHulls);
            const armor = hardpoints === 0 ? 0 : Math.ceil(hardpoints / armorEfficiency);
            const effectiveHulls = activeHullCount + containmentHulls + armor;
            const remassPerBurn = core.coreData.gears.map(gear =>
                OutfitWidget.calculateGearBurnMetrics(
                    effectiveHulls,
                    core.coreData.engineEfficiency,
                    gear.instability
                )?.remassPerBurn
            );
            if (remassPerBurn.some(value => !Number.isSafeInteger(value))) continue;

            const requiredRemass = 12 * Math.max(...remassPerBurn);
            const minimumCargo = 8 * activeHullCount;
            const resourceBudget = 50 * containmentHulls;
            if (resourceBudget >= requiredRemass + minimumCargo) {
                candidates.push({
                    coreCount,
                    emplacementCapacity,
                    systemCapacity,
                    containmentHulls,
                    armorEfficiency,
                    armor,
                    activeHullCount,
                    requiredRemass,
                    minimumCargo,
                    resourceBudget
                });
            }
        }
        if (!candidates.length) return null;

        const plan = randomItem(candidates);
        const remass = randomInteger(
            plan.requiredRemass,
            plan.resourceBudget - plan.minimumCargo
        );
        return {
            ...plan,
            cargo: plan.resourceBudget - remass,
            remass
        };
    }

    function assertIntegerCustomValues(ship, core, outfit) {
        const values = [
            ...Object.values(ship.shipData.hullComposition),
            ship.shipData.containmentHulls,
            ship.shipData.armorEfficiency,
            ...Object.values(ship.shipData.powerAndPropulsion),
            ship.shipData.heatManagement.capacity,
            ...Object.values(ship.shipData.heatManagement.thresholds),
            ship.shipData.heatManagement.dissipation,
            ship.shipData.resources.cargo,
            ship.shipData.resources.remass,
            core.coreData.developmentCost,
            core.coreData.powerplantSize,
            core.coreData.reactorValue,
            core.coreData.engineValue,
            core.coreData.manifoldValue,
            ...core.coreData.gears.map(gear => gear.instability),
            outfit.outfitData.defenses.armor,
            outfit.outfitData.systems.general.berthing,
            outfit.outfitData.systems.general.berthingCargo,
            outfit.outfitData.systems.general.craftLauncher,
            outfit.outfitData.systems.general.laserGenerator.count,
            outfit.outfitData.systems.general.tending,
            ...Object.values(outfit.outfitData.systems.entropy).map(selection => selection.count),
            ...['radiators', 'defenses'].flatMap(collection =>
                outfit.outfitData.utilityDevices[collection].map(selection => selection.count)
            ),
            ...['offensive', 'defensive'].flatMap(category =>
                outfit.outfitData.weapons[category].map(weapon => weapon.count)
            )
        ];
        if (!values.every(Number.isSafeInteger)) {
            throw new Error('Generated custom values must all be whole-number increments of 1.');
        }
    }

    function assertCompleteAndLegal(ship, core, outfit) {
        const hullTotal = ship.getTotalHulls();
        const coreRatio = ship.shipData.hullComposition.core / hullTotal;
        if (!ship.shipData.operational || !core.coreData.operational ||
            !outfit.outfitData.operational ||
            !ship.shipData.ignoreRequiredTech || !core.coreData.ignoreRequiredTech ||
            !outfit.outfitData.ignoreRequiredTech) {
            throw new Error('Generated designs must be operational and allow all required-tech options.');
        }
        if (!Number.isSafeInteger(hullTotal) || hullTotal > 200 ||
            coreRatio < 0.1 || coreRatio > 0.2) {
            throw new Error('Generated Ship Class is outside the hull count or core ratio limits.');
        }

        const containment = ship.shipData.containmentHulls;
        if (ship.shipData.resources.cargo + ship.shipData.resources.remass !== containment * 50 ||
            ship.shipData.hullComposition.freight + ship.shipData.hullComposition.tankage !== containment) {
            throw new Error('Generated cargo and remass must allocate every containment resource exactly once.');
        }
        assertIntegerCustomValues(ship, core, outfit);

        const capacities = outfit.getResourceSources();
        const usage = outfit.getResourceUse();
        for (const resource of ['core', 'emplacements', 'utilities', 'systems']) {
            const capacity = capacities[resource];
            const used = usage[resource];
            if (!Number.isSafeInteger(capacity) || !Number.isSafeInteger(used) || used !== capacity) {
                throw new Error(
                    `Generated Outfit must use exactly its available ${resource} resource (${used} / ${capacity}).`
                );
            }
        }
        const hardpoints = capacities.hardpoints;
        const hardpointsUsed = usage.hardpoints;
        if (!Number.isSafeInteger(hardpoints) || !Number.isSafeInteger(hardpointsUsed) ||
            hardpointsUsed > hardpoints) {
            throw new Error(
                `Generated Outfit cannot exceed its available hardpoints (${hardpointsUsed} / ${hardpoints}).`
            );
        }

        for (const component of ['reactor', 'engine', 'manifold']) {
            if (!core.coreOptions?.[component]?.options?.[core.coreData[component]]) {
                throw new Error(`Generated Ship Core has an invalid ${component} selection.`);
            }
        }
        const weapons = outfit.getAllWeapons();
        if (!outfit.getSpinalWeapons().some(weapon => weapon.id === outfit.outfitData.weapons.spinal) ||
            outfit.outfitData.weapons.offensive.some(selection =>
                !outfit.getOffensiveWeapons().some(weapon => weapon.id === selection.weaponId) ||
                selection.arc !== outfit.getValidWeaponArc(
                    selection.arc,
                    outfit.getWeaponDefinition(selection.weaponId)?.isMain,
                    selection.isTurreted
                )
            ) ||
            outfit.outfitData.weapons.defensive.some(selection =>
                !outfit.getPDWeapons().some(weapon => weapon.id === selection.weaponId) ||
                selection.arc !== undefined
            ) ||
            ['radiators', 'defenses'].some(collection =>
                outfit.outfitData.utilityDevices[collection].some(selection =>
                    !outfit.utilitiesData[collection].some(item => item.id === selection.id)
                )
            ) ||
            Object.keys(outfit.outfitData.systems.entropy)
                .some(id => !outfit.systemsData.entropy.some(item => item.id === id)) ||
            (outfit.outfitData.systems.general.laserGenerator.techId &&
                !outfit.laserGeneratorTechs.some(tech =>
                    tech.id === outfit.outfitData.systems.general.laserGenerator.techId
                ))) {
            throw new Error('Generated ship contains a selection that is not present in its catalogue.');
        }
        if (!ship.defaultRoles.includes(ship.shipData.role) ||
            !outfit.availableRoles.includes(outfit.outfitData.role) ||
            outfit.systemsData.general.length === 0) {
            throw new Error('Generated ship contains an invalid role or has no available systems.');
        }

        const endurance = ShipCapacity.getEndurance(ship, outfit, ship.shipData.resources.cargo);
        const gears = ShipCapacity.getGearBurns(ship, outfit);
        if (endurance === null || endurance < 8 ||
            gears.length === 0 || gears.some(gear => (gear.maximumBurns ?? 0) < 12)) {
            throw new Error('Generated ship must have endurance 8 and at least 12 burns in every gear.');
        }

    }

    function removeGeneratedWidgets(widgets) {
        for (const widget of [...widgets].reverse()) {
            try {
                widget.close();
            } catch (error) {
                console.error('Failed to clean up a partial debug ship group:', error);
            }
        }
    }

    async function createRandomShipGroup(app) {
        if (!app?.createWidget || !app.widgetManager || !app.nodeSystem) {
            throw new Error('The main design application is not ready.');
        }
        app.setEmpireView('design');

        const createdWidgets = [];
        try {
            const ship = app.createWidget('ship', 0, 0);
            if (!ship) throw new Error('Failed to create a Ship Class widget.');
            createdWidgets.push(ship);
            ship.element.hidden = true;

            const core = app.createWidget('shipCore', 0, 0);
            if (!core) throw new Error('Failed to create a Ship Core widget.');
            createdWidgets.push(core);
            core.element.hidden = true;

            const outfit = app.createWidget('outfit', 0, 0);
            if (!outfit) throw new Error('Failed to create an Outfit widget.');
            createdWidgets.push(outfit);
            outfit.element.hidden = true;

            await Promise.all([
                core.loadCoreOptions(),
                outfit.loadWeaponsData(),
                outfit.loadUtilitiesData(),
                outfit.loadSystemsData()
            ]);
            if (!core.coreOptions ||
                ['reactor', 'engine', 'manifold'].some(component =>
                    !Object.keys(core.coreOptions[component]?.options || {}).length
                )) {
                throw new Error('Ship Core options are unavailable; the debug ship was not generated.');
            }
            if (!outfit.weaponsDataLoaded || !outfit.utilitiesDataLoaded ||
                !outfit.systemsDataLoaded || !rolesAreAvailable(outfit)) {
                throw new Error('Outfit catalogues are unavailable; the debug ship was not generated.');
            }

            let plan = null;
            for (let attempt = 0; attempt < 60 && !plan; attempt++) {
                const coreCount = randomInteger(4, 8);
                randomizeCore(core, coreCount);
                randomizeOutfit(outfit, core);
                plan = findShipPlan(core, outfit);
            }
            if (!plan) {
                throw new Error('Unable to generate a complete ship within the hull, endurance, and burn limits.');
            }
            outfit.outfitData.defenses.armor = plan.armor;
            randomizeShipClass(ship, plan);
            outfit.syncFormFromData();

            for (const widget of createdWidgets) widget.element.hidden = false;
            const canvas = document.getElementById('canvas');
            if (!canvas) throw new Error('The design canvas is unavailable.');
            const existingWidgets = app.widgetManager.getAllWidgets()
                .filter(widget => !createdWidgets.includes(widget) && widget.element?.isConnected);
            let positions = findGroupPosition(canvas, createdWidgets, existingWidgets);
            createdWidgets.forEach((widget, index) => {
                widget.setPosition(positions[index].x, positions[index].y, {
                    markManual: true,
                    updateConnections: false,
                    updateMinimap: false
                });
            });

            connect(app.nodeSystem, ship, 'output', core, 'input', 'Class');
            connect(app.nodeSystem, ship, 'output', outfit, 'input', 'Class');
            connect(app.nodeSystem, core, 'output', outfit, 'input', 'Core');

            ship.refresh();
            core.refresh();
            outfit.refresh();
            assertCompleteAndLegal(ship, core, outfit);

            positions = findGroupPosition(canvas, createdWidgets, existingWidgets);
            createdWidgets.forEach((widget, index) => {
                widget.setPosition(positions[index].x, positions[index].y, {
                    markManual: true,
                    updateConnections: false,
                    updateMinimap: false
                });
            });
            app.nodeSystem.updateConnections();
            app.updateMinimap?.();
            return { ship, core, outfit };
        } catch (error) {
            removeGeneratedWidgets(createdWidgets);
            throw error;
        }
    }

    function rolesAreAvailable(outfit) {
        return Array.isArray(outfit.availableRoles) && outfit.availableRoles.length > 0 &&
            Array.isArray(outfit.getSpinalWeapons()) && outfit.getSpinalWeapons().length > 0 &&
            outfit.getOffensiveWeapons().length > 0 && outfit.getPDWeapons().length > 0 &&
            outfit.utilitiesData.radiators.length > 0 &&
            outfit.utilitiesData.defenses.length > 0 &&
            outfit.systemsData.general.length > 0 &&
            outfit.systemsData.entropy.length > 0;
    }

    window.DebugRandomShipGenerator = Object.freeze({ createRandomShipGroup });
})();
