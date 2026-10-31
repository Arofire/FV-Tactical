// Multi-selection for design widgets: Ctrl/Cmd box selection, Ctrl/Cmd click toggling,
// group dragging and the floating selection toolbar.
class WidgetSelection {
    static DRAG_THRESHOLD = 3;
    static MIN_COVERAGE = 0.5;
    static DUPLICATE_OFFSET = 40;
    static TOOLBAR_GAP = 10;
    static OUTLINE_PADDING = 6;

    // Fraction of rect's area covered by box (both { minX, minY, maxX, maxY }).
    static coverageRatio(rect, box) {
        const width = rect.maxX - rect.minX;
        const height = rect.maxY - rect.minY;
        if (!(width > 0) || !(height > 0)) return 0;
        const overlapX = Math.max(0, Math.min(rect.maxX, box.maxX) - Math.max(rect.minX, box.minX));
        const overlapY = Math.max(0, Math.min(rect.maxY, box.maxY) - Math.max(rect.minY, box.minY));
        return (overlapX * overlapY) / (width * height);
    }

    static rectFromPoints(a, b) {
        return {
            minX: Math.min(a.x, b.x),
            minY: Math.min(a.y, b.y),
            maxX: Math.max(a.x, b.x),
            maxY: Math.max(a.y, b.y)
        };
    }

    static widgetRect(widget) {
        const width = widget.element?.offsetWidth || widget.width || 0;
        const height = widget.element?.offsetHeight || widget.height || 0;
        return { minX: widget.x, minY: widget.y, maxX: widget.x + width, maxY: widget.y + height };
    }

    constructor(manager) {
        this.manager = manager;
        this.ids = new Set();
        this.marquee = null;
        this.groupDrag = null;
        this.toolbar = null;
        this.outline = null;
        this.suppressNextClick = false;
        this.onMarqueeMove = this.onMarqueeMove.bind(this);
        this.onMarqueeEnd = this.onMarqueeEnd.bind(this);
        this.onGroupDragMove = this.onGroupDragMove.bind(this);
        this.onGroupDragEnd = this.onGroupDragEnd.bind(this);
    }

    // ------------------ Selection state ------------------
    getSelected() {
        return Array.from(this.ids).map(id => this.manager.widgets.get(id)).filter(Boolean);
    }

    setSelection(widgets) {
        const next = new Set(widgets.filter(Boolean).map(widget => widget.id));
        for (const id of this.ids) {
            if (!next.has(id)) this.manager.widgets.get(id)?.setSelected(false);
        }
        for (const id of next) {
            this.manager.widgets.get(id)?.setSelected(true);
        }
        this.ids = next;
        this.updateToolbar();
    }

    selectOnly(widget) {
        this.setSelection([widget]);
    }

    add(widgets) {
        this.setSelection([...this.getSelected(), ...widgets]);
    }

    remove(widget) {
        this.setSelection(this.getSelected().filter(selected => selected !== widget));
    }

    toggle(widget) {
        if (this.ids.has(widget.id)) {
            this.remove(widget);
        } else {
            this.add([widget]);
        }
    }

    clear() {
        this.setSelection([]);
    }

    // Called when a widget leaves the manager.
    forget(widgetId) {
        if (this.ids.delete(widgetId)) this.updateToolbar();
    }

    // ------------------ Coordinates ------------------
    clientToWorld(clientX, clientY) {
        const workspace = document.getElementById('workspace');
        const t = window.app?.workspaceTransform;
        if (!workspace || !t) return null;
        const rect = workspace.getBoundingClientRect();
        return {
            x: (clientX - rect.left - t.translateX) / t.scale,
            y: (clientY - rect.top - t.translateY) / t.scale
        };
    }

