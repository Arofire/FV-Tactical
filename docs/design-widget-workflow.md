# Creating and rebuilding design widgets

Use `DesignWidget` for configurable widgets whose users select or edit a design and whose data is saved with the Empire. The base provides the three-column node layout, title rename behavior, shared Operational / Ignore Required Tech controls, simple declarative fields, tech filtering, subtotals, capacity counters, quantity rows, and minimized-summary helpers. Keep specialized rules and interactions in the widget subclass.

For the reusable implementation procedure, follow the [`design-widget-workflow` skill](../.github/skills/design-widget-workflow/SKILL.md). The steps below are a repository-specific runbook for applying it.

## Create a widget

1. **Specify the data contract.** Define defaults, catalogue sources, cost and capacity formulas, serialized field names, tech requirements, node types, and any consumers before coding. Search the repository for every existing consumer of the data.
2. **Add the subclass.** Create `js/widgets/<Name>Widget.js` extending `DesignWidget`. Follow `CraftWidget` or `TroopsWidget` for async catalogue loading and state initialization. Implement `designData`, `defaultTitle`, `createContent()`, `refresh()`, `getSerializedData()`, `loadSerializedData()`, and `createNodes()`.
3. **Compose the UI.** Use `createDesignSection()` and `setSectionContent()` for sections. Use `renderIdentityFields()` for the shared flags, role, and notes when appropriate. Use `renderDesignFields()` plus `setupDesignFieldListeners()` for simple controls. Keep specialized catalogue pickers and multi-step interactions in subclass methods.
4. **Keep domain logic explicit.** Add named functions for catalogue lookup, normalization, requirements, resource/capacity accounting, derived statistics, cost, and any automatic trimming or validation. Do not hide domain rules inside markup callbacks.
5. **Preserve technology behavior.** Store tech IDs in `requiredTech` arrays, filter options using the base helpers, retain locked saved selections as unavailable, and rebuild controls on tech-tree updates.
6. **Wire the app.** Add scripts in both HTML entry points, constructors in both `main.js` creation/restoration switches, compatible nodes in `NodeSystem.js`, and any menu, preflight, Summary, Fleet, capacity, or export integration that uses the new widget.
7. **Verify the full lifecycle.** Test current-format save/load, duplicate and rename, catalogue load failures, flags, technology changes, economy changes, capacities, node connections, and downstream consumers. Check syntax and relevant tests before completing the change.

Widget lifecycle behavior applies to every widget type, not only `DesignWidget` subclasses:

- Pinning presents an editable synchronized view of the same widget. Input and action controls in the pinned view must reach the original widget's handlers and state; pinned DOM IDs must remain unique, and unpin/close must release observers and event listeners.
- Duplicating copies the widget's serialized design data and external source references into independent state, but does not copy node connections or parent/child hierarchy. For example, a duplicated Ship Loadout retains selected troop, craft, and munition widget IDs while remaining unconnected.
- Minimize/restore must keep the current widget summary, visual state, and node layout synchronized, including when a widget is pinned or refreshed.

The base field renderer supports `text`, `textarea`, `number`, `checkbox`, and static `select` controls. Fields accept a stable `key`, optional persisted `path`, and type-specific properties. For dynamic catalogue options, use the existing `buildOptions()` helper and subclass behavior rather than freezing options at initial render. Keep equivalent controls and field layouts consistent with the shared widget styles. Place add/remove actions before the content they affect so their position stays fixed as the list changes.

