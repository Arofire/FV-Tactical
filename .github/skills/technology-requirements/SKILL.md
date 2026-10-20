---
name: technology-requirements
description: How technologies and required tech work in FV-Tactical. Use when adding or changing tech-tree entries, data files with required tech, or widget dropdowns that must be filtered by researched tech.
---

# Technology handling in FV-Tactical

## Vocabulary
| Term | Meaning |
|---|---|
| **tech ID** | Key of an entry in `data/tech-tree.json` (lowercase kebab-case, e.g. `fusion`). Always store tech IDs, not display names. |
| **`requiredTech`** | Field name for "this object needs these techs". Always an **array of tech IDs** (empty array = none). Every one must be researched. |
| **`ignoreRequiredTech`** | Boolean flag that disables enforcement of `requiredTech`. UI label: "Ignore Required Tech". Checkbox element id suffix: `-ignore-required-tech`. |
| **`requiredEmpireTier`** | Optional number on a tech-tree entry for an empire tier gate (not a tech, so not in `requiredTech`). Currently unenforced because empire tier isn't tracked (`TechTree.canResearch` takes an `empireLevel`). |
| **option** | A selectable choice in a dropdown (e.g. a ship core option). It *carries* a `requiredTech`; it is not a tech requirement itself. |

Tech-to-tech dependencies in the tech tree also use `requiredTech`.

Method naming: `getSelectedRequiredTech()` (collect from current selections), `TechTree.getTechRequiredTech(id)`, `filterByRequiredTech(items)` / `isOptionAvailable(option)` (filtering), `addRequiredTechIssue()` / `checkRequiredTech()` (preflight), `showRequiredTech()` (widget tech-tree modal).

## Source of truth
- `data/tech-tree.json`: object keyed by tech ID. Entries have `name`, `category`, `cost`, `requiredTech` (tech IDs of other techs, may be empty), `description`; optional `abbreviation`, `requiredEmpireTier`. A tech is researchable when all its `requiredTech` are researched.
- `js/core/TechTree.js` loads/queries the tree. `js/core/Empire.js` holds `researchedTech` / `availableTech` and `hasTech(id)` (runtime: `window.empire.hasTech`).

## Where `requiredTech` lives
- `data/tech-tree.json`: each tech lists the techs it depends on.
- `data/weapons.json`: each weapon has `requiredTech: [ids]` (`scripts/import_weapons.py` writes this shape).
- `data/ship-cores.json`: sections `reactor`, `engine`, `manifold`; each option key is its tech ID and has `name`, `requiredTech`, plus per-option values like `stat`.
- Craft/troop catalogue items: `requiredTech` array (none declared yet).
- Widget serialized data: `requiredTech` (array) and `ignoreRequiredTech` (boolean). Selected-item widgets expose `getSelectedRequiredTech()` and write the result to their data and `getSerializedData()`. `ShipCoreWidget` derives it from the chosen reactor/engine/manifold options.

## Consumers (all read `requiredTech`)
- `PreflightCheck.checkRequiredTech`: scans serialized widget data for `requiredTech` keys; skipped when `ignoreRequiredTech` is set on the widget or `shipData`.
- `Widget.showRequiredTech`: shows the tech tree for the widget's `requiredTech`.
- `ShipHullsWidget.collectTechnologies`: summary list from `requiredTech`.
- `Empire`/`TechTree`/`main.js` research logic: availability, tree validation and the locked-tech "Requires:" row all read `requiredTech`.
- `Empire.getRequiredTech`: missing tech across saved designs.

If a new widget needs tech gating, put a `requiredTech` array in its serialized data.

## Filtering options in a widget
1. Load options from JSON; each carries `requiredTech`.
2. Keep an option if `ignoreRequiredTech` is true or every ID passes `window.empire?.hasTech?.(id)`.
3. Rebuild the list when the Ignore Required Tech checkbox changes and in `onTechTreeUpdated()`; clear any selection no longer available. References: `ShipCoreWidget.getComponentOptions` / `isOptionAvailable`, `OutfitWidget.filterByRequiredTech`.

## Consistency checklist
- New tech: unique kebab-case ID; its `requiredTech` IDs exist and form no cycle.
- Every ID in any `requiredTech` exists in `tech-tree.json`; every `requiredTech` is an array.
- Parse-check JS with node (not installed by default; `pip install nodejs-wheel-binaries` provides one).

## Known gaps
- `ShipWidget.shipData.foundations` keys are camelCase flags, not tech IDs; preflight only checks keys that are real tech IDs, so foundations are effectively unenforced until mapped to tech IDs.
- `Empire.fromJSON` defaults `availableTech` to nonexistent IDs (`basic-hull`, ...) when absent.
- `requiredEmpireTier` (3 techs) is not enforced in `Empire.updateAvailableTech`; no empire tier exists yet.
