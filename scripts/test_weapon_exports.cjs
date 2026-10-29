const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadExportContext() {
    const widgetManager = {
        getWidget(id) {
            return widgets.get(id) || null;
        },
        getAllWidgets() {
            return Array.from(widgets.values());
        }
    };
    const widgets = new Map();
    const context = vm.createContext({
        Blob,
        console,
        document: {},
        fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
        window: { empire: {}, widgetManager },
        Widget: class Widget {},
        ShipCapacity: {
            ensureWeaponsData: async () => catalogue,
            getCoreForOutfit: () => null
        },
        ShipBuilder: {
            cloneContents: contents => JSON.parse(JSON.stringify(contents)),
            emptyContents: () => ({
                hardpoints: [],
                hardpointLoadout: { devices: [], weapons: [] },
                magazine: [],
                berths: []
            })
        },
        ShipLoadoutWidget: { getDeviceCatalogue: () => [] }
    });

    const catalogue = {
        categories: [{ name: 'Weapons', weapons: [] }]
    };
    const capacityOverrides = context.ShipCapacity;
    vm.runInContext(
        fs.readFileSync(path.join(root, 'js/core/ShipCapacity.js'), 'utf8') +
            '\nglobalThis.ShipCapacity = ShipCapacity;',
        context,
        { filename: 'js/core/ShipCapacity.js' }
    );
    Object.assign(context.ShipCapacity, capacityOverrides);
    const weaponCatalogueSource = fs.readFileSync(
        path.join(root, 'js/core/WeaponCatalogue.js'),
        'utf8'
    );
    vm.runInContext(
        `${weaponCatalogueSource}\nglobalThis.WeaponCatalogue = WeaponCatalogue;`,
        context,
        { filename: 'js/core/WeaponCatalogue.js' }
    );
    const summarySource = fs.readFileSync(
        path.join(root, 'js/widgets/SummaryWidget.js'),
        'utf8'
    );
    vm.runInContext(
        `${summarySource}\nglobalThis.SummaryWidget = SummaryWidget;`,
        context,
        { filename: 'js/widgets/SummaryWidget.js' }
    );
    const exporterSource = fs.readFileSync(
        path.join(root, 'js/fleet/UniqueShipExporter.js'),
        'utf8'
    );
    vm.runInContext(
        `${exporterSource}\nglobalThis.UniqueShipExporter = UniqueShipExporter;`,
        context,
        { filename: 'js/fleet/UniqueShipExporter.js' }
    );

    vm.runInContext(`
        SummaryWidget.prototype.createLayout = () => ({
            rows: 1,
            cols: 1,
            cells: [],
            missing: 0
        });
        SummaryWidget.prototype.buildArmorTable = () => [];
        SummaryWidget.prototype.blockTable = () => [];
    `, context);

    return { context, catalogue, widgets };
}

function installExportFixture(context, catalogue, widgets) {
    const weapon = {
        id: 'compact-cannon',
        name: 'Compact Cannon',
        accuracy: ['10: -4', 0, -2, null, '5'],
        damage: [2, 0, 3, null, 1],
        tagsDescription: 'Beam, Expendable(3), Charge(1.5)',
        hp: 'E04',
        isMain: true,
        isSpinal: false,
        requiredTech: []
    };
    catalogue.categories[0].weapons.push(weapon);
    const classWidget = {
        id: 'class-widget',
        type: 'ship',
        title: 'Test Class',
        shipData: {
            name: 'Test Class',
            hullComposition: {
                emplacement: 4,
                hangar: 0,
                magazine: 0,
                system: 0,
                freight: 0,
                tankage: 0,
                core: 0
            },
            resources: { cargo: 10, remass: 20 }
        },
        getCostTotals: () => ({ CV: 100 })
    };
    const outfitWidget = {
        id: 'outfit-widget',
        type: 'outfit',
        title: 'Test Outfit',
        outfitData: {
            name: 'Test Outfit',
            resources: { hardpoints: 4, systems: 0 },
            weapons: {
                spinal: null,
                offensive: [{
                    weaponId: weapon.id,
                    name: 'Stale Cached Name',
                    count: 1,
                    arc: 'P',
                    isTurreted: true,
                    isMain: false,
                    resourceType: 'hardpoints',
                    resourceCount: 1
                }],
                defensive: []
            }
        },
        getAllWeapons: () => [weapon],
        getHullPlanExportDevices: () => ({ systems: [], utilities: [] }),
        getGearBurnAnalysis: () => ({ gears: [] }),
        getCostTotals: () => ({ CV: 40 })
    };
    widgets.set(classWidget.id, classWidget);
    widgets.set(outfitWidget.id, outfitWidget);
    const ship = {
        id: 'ship-1',
        name: 'Test Ship',
        classWidgetId: classWidget.id,
        outfitWidgetId: outfitWidget.id,
        stores: {},
        contents: {
            hardpoints: [],
            hardpointLoadout: { devices: [], weapons: [] },
            magazine: [],
            berths: []
        }
    };
    return { ship, weapon };
}

