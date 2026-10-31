const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const { CanvasExtent } = require(path.join(root, 'js/core/CanvasExtent.js'));
const { WidgetSelection } = require(path.join(root, 'js/core/WidgetSelection.js'));

const BASE = CanvasExtent.BASE;
const rect = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });

test('canvas keeps its base size when widgets are well inside it', () => {
    assert.deepEqual(CanvasExtent.computeBounds([rect(2000, 1500, 2400, 1800)]), { ...BASE });
});

test('canvas grows in chunks on the side a widget approaches', () => {
    // Right edge: 5600 + 1000 margin = 6600 -> 7000
    assert.deepEqual(CanvasExtent.computeBounds([rect(5300, 1000, 5600, 1200)]),
        { minX: 0, minY: 0, maxX: 7000, maxY: 4000 });
    // Bottom edge
    assert.deepEqual(CanvasExtent.computeBounds([rect(1000, 3500, 1300, 3800)]),
        { minX: 0, minY: 0, maxX: 6000, maxY: 5000 });
});

test('canvas grows into negative world coordinates', () => {
    assert.deepEqual(CanvasExtent.computeBounds([rect(-2500, 200, -2200, 500)]),
        { minX: -4000, minY: -1000, maxX: 6000, maxY: 4000 });
});

test('canvas shrinks back to the base when widgets return', () => {
    const grown = CanvasExtent.computeBounds([rect(9000, 9000, 9300, 9300)]);
    assert.deepEqual(grown, { minX: 0, minY: 0, maxX: 11000, maxY: 11000 });
    assert.deepEqual(CanvasExtent.computeBounds([rect(3000, 2000, 3300, 2300)]), { ...BASE });
});

test('canvas never shrinks past the kept (visible) rect', () => {
    const bounds = CanvasExtent.computeBounds([], BASE, 1000, 1000, rect(-1500, 100, 800, 900));
    assert.deepEqual(bounds, { minX: -2000, minY: 0, maxX: 6000, maxY: 4000 });
});

test('computeBounds ignores invalid rects', () => {
    assert.deepEqual(CanvasExtent.computeBounds([rect(NaN, 0, 10, 10), null]), { ...BASE });
});

test('coverageRatio measures the fraction of a widget inside the box', () => {
    const widget = rect(0, 0, 100, 100);
    assert.equal(WidgetSelection.coverageRatio(widget, rect(-10, -10, 200, 200)), 1);
    assert.equal(WidgetSelection.coverageRatio(widget, rect(50, 0, 200, 200)), 0.5);
    assert.equal(WidgetSelection.coverageRatio(widget, rect(200, 200, 300, 300)), 0);
    assert.ok(WidgetSelection.coverageRatio(widget, rect(40, 0, 200, 200)) > WidgetSelection.MIN_COVERAGE);
    assert.ok(!(WidgetSelection.coverageRatio(widget, rect(50, 0, 200, 200)) > WidgetSelection.MIN_COVERAGE));
    assert.equal(WidgetSelection.coverageRatio(rect(0, 0, 0, 10), rect(-1, -1, 5, 5)), 0);
});

test('rectFromPoints normalises drag direction', () => {
    assert.deepEqual(WidgetSelection.rectFromPoints({ x: 50, y: 10 }, { x: -20, y: 80 }), rect(-20, 10, 50, 80));
});
