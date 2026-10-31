// Tracks the design canvas world bounds. The canvas grows on any side that widgets
// approach and shrinks back toward the base area once they move away. World
// coordinates are stable (they may become negative), so the base area's centre
// stays the fixed centre point of the design view.
class CanvasExtent {
    static BASE = Object.freeze({ minX: 0, minY: 0, maxX: 6000, maxY: 4000 });
    static EDGE_MARGIN = 1000;
    static CHUNK = 1000;

    static unionRect(a, b) {
        if (!a) return b ? { ...b } : null;
        if (!b) return { ...a };
        return {
            minX: Math.min(a.minX, b.minX),
            minY: Math.min(a.minY, b.minY),
            maxX: Math.max(a.maxX, b.maxX),
            maxY: Math.max(a.maxY, b.maxY)
        };
    }

    // Union of the base area and every rect padded by margin, snapped outward to chunk.
    static computeBounds(rects, base = CanvasExtent.BASE, margin = CanvasExtent.EDGE_MARGIN, chunk = CanvasExtent.CHUNK, keepRect = null) {
        let bounds = { ...base };
        for (const rect of rects || []) {
            if (!rect || ![rect.minX, rect.minY, rect.maxX, rect.maxY].every(Number.isFinite)) continue;
            bounds = CanvasExtent.unionRect(bounds, {
                minX: rect.minX - margin,
                minY: rect.minY - margin,
                maxX: rect.maxX + margin,
                maxY: rect.maxY + margin
            });
        }
        if (keepRect) bounds = CanvasExtent.unionRect(bounds, keepRect);
        return {
            minX: Math.min(base.minX, Math.floor(bounds.minX / chunk) * chunk),
            minY: Math.min(base.minY, Math.floor(bounds.minY / chunk) * chunk),
            maxX: Math.max(base.maxX, Math.ceil(bounds.maxX / chunk) * chunk),
            maxY: Math.max(base.maxY, Math.ceil(bounds.maxY / chunk) * chunk)
        };
    }

    static boundsEqual(a, b) {
        return !!a && !!b && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
    }

    static widgetRect(widget) {
        const width = widget.element?.offsetWidth || widget.width || 0;
        const height = widget.element?.offsetHeight || widget.height || 0;
        return { minX: widget.x, minY: widget.y, maxX: widget.x + width, maxY: widget.y + height };
    }

    constructor(app) {
        this.app = app;
        this.bounds = { ...CanvasExtent.BASE };
        this.surface = null;
    }

    get width() {
        return this.bounds.maxX - this.bounds.minX;
    }

    get height() {
        return this.bounds.maxY - this.bounds.minY;
    }

    get center() {
        const base = CanvasExtent.BASE;
        return { x: (base.minX + base.maxX) / 2, y: (base.minY + base.maxY) / 2 };
    }

    attach() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        this.surface = document.getElementById('canvasSurface');
        if (!this.surface) {
            this.surface = document.createElement('div');
            this.surface.id = 'canvasSurface';
            this.surface.className = 'canvas-surface';
            canvas.prepend(this.surface);
        }
        this.render();
    }

    isBackground(target) {
        if (!target) return false;
        return target === this.surface || target.id === 'canvas' || target.id === 'canvasSurface';
    }

    getWidgetRects(widgets = null) {
        const list = widgets || window.widgetManager?.getAllWidgets?.() || [];
        return list.filter(widget => widget?.element).map(widget => CanvasExtent.widgetRect(widget));
    }

    getVisibleRect() {
        const workspace = document.getElementById('workspace');
        const t = this.app?.workspaceTransform;
        if (!workspace || !t) return null;
        return {
            minX: -t.translateX / t.scale,
            minY: -t.translateY / t.scale,
            maxX: (workspace.clientWidth - t.translateX) / t.scale,
            maxY: (workspace.clientHeight - t.translateY) / t.scale
        };
    }

    // Grow only; cheap enough to call during drags.
    growToFit(widgets) {
        const needed = CanvasExtent.computeBounds(this.getWidgetRects(widgets));
        const next = CanvasExtent.unionRect(this.bounds, needed);
        if (!CanvasExtent.boundsEqual(next, this.bounds)) {
            this.apply(next);
            return true;
        }
        return false;
    }

    // Full recompute allowing shrink, never cutting into the visible viewport.
    settle() {
        const next = CanvasExtent.computeBounds(this.getWidgetRects(), CanvasExtent.BASE,
            CanvasExtent.EDGE_MARGIN, CanvasExtent.CHUNK, this.getVisibleRect());
        if (!CanvasExtent.boundsEqual(next, this.bounds)) {
            this.apply(next);
            return true;
        }
        return false;
    }

    apply(bounds) {
        this.bounds = { ...bounds };
        this.render();
        if (this.app?.workspaceTransform && this.app.updateWorkspaceTransform) {
            this.app.updateWorkspaceTransform();
        }
    }

    render() {
        const { minX, minY, maxX, maxY } = this.bounds;
        if (this.surface) {
            this.surface.style.left = `${minX}px`;
            this.surface.style.top = `${minY}px`;
            this.surface.style.width = `${maxX - minX}px`;
            this.surface.style.height = `${maxY - minY}px`;
        }
        const svg = document.getElementById('connectionSvg');
        if (svg) {
            // The SVG spans the world bounds; its transform adds translate(minX, minY)
            // so the viewBox keeps path coordinates in world space.
            svg.style.width = `${maxX - minX}px`;
            svg.style.height = `${maxY - minY}px`;
            svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CanvasExtent };
}
