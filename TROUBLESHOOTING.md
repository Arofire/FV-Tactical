FV-Tactical Troubleshooting Quick Reference

Short, searchable fixes for recurring issues. Each section lists the fastest diagnosis path plus the canonical fix.

---

# DOM Lookup Failure
**Tags:** `DOM`, `querySelector`, `getElementById`, `event-listeners`
- **Symptom:** Handlers never fire; `document.getElementById()` returns `null` while the element exists inside the widget.
- **Root Cause:** Widgets render HTML inside `this.element`. The global ID registry updates after initial binding, so `getElementById` misses freshly created nodes.
- **Fix:** Resolve every lookup through the widget wrapper.
  ```javascript
  const find = (id) => this.element?.querySelector(`#${id}`);
  const ignoreTechCheckbox = find(`${this.id}-ignore-tech`);
  ```
- **Apply To:** All element queries in widget lifecycle hooks (notably `setupEventListeners`).

---

## Parent → Child Flag Sync
**Tags:** `parent-child`, `notifications`, `inheritance`, `callbacks`
- **Symptom:** Ship checkbox updates do not alter connected outfit widgets.
- **Checklist:**
  1. Parent emits: `this.notifyOutfitChildrenToRefresh()` after state change.
  2. Child implements `handleParentTechRequirementChange(parent)` and refreshes its UI.
  3. `onParentLinked` seeds initial state via `applyParentInheritance`.
- **Fix Snippet:**
  ```javascript
  // parent (ShipWidget)
  const toggle = find(`${this.id}-ignore-tech`);
  toggle?.addEventListener('change', (e) => {
      this.shipData.ignoreTechRequirements = e.target.checked;
      this.notifyOutfitChildrenToRefresh();
  });

  // child (OutfitWidget)
  handleParentTechRequirementChange(parent) {
      this.ignoreTechRequirements = parent.shipData?.ignoreTechRequirements ?? false;
      this.refreshWeaponDropdowns();
  }
  ```

---

## Weapons Data Loads Late
**Tags:** `async-loading`, `event-delegation`, `weapons`
- **Symptom:** Dropdowns empty, "Add" buttons inert on first render.
- **Root Cause:** `setupWeaponsEventListeners()` ran before JSON finished loading, so later DOM nodes had no listeners.
- **Fix:**
  - Introduce `_weaponsListenersAttached` guard.
  - Call `setupWeaponsEventListeners()` from `loadWeaponsData()` once the fetch resolves.
  - Use event delegation on the table container so future rows inherit handlers.

---

## UI Refresh Forgot to Run
**Tags:** `reactivity`, `state`, `refresh`
- **Symptom:** Data updates internally but UI shows stale values until another interaction.
- **Fix Pattern:** Pair every state mutation with its refresh helper (e.g., `this.refreshWeaponDropdowns();`, `this.updateStats();`).
- **Reminder:** Parent callbacks must finish with the appropriate refresh call.

---

## Reuse Patterns
- **Element Lookup Helper:** `const find = (id) => this.element?.querySelector(`#${id}`);`
- **Async Listener Guard:** `if (!this._listenersAttached) { attach(); this._listenersAttached = true; }`
- **Parent Notify:** `this.notifyOutfitChildrenToRefresh('callbackName');`
- **Event Delegation:** Attach once on the table container, branch inside via `classList.contains`.

---

## Preventive Checklist
- [ ] Use `this.element?.querySelector` for widget DOM access.
- [ ] Attach listeners after async data resolves; guard against duplicates.
- [ ] Call refresh helpers immediately after changing state.
- [ ] Verify parent widgets call notify methods on relevant toggles.
- [ ] Hard refresh (Ctrl + Shift + R) when testing new JS changes.# FV-Tactical Troubleshooting Guide
