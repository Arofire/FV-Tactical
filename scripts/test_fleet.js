async function runFleetRegressionChecks() {
    const results = [];
    const assert = (condition, message) => {
        if (!condition) throw new Error(message);
    };
    const equal = (actual, expected, message) => {
        assert(JSON.stringify(actual) === JSON.stringify(expected),
            `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    };
    const rejects = (action, message) => {
        let error;
        try {
            action();
        } catch (caught) {
            error = caught;
        }
        assert(error instanceof Error, message);
    };
    const test = (name, action) => {
        action();
        results.push(`PASS ${name}`);
    };
    const empire = Object.assign(Object.create(Empire.prototype), {
        name: 'Test Empire', techPoints: 0,
        researchedTech: new Set(), availableTech: new Set(), economyMode: 'skirmish',
        campaignCostRules: { categories: {}, items: {} },
        designs: { ships: [], craft: [], troops: [], munitions: [], powerplants: [] },
        taskForces: [], fleetShips: []
    });
    const first = empire.addTaskForce('First');
    const second = empire.addTaskForce('Second');
    const contents = () => ({
        berths: [], magazine: [], hangar: [],
        hardpointLoadout: { devices: [], weapons: [] }
    });
    test('membership uses transfer order and same-force assignment preserves it', () => {
        for (const id of ['a', 'b', 'c']) {
            empire.addFleetShip({ id, name: id, contents: contents() });
        }
        empire.assignFleetShip('b', first.id);
        empire.assignFleetShip('a', first.id);
        empire.assignFleetShip('c', first.id);
        equal(empire.getTaskForceShips(first.id).map(ship => ship.id),
            ['b', 'a', 'c'], 'Transfer order');
        empire.assignFleetShip('b', first.id);
        equal(empire.getTaskForceShips(first.id).map(ship => ship.id),
            ['b', 'a', 'c'], 'Same-force order');
        empire.assignFleetShip('b', second.id);
        empire.assignFleetShip('b', first.id);
        equal(empire.getTaskForceShips(first.id).map(ship => ship.id),
            ['a', 'c', 'b'], 'Returned ship appends');
        rejects(() => empire.assignFleetShip('a', 'missing'), 'Invalid force rejected');
        rejects(() => empire.assignFleetShip('missing', first.id), 'Invalid ship rejected');
    });
    test('batch assignments validate before moving ships and preserve destination members', () => {
        const before = JSON.stringify(empire.fleetShips);
        rejects(() => empire.assignFleetShips(['a', 'missing'], second.id),
            'Batch rejects unresolved ship');
        equal(JSON.stringify(empire.fleetShips), before, 'Invalid batch cannot partially move ships');
        rejects(() => empire.assignFleetShips(['a', 'b'], 'missing'), 'Invalid batch destination');
        rejects(() => empire.assignFleetShips([], second.id), 'Empty batch rejected');
        empire.assignFleetShips(['a', 'b', 'a'], second.id);
        equal(empire.getTaskForceShips(second.id).map(ship => ship.id), ['a', 'b'], 'Batch deduplicated');
        const existingOrder = empire.getTaskForceShips(second.id)[0].taskForceOrder;
        empire.assignFleetShips(['b', 'c', 'a'], second.id);
        equal(empire.getTaskForceShips(second.id).map(ship => ship.id), ['a', 'b', 'c'],
            'Existing members retain order');
        equal(empire.getTaskForceShips(second.id)[0].taskForceOrder, existingOrder,
            'Existing member order unchanged');
        empire.assignFleetShips(['a', 'b', 'c'], first.id);
    });
    test('current saves round-trip membership order and reject old formats', () => {
        const manager = new DataManager();
        const saved = manager.serializeEmpireData(empire);
        const restored = Object.assign(Object.create(Empire.prototype), {
            campaignCostRules: { categories: {}, items: {} }
        });
        restored.fromJSON(manager.deserializeEmpireData(JSON.parse(JSON.stringify(saved))).empire);
        equal(restored.getTaskForceShips(first.id).map(ship => ship.id),
            ['a', 'b', 'c'], 'Restored membership order');
        rejects(() => manager.deserializeEmpireData({ ...saved, fileVersion: '2.0' }),
            'Old file version rejected');
        const legacy = JSON.parse(JSON.stringify(saved));
        legacy.empire.fleetShips[0].contents.hardpoints = [];
        rejects(() => manager.deserializeEmpireData(legacy), 'Old contents rejected');
        const duplicatedOrder = JSON.parse(JSON.stringify(saved));
        duplicatedOrder.empire.fleetShips[1].taskForceOrder =
            duplicatedOrder.empire.fleetShips[0].taskForceOrder;
        rejects(() => manager.deserializeEmpireData(duplicatedOrder), 'Duplicate order rejected');
        empire.removeTaskForce(first.id);
        assert(empire.fleetShips.every(ship => ship.taskForceId === null),
            'Disband returns all ships to unassigned');
        assert(manager.validateImportData(manager.serializeEmpireData(empire)),
            'Disbanded membership remains valid');
        saved.widgets.push({
            id: 'loadout', type: 'shipLoadout', title: 'Loadout',
            x: 0, y: 0, width: 400, height: 300,
            explicitWidth: false, explicitHeight: false, minimized: false,
            parents: [], children: [], data: {}
        });
        assert(manager.validateImportData(saved), 'Current Ship Loadout widget type accepted');
    });
    const catalogueResponse = await fetch('../data/Hardpoints.json');
    if (!catalogueResponse.ok) throw new Error('Unable to load device test catalogue.');
    ShipLoadoutWidget.deviceCatalogue = (await catalogueResponse.json()).devices;
    const fixture = { id: 'fixture-gun', cost: 3, hp: 'H01' };
    ShipCapacity.fleetWeapons = [fixture];
    const options = {
        troops: [{ id: 'troop', name: 'Troop', berthsRequired: 1, cost: 2 }],
        munitions: [{ id: 'munition', name: 'Munition', magazineCells: 6, cost: 1.5, profile: 'missile' }],
        craft: [{ id: 'craft', name: 'Craft', baysRequired: 2, cost: 4 }]
    };
    const configured = contents();
    configured.hardpointLoadout.devices = [
        { instanceId: 'adapter-1', deviceId: 'adapter', contents: [{ id: 'munition', count: 1 }] },
        { instanceId: 'adapter-2', deviceId: 'adapter', contents: [] },
        { instanceId: 'clamp-1', deviceId: 'clamp', contents: [{ id: 'craft', count: 1 }] },
        { instanceId: 'clamp-2', deviceId: 'clamp', contents: [] },
        { instanceId: 'fixture-1', deviceId: 'fixture', contents: [] },
        { instanceId: 'fixture-2', deviceId: 'fixture', contents: [] }
    ];
    configured.hardpointLoadout.weapons = [{ weaponId: fixture.id, count: 2, arc: 'P' }];
    test('adapter and clamp capacities are isolated, fixture mounts are pooled', () => {
        let summary = ShipCapacity.summarizeContents(configured, options, [fixture]);
        assert(summary.valid, 'Valid isolated contents and pooled fixture mounts');
        equal(summary.used.fixtureMounts, 2, 'Fixture mount usage');
        configured.hardpointLoadout.devices[0].contents[0].count = 2;
        summary = ShipCapacity.summarizeContents(configured, options, [fixture]);
        assert(!summary.valid, 'Adapter cannot borrow another adapter cells');
        configured.hardpointLoadout.devices[0].contents[0].count = 1;
        configured.hardpointLoadout.devices[2].contents[0].count = 2;
        assert(!ShipCapacity.summarizeContents(configured, options, [fixture]).valid,
            'Clamp cannot borrow another clamp bays');
        configured.hardpointLoadout.devices[2].contents[0].count = 1;
        configured.hardpointLoadout.weapons[0].count = 3;
        assert(!ShipCapacity.summarizeContents(configured, options, [fixture]).valid,
            'Fixture mount sum enforced');
        configured.hardpointLoadout.weapons[0].count = 2;
        configured.hardpointLoadout.devices[0].contents[0].count = -1;
        assert(!ShipCapacity.summarizeContents(configured, options, [fixture]).valid,
            'Negative quantities rejected');
        configured.hardpointLoadout.devices[0].contents[0].count = 1.5;
        assert(!ShipCapacity.summarizeContents(configured, options, [fixture]).valid,
            'Fractional quantities rejected');
        configured.hardpointLoadout.devices[0].contents[0].count = 1;
        rejects(() => ShipCapacity.summarizeContents({ hardpoints: [] }, options),
            'Direct hardpoint format rejected');
    });
    const classWidget = {
        id: 'class', type: 'ship',
        shipData: { name: 'Class', hullComposition: { system: 4, magazine: 1, hangar: 1 },
            resources: { cargo: 100, remass: 80 } },
        getCostTotals: () => ({ CV: 100 })
    };
    const outfitWidget = {
        id: 'outfit', type: 'outfit',
        outfitData: { name: 'Outfit', systems: {
            general: { berthing: 2, berthingCargo: 10, tending: 1 },
            quantum: { targeting: 1, command: 2, navigation: 1 }
        } },
        getCostTotals: () => ({ CV: 50 }),
        getResourceSources: () => ({ hardpoints: 10 }),
        getWeaponResourceUse: () => ({ hardpoints: 0 })
    };
    const widgets = new Map([
        ['class', classWidget], ['outfit', outfitWidget],
        ['munition', { id: 'munition', type: 'munitions', munitionData: {
            name: 'Munition', cost: 1.5, profile: 'missile', operational: false
        }, getMagazineCells: () => 6 }],
        ['craft', { id: 'craft', type: 'craft', craftData: {
            name: 'Craft', baysRequired: 2, operational: false
        }, calculateStats: () => ({ combatValue: 4 }) }]
    ]);
    window.widgetManager = { getWidget: id => widgets.get(id), getAllWidgets: () => [...widgets.values()] };
    window.empire = empire;
    const ship = {
        classWidgetId: 'class', outfitWidgetId: 'outfit',
        stores: { cargo: 20, remass: 40 }, contents: configured
    };
    test('unique ship totals use actual contents and outfit navigation plus cradles', () => {
        configured.magazine.push({ id: 'munition', count: 1 });
        configured.hangar.push({ id: 'craft', count: 1 });
        configured.hardpointLoadout.devices.push(
            { instanceId: 'cradle-1', deviceId: 'cradle', contents: [] },
            { instanceId: 'cradle-2', deviceId: 'cradle', contents: [] }
        );
        const metrics = ShipCapacity.getFleetShipMetrics(ship);
        equal(metrics.contentTotals, { troops: 0, munitions: 2, craft: 2 }, 'Contents totals');
        equal(metrics.deviceResources.cells, 20, 'Adapter cells aggregate');
        equal(metrics.deviceResources.bays, 4, 'Clamp bays aggregate');
        equal(metrics.jumpDistance, 2, 'One navigation gives ship range 2');
        equal(metrics.jumpiumCapacity, 3, 'Outfit capacity plus actual cradles');
        equal(metrics.endurance, 5, 'Current stores plus berthing cargo / consumption');
        equal(metrics.cost, 150 + ShipCapacity.summarizeContents(configured,
            ShipCapacity.getContentOptions(true), [fixture]).cost, 'Actual contents CV');
        assert(metrics.contentsValid, 'Non-operational existing designs still counted');
        outfitWidget.outfitData.systems.quantum.navigation = 0;
        equal(ShipCapacity.getFleetShipMetrics(ship).jumpDistance, null, 'No navigation, no ship jump');
        outfitWidget.outfitData.systems.quantum.navigation = 2;
        equal(ShipCapacity.getFleetShipMetrics(ship).jumpiumCapacity, 4, 'Two navigation plus cradles');
        widgets.delete('class');
        const missing = ShipCapacity.getFleetShipMetrics(ship);
        assert(missing.missing && missing.cost === null && missing.endurance === null,
            'Missing design explicitly unavailable');
        widgets.set('class', classWidget);
    });
    const notifications = [];
    const testApp = {
        empire,
        saveEmpire() {},
        showNotification(message, type) { notifications.push({ message, type }); }
    };
    const view = new FleetView(testApp);
    test('selected groups render directly in the main panel without an outer card', () => {
        const panel = document.createElement('div');
        for (const id of [null, second.id]) {
            view.selectedTaskForceId = id;
            view.renderTaskForces(panel);
            assert(panel.firstElementChild.matches('.task-force-header'),
                'Group header is a direct child of the main panel');
            assert(panel.querySelector(':scope > .fleet-table-scroll'),
                'Ship list is a direct child of the main panel');
            assert(!panel.querySelector('.task-force-group, .fleet-force-detail'),
                'No outer group card remains');
        }
        view.selectedTaskForceId = null;
    });
    test('main table headers, inventory entries and tiles tooltip placement', () => {
        equal(view.getColumns().map(column => column.label), [
            'Class', 'Outfit', 'Name', 'CV', 'Cargo', 'Cargo cap', 'Remass', 'Remass cap',
            'Bays', 'Bays cap', 'Cells', 'Cells cap', 'Berths', 'Berths cap',
            'Hardpoints', 'Hardpoints cap', 'Jumpium', 'Jumpium cap'
        ], 'Column labels');
        const row = view.createInventoryRow(empire.fleetShips[0]);
        assert(!row.querySelector('.fleet-inventory-configure') &&
            ![...row.querySelectorAll('button')].some(button => /Configure/.test(button.textContent)),
            'Inventory has no configure button');
        const tooltip = document.createElement('div');
        tooltip.style.cssText = 'position:fixed;width:200px;height:100px';
        document.body.appendChild(tooltip);
        view.tilesTooltip = tooltip;
        view.positionTilesTooltip(100, 300);
        equal([tooltip.style.left, tooltip.style.top], ['116px', '250px'], 'Right of cursor, vertically centred');
        view.positionTilesTooltip(window.innerWidth - 10, 2);
        equal([tooltip.style.left, tooltip.style.top],
            [`${window.innerWidth - 226}px`, '8px'], 'Flips left and clamps to viewport');
        view.positionTilesTooltip(50, window.innerHeight - 2);
        equal(tooltip.style.top, `${window.innerHeight - 108}px`, 'Clamped above bottom edge');
        view.positionTilesTooltip(30, 300, 342);
        equal([tooltip.style.left, tooltip.style.top], ['342px', '250px'],
            'Panel anchor ignores cursor x and centres on cursor y');
        view.positionTilesTooltip(900, 300, 342);
        equal(tooltip.style.left, '342px', 'Panel anchor does not track cursor x');
        view.positionTilesTooltip(30, 2, window.innerWidth);
        equal([tooltip.style.left, tooltip.style.top],
            [`${window.innerWidth - 208}px`, '8px'], 'Panel anchor stays in viewport');
        view.hideTilesTooltip();
        assert(!tooltip.isConnected, 'Tooltip hidden');
        view.tilesTooltip = null;
    });
    test('delete action removes a ship only after confirmation', () => {
        const originalConfirm = window.confirm;
        empire.addFleetShip({ id: 'doomed', name: 'Doomed', contents: contents() });
        try {
            window.confirm = () => false;
            assert(!view.deleteShip(empire.fleetShips.find(ship => ship.id === 'doomed')), 'Cancel keeps ship');
            assert(empire.fleetShips.some(ship => ship.id === 'doomed'), 'Ship retained after cancel');
            window.confirm = () => true;
            view.selectedShipIds.add('doomed');
            view.selectedShipId = 'doomed';
            assert(view.deleteShip(empire.fleetShips.find(ship => ship.id === 'doomed')), 'Confirm deletes');
            assert(!empire.fleetShips.some(ship => ship.id === 'doomed'), 'Ship removed');
            assert(!view.selectedShipIds.has('doomed') && view.selectedShipId === null, 'Selection cleared');
        } finally {
            window.confirm = originalConfirm;
        }
    });
    test('shared Ctrl and additive Shift selections span groups and respect visible sort order', () => {
        view.selectShips('a', {}, ['a', 'b', 'c'], 'inventory');
        view.selectShips('c', { ctrlKey: true }, ['a', 'b', 'c'], 'inventory');
        equal([...view.selectedShipIds], ['a', 'c'], 'Ctrl adds distinct selection');
        view.selectShips('b', { shiftKey: true }, ['a', 'b', 'c'], 'inventory');
        equal([...view.selectedShipIds], ['a', 'c', 'b'], 'Shift preserves distinct and includes range');
        view.selectShips('a', { ctrlKey: true }, ['a', 'b', 'c'], 'inventory');
        assert(!view.selectedShipIds.has('a'), 'Ctrl toggles off');
        view.selectShips('four', { metaKey: true }, ['four', 'two', 'three', 'one'], 'main:force');
        view.selectShips('three', { shiftKey: true }, ['four', 'two', 'three', 'one'], 'main:force');
        equal([...view.selectedShipIds], ['c', 'b', 'four', 'two', 'three'],
            'Main sorted range preserves inventory selections');
        view.selectShips('one', {}, ['four', 'two', 'three', 'one'], 'main:force');
        equal([...view.selectedShipIds], ['one'], 'Plain click replaces shared selection');
        view.selectedShipIds.clear();
        view.selectionAnchors.clear();
    });
    test('dragging a selected ship transfers all selections and unselected drag replaces selection', () => {
        const dragView = new FleetView(testApp);
        dragView.render = () => {};
        dragView.selectedShipIds = new Set(['a', 'c']);
        const element = document.createElement('div');
        dragView.makeDraggable(element, empire.fleetShips.find(entry => entry.id === 'c'));
        const transfer = new DataTransfer();
        element.dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer }));
        equal(JSON.parse(transfer.getData('application/x-fv-fleet-ships')), ['a', 'c'],
            'Drag carries selected set, not just source');
        const target = document.createElement('div');
        dragView.makeDropTarget(target, second.id);
        target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, cancelable: true }));
        equal(empire.getTaskForceShips(second.id).map(entry => entry.id), ['a', 'c'],
            'Whole selection moved together');
        equal([...dragView.selectedShipIds], ['a', 'c'], 'Selection retained after transfer');
        const unselected = document.createElement('div');
        dragView.makeDraggable(unselected, empire.fleetShips.find(entry => entry.id === 'b'));
        const single = new DataTransfer();
        unselected.dispatchEvent(new DragEvent('dragstart', { dataTransfer: single }));
        equal([...dragView.selectedShipIds], ['b'], 'Unselected drag replaces selection');
        const pool = document.createElement('div');
        dragView.makeDropTarget(pool, null);
        pool.dispatchEvent(new DragEvent('drop', { dataTransfer: single, cancelable: true }));
        equal(empire.getTaskForceShips(null).map(entry => entry.id), ['b'], 'Drag to pool');
        const before = JSON.stringify(empire.fleetShips);
        const malformed = new DataTransfer();
        malformed.setData('application/x-fv-fleet-ships', '{');
        target.dispatchEvent(new DragEvent('drop', { dataTransfer: malformed, cancelable: true }));
        equal(JSON.stringify(empire.fleetShips), before, 'Malformed drag cannot change membership');
        assert(notifications.some(entry => entry.type === 'error'), 'Invalid drag reports error');
        empire.assignFleetShips(['a', 'b', 'c'], null);
    });
    const sortable = [
        { ...ship, id: 'one', name: 'Beta', stores: { cargo: 5, remass: 40 } },
        { ...ship, id: 'two', name: 'Alpha', stores: { cargo: 10, remass: 40 } },
        { ...ship, id: 'three', name: 'Alpha', stores: { cargo: 2, remass: 40 } },
        { ...ship, id: 'four', name: 'Alpha', stores: { cargo: 2, remass: 40 } }
    ];
    test('prioritized sorts cycle, compact and preserve insertion-order ties', () => {
        view.cycleSort('class', 'force');
        view.cycleSort('name', 'force');
        view.cycleSort('cargo', 'force');
        view.cycleSort('cargo', 'force');
        equal(view.sortShips(sortable, 'force').map(entry => entry.id),
            ['two', 'three', 'four', 'one'], 'Priority order and stable ties');
        equal(view.sorts.get('force').map(sort => [sort.key, sort.direction]),
            [['class', 1], ['name', 1], ['cargo', -1]], 'Ascending and descending priorities');
        view.cycleSort('name', 'force');
        view.cycleSort('name', 'force');
        equal(view.sorts.get('force').map(sort => sort.key),
            ['class', 'cargo'], 'Neutral removes priority');
        const table = view.createShipTable(sortable, 'force');
        equal([...table.querySelectorAll('.fleet-sort-priority')].map(badge => badge.textContent),
            ['↑ 1', '↓ 2'], 'Priority badges compact');
        view.sorts.set('force', []);
        equal(view.sortShips(sortable, 'force').map(entry => entry.id),
            ['one', 'two', 'three', 'four'], 'Clear restores membership order');
        assert(!view.sorts.has('another-force'), 'Sorts isolated per force');
    });
    const summaryValues = summary => Object.fromEntries([...summary.querySelectorAll('dt')]
        .map(term => [term.textContent, term.nextElementSibling.textContent]));
    const supported = [
        { ...ship, id: 'supported-a', name: 'A', stores: { cargo: 20, remass: 40 } },
        { ...ship, id: 'supported-b', name: 'B', stores: { cargo: 80, remass: 40 } }
    ];
    test('force summaries distinguish occupancy, tending endurance and navigation eligibility', () => {
        let values = summaryValues(view.createForceSummary(supported));
        equal(values.Endurance, '10', 'Pooled current cargo and berthing cargo');
        equal(values['Munitions / Cells'], '24 / 90', 'Magazine and adapter occupancy, not item counts');
        equal(values['Maximum Jump Distance'], '2', 'Two navigation qualifies for force range');
        outfitWidget.outfitData.systems.general.tending = 0;
        view.metrics.clear();
        values = summaryValues(view.createForceSummary(supported));
        equal(values.Endurance, '5', 'Without tending use lowest endurance');
        outfitWidget.outfitData.systems.quantum.navigation = 1;
        view.metrics.clear();
        values = summaryValues(view.createForceSummary(supported));
        assert(values['Maximum Jump Distance'].includes('Unavailable'),
            'One navigation allows ship jump but not force range');
        outfitWidget.outfitData.systems.quantum.navigation = 2;
        outfitWidget.outfitData.systems.general.tending = 1;
        view.metrics.clear();
    });
    const builder = new ShipBuilder(testApp);
    builder.options = options;
    builder.hardpointWeapons = [fixture];
    builder.capacities = { berths: 10, magazineCells: 25, hangarBays: 4, hardpoints: 15 };
    await builder.openContentsEditorDialog({ title: 'Test contents', contents: configured, onApply() {} });
    test('contents editor groups devices and enforces individual capacities', () => {
        const dialog = document.querySelector('.ship-contents-dialog');
        const adapters = [...dialog.querySelectorAll('.ship-device-contents')]
            .filter(section => section.querySelector('h4').textContent.startsWith('Adapter'));
        equal(adapters.length, 2, 'One compact contents group per adapter');
        assert(adapters[0].querySelector('button').disabled, 'First adapter cannot add another 6-cell munition');
        assert(!adapters[1].querySelector('button').disabled, 'Second adapter retains independent free cells');
        assert(dialog.querySelector('[aria-label="Close"]').classList.contains('widget-control-btn'),
            'Close uses shared widget styling');
        const clampCount = dialog.querySelector('[aria-label="Clamp 1 Craft count"]');
        clampCount.value = '2';
        clampCount.dispatchEvent(new Event('input', { bubbles: true }));
        assert(dialog.querySelector('.ship-builder-confirm').disabled,
            'Over-capacity clamp disables Apply');
        clampCount.value = '1';
        clampCount.dispatchEvent(new Event('change', { bubbles: true }));
        assert(!dialog.querySelector('.ship-builder-confirm').disabled, 'Valid count restores Apply');
        dialog.querySelector('[aria-label="Remove one Fixture"]').click();
        assert(notifications.some(entry => entry.type === 'error' && entry.message.includes('Fixture')),
            'Fixture removal reports mounted-weapon conflict');
        equal([...dialog.querySelectorAll('h4')].filter(heading =>
            heading.textContent.startsWith('Fixture-mounted')).length, 1,
        'Mounted fixture controls remain accessible after blocked removal');
        dialog.querySelector('[aria-label="Close"]').click();
        rejects(() => ShipBuilder.cloneContents({ hardpoints: [] }), 'Old clone format rejected explicitly');
    });
    await builder.openContentsEditorDialog({ title: 'Empty contents', contents: contents(), onApply() {} });
    test('fixture-mounted controls are hidden without fixtures', () => {
        const dialog = document.querySelector('.ship-contents-dialog');
        const heading = [...dialog.querySelectorAll('h4')].find(element =>
            element.textContent.startsWith('Fixture-mounted'));
        assert(heading.closest('section').hidden, 'No fixture weapon section without fixtures');
        dialog.querySelector('[aria-label="Close"]').click();
    });
    return results;
}

runFleetRegressionChecks().then(results => {
    document.getElementById('results').textContent = results.join('\n');
    document.body.dataset.testResult = 'passed';
}).catch(error => {
    console.error('Fleet regression checks failed:', error);
    document.getElementById('results').textContent = `FAIL ${error.stack}`;
    document.body.dataset.testResult = 'failed';
});
