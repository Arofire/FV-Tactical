const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
function runtime() {
    const context = vm.createContext({
        console,
        window: { empire: { hasTech: id => id === 'unlocked' }, widgetManager: { getAllWidgets: () => [] } },
        Widget: class {},
        fetch: () => { throw new Error('Unexpected fetch'); }
    });
    for (const [file, name] of [
        ['core/WeaponCatalogue', 'WeaponCatalogue'],
        ['core/ShipCapacity', 'ShipCapacity'],
        ['widgets/DesignWidget', 'DesignWidget'],
        ['widgets/OutfitWidget', 'OutfitWidget'],
        ['widgets/CraftWidget', 'CraftWidget'],
        ['widgets/TroopsWidget', 'TroopsWidget'],
        ['widgets/ShipLoadoutWidget', 'ShipLoadoutWidget'],
        ['widgets/MunitionsWidget', 'MunitionsWidget'],
        ['widgets/SummaryWidget', 'SummaryWidget']
    ]) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', `${file}.js`), 'utf8') +
            `\nglobalThis.${name} = ${name};`, context);
    }
    return context;
}
const plain = value => JSON.parse(JSON.stringify(value));
const weapon = (overrides = {}) => ({
    id: 'example', name: 'Example',
    accuracy: [0, -2, '10: -4', null, null],
    damage: [null, 2, 0, null, null],
    hp: 'E02', requiredTech: [], sourceRow: 3, cost: 31,
    ...overrides
});
const catalogue = (weapons = [weapon()]) => ({
    schemaVersion: 1, source: { url: 'fixture.csv', description: 'Test fixture' },
    categories: [{ name: 'Test', description: '', weapons }]
});

test('validation returns compact records unchanged, including partial null ranges', () => {
    const { WeaponCatalogue: W } = runtime();
    const data = catalogue();
    const original = JSON.stringify(data);
    assert.equal(W.validate(data), data);
    assert.equal(JSON.stringify(data), original);
    for (const field of ['ranges', 'notes', 'resourceType', 'resourceCount', 'isSpinal']) {
        assert.equal(Object.hasOwn(data.categories[0].weapons[0], field), false);
    }
});

test('invalid input fails with weapon context instead of normalizing it', () => {
    const { WeaponCatalogue: W } = runtime();
    for (const invalid of [
        { accuracy: [1, 2] }, { damage: [1, 2, 3, 4, {}] },
        { requiredTech: [''] }, { cost: {} }, { isMain: 'true' },
        { tagsDescription: null }, { sourceRow: 0 }, { hp: 'E99999999999999999999' },
        { ranges: [] }, { notes: [] }, { resourceType: 'emplacements' }, { arbitrary: 'value' }
    ]) {
        assert.throws(() => W.validate(catalogue([weapon(invalid)])), /Weapon "example" in "Test"/);
    }
    assert.throws(() => W.validate(catalogue([weapon(), weapon()])), /duplicate/);
    assert.throws(() => W.validate({ ...catalogue(), schemaVersion: 2 }), /schemaVersion/);
});

test('mount and tag queries preserve special codes, zeroes, expressions and decimal values', () => {
    const { WeaponCatalogue: W } = runtime();
    for (const [hp, resourceType, resourceCount] of [
        ['H01', 'hardpoints', 1], ['U02', 'utilities', 2], [' E04 ', 'emplacements', 4],
        ['e12', 'emplacements', 12], ['AHP', null, null], ['C02', null, null],
        ['S01', null, null], ['MHP', null, null], [undefined, null, null]
    ]) {
        assert.deepEqual(plain(W.getMount({ hp })), { resourceType, resourceCount });
    }
    const w = weapon({ tagsDescription: 'Generator, Expendable(4), Fraction(0.5), Empty(), Other(N/A), Expr(3: +0), Hex(0x10)' });
    assert.equal(W.hasTag(w, 'generator'), true);
    assert.equal(W.getNote(w, 'Expendable').value, 4);
    assert.equal(W.getNote(w, 'Fraction').value, 0.5);
    assert.equal(W.getNote(w, 'Empty').value, null);
    assert.equal(W.getNote(w, 'Other').value, 'N/A');
    assert.equal(W.getNote(w, 'Expr').value, '3: +0');
    assert.equal(W.getNote(w, 'Hex').value, '0x10');
    assert.equal(W.getNote({}, 'Expendable'), undefined);
    assert.equal(Object.hasOwn(w, 'notes'), false);
});