test('hull-plan JSON and PDF preserve the v2 weapon summaries and device mapping', async () => {
    const { context } = loadExportContext();
    const SummaryWidget = context.SummaryWidget;
    const summary = Object.create(SummaryWidget.prototype);
    const selection = {
        id: 'compact-cannon',
        name: 'Test Cannon',
        hp: 'E02',
        resourceType: 'hardpoints',
        resourceCount: 1,
        count: 2,
        arc: 'FS',
        isMain: false,
        isSpinal: false,
        isTurreted: false
    };

    const items = summary.createHullItems([{
        weapons: { spinal: null, offensive: [selection], defensive: [] }
    }]);
    assert.equal(items.Emplacement.length, 4);
    assert.equal(items.Emplacement[0].resourceCost, 2);
    assert.equal(items.Emplacement[0].weaponId, selection.id);

    const lines = summary.formatEmplacementWeaponsForExport([{
        weapons: { spinal: null, offensive: [selection], defensive: [] }
    }]);
    assert.deepEqual(Array.from(lines), ['Secondary Fore Starboard Test Cannon x2']);

    summary.getConnectedComponents = () => [];
    summary.getModel = () => ({
        counts: {},
        hullItems: {},
        outfits: [],
        technologies: []
    });
    summary.getMetrics = () => [];
    summary.createLayout = () => ({ rows: 0, cols: 0, cells: [], missing: 0 });
    summary.getConnectedRiggingTotals = () => ({
        developmentPoints: null,
        classDevelopmentPoints: null,
        coreDevelopmentPoints: null,
        resourceCost: {}
    });
    summary.getOutfitDeviceLines = () => ({
        emplacements: Array.from(lines),
        systems: [],
        utilities: []
    });
    summary.getPdfFormFields = () => ({ EmplacementWeapon1: lines[0] });

    const payload = summary.getExportData();
    assert.equal(payload.schema, 'fv-tactical.hull-plan/v2');
    assert.equal(payload.deviceLines.emplacements[0], 'Secondary Fore Starboard Test Cannon x2');
    assert.equal(Object.hasOwn(payload, 'weapons'), false);

    const downloads = [];
    summary.downloadBlob = (blob, filename) => downloads.push({ blob, filename });
    const jsonPayload = summary.downloadJSON();
    assert.equal(jsonPayload.schema, 'fv-tactical.hull-plan/v2');
    assert.equal(downloads[0].filename, 'hull-plan.json');
    const downloadedPayload = JSON.parse(await downloads[0].blob.text());
    assert.equal(downloadedPayload.deviceLines.emplacements[0], lines[0]);

    class PDFTextField {
        constructor(name) {
            this.name = name;
            this.value = null;
        }
        getName() {
            return this.name;
        }
        setText(value) {
            this.value = value;
        }
    }
    const fields = new Map(
        Object.keys(payload.formFields).map(name => [name, new PDFTextField(name)])
    );
    let appearanceOptions;
    let needAppearances;
    const form = {
        getFields: () => Array.from(fields.values()),
        getField: name => fields.get(name),
        acroForm: {
            dict: {
                set: (name, value) => {
                    if (name === 'NeedAppearances') needAppearances = value;
                }
            }
        }
    };
    const pdfDocument = {
        getForm: () => form,
        save: async options => {
            appearanceOptions = options;
            return new Uint8Array([37, 80, 68, 70]);
        }
    };
    const pdfLib = {
        PDFDocument: { load: async () => pdfDocument },
        PDFCheckBox: class PDFCheckBox {},
        PDFTextField,
        PDFName: { of: value => value },
        PDFBool: { True: true }
    };
    summary.loadPdfLibrary = async () => pdfLib;

    const unavailableFields = await summary.downloadFilledPDF(payload);
    assert.deepEqual(Array.from(unavailableFields), Array.from(payload.unavailableFormFields));
    assert.equal(fields.get('EmplacementWeapon1').value, lines[0]);
    assert.equal(needAppearances, true);
    assert.equal(appearanceOptions.updateFieldAppearances, false);
    assert.equal(downloads[1].blob.type, 'application/pdf');
});

