const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
    DesignWidget: class {},
    window: { empire: { economyMode: 'skirmish' } }
});
for (const name of ['OutfitWidget', 'ShipCoreWidget']) {
    vm.runInContext(
        fs.readFileSync(path.join(root, 'js/widgets', `${name}.js`), 'utf8') +
            `\nglobalThis.${name} = ${name};`,
        context
    );
}
const { ShipCoreWidget, OutfitWidget } = context;
const options = JSON.parse(fs.readFileSync(path.join(root, 'data/ship-cores.json'), 'utf8'));
ShipCoreWidget.options = options;

function core(overrides = {}) {
    return {
        engine: 'automation',
        engineEfficiency: 2,
        gears: [1, 3, 6].map(instability => ({ instability })),
        ...overrides
    };
}

function close(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

test('56-hull example sums unrounded gear savings using the unmodified exponent', () => {
    const result = ShipCoreWidget.calculateCost(core(), 56);
    const low = 84 - 84 / Math.sqrt(3);
    const high = 84 - 84 / Math.sqrt(6);
    close(result.engine, low + high);
    close(result.total, low + high);
    assert.equal(result.engine.toFixed(2), '85.21');
    assert.equal(result.reactor, 0);
    assert.equal(result.manifold, 0);
    assert.notEqual(OutfitWidget.calculateGearBurnMetrics(56, 2, 3).engineExponent, 2);
});

test('engine cost uses the appropriate root and has no reaction discount', () => {
    const gears = [{ instability: 8 }];
    for (const engine of ['automation', 'boson-mastery']) {
        close(ShipCoreWidget.calculateCost(core({
            engine, engineEfficiency: 3, gears
        }), 56).engine, 42);
    }
    close(ShipCoreWidget.calculateCost(core({
        engine: 'boson-mastery', engineEfficiency: 1, gears: [{ instability: 3 }]
    }), 56).engine, 56);
});

test('thrust multiplier stays at least one and scales for larger hulls', () => {
    for (const [hulls, thrust] of [[14, 14], [28, 28], [56, 84], [112, 280]]) {
        close(ShipCoreWidget.calculateCost(core({
            gears: [{ instability: 4 }]
        }), hulls).engine, thrust / 2);
    }
});

test('all configured gears contribute, with gear one and no gears costing zero', () => {
    for (const gears of [[], [{ instability: 1 }]]) {
        assert.equal(ShipCoreWidget.calculateCost(core({ gears }), 56).engine, 0);
    }
    const gears = [4, 4, 1, 4].map(instability => ({ instability }));
    close(ShipCoreWidget.calculateCost(core({ gears }), 56).engine, 126);
    close(ShipCoreWidget.calculateCost(core({ gears: gears.reverse() }), 56).engine, 126);
    assert.equal(ShipCoreWidget.calculateCost(core({ engine: '' }), 56).engine, 0);
});

test('reactor and manifold costs retain their existing flooring and rates', () => {
    const result = ShipCoreWidget.calculateCost(core({
        reactor: 'thermal', reactorStability: 3.9,
        manifold: 'intelligence-models', manifoldEfficiency: 1.13
    }), 56);
    assert.equal(result.reactor, 15);
    assert.equal(result.entropy, 63);
    assert.equal(result.manifold, 63);
    close(result.total, result.engine + 78);
});

test('unavailable or invalid cost inputs remain unavailable', () => {
    for (const hulls of [null, 0, -1, NaN, Infinity]) {
        assert.equal(ShipCoreWidget.calculateCost(core(), hulls), null);
    }
    for (const engineEfficiency of [0, -1, NaN, Infinity]) {
        assert.equal(ShipCoreWidget.calculateCost(core({ engineEfficiency }), 56), null);
    }
    for (const gears of [undefined, null, [null], [{ instability: 0 }],
        [{ instability: -1 }], [{ instability: NaN }], [{ instability: Infinity }]]) {
        assert.equal(ShipCoreWidget.calculateCost(core({ gears }), 56), null);
    }
});

test('core and outfit cost totals share gear pricing and economy units', () => {
    const data = core();
    const coreWidget = Object.create(ShipCoreWidget.prototype);
    Object.assign(coreWidget, {
        coreData: data,
        coreOptions: options,
        isConnectedToOutfit: () => false,
        getClassHullCount: () => 28
    });
    const outfit = Object.create(OutfitWidget.prototype);
    Object.assign(outfit, {
        getCoreData: () => data,
        getEffectiveHullCount: () => 56
    });
    for (const [economyMode, unit] of [['skirmish', 'CV'], ['campaign', 'IP']]) {
        context.window.empire.economyMode = economyMode;
        close(coreWidget.getCostTotals()[unit], ShipCoreWidget.calculateCost(data, 28).total);
        close(outfit.getCoreCostTotals()[unit], ShipCoreWidget.calculateCost(data, 56).total);
    }
    coreWidget.isConnectedToOutfit = () => true;
    assert.equal(Object.keys(coreWidget.getCostTotals()).length, 0);
});