test('concurrent consumers share one validated fetch and failures can be retried', async () => {
    const context = runtime();
    let calls = 0;
    const data = catalogue();
    context.fetch = async () => { calls++; return { ok: true, json: async () => data }; };
    const { WeaponCatalogue: W } = context;
    const results = await Promise.all([W.load(), W.load(), context.ShipCapacity.ensureWeaponsData()]);
    assert.equal(calls, 1);
    assert.ok(results.every(result => result === data));
    W.loadPromise = null;
    context.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(W.load(), /503/);
    assert.equal(W.loadPromise, null);
    context.fetch = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(W.load(), /schemaVersion/);
    assert.equal(W.loadPromise, null);
    context.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
    await assert.rejects(W.load(), /Invalid JSON/);
    assert.equal(W.loadPromise, null);
    context.fetch = async () => ({ ok: true, json: async () => data });
    assert.equal(await W.load(), data);
});

test('omitted optional defaults and explicit zero or false stay distinct without expansion', () => {
    const { WeaponCatalogue: W } = runtime();
    const zero = weapon({ tier: 0, cost: 0, isMain: false, tagsDescription: '' });
    const absent = weapon({ id: 'absent' });
    delete absent.cost;
    delete absent.hp;
    const data = catalogue([zero, absent]);
    assert.equal(W.validate(data), data);
    assert.equal(zero.tier, 0);
    assert.equal(zero.cost, 0);
    assert.equal(zero.isMain, false);
    assert.equal(zero.tagsDescription, '');
    assert.equal(Object.hasOwn(absent, 'cost'), false);
    assert.equal(Object.hasOwn(absent, 'hp'), false);
    assert.equal(Object.hasOwn(absent, 'isMain'), false);
});

test('Outfit directly filters compact definitions and counts multi-arc mounts', () => {
    const context = runtime();
    const O = context.OutfitWidget;
    const definitions = [
        weapon(), weapon({ id: 'spinal', hp: 'E04', isSpinal: true, isMain: true }),
        weapon({ id: 'pd', hp: 'U01', isPointDefense: true }),
        weapon({ id: 'fixture', hp: 'H01' }),
        weapon({ id: 'special-spinal', hp: 'S01', isSpinal: true })
    ];
    const outfit = Object.create(O.prototype);
    outfit.weaponsData = catalogue(definitions);
    outfit.outfitData = { weapons: {
        spinal: 'spinal',
        offensive: [{ weaponId: 'example', count: 2, arc: 'FP', isTurreted: true }],
        defensive: [{ weaponId: 'pd', count: 3 }]
    } };
    assert.deepEqual(plain(outfit.getWeaponResourceUse()), { hardpoints: 0, utilities: 3, emplacements: 10 });
    assert.deepEqual(plain(outfit.getOffensiveWeapons().map(w => w.id)), ['example']);
    assert.deepEqual(plain(outfit.getPDWeapons().map(w => w.id)), ['pd']);
    assert.deepEqual(plain(outfit.getSpinalWeapons().map(w => w.id)), ['spinal', 'special-spinal']);
    assert.equal(outfit.isTurretOptionDisabled(weapon({ hp: 'E01' })), true);
    assert.equal(outfit.isTurretOptionDisabled(weapon()), false);
    assert.equal(outfit.getValidWeaponArc('FPSA', true, true), 'PS');
    assert.equal(outfit.isGeneratorTaggedWeapon(weapon({ tagsDescription: 'Generator' })), true);
});

test('a current definition clears stale saved classification and resource summaries', () => {
    const context = runtime();
    const outfit = Object.create(context.OutfitWidget.prototype);
    outfit.weaponsData = catalogue([weapon({ hp: 'AHP' })]);
    const selection = {
        weaponId: 'example', count: 1, hp: 'E04', resourceType: 'emplacements',
        resourceCount: 4, isSpinal: true, isMain: true, isPointDefense: true, arc: 'F'
    };
    outfit.applyWeaponRequirements(selection, 'offensive');
    assert.equal(selection.hp, 'AHP');
    assert.equal(selection.resourceType, null);
    assert.equal(selection.resourceCount, null);
    assert.equal(selection.isSpinal, false);
    assert.equal(selection.isMain, false);
    assert.equal(selection.isPointDefense, false);
});