    // ------------------ Box selection ------------------
    startMarquee(event) {
        const canvas = document.getElementById('canvas');
        const start = this.clientToWorld(event.clientX, event.clientY);
        if (!canvas || !start) return;
        this.cancelMarquee();
        const element = document.createElement('div');
        element.className = 'selection-marquee';
        element.hidden = true;
        canvas.appendChild(element);
        this.marquee = {
            element,
            start,
            startClient: { x: event.clientX, y: event.clientY },
            moved: false,
            candidates: new Set()
        };
        document.body.classList.add('is-box-selecting');
        document.addEventListener('mousemove', this.onMarqueeMove);
        document.addEventListener('mouseup', this.onMarqueeEnd);
    }

    onMarqueeMove(event) {
        const marquee = this.marquee;
        if (!marquee) return;
        if (!marquee.moved) {
            const distance = Math.hypot(event.clientX - marquee.startClient.x, event.clientY - marquee.startClient.y);
            if (distance < WidgetSelection.DRAG_THRESHOLD) return;
            marquee.moved = true;
            marquee.element.hidden = false;
        }
        const current = this.clientToWorld(event.clientX, event.clientY);
        if (!current) return;
        const box = WidgetSelection.rectFromPoints(marquee.start, current);
        marquee.box = box;
        Object.assign(marquee.element.style, {
            left: `${box.minX}px`,
            top: `${box.minY}px`,
            width: `${box.maxX - box.minX}px`,
            height: `${box.maxY - box.minY}px`
        });

        const candidates = new Set();
        for (const widget of this.manager.widgets.values()) {
            if (!widget.element) continue;
            if (WidgetSelection.coverageRatio(WidgetSelection.widgetRect(widget), box) > WidgetSelection.MIN_COVERAGE) {
                candidates.add(widget);
            }
        }
        for (const widget of marquee.candidates) {
            if (!candidates.has(widget)) widget.element?.classList.remove('marquee-candidate');
        }
        for (const widget of candidates) {
            widget.element.classList.add('marquee-candidate');
        }
        marquee.candidates = candidates;
        event.preventDefault();
    }

    onMarqueeEnd() {
        const marquee = this.marquee;
        if (!marquee) return;
        const selected = marquee.moved ? Array.from(marquee.candidates) : [];
        this.cancelMarquee();
        if (marquee.moved) {
            // The click that follows this mouseup must not clear the new selection
            this.suppressNextClick = true;
            setTimeout(() => { this.suppressNextClick = false; }, 0);
            if (selected.length) this.add(selected);
        }
    }

    cancelMarquee() {
        const marquee = this.marquee;
        if (!marquee) return;
        this.marquee = null;
        document.removeEventListener('mousemove', this.onMarqueeMove);
        document.removeEventListener('mouseup', this.onMarqueeEnd);
        document.body.classList.remove('is-box-selecting');
        marquee.candidates.forEach(widget => widget.element?.classList.remove('marquee-candidate'));
        marquee.element.remove();
    }

    consumeMarqueeClick() {
        const suppressed = this.suppressNextClick;
        this.suppressNextClick = false;
        return suppressed;
    }

    // ------------------ Group drag ------------------
    startGroupDrag(leader, event) {
        const pointer = this.clientToWorld(event.clientX, event.clientY);
        if (!pointer) return;
        const moving = new Map();
        for (const widget of this.getSelected()) {
            moving.set(widget, { x: widget.x, y: widget.y });
        }
        if (window.app?.cascadeDragEnabled) {
            const stack = this.getSelected().flatMap(widget => Array.from(widget.children || []));
            while (stack.length) {
                const child = this.manager.widgets.get(stack.pop());
                if (!child || moving.has(child)) continue;
                moving.set(child, { x: child.x, y: child.y });
                stack.push(...(child.children || []));
            }
        }
        this.groupDrag = {
            leader,
            moving,
            offset: { x: pointer.x - leader.x, y: pointer.y - leader.y },
            startClient: { x: event.clientX, y: event.clientY },
            moved: false
        };
        document.addEventListener('mousemove', this.onGroupDragMove);
        document.addEventListener('mouseup', this.onGroupDragEnd);
    }