test('summary hardpoints use armour-capped capacity minus devices, not armour hits', () => {
    const { context, widgets } = loadExportContext();
    const SummaryWidget = context.SummaryWidget;
    const summary = Object.create(SummaryWidget.prototype);
    const classData = {
        armorEfficiency: 3,
        hullComposition: {
            emplacement: 0,
            hangar: 0,
            magazine: 0,
            system: 0,
            freight: 1,
            tankage: 0,
            core: 0
        }
    };
    const outfitWidget = {
        id: 'armor-outfit',
        type: 'outfit',
        getHullPlanExportDevices: () => ({ systems: [], utilities: [] }),
        getResourceUse: () => ({ hardpoints: 2 })
    };
    widgets.set(outfitWidget.id, outfitWidget);

    summary.createHullItems = () => ({});
    summary.collectTechnologies = () => [];
    const model = summary.getModel([
        { inputType: 'Class', data: { shipData: classData } },
        {
            inputType: 'Outfit',
            sourceWidgetId: outfitWidget.id,
            data: {
                outfitData: {
                    resources: { hardpoints: 7 },
                    defenses: { armor: 1 },
                    armorHits: 3,
                    armorHardpoints: 3,
                    resourceUse: { hardpoints: 2 }
                }
            }
        }
    ]);

    assert.equal(model.hardpoints, 3);
    assert.equal(model.availableHardpoints, 1);
    assert.equal(
        summary.getAvailableHardpoints(
            model.outfits[0],
            classData,
            { getResourceUse: () => ({ hardpoints: 0 }) }
        ),
        3
    );
    assert.equal(
        summary.getMetrics(model).find(metric => metric.label === 'Hardpoints').value,
        '1'
    );
    assert.equal(summary.getAvailableHardpoints(
        model.outfits[0], classData, { getResourceUse: () => ({ hardpoints: 5 }) }
    ), 0);
});