test('saved turret arcs survive restoration before the compact catalogue has loaded', () => {
    const context = runtime();
    const outfit = Object.create(context.OutfitWidget.prototype);
    outfit.weaponsData = { categories: [] };
    const selection = {
        weaponId: 'example', count: 2, hp: 'E02', resourceType: 'emplacements',
        resourceCount: 2, isTurreted: true, arc: 'FP'
    };
    outfit.applyWeaponRequirements(selection, 'offensive');
    assert.equal(selection.isTurreted, true);
    assert.equal(selection.arc, 'FP');
    outfit.weaponsData = catalogue([weapon()]);
    outfit.applyWeaponRequirements(selection, 'offensive');
    assert.equal(selection.isTurreted, true);
    assert.equal(selection.arc, 'FP');
});

test('operational munition definitions use compact arrays and one-hardpoint mount', () => {
    const context = runtime();
    const munition = Object.create(context.MunitionsWidget.prototype);
    munition.id = 'munition-1';
    munition.munitionData = {
        name: 'Test torpedo', accuracy: { short: 2, medium: 1, long: 0, distant: -1, extreme: -2 },
        cost: 2
    };
    munition.findProfile = () => ({ damage: 4, tags: [{ name: 'Expendable', value: 1 }] });
    munition.findPayload = () => ({ notes: [{ name: 'Blast' }] });
    munition.getSelectedRequiredTech = () => ['unlocked'];
    const result = munition.toWeaponDefinition();
    assert.deepEqual(plain(result.accuracy), [2, 1, 0, -1, -2]);
    assert.deepEqual(plain(result.damage), [4, 4, 4, 4, 4]);
    assert.equal(result.hp, 'H01');
    assert.equal(context.WeaponCatalogue.getNote(result, 'Expendable').value, 1);
    for (const field of ['ranges', 'notes', 'resourceType', 'resourceCount']) {
        assert.equal(Object.hasOwn(result, field), false);
    }
});

test('hardpoint options and content accounting use native compact mount data', async () => {
    const context = runtime();
    const data = catalogue([
        weapon({ id: 'free', hp: 'H02' }),
        weapon({ id: 'locked', hp: 'H01', requiredTech: ['locked'] }),
        weapon({ id: 'unlocked', hp: 'H01', requiredTech: ['unlocked'] }),
        weapon({ id: 'not-hardpoint', hp: 'E02' })
    ]);
    context.WeaponCatalogue.loadPromise = Promise.resolve(data);
    const S = context.ShipCapacity;
    assert.deepEqual(plain((await S.getHardpointWeaponOptions()).map(w => w.id)), ['free', 'unlocked']);
    assert.equal((await S.getHardpointWeaponOptions(true)).length, 3);
    context.ShipLoadoutWidget.deviceCatalogue = [];
    const summary = S.summarizeContents(
        { hardpoints: [{ weaponId: 'free', count: 2, arc: 'FP', turreted: true }] },
        { troops: [], craft: [], munitions: [] }, data.categories[0].weapons);
    assert.equal(summary.used.hardpoints, 6);
    assert.equal(summary.cost, 62);
    assert.equal(context.CraftWidget.prototype.getItemSize('hardpoints', data.categories[0].weapons[0]), 2);
});