    onGroupDragMove(event) {
        const drag = this.groupDrag;
        if (!drag) return;
        if (!drag.moved) {
            const distance = Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y);
            if (distance < WidgetSelection.DRAG_THRESHOLD) return;
            drag.moved = true;
            for (const widget of drag.moving.keys()) {
                widget.isDragging = true;
                widget.element?.classList.add('dragging');
            }
        }
        const pointer = this.clientToWorld(event.clientX, event.clientY);
        if (!pointer) return;
        const { leader, moving } = drag;
        leader.x = pointer.x - drag.offset.x;
        leader.y = pointer.y - drag.offset.y;
        leader.applyMagneticSnapping(new Set(moving.keys()));
        const leaderStart = moving.get(leader);
        const dx = leader.x - leaderStart.x;
        const dy = leader.y - leaderStart.y;
        for (const [widget, start] of moving) {
            widget.x = start.x + dx;
            widget.y = start.y + dy;
            if (widget.element) {
                widget.element.style.left = `${widget.x}px`;
                widget.element.style.top = `${widget.y}px`;
            }
        }
        window.canvasExtent?.growToFit(Array.from(moving.keys()));
        window.nodeSystem?.updateConnections();
        window.app?.updateMinimap?.(false);
        this.updateToolbar();
        event.preventDefault();
    }

    onGroupDragEnd() {
        const drag = this.groupDrag;
        if (!drag) return;
        this.groupDrag = null;
        document.removeEventListener('mousemove', this.onGroupDragMove);
        document.removeEventListener('mouseup', this.onGroupDragEnd);
        if (!drag.moved) {
            // A plain click on a selected widget's header collapses the selection to it
            this.selectOnly(drag.leader);
            return;
        }
        for (const widget of drag.moving.keys()) {
            widget.isDragging = false;
            widget.manualPosition = true;
            widget.element?.classList.remove('dragging');
        }
        window.canvasExtent?.settle();
        window.app?.updateMinimap?.(true);
        this.updateToolbar();
    }

    // ------------------ Toolbar actions ------------------
    toggleMinimizeSelected() {
        const selected = this.getSelected();
        const anyExpanded = selected.some(widget => !widget.minimized);
        selected
            .filter(widget => widget.minimized !== anyExpanded)
            .forEach(widget => widget.toggleMinimize());
        this.updateToolbar();
    }

    duplicateSelected() {
        const selected = this.getSelected();
        if (!selected.length) return [];
        const offset = WidgetSelection.DUPLICATE_OFFSET;
        const copies = new Map();
        for (const widget of selected) {
            const copy = widget.duplicate({ offsetX: offset, offsetY: offset, runPreflight: false });
            if (copy) copies.set(widget.id, copy);
        }

        // Recreate connections whose two ends were both selected
        const nodeSystem = window.nodeSystem;
        const remap = nodeId => {
            for (const [originalId, copy] of copies) {
                if (nodeId?.startsWith(`${originalId}-`)) {
                    return { copy, nodeId: `${copy.id}${nodeId.slice(originalId.length)}` };
                }
            }
            return null;
        };
        const pairs = [];
        for (const connection of nodeSystem?.connections?.values() || []) {
            const source = remap(connection.sourceNodeId);
            const target = remap(connection.targetNodeId);
            if (source && target) pairs.push([source, target]);
        }
        for (const [source, target] of pairs) {
            source.copy.ensureNodeForConnection?.(source.nodeId);
            target.copy.ensureNodeForConnection?.(target.nodeId);
        }
        for (const [source, target] of pairs) {
            if (nodeSystem.canConnect(source.nodeId, target.nodeId)) {
                nodeSystem.createConnection(source.nodeId, target.nodeId);
            }
        }
        const copyList = Array.from(copies.values());
        if (pairs.length) {
            copyList.forEach(copy => copy.syncConnectedData?.());
            nodeSystem.updateConnections();
        }

        this.setSelection(copyList);
        window.canvasExtent?.growToFit(copyList);
        window.preflightCheck?.runCheck();
        return copyList;
    }

    deleteSelected() {
        const selected = this.getSelected();
        this.clear();
        selected.forEach(widget => widget.close());
        window.canvasExtent?.settle();
    }

    // ------------------ Toolbar rendering ------------------
    createToolbar() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return false;

        this.outline = document.createElement('div');
        this.outline.className = 'selection-outline';

        const toolbar = document.createElement('div');
        toolbar.className = 'selection-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Selected widgets');
        toolbar.addEventListener('mousedown', event => event.stopPropagation());
        toolbar.addEventListener('dblclick', event => event.stopPropagation());

        const label = document.createElement('span');
        label.className = 'selection-toolbar-count';
        this.toolbarCount = label;

        const controls = document.createElement('div');
        controls.className = 'widget-controls';
        const makeButton = (className, text, title, action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `widget-control-btn ${className}`;
            button.textContent = text;
            button.title = title;
            button.setAttribute('aria-label', title);
            button.addEventListener('click', event => {
                event.stopPropagation();
                action();
            });
            controls.appendChild(button);
            return button;
        };
        makeButton('duplicate', '⎘', 'Duplicate selected widgets', () => this.duplicateSelected());
        this.minimizeButton = makeButton('minimize', '−', 'Minimize selected widgets', () => this.toggleMinimizeSelected());
        makeButton('clear-selection', '⊘', 'Clear selection', () => this.clear());
        makeButton('close', '×', 'Delete selected widgets', () => this.deleteSelected());

        toolbar.append(label, controls);
        canvas.append(this.outline, toolbar);
        this.toolbar = toolbar;
        return true;
    }

    updateToolbar() {
        const selected = this.getSelected();
        const visible = selected.length > 1;
        document.getElementById('canvas')?.classList.toggle('has-multi-selection', visible);
        if (!visible) {
            if (this.toolbar) this.toolbar.hidden = true;
            if (this.outline) this.outline.hidden = true;
            return;
        }
        if (!this.toolbar && !this.createToolbar()) return;

        let bounds = null;
        for (const widget of selected) {
            const rect = WidgetSelection.widgetRect(widget);
            bounds = bounds ? {
                minX: Math.min(bounds.minX, rect.minX),
                minY: Math.min(bounds.minY, rect.minY),
                maxX: Math.max(bounds.maxX, rect.maxX),
                maxY: Math.max(bounds.maxY, rect.maxY)
            } : rect;
        }
        const scale = window.app?.workspaceTransform?.scale || 1;
        const pad = WidgetSelection.OUTLINE_PADDING;
        Object.assign(this.outline.style, {
            left: `${bounds.minX - pad}px`,
            top: `${bounds.minY - pad}px`,
            width: `${bounds.maxX - bounds.minX + pad * 2}px`,
            height: `${bounds.maxY - bounds.minY + pad * 2}px`
        });
        // Counter-scale so the toolbar keeps a constant on-screen size at any zoom
        Object.assign(this.toolbar.style, {
            left: `${(bounds.minX + bounds.maxX) / 2}px`,
            top: `${bounds.minY - pad - WidgetSelection.TOOLBAR_GAP / scale}px`,
            transform: `scale(${1 / scale}) translate(-50%, -100%)`
        });

        this.toolbarCount.textContent = `${selected.length} selected`;
        const anyExpanded = selected.some(widget => !widget.minimized);
        this.minimizeButton.textContent = anyExpanded ? '−' : '□';
        const minimizeTitle = anyExpanded ? 'Minimize selected widgets' : 'Restore selected widgets';
        this.minimizeButton.title = minimizeTitle;
        this.minimizeButton.setAttribute('aria-label', minimizeTitle);

        this.outline.hidden = false;
        this.toolbar.hidden = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WidgetSelection };
}