test('Fleet JSON and PDF exports map compact weapon arrays and notes', async () => {
    const { context, catalogue, widgets } = loadExportContext();
    const { ship, weapon } = installExportFixture(context, catalogue, widgets);
    const UniqueShipExporter = context.UniqueShipExporter;
    const exporter = Object.create(UniqueShipExporter.prototype);
    exporter.app = { empire: { name: 'Test Empire', taskForces: [] } };

    const payload = await UniqueShipExporter.getExportData(ship, exporter.app);
    assert.equal(payload.schema, 'fv-tactical.unique-ship/v2');
    assert.equal(payload.weapons.length, 1);
    assert.equal(payload.weapons[0].resourceType, 'emplacements');
    assert.equal(payload.weapons[0].turreted, false);
    assert.deepEqual(Array.from(payload.weapons[0].details.accuracy), weapon.accuracy);
    assert.deepEqual(Array.from(payload.weapons[0].details.damage), weapon.damage);
    assert.equal(Object.hasOwn(payload.weapons[0].details, 'ranges'), false);
    assert.equal(payload.weapons[0].details.expend, 3);
    assert.equal(weapon.tagsDescription, 'Beam, Expendable(3), Charge(1.5)');
    assert.equal(Object.hasOwn(weapon, 'notes'), false);
    assert.equal(payload.formFields.Weapon1ShortHit, '10: -4');
    assert.equal(payload.formFields.Weapon1ShortDam, 2);
    assert.equal(payload.formFields.Weapon1MediumHit, 0);
    assert.equal(payload.formFields.Weapon1MediumDam, 0);
    assert.equal(payload.formFields.Weapon1LongHit, -2);
    assert.equal(payload.formFields.Weapon1LongDam, 3);
    assert.equal(payload.formFields.Weapon1FarHit, null);
    assert.equal(payload.formFields.Weapon1ExtremeHit, '5');

    const downloads = [];
    UniqueShipExporter.downloadBlob = (blob, filename) => downloads.push({ blob, filename });
    const jsonPayload = await exporter.exportJSON(ship);
    assert.equal(jsonPayload.schema, 'fv-tactical.unique-ship/v2');
    assert.equal(downloads[0].filename, 'Test-Ship.json');
    const downloadedPayload = JSON.parse(await downloads[0].blob.text());
    assert.deepEqual(downloadedPayload.weapons[0].details.accuracy, weapon.accuracy);

    class PDFTextField {
        constructor(name) {
            this.name = name;
            this.value = null;
        }
        getName() {
            return this.name;
        }
        setText(value) {
            this.value = value;
        }
    }
    const fields = new Map(
        UniqueShipExporter.getFormFieldNames().map(name => [name, new PDFTextField(name)])
    );
    let appearanceOptions;
    let needAppearances;
    const form = {
        getFields: () => Array.from(fields.values()),
        getField: name => fields.get(name),
        acroForm: {
            dict: {
                set: (name, value) => {
                    if (name === 'NeedAppearances') needAppearances = value;
                }
            }
        }
    };
    const pdfDocument = {
        getForm: () => form,
        save: async options => {
            appearanceOptions = options;
            return new Uint8Array([37, 80, 68, 70]);
        }
    };
    const pdfLib = {
        PDFDocument: { load: async () => pdfDocument },
        PDFCheckBox: class PDFCheckBox {},
        PDFTextField,
        PDFName: { of: value => value },
        PDFBool: { True: true }
    };
    context.SummaryWidget.prototype.loadPdfLibrary = async () => pdfLib;

    const pdfPayload = await exporter.exportPDF(ship);
    assert.equal(pdfPayload.schema, 'fv-tactical.unique-ship/v2');
    assert.equal(fields.get('Weapon1ShortHit').value, '10: -4');
    assert.equal(fields.get('Weapon1ShortDam').value, '2');
    assert.equal(fields.get('Weapon1MediumHit').value, '0');
    assert.equal(fields.get('Weapon1LongHit').value, '-2');
    assert.equal(fields.get('Weapon1FarHit').value, '');
    assert.equal(fields.get('Weapon1ExtremeDam').value, '1');
    assert.equal(needAppearances, true);
    assert.equal(appearanceOptions.updateFieldAppearances, false);
    assert.equal(downloads[1].filename, 'Test-Ship.pdf');
    assert.equal(downloads[1].blob.type, 'application/pdf');
});

test('Fleet missing-definition fallback uses saved hp and exports five null stat slots', async () => {
    const { context, catalogue, widgets } = loadExportContext();
    const { ship } = installExportFixture(context, catalogue, widgets);
    const outfitWidget = widgets.get(ship.outfitWidgetId);
    catalogue.categories[0].weapons.length = 0;
    outfitWidget.getAllWeapons = () => [];
    outfitWidget.outfitData.weapons.offensive[0] = {
        weaponId: 'missing-cannon',
        name: 'Saved Cannon',
        count: 2,
        arc: 'PS',
        isTurreted: false,
        hp: 'E03',
        tagsDescription: 'Expendable(2)',
        resourceType: 'hardpoints',
        resourceCount: 1
    };

    const payload = await context.UniqueShipExporter.getExportData(
        ship,
        { empire: { name: 'Test Empire', taskForces: [] } }
    );
    assert.equal(payload.weapons.length, 1);
    assert.equal(payload.weapons[0].id, 'missing-cannon');
    assert.equal(payload.weapons[0].resourceType, 'emplacements');
    assert.equal(payload.weapons[0].count, 2);
    assert.deepEqual(Array.from(payload.weapons[0].details.accuracy), [
        null, null, null, null, null
    ]);
    assert.deepEqual(Array.from(payload.weapons[0].details.damage), [
        null, null, null, null, null
    ]);
    assert.ok(payload.warnings.some(warning =>
        warning.includes('1 outfit weapon definition(s) could not be resolved')
    ));
});