test('armour establishes usable hardpoint capacity rather than occupying its slots', () => {
    const context = runtime();
    const S = context.ShipCapacity;
    const outfit = Object.create(context.OutfitWidget.prototype);
    outfit.getConnectedClassData = () => ({
        containmentHulls: 27, armorEfficiency: 2, hullComposition: {}
    });
    outfit.getCoreData = () => null;
    outfit.outfitData = { defenses: { armor: 3 } };
    assert.equal(outfit.getResourceSources().hardpoints, 6);
    assert.equal(S.getCapacities({ shipData: {} }, outfit).hardpoints, 6);
    outfit.outfitData.defenses.armor = 10;
    assert.equal(outfit.getResourceSources().hardpoints, 9);
    assert.equal(S.getCapacities({ shipData: {} }, outfit).hardpoints, 9);
    outfit.outfitData.defenses.armor = 0;
    assert.equal(outfit.getResourceSources().hardpoints, 0);
    assert.equal(S.getCapacities({ shipData: {} }, outfit).hardpoints, 0);
    assert.equal(S.getHardpointCapacity(null, 10), null);
    const savedOutfit = {
        outfitData: { defenses: { armor: 3 } },
        getCoreData: () => ({ hardpoints: 9 }),
        getWeaponResourceUse: () => ({ hardpoints: 1 })
    };
    assert.equal(S.getCapacities({ shipData: { armorEfficiency: 2 } }, savedOutfit).hardpoints, 5);
    savedOutfit.outfitData.defenses.armor = 10;
    assert.equal(S.getCapacities({ shipData: { armorEfficiency: 2 } }, savedOutfit).hardpoints, 8);
});

test('connected design loadouts and copied Fleet devices consume the same slots exactly once', () => {
    const context = runtime();
    const outfit = Object.create(context.OutfitWidget.prototype);
    const empty = { general: { berthing: 0, craftLauncher: 0, laserGenerator: {}, tending: 0 }, entropy: {} };
    outfit.outfitData = { defenses: { armor: 3 }, utilityDevices: {}, systems: empty, weapons: {} };
    outfit.systemsData = { entropy: [] };
    outfit.getConnectedClassData = () => ({
        containmentHulls: 27, armorEfficiency: 2, hullComposition: {}
    });
    outfit.getCoreData = () => null;
    outfit.getWeaponResourceUse = () => ({ hardpoints: 1, utilities: 0, emplacements: 0 });
    const loadout = {
        type: 'shipLoadout',
        loadoutData: { operational: true, hardpointDevices: [
            { instanceId: 'fixture-1', deviceId: 'fixture', contents: [] },
            { instanceId: 'adapter-1', deviceId: 'adapter', contents: [] }
        ], weapons: [{ weaponId: 'gun', count: 1, arc: 'F' }] }
    };
    outfit.getConnectedDataByNodeType = () => [{
        data: { hardpointsUsed: 2, loadoutData: loadout.loadoutData }
    }];
    const used = outfit.getResourceUse();
    assert.equal(used.hardpoints, 3);
    const capacity = outfit.getResourceSources().hardpoints;
    const summary = Object.create(context.SummaryWidget.prototype);
    assert.equal(summary.getAvailableHardpoints({
        resources: { hardpoints: capacity }, armorHits: 6, resourceUse: used
    }, {}, outfit), 3);
    const fleetCapacity = context.ShipCapacity.getCapacities({ shipData: {} }, outfit);
    assert.equal(fleetCapacity.hardpoints, 5);
    context.ShipLoadoutWidget.deviceCatalogue = [
        { id: 'fixture', mounts: 1, cost: 3, requiredTech: [] },
        { id: 'adapter', cells: 10, cost: 2, requiredTech: [] }
    ];
    const contents = context.ShipCapacity.createFleetContents(loadout);
    const weapons = [weapon({ id: 'gun', hp: 'H01', cost: 11 })];
    const options = { troops: [], craft: [], munitions: [] };
    const fleet = context.ShipCapacity.summarizeContents(contents, options, weapons);
    assert.equal(fleet.used.hardpoints, 2);
    assert.equal(fleet.used.fixtureMounts, 1);
    assert.equal(fleetCapacity.hardpoints - fleet.used.hardpoints, 3);
    assert.equal(context.ShipCapacity.contentsFit(contents, fleetCapacity, options, weapons).fits, true);
    outfit.getConnectedDataByNodeType = () => [{
        data: { hardpointsUsed: 2, loadoutData: { ...loadout.loadoutData, operational: false } }
    }];
    assert.equal(outfit.getResourceUse().hardpoints, 1);
});