Load weapon definitions with `WeaponCatalogue.load()`. These are native compact records with five-element `accuracy` and `damage` arrays, canonical `tagsDescription`, and an `hp` mount code. Use `WeaponCatalogue.getMount()` and `getNote()` / `hasTag()` for mount accounting and tag queries; do not attach legacy `ranges`, `notes`, or resource fields to catalogue definitions. Generated munition weapon definitions follow the same contract. See the [catalogue editing rules](../README.md#editing-the-weapon-catalogue).

### Shared visual patterns

- Render only identity controls that apply to the widget. Use `renderFlags()` for Operational / Ignore Required Tech without Role and Notes; use `renderIdentityFields()` when those text fields are part of the design contract.
- Ship Class and Outfit role presets support custom entries and removal. Keep each widget type's complete preset list synchronized and include it in Empire `roleLists` save/export data so imported edits replace the built-in defaults.
- Keep nested catalogue groups inside their owning section and use Craft's `.design-subsection.design-loadout` category and `.design-subsection.design-loadout-group` nested-group classes. Appending dynamic groups beside the main sections can make them span the whole center column.
- Use `outfit-section-subtotal outfit-section-subtotal-inline` for inline section costs and `outfit-resource-counter` for used / available values. Put them in the subsection title row so the shared styles align them consistently with Outfit and Craft.
- Reuse the shared top-right cost metric with `setHeaderMetric('cost', '', formattedCost)` during totals refresh, and recalculate it when design selections or economy settings change.
- Keep repeated quantity rows in name, quantity, cost, remove-action order, using the shared `design-entry` classes or `DesignWidget.renderEntryRows()`. Aggregate repeated devices of the same type into one quantity/subtotal row when appropriate, while keeping per-instance contents and capacity counters separate. Show conditional categories only while they contain an applicable device.
- Cargo, remass, jumpium, and other resource values have no physical measurement unit. Store and display standalone values without conversion or measurement suffixes. Bays, cells, and berths label capacity categories; keep cost labels appropriate to the economy mode.
- For Ship Loadouts and Fleet contents, show one aggregate Adapter/Clamp count and capacity summary, with a compact picker and used/capacity counter per instance. Never pool their contents capacities. Fixture mount resources are pooled, and fixture weapon controls appear only while a Fixture is installed.

For connection nodes that are non-essential, pass `optional: true` in the `addNode()` options. Expandable node groups accept the same flag in `createExpandableNodeGroup()` so generated nodes share the optional gray idle style. Optional styling changes only the node's appearance; connection direction, compatibility, labels, and interaction feedback remain unchanged.

## Current widget roles

Keep domain logic and specialized interactions in each widget. Use shared controls and layouts for common form elements; retain specialized presentation for read-only visualizations and domain-specific data.

| Widget | Migration approach | Preserve and revalidate |
|---|---|---|
| `MunitionsWidget` | Uses `DesignWidget` for title/flag/identity behavior, shared sections, and required-tech filtering. Keep profile-driven payload rules, accuracy sliders, and editable cost specialized. | Munition data shape, profile/payload capacity, operational Fleet magazine/hardpoint content, and node compatibility. |
| `ShipCoreWidget` | Migrated to `DesignWidget` for title/flag/identity behavior, shared sections, and tech availability. Keep reactor/engine/manifold allocations, gears, instability, and core-cost formulas specialized. Retain selected tech options as unavailable instead of dropping saved selections. | Existing core serialization, connected-class dependencies, allocations, node names, and Outfit consumers. |
| `OutfitWidget` | Migrated to `DesignWidget` for title/flag/notes behavior and shared sections. Keep role management, core-linked resources, collapsible categories, weapons, systems, and burn analysis in Outfit-specific code. | The broadest integration surface: core and ship connections, resource accounting, preflight, Hull Tiles, Summary/PDF export, Fleet weapon/resource behavior, and saved outfit data. |
| `ShipLoadoutWidget` | Use `DesignWidget` for Operational / Ignore Required Tech flags, catalogue filtering, shared cost metrics, quantity rows, subtotals, and counters. Keep per-Adapter/Clamp contents, fixture-mounted weapons, and berth entries in the widget. | Class-derived hardpoint capacity, dynamic Loadout inputs on Outfit, Fleet defaults and per-ship copies, tech filtering, campaign costs, save/restore of expandable node connections, and Summary's total hardpoint capacity. |
| `ShipWidget` | Migrated to `DesignWidget` for title/flag behavior and shared sections. Keep its custom role editor, hull/foundation controls, class calculations, and preflight integration specialized. | Hull/foundation state, ship/class nodes, capacity formulas, Outfit/Core and ShipCapacity consumers, Fleet building, and all saved ship designs. |
| `BasicInfoWidget` | Leave as a general metadata widget unless it gains catalogue-driven design behavior; it does not need the catalogue workflow merely to share a few text inputs. | Existing general-purpose metadata contract and consumers. |
| `SummaryWidget` | Do not migrate to `DesignWidget`; it is a read-only aggregation/export widget, not a user-configured design. | Connected widget aggregation, resource totals, craft statistics, and export behavior. |

When replacing a widget version, implement only the current serialized format. Remove obsolete widget aliases, legacy markup/layouts, and app-wide import or connection fallbacks rather than preserving old-version compatibility. Increment `DataManager.fileVersion` when the import format changes; reject files and backups that do not match the current version. Keep current-version behavior and consumers listed in the table working.

### Commands

Run JavaScript syntax validation for the changed files with the repository's Node executable:

```sh
node --check js/widgets/DesignWidget.js
node --check js/widgets/<Name>Widget.js
```

Use the project's existing test/build commands when the change touches their coverage. Validate JSON catalogue files with a JSON parser and verify every `requiredTech` ID against `data/tech-tree.json`.
