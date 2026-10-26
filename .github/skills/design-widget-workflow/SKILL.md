---
name: design-widget-workflow
description: Create or migrate catalogue-driven customizable widgets using DesignWidget and the project's serialization, tech, node, and UI conventions.
---

# Design widget workflow

Use this skill when adding a customizable design widget or migrating an existing configurable widget to the shared `DesignWidget` base. Start with the practical migration guide in [`docs/design-widget-workflow.md`](../../../docs/design-widget-workflow.md), then inspect the base and the closest existing implementation before editing:

- `js/widgets/DesignWidget.js`
- `js/widgets/TroopsWidget.js`
- `js/widgets/CraftWidget.js`

## 1. Define the widget contract

Before building UI, identify:

- The widget type and displayed name.
- The current persisted data shape and defaults.
- Catalogue JSON sources and which data files own each option.
- Cost, capacity, derived statistics, and required-tech rules.
- Input/output node types and downstream consumers.
- Other code that reads its data (preflight, Fleet, Summary, exporters, or capacity logic).

Keep domain calculations and domain-specific controls in the subclass. Put reusable form, tech, subtotal, capacity-counter, quantity-row, and summary behavior in `DesignWidget` only when at least two widgets can share it.

## 2. Implement the subclass

Create `js/widgets/<Name>Widget.js` as a subclass of `DesignWidget`.

1. In the constructor, call `super(type, defaultTitle, x, y)`, initialize the persisted data and catalogue state, call `init()`, then start asynchronous catalogue loading. Do not assume catalogues have loaded during `init()` or `loadSerializedData()`.
2. Implement `designData` to return the persisted data object and `defaultTitle` to return the fallback title. Keep `name`, `operational`, and `ignoreRequiredTech` in that object.
3. Implement `createContent(contentElement)` with `createDesignSection()` and `setSectionContent()`. Use `renderIdentityFields()` for the standard Operational / Ignore Required Tech, Role, and Notes area where it fits.
4. Use `renderDesignFields()` and `setupDesignFieldListeners()` for simple text, textarea, number, checkbox, or static select controls. Field definitions use `{ key, type, label, path?, placeholder?, rows?, options?, className?, onChange? }`. `path` supports nested persisted data, such as `configuration.name`. For catalogue controls, use `buildOptions()` and implement their custom selection behavior in the subclass. Use shared widget control styles and layouts for equivalent controls, and place actions before the content they modify.
5. For catalogue options, keep `requiredTech` as tech IDs. Filter with `isOptionAvailable()` / `filterByRequiredTech()`, preserve a saved unavailable selection, and rebuild options from `onTechTreeUpdated()`. `setupFlagListeners()` should call the widget's refresh path when Ignore Required Tech changes.
6. Put item lookup, selection normalization, capacities, derived values, costs, and required-tech collection in named subclass methods. Ensure asynchronous catalogue completion normalizes saved selections and refreshes the rendered UI.
7. Keep `refresh()` safe before catalogue load and after the widget is minimized or restored. Update controls, totals, minimized summary, and children that consume this widget's output.
8. Implement `getSerializedData()` and `loadSerializedData(data)` together for the current format only. Serialize stable IDs and plain data; normalize and merge duplicate quantity entries, and never silently reinterpret an unknown ID. Recompute cached cost/tech/capacity fields from the selected options where appropriate.
9. Implement `createNodes()` with stable node type names and section anchors. Keep existing node names, directions, and connection semantics when migrating a widget.

Example shared identity setup:

```js
const section = this.createDesignSection('meta', '');
this.setSectionContent(section, this.renderIdentityFields({
    rolePlaceholder: 'Optional role',
    notesPlaceholder: 'Design notes'
}));
sections.appendChild(section.section);
this.setupFlagListeners(() => this.refresh());
this.setupIdentityFieldListeners();
```

Example simple fields:

```js
const fields = [
    { key: 'designation', path: 'configuration.designation', type: 'text', label: 'Designation' },
    { key: 'quantity', path: 'configuration.quantity', type: 'number', label: 'Quantity' }
];
this.setSectionContent(section, this.renderDesignFields(fields));
this.setupDesignFieldListeners(fields, {
    onChange: () => this.refresh()
});
```

Validate all data paths before relying on them. `setDesignValue()` throws for a missing path or a forbidden prototype key; initialize nested objects in the widget defaults and serialized-data loader.

## 3. Wire every application surface

Search for the widget's existing type and data properties before adding a new integration. Update each applicable surface consistently:

- Add the script to `index.html` and `debug.html`, after `DesignWidget.js` and before consumers of the subclass.
- Add constructor cases to both widget creation and saved-empire restoration in `js/main.js`.
- Add the widget type and compatible node directions in `js/core/NodeSystem.js`.
- Add the creation/menu entry and relevant preflight checks.
- Update any capacity calculations, summary rendering, exporters, fleet views, and other code that reads widget data.
- Add or update catalogue data with `requiredTech` arrays of valid tech IDs.

Do not change node labels or serialized field names during a visual migration unless all saved data and consumers are migrated too.

## 4. Replace an earlier widget version

When replacing a widget version:

1. Read the implementation and search for its type, serialized fields, node labels, direct data consumers, and test/debug entry points.
2. Inventory current behavior and consumers. Preserve domain algorithms while moving only common presentation into shared helpers.
3. Implement the current data shape and loader; remove obsolete aliases, old-version formats, and fallback paths.
4. Migrate equivalent controls and layouts to the newest shared patterns. Keep section actions before the content they modify, in stable positions, without duplicating controls or content.
5. Keep current node names and anchors consistent. Compare preflight, summary, Fleet, and export output before and after.
6. Exercise current-format saves, duplicate, rename, tech filtering, economy changes, node connections, and relevant consumers. Reject older files and backups rather than migrating them.
7. Increment `DataManager.fileVersion` for an incompatible import-format change. Run the narrowest relevant tests plus JavaScript syntax checks and review for unrelated changes.

See the project migration inventory and sequence in [`docs/design-widget-workflow.md`](../../../docs/design-widget-workflow.md).

## 5. Completion checklist

- [ ] Widget name, role, and notes round-trip through save/load and rename.
- [ ] Operational and Ignore Required Tech flags persist and trigger the appropriate consumers.
- [ ] Catalogue loading errors are surfaced; the UI does not silently report a successful empty design.
- [ ] All required-tech IDs exist in `data/tech-tree.json`.
- [ ] Costs and capacities are correct in each supported economy mode.
- [ ] Current-format data round-trips through save/load and import/export; older files and backups are rejected.
- [ ] Node connections, preflight, downstream summary/Fleet/export behavior remain correct.
- [ ] `node --check` passes for changed JavaScript, and relevant tests pass.
- [ ] README and directly related skills describe the new behavior.