test('weapon catalogue failures do not normalize saved selections or report successful loading', async () => {
    const context = runtime();
    context.fetch = async () => ({ ok: false, status: 503 });
    for (const name of ['OutfitWidget', 'CraftWidget', 'TroopsWidget', 'ShipLoadoutWidget']) {
        const widget = Object.create(context[name].prototype);
        const errors = [];
        widget.reportCatalogueError = (label, error) => errors.push([label, error.message]);
        widget.refresh = () => {};
        widget.normalizeSelections = () => assert.fail(`${name} normalized after load failure`);
        widget.fetchJSON = async () => ({});
        widget.catalogues = {};
        widget.cataloguesLoaded = false;
        widget.weaponsDataLoaded = false;
        if (name === 'ShipLoadoutWidget') context.ShipLoadoutWidget.loadDeviceCatalogue = async () => [];
        if (name === 'OutfitWidget') await widget.loadWeaponsData();
        else await widget.loadCatalogues();
        assert.equal(widget.cataloguesLoaded, false);
        assert.equal(widget.weaponsDataLoaded, false);
        assert.equal(errors.length, 1, name);
        assert.match(errors[0][1], /503/);
    }
});

test('bundled catalogue validates without mutation and all required technologies exist', () => {
    const context = runtime();
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data/weapons.json'), 'utf8'));
    const technologies = JSON.parse(fs.readFileSync(path.join(root, 'data/tech-tree.json'), 'utf8'));
    const before = JSON.stringify(data);
    context.WeaponCatalogue.validate(data);
    assert.equal(JSON.stringify(data), before);
    const weapons = data.categories.flatMap(c => c.weapons);
    assert.equal(weapons.length, 281);
    assert.equal(data.categories.length, 14);
    assert.equal(data.categories.some(c => c.name === 'Warheads'), true);
    for (const weapon of weapons) {
        for (const tech of weapon.requiredTech) assert.ok(Object.hasOwn(technologies, tech), `${weapon.id}: ${tech}`);
    }
});

test('offline CSV import produces compact records used directly by browser consumers', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'weapon-contract-'));
    try {
        const header = Array(18).fill('');
        header[0] = 'Weapon';
        header[16] = 'HP';
        const section = Array(18).fill('');
        section[0] = 'Cannon';
        const row = Array(18).fill('');
        row[0] = 'Main Contract Fixture';
        row[1] = '0';
        row[2] = '4';
        row[3] = '10: -4';
        row[4] = '-1';
        row[9] = '2';
        row[11] = 'Projectile, Expendable(4)';
        row[15] = '0';
        row[16] = 'E04';
        row[17] = '31';
        const csv = [header, section, row].map(cells =>
            cells.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
        const source = path.join(directory, 'weapons.csv');
        const output = path.join(directory, 'weapons.json');
        fs.writeFileSync(source, csv);
        execFileSync('python3', [path.join(root, 'scripts/import_weapons.py'), '--source', source, '--output', output],
            { cwd: root });
        const { WeaponCatalogue: W } = runtime();
        const imported = W.validate(JSON.parse(fs.readFileSync(output, 'utf8')));
        const record = imported.categories[0].weapons[0];
        assert.deepEqual(record.accuracy, [0, '10: -4', null, null, 2]);
        assert.deepEqual(record.damage, [4, -1, null, null, null]);
        assert.equal(record.isMain, true);
        assert.equal(record.tier, 0);
        assert.equal(W.getMount(record).resourceCount, 4);
        assert.equal(W.getNote(record, 'Expendable').value, 4);
        assert.equal(Object.hasOwn(record, 'ranges'), false);
        assert.equal(Object.hasOwn(record, 'notes'), false);
        const first = fs.readFileSync(output, 'utf8');

        const generalSource = path.join(directory, 'general.csv');
        const generalOutput = path.join(directory, 'general.json');
        fs.writeFileSync(generalSource,
            [header, row].map(cells =>
                cells.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n');
        execFileSync('python3', [path.join(root, 'scripts/import_weapons.py'),
            '--source', generalSource, '--output', generalOutput], { cwd: root });
        const general = W.validate(JSON.parse(fs.readFileSync(generalOutput, 'utf8')));
        assert.equal(general.categories[0].name, 'General');
        assert.equal(general.categories[0].description, '');
        assert.equal(typeof general.categories[0].description, 'string');

        execFileSync('python3', [path.join(root, 'tmp_weapon_parser.py'), '--source', source, '--output', output],
            { cwd: root });
        assert.equal(fs.readFileSync(output, 'utf8'), first);
    } finally {
        fs.rmSync(directory, { recursive: true });
    }
});
