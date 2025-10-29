// Base Widget class for all draggable/resizable widgets
class Widget {
    constructor(type, title, x = 100, y = 100, width = 300, height = 200) {
        this.type = type;
        this.title = title;
        this.id = this.generateId();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.minimized = false;
        this.selected = false;
        this.pinned = false;
    this.pinnedWidget = null;
    this.manualPosition = false;
    this.layoutAnchors = [];
        
        this.element = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
    this.nodes = new Map(); // input/output nodes for connections
    this.connections = new Set(); // connections to other widgets
    this.expandableNodeGroups = new Map(); // dynamic node groups by id
    this.nodeGroupMembership = new Map(); // nodeId -> groupId mapping
    this.nodeCounters = new Map(); // deterministic node id counters
    // Hierarchy relationships
    this.parents = new Set();
    this.children = new Set();
    // Feature flags
    this.enableCascadeDrag = window.app?.cascadeDragEnabled || false;
        // Layout mode
        this.layoutMode = 'legacy';
        
        // Cache for preflight indicator to avoid unnecessary DOM updates
        this.lastPreflightState = {
            warnings: -1,
            errors: -1,
            alerts: -1,
            issuesCount: -1,
            visible: null
        };
        
        // Data change notification system for parent-child data sync
        this.childWidgets = new Set(); // Track connected children
        
        // Defer creation until subclass has initialized its specific data.
        // Subclasses must call this.init() after setting their data objects.
    }

    generateId() {
        return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    create() {
    this.element = document.createElement('div');
    this.element.className = `widget ${this.type}-widget`;
        this.element.id = this.id;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        
        // Set width if specified, otherwise let CSS handle it
        if (this.width) {
            this.element.style.width = this.width + 'px';
        }
        // Don't set height - let it auto-size based on content

        // Create header
        const header = document.createElement('div');
        header.className = 'widget-header';
        
        const titleElement = document.createElement('span');
        titleElement.className = 'widget-title';
        titleElement.textContent = this.title;
        
        const controls = document.createElement('div');
        controls.className = 'widget-controls';

        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'widget-control-btn duplicate';
        duplicateBtn.innerHTML = '⎘';
        duplicateBtn.title = 'Duplicate widget';
        duplicateBtn.onclick = (e) => {
            e.stopPropagation();
            this.duplicate();
        };

        const pinBtn = document.createElement('button');
        pinBtn.className = 'widget-control-btn pin';
        pinBtn.innerHTML = '🖈';
        pinBtn.title = 'Pin widget';
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            this.togglePin();
        };

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'widget-control-btn minimize';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.title = 'Minimize widget';
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        };
        this.minimizeButton = minimizeBtn;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'widget-control-btn close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.close();
        };
        
        // Create preflight indicator
        const preflightIndicator = document.createElement('div');
        preflightIndicator.className = 'widget-preflight-indicator';
        preflightIndicator.id = `${this.id}-preflight`;
        preflightIndicator.style.display = 'none'; // Hidden by default
        
        controls.appendChild(preflightIndicator);
        controls.appendChild(duplicateBtn);
        controls.appendChild(pinBtn);
        controls.appendChild(minimizeBtn);
        controls.appendChild(closeBtn);
        header.appendChild(titleElement);
        header.appendChild(controls);
        
        const content = document.createElement('div');
        content.className = 'widget-content';
        this.contentElement = content;

        let sectionsContainer;

        if (this.usesThreeColumnLayout()) {
            this.element.classList.add('widget-three-column');

            const columnsWrapper = document.createElement('div');
            columnsWrapper.className = 'widget-columns';

            const inputColumn = document.createElement('div');
            inputColumn.className = 'widget-node-column inputs';

            sectionsContainer = document.createElement('div');
            sectionsContainer.className = 'widget-sections';

            const summaryContainer = document.createElement('div');
            summaryContainer.className = 'widget-summary';
            summaryContainer.setAttribute('aria-live', 'polite');
            summaryContainer.hidden = true;
            this.summaryElement = summaryContainer;

            const outputColumn = document.createElement('div');
            outputColumn.className = 'widget-node-column outputs';

            columnsWrapper.appendChild(inputColumn);
            columnsWrapper.appendChild(sectionsContainer);
            columnsWrapper.appendChild(outputColumn);

            content.appendChild(columnsWrapper);

            this.nodeColumnElements = {
                input: inputColumn,
                output: outputColumn
            };
        } else {
            sectionsContainer = document.createElement('div');
            sectionsContainer.className = 'widget-sections';
            content.appendChild(sectionsContainer);

            const nodesContainer = document.createElement('div');
            nodesContainer.className = 'widget-nodes';
            this.nodesContainer = nodesContainer;
            this._legacyNodesContainer = nodesContainer;
        }

        this.sectionsContainer = sectionsContainer;

        this.element.appendChild(header);
        this.element.appendChild(content);

        if (this._legacyNodesContainer) {
            this.element.appendChild(this._legacyNodesContainer);
            delete this._legacyNodesContainer;
        }
        
        // Populate content (to be overridden by subclasses)
        this.createContent(content);

        if (this.summaryElement && this.sectionsContainer && this.summaryElement.parentElement !== this.sectionsContainer) {
            this.sectionsContainer.appendChild(this.summaryElement);
        }
        if (this.registerLayoutAnchors) {
            this.registerLayoutAnchors();
        }
        
        // Add to canvas
        const canvas = document.getElementById('canvas');
        if (canvas) {
            canvas.appendChild(this.element);
        }
        
        // Create initial nodes
        this.createNodes();
        // Standardize node layout (inputs left, outputs right, vertical distribution)
        this.reflowNodes();
    }

    // Public initializer to be called by subclasses after their own state setup
    init() {
        if (this.element) return; // prevent double init
        this.create();
        this.setupEventListeners();
    }

    usesThreeColumnLayout() {
        return this.layoutMode === 'three-column';
    }

    createContent(contentElement) {
        // To be overridden by subclasses
        contentElement.innerHTML = '<p>Base widget content</p>';
    }

    // Helper method to create a section
    createSection(sectionId, sectionTitle, options = {}) {
        const section = document.createElement('div');
        const isSingleColumnLayout = this.usesThreeColumnLayout();
        section.className = 'widget-section';
        if (!isSingleColumnLayout) {
            section.classList.add('with-columns');
        }
        section.id = `${this.id}-${sectionId}`;
        
        if (options.errorState) {
            section.classList.add('section-error');
        } else if (options.warningState) {
            section.classList.add('section-warning');
        }

        let titleElement = null;

        if (isSingleColumnLayout) {
            if (sectionTitle) {
                titleElement = document.createElement('h4');
                titleElement.className = 'section-title';
                titleElement.textContent = sectionTitle;
                section.appendChild(titleElement);
            }

            return {
                section,
                leftColumn: null,
                bodyColumn: section,
                rightColumn: null,
                contentContainer: section,
                titleElement
            };
        }

        // Legacy three-column section structure
        const leftColumn = document.createElement('div');
        leftColumn.className = 'section-left-column';

        const bodyColumn = document.createElement('div');
        bodyColumn.className = 'section-body-column';

        const rightColumn = document.createElement('div');
        rightColumn.className = 'section-right-column';

        if (sectionTitle) {
            titleElement = document.createElement('h4');
            titleElement.className = 'section-title';
            titleElement.textContent = sectionTitle;
            bodyColumn.appendChild(titleElement);
        }

        section.appendChild(leftColumn);
        section.appendChild(bodyColumn);
        section.appendChild(rightColumn);

        return {
            section,
            leftColumn,
            bodyColumn,
            rightColumn,
            contentContainer: bodyColumn,
            titleElement
        };
    }

    setSectionContent(sectionRef, content) {
        if (!sectionRef) return;

        const container = sectionRef.contentContainer || sectionRef.section;
        const titleElement = sectionRef.titleElement && sectionRef.titleElement.parentElement === container
            ? sectionRef.titleElement
            : null;

        let node = titleElement ? titleElement.nextSibling : container.firstChild;
        while (node) {
            const next = node.nextSibling;
            container.removeChild(node);
            node = next;
        }

        if (content == null) {
            return;
        }

        const appendContent = (value) => {
            if (typeof value === 'string') {
                if (value.trim().length > 0) {
                    container.insertAdjacentHTML('beforeend', value);
                }
            } else if (value instanceof Node) {
                container.appendChild(value);
            }
        };

        if (Array.isArray(content)) {
            content.forEach(appendContent);
        } else {
            appendContent(content);
        }
    }

    // Helper methods to set section states
    setSectionError(sectionId, hasError = true) {
        const section = this.element?.querySelector(`#${this.id}-${sectionId}`);
        if (section) {
            section.classList.toggle('section-error', hasError);
            if (hasError) {
                section.classList.remove('section-warning');
            }
        }
    }

    setSectionWarning(sectionId, hasWarning = true) {
        const section = this.element?.querySelector(`#${this.id}-${sectionId}`);
        if (section) {
            section.classList.toggle('section-warning', hasWarning);
            if (hasWarning) {
                section.classList.remove('section-error');
            }
        }
    }

    clearSectionState(sectionId) {
        const section = this.element?.querySelector(`#${this.id}-${sectionId}`);
        if (section) {
            section.classList.remove('section-error', 'section-warning');
        }
    }

    // Update all nodes to ensure they're in the correct columns
    updateNodePositions() {
        for (const [nodeId, node] of this.nodes) {
            if (node.sectionId) {
                // Re-create the node element in the correct section
                const oldElement = this.getNodeDomElement(nodeId);
                const oldLabel = this.element.querySelector(`.node-label[data-node-id="${nodeId}"]`);
                
                if (oldElement) oldElement.remove();
                if (oldLabel) oldLabel.remove();
                
                this.createNodeElement(node);
            }
        }
    }

    createNodes() {
        // To be overridden by subclasses
        // Example: this.addNode('input', 'power', 'Power Input', 0, 0.5);
    }

    clearNodes() {
        for (const nodeId of Array.from(this.nodes.keys())) {
            this.removeNode(nodeId);
        }
        this.expandableNodeGroups.clear();
        this.nodeGroupMembership.clear();
        this.nodeCounters.clear();
    }

    addNode(type, nodeType, label, relativeX, relativeY, options = {}) {
        const counterKey = `${type}:${nodeType}`;
        let nodeId = options.nodeId;
        if (!nodeId) {
            const nextIndex = (this.nodeCounters.get(counterKey) || 0) + 1;
            this.nodeCounters.set(counterKey, nextIndex);
            nodeId = `${this.id}-${counterKey}-${nextIndex}`;
        } else {
            const nextIndex = (this.nodeCounters.get(counterKey) || 0) + 1;
            this.nodeCounters.set(counterKey, nextIndex);
        }
        const node = {
            id: nodeId,
            type: type, // 'input' or 'output'
            nodeType: nodeType, // 'power', 'weapon', 'data', etc.
            label: label,
            relativeX: relativeX, // 0-1 relative to widget
            relativeY: relativeY, // 0-1 relative to widget
            connections: new Set(),
            anchorId: options.anchorId || null,
            minSpacing: options.minSpacing || 28,
            anchorOffset: options.anchorOffset || 0,
            sectionId: options.sectionId || null, // Which section to place the node in
            allowMultipleConnections: !!options.allowMultipleConnections,
            groupId: options.groupId || null
        };
        
        this.nodes.set(nodeId, node);
        this.createNodeElement(node);
        return nodeId;
    }

    static escapeIdForSelector(id) {
        return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    getNodeDomElement(nodeId) {
        if (!nodeId) return null;
        const selector = `[id="${Widget.escapeIdForSelector(nodeId)}"]`;
        if (this.element) {
            const scoped = this.element.querySelector(selector);
            if (scoped) return scoped;
        }
        const candidates = document.querySelectorAll(selector);
        for (const candidate of candidates) {
            if (!candidate.closest('.pinned-widget')) {
                return candidate;
            }
        }
        return candidates[0] || null;
    }

    createNodeElement(node) {
        const nodeElement = document.createElement('div');
        nodeElement.className = `node ${node.type} ${node.nodeType}`;
        nodeElement.id = node.id;
        
        const labelElement = document.createElement('div');
        labelElement.className = `node-label ${node.type}`;
        labelElement.textContent = node.label;
        labelElement.setAttribute('data-node-id', node.id);
        
    const useThreeColumn = this.usesThreeColumnLayout() && this.nodeColumnElements;

        // Find the appropriate column for this node
        let targetColumn;
        if (useThreeColumn) {
            targetColumn = node.type === 'input'
                ? this.nodeColumnElements.input
                : this.nodeColumnElements.output;
        } else if (node.sectionId) {
            // Place in specific section's column (legacy layout)
            const section = this.element.querySelector(`#${this.id}-${node.sectionId}`);
            if (section) {
                targetColumn = node.type === 'input'
                    ? section.querySelector('.section-left-column')
                    : section.querySelector('.section-right-column');
            }
        }
        
        // Fallback to legacy widget-nodes container if no section specified or found
        if (!targetColumn && this.nodesContainer) {
            targetColumn = this.nodesContainer;
        }
        
        if (targetColumn) {
            targetColumn.appendChild(nodeElement);
            targetColumn.appendChild(labelElement);
        }
        
        this.updateNodePosition(node.id);
        
        // Add node event listeners
        nodeElement.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            window.nodeSystem.startConnection(node.id, e);
        });
    }

    updateNodePosition(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        const target = this.getNodeTargetPosition(node);
        this.positionNode(node, target.targetY);
    }

    // Standardize node layout using anchors when available
    reflowNodes() {
        const inputs = [];
        const outputs = [];
        for (const node of this.nodes.values()) {
            if (node.type === 'input') inputs.push(node);
            else if (node.type === 'output') outputs.push(node);
        }

        const useThreeColumn = this.usesThreeColumnLayout() && this.nodeColumnElements;

        const layoutNodes = (arr, relativeX) => {
            const count = arr.length;
            if (count === 0) return;
            const metrics = this.getNodeLayoutMetrics();
            const entries = arr.map(node => {
                node.relativeX = relativeX;
                const target = this.getNodeTargetPosition(node);
                return { node, targetY: target.targetY, minSpacing: target.minSpacing };
            });
            entries.sort((a, b) => a.targetY - b.targetY);

            if (useThreeColumn) {
                let currentY = metrics.contentTop;
                for (const entry of entries) {
                    const node = entry.node;
                    this.positionNode(node, currentY, metrics);
                    currentY += entry.minSpacing;
                }
            } else {
                let lastY = metrics.contentTop - 999;
                for (const entry of entries) {
                    const node = entry.node;
                    let desiredY = entry.targetY;
                    const spacing = entry.minSpacing;
                    if (desiredY - lastY < spacing) {
                        desiredY = lastY + spacing;
                    }
                    if (desiredY < metrics.contentTop) {
                        desiredY = metrics.contentTop;
                    }
                    if (desiredY > metrics.contentBottom) {
                        desiredY = metrics.contentBottom;
                    }
                    this.positionNode(node, desiredY, metrics);
                    lastY = desiredY;
                }
            }
        };

        layoutNodes(inputs, 0);
        layoutNodes(outputs, 1);

        if (useThreeColumn && this.nodeColumnElements) {
            ['input', 'output'].forEach(type => {
                const column = this.nodeColumnElements[type];
                if (!column) return;
                let maxBottom = 0;
                column.querySelectorAll('.node').forEach(nodeEl => {
                    const top = parseFloat(nodeEl.style.top || '0');
                    const height = nodeEl.offsetHeight || 12;
                    maxBottom = Math.max(maxBottom, top + height);
                });
                column.style.minHeight = maxBottom > 0 ? `${Math.ceil(maxBottom + 12)}px` : '0';
            });
        }

        if (window.nodeSystem) window.nodeSystem.updateConnections();
    }

    updateAllNodePositions() {
        for (const nodeId of this.nodes.keys()) {
            this.updateNodePosition(nodeId);
        }
    }

    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Remove connections
        window.nodeSystem.removeNodeConnections(nodeId);
        
        // Remove DOM elements
    const nodeElement = this.getNodeDomElement(nodeId);
        const labelElement = this.element?.querySelector(`.node-label[data-node-id="${nodeId}"]`) || nodeElement?.nextElementSibling;
        if (nodeElement) nodeElement.remove();
        if (labelElement && labelElement.classList.contains('node-label')) {
            labelElement.remove();
        }
        
        this.nodes.delete(nodeId);
        if (node.groupId) {
            const group = this.expandableNodeGroups.get(node.groupId);
            if (group) {
                group.nodes = group.nodes.filter(id => id !== nodeId);
            }
            this.nodeGroupMembership.delete(nodeId);
        }
    }

    handleNodeConnectionChange(nodeId) {
        const groupId = this.nodeGroupMembership.get(nodeId);
        if (!groupId) return;
        this.updateExpandableGroup(groupId);
    }

    createExpandableNodeGroup(groupId, config = {}) {
        const groupConfig = {
            baseLabel: config.baseLabel || 'Connection',
            labelFormatter: typeof config.labelFormatter === 'function'
                ? config.labelFormatter
                : (index) => `${config.baseLabel || 'Connection'} ${index}`,
            direction: config.direction || 'input',
            nodeType: config.nodeType,
            sectionId: config.sectionId || null,
            anchorId: config.anchorId || null,
            anchorOffset: config.anchorOffset || 0,
            minSpacing: config.minSpacing || 28,
            minAvailable: typeof config.minAvailable === 'number' ? config.minAvailable : 1,
            maxFree: typeof config.maxFree === 'number' ? config.maxFree : 2,
            allowMultipleConnections: !!config.allowMultipleConnections,
            relativeX: typeof config.relativeX === 'number' ? config.relativeX : (config.direction === 'output' ? 1 : 0),
            relativeY: typeof config.relativeY === 'number' ? config.relativeY : 0.5,
            nodes: []
        };
        this.expandableNodeGroups.set(groupId, groupConfig);
        const initial = Math.max(config.initialNodes || 1, 1);
        for (let i = 0; i < initial; i++) {
            this.addExpandableGroupNode(groupId);
        }
        this.updateExpandableGroup(groupId);
    }

    addExpandableGroupNode(groupId) {
        const group = this.expandableNodeGroups.get(groupId);
        if (!group) return null;
        const index = group.nodes.length + 1;
        const label = group.labelFormatter(index);
        const nodeId = this.addNode(
            group.direction,
            group.nodeType,
            label,
            group.relativeX,
            group.relativeY,
            {
                sectionId: group.sectionId,
                anchorId: group.anchorId,
                anchorOffset: group.anchorOffset,
                minSpacing: group.minSpacing,
                allowMultipleConnections: group.allowMultipleConnections,
                groupId
            }
        );
        group.nodes.push(nodeId);
        this.nodeGroupMembership.set(nodeId, groupId);
        this.reflowNodes();
        return nodeId;
    }

    updateExpandableGroup(groupId) {
        const group = this.expandableNodeGroups.get(groupId);
        if (!group) return;

        group.nodes = group.nodes.filter(nodeId => this.nodes.has(nodeId));
        let freeNodes = group.nodes.filter(nodeId => {
            const node = this.nodes.get(nodeId);
            return node && node.connections.size === 0;
        });

        if (freeNodes.length < group.minAvailable) {
            this.addExpandableGroupNode(groupId);
            return;
        }

        while (freeNodes.length > group.maxFree && group.nodes.length > group.minAvailable) {
            const nodeId = freeNodes.pop();
            const node = this.nodes.get(nodeId);
            if (!node || node.connections.size > 0) {
                continue;
            }
            this.removeNode(nodeId);
        }
        this.reflowNodes();
    }

    clampToCanvasBounds() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        const widgetWidth = this.element?.offsetWidth || this.width || 0;
        const widgetHeight = this.element?.offsetHeight || this.height || 0;
        const maxX = Math.max(0, canvasWidth - widgetWidth);
        const maxY = Math.max(0, canvasHeight - widgetHeight);
        this.x = Math.max(0, Math.min(this.x, maxX));
        this.y = Math.max(0, Math.min(this.y, maxY));
    }

    setPosition(x, y, options = {}) {
        const { updateConnections = true, updateMinimap = true, markManual = false } = options;
        this.x = x;
        this.y = y;
        if (markManual) {
            this.manualPosition = true;
        }
        this.clampToCanvasBounds();
        if (this.element) {
            this.element.style.left = this.x + 'px';
            this.element.style.top = this.y + 'px';
        }
        if (updateConnections && window.nodeSystem) {
            window.nodeSystem.updateConnections();
        }
        if (updateMinimap && window.app && window.app.updateMinimap) {
            window.app.updateMinimap();
        }
        this.updateStickyHeaders();
    }

    updateStickyHeaders() {
        // Find all sticky headers in this widget and adjust their position
        // to stay visible when the widget top is clipped by viewport
        if (!this.element) return;
        
        const stickyHeaders = this.element.querySelectorAll('.widget-sticky-header');
        if (stickyHeaders.length === 0) return;
        
        // Get workspace viewport info
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        
        const viewportRect = workspace.getBoundingClientRect();
        const widgetRect = this.element.getBoundingClientRect();
        
        // Get the current transform scale to account for zoom
        const transform = window.app?.workspaceTransform || { scale: 1, translateX: 0, translateY: 0 };
        const scale = transform.scale;
        
        stickyHeaders.forEach(header => {
            // Calculate how much of the widget top is clipped by the viewport
            // The 40 is the header height in canvas units, so scale it to screen units
            const clipAmount = viewportRect.top - widgetRect.top - (40 * scale);
            
            if (clipAmount > 0) {
                // Widget top is clipped - move header down to stay visible
                // Calculate max offset to prevent header from going past widget bottom
                // Account for the header's height and the widget's bottom position
                const widgetBottomClip = widgetRect.bottom - viewportRect.bottom;
                const maxOffset = widgetRect.height - (header.offsetHeight * scale) - (60 * scale); // 40px margin from bottom
                
                // If widget bottom is also clipped, reduce the max offset
                const effectiveMaxOffset = widgetBottomClip > 0 ? 
                    maxOffset - widgetBottomClip : 
                    maxOffset;
                
                // Convert screen offset back to canvas units for the transform
                const offset = Math.min(clipAmount, Math.max(0, effectiveMaxOffset)) / scale;
                header.style.transform = `translateY(${offset}px)`;
                header.style.position = 'relative';
                header.style.zIndex = '10';
            } else {
                // Widget top is fully visible - reset header position
                header.style.transform = '';
                header.style.position = '';
                header.style.zIndex = '';
            }
        });
    }

    resetLayoutAnchors() {
        this.layoutAnchors = [];
    }

    registerLayoutAnchors() {
        // To be overridden by subclasses when they provide layout anchors
    }

    addLayoutAnchor(id, element, options = {}) {
        if (!id) return;
        const anchor = {
            id,
            element: element || null,
            selector: options.selector || null,
            offset: options.offset || 0,
            closest: options.closest || null
        };
        this.layoutAnchors = this.layoutAnchors.filter(a => a.id !== id);
        this.layoutAnchors.push(anchor);
    }

    getLayoutAnchor(id) {
        const anchor = this.layoutAnchors.find(a => a.id === id);
        if (!anchor) return null;
        if (!anchor.element || !anchor.element.isConnected) {
            if (anchor.selector && this.element) {
                let element = this.element.querySelector(anchor.selector);
                if (element && anchor.closest) {
                    element = element.closest(anchor.closest) || element;
                }
                anchor.element = element;
            }
        }
        return anchor.element ? anchor : null;
    }

    getNodeLayoutMetrics() {
    const headerHeight = this.element?.querySelector('.widget-header')?.offsetHeight || 40;
    const elementHeight = this.element?.offsetHeight || this.height || headerHeight + 100;
    const isThreeColumn = this.usesThreeColumnLayout();
    const topPadding = isThreeColumn ? 6 : 10;
    const bottomPadding = isThreeColumn ? 12 : 20;
        const availableHeight = Math.max(60, elementHeight - headerHeight - topPadding - bottomPadding);
        const contentTop = headerHeight + topPadding;
        const contentBottom = contentTop + availableHeight;
        this.height = elementHeight; // keep cached height in sync for legacy code paths
        return { headerHeight, topPadding, bottomPadding, availableHeight, contentTop, contentBottom };
    }

    getNodeTargetPosition(node) {
        const metrics = this.getNodeLayoutMetrics();
        let normalized = Math.max(0, Math.min(1, node.relativeY));
        if (node.anchorId) {
            const anchor = this.getLayoutAnchor(node.anchorId);
            if (anchor && anchor.element) {
                const anchorRect = anchor.element.getBoundingClientRect();
                const widgetRect = this.element.getBoundingClientRect();
                let offset = anchorRect.top - widgetRect.top + anchorRect.height / 2 + anchor.offset + (node.anchorOffset || 0);
                normalized = (offset - metrics.contentTop) / metrics.availableHeight;
            }
        }
        normalized = Math.max(0, Math.min(1, normalized));
        const targetY = metrics.contentTop + normalized * metrics.availableHeight;
        return {
            targetY,
            normalizedY: normalized,
            minSpacing: node.minSpacing || 28
        };
    }

    positionNode(node, targetY, metrics = null) {
    const nodeElement = this.getNodeDomElement(node.id);
        if (!nodeElement) return;

        const labelElement = this.element?.querySelector(`.node-label[data-node-id="${node.id}"]`) || nodeElement.nextElementSibling;
        const layout = metrics || this.getNodeLayoutMetrics();
        const clampedY = Math.max(layout.contentTop, Math.min(layout.contentBottom, targetY));

        const nodeWidth = nodeElement.offsetWidth || 12;
        const isInput = node.type === 'input';
        const isOutput = node.type === 'output';
    const useThreeColumn = this.usesThreeColumnLayout() && this.nodeColumnElements;

        if (useThreeColumn) {
            const column = isInput ? this.nodeColumnElements.input : this.nodeColumnElements.output;
            if (column) {
                const computed = getComputedStyle(column);
                if (computed.position === 'static') {
                    column.style.position = 'relative';
                }

                const fallbackWidth = this.element?.offsetWidth || this.width || 240;
                const columnWidth = column.offsetWidth || fallbackWidth / 4;
                const inputLabelGap = 0;
                const outputLabelGap = 8;
                const defaultLabelGap = 8;
                const nodeHeight = nodeElement.offsetHeight || 12;

                const columnRect = column.getBoundingClientRect();
                const widgetRect = this.element.getBoundingClientRect();
                const columnOffsetTop = columnRect.top - widgetRect.top;
                const fallbackHeight = layout.availableHeight || nodeHeight;
                const columnHeight = column.offsetHeight || column.scrollHeight || fallbackHeight;
                const clampedColumnHeight = Math.max(nodeHeight, columnHeight);
                const relativeTop = Math.max(0, Math.min(clampedColumnHeight - nodeHeight, clampedY - columnOffsetTop));

                if (labelElement) {
                    labelElement.classList.remove('node-label-inward');
                    const measuredWidth = labelElement.offsetWidth || labelElement.getBoundingClientRect?.().width || 0;
                    const labelWidth = measuredWidth || 60;
                    const nodeCenterY = relativeTop + nodeHeight / 2;
                    labelElement.style.top = nodeCenterY + 'px';
                }

                node.relativeY = (clampedY - layout.contentTop) / layout.availableHeight;
            }
            return;
        }

        const elementWidth = this.element?.offsetWidth || this.width || 0;
        const baseX = elementWidth * node.relativeX;
        const edgeOffset = 12;
        const labelSpacing = 10;
        const labelInsideOffset = 14;

        let nodeX = baseX;
        if (isInput) {
            nodeX = baseX - nodeWidth - edgeOffset;
        } else if (isOutput) {
            nodeX = baseX + edgeOffset;
        }

        nodeElement.style.left = nodeX + 'px';
        nodeElement.style.top = clampedY + 'px';

        if (labelElement) {
            const measuredWidth = labelElement.offsetWidth || labelElement.getBoundingClientRect?.().width || 0;
            const labelWidth = measuredWidth || 60;
            let labelX = baseX;
            labelElement.style.top = clampedY + 'px';
            if (isInput) {
                labelX = baseX + labelInsideOffset + labelWidth;
            } else if (isOutput) {
                labelX = nodeX - labelSpacing;
            }
            labelElement.style.left = labelX + 'px';
        }

        node.relativeY = (clampedY - layout.contentTop) / layout.availableHeight;
    }

    setupEventListeners() {
        const header = this.element.querySelector('.widget-header');

        if (header) {
            header.addEventListener('mousedown', (e) => this.startDrag(e));
        }

        // Selection
        this.element.addEventListener('mousedown', (e) => {
            if (e.target === this.element || e.target.closest('.widget-content')) {
                this.select();
            }
        });
    }

    startDrag(e) {
        if (e.button !== 0) return; // Only left mouse button
        
        this.isDragging = true;
        this.element.classList.add('dragging');
        this.select();
        
        // Convert mouse position to canvas coordinates
        const canvasPos = this.clientToCanvas(e.clientX, e.clientY);
        if (!canvasPos) return;
        
        this.dragOffset.x = canvasPos.x - this.x;
        this.dragOffset.y = canvasPos.y - this.y;
        // Store bound handlers so we can properly remove them later
        this._boundDrag = this._boundDrag || this.drag.bind(this);
        this._boundStopDrag = this._boundStopDrag || this.stopDrag.bind(this);
        document.addEventListener('mousemove', this._boundDrag);
        document.addEventListener('mouseup', this._boundStopDrag);
        
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        
        // Convert mouse position to canvas coordinates
        const canvasPos = this.clientToCanvas(e.clientX, e.clientY);
        if (!canvasPos) return;
        
        const oldX = this.x;
        const oldY = this.y;
        this.x = canvasPos.x - this.dragOffset.x;
        this.y = canvasPos.y - this.dragOffset.y;

        // Apply magnetic snapping to nearby widget edges
        this.applyMagneticSnapping();

        // Constrain movement to the canvas bounds
        this.clampToCanvasBounds();

        if (this.element) {
            this.element.style.left = this.x + 'px';
            this.element.style.top = this.y + 'px';
        }
        
        // Update node connections now (will re-run if cascade applies)
        window.nodeSystem.updateConnections();
        if (this.enableCascadeDrag && this.children.size > 0) {
            const dx = this.x - oldX;
            const dy = this.y - oldY;
            if (dx !== 0 || dy !== 0) {
                const visited = new Set();
                const stack = Array.from(this.children);
                while (stack.length) {
                    const cid = stack.pop();
                    if (visited.has(cid)) continue;
                    visited.add(cid);
                    const childWidget = window.widgetManager?.getWidget(cid);
                    if (childWidget) {
                        childWidget.x += dx;
                        childWidget.y += dy;
                        childWidget.clampToCanvasBounds();
                        if (childWidget.element) {
                            childWidget.element.style.left = childWidget.x + 'px';
                            childWidget.element.style.top = childWidget.y + 'px';
                        }
                        childWidget.children.forEach(grand => stack.push(grand));
                    }
                }
                window.nodeSystem.updateConnections();
            }
        }
        if (window.app && window.app.updateMinimap) window.app.updateMinimap();
    }

    applyMagneticSnapping() {
        if (!window.widgetManager) return;
        
        const snapThreshold = 15; // pixels within which snapping occurs
        const myWidth = this.element?.offsetWidth || this.width || 300;
        const myHeight = this.element?.offsetHeight || this.height || 200;
        const myLeft = this.x;
        const myRight = this.x + myWidth;
        const myTop = this.y;
        const myBottom = this.y + myHeight;
        
        let snapX = null;
        let snapY = null;
        
        // Check all other widgets for snapping opportunities
        for (const otherWidget of window.widgetManager.widgets.values()) {
            if (otherWidget === this || !otherWidget.element) continue;
            
            const otherWidth = otherWidget.element.offsetWidth || otherWidget.width || 300;
            const otherHeight = otherWidget.element.offsetHeight || otherWidget.height || 200;
            const otherLeft = otherWidget.x;
            const otherRight = otherWidget.x + otherWidth;
            const otherTop = otherWidget.y;
            const otherBottom = otherWidget.y + otherHeight;
            
            // Check for vertical overlap (for horizontal snapping to make sense)
            const verticalOverlap = !(myBottom < otherTop || myTop > otherBottom);
            
            // Check for horizontal overlap (for vertical snapping to make sense)
            const horizontalOverlap = !(myRight < otherLeft || myLeft > otherRight);
            
            // Only apply horizontal snapping if there's vertical overlap or near-overlap
            const verticalProximity = Math.min(
                Math.abs(myTop - otherBottom),
                Math.abs(myBottom - otherTop),
                Math.abs(myTop - otherTop),
                Math.abs(myBottom - otherBottom)
            );
            
            if (snapX === null && (verticalOverlap || verticalProximity < snapThreshold)) {
                // Check for horizontal alignment opportunities (left/right edges)
                // Snap my left edge to other's left edge
                if (Math.abs(myLeft - otherLeft) < snapThreshold) {
                    snapX = otherLeft;
                }
                // Snap my left edge to other's right edge
                else if (Math.abs(myLeft - otherRight) < snapThreshold) {
                    snapX = otherRight;
                }
                // Snap my right edge to other's left edge
                else if (Math.abs(myRight - otherLeft) < snapThreshold) {
                    snapX = otherLeft - myWidth;
                }
                // Snap my right edge to other's right edge
                else if (Math.abs(myRight - otherRight) < snapThreshold) {
                    snapX = otherRight - myWidth;
                }
            }
            
            // Only apply vertical snapping if there's horizontal overlap or near-overlap
            const horizontalProximity = Math.min(
                Math.abs(myLeft - otherRight),
                Math.abs(myRight - otherLeft),
                Math.abs(myLeft - otherLeft),
                Math.abs(myRight - otherRight)
            );
            
            if (snapY === null && (horizontalOverlap || horizontalProximity < snapThreshold)) {
                // Check for vertical alignment opportunities (top/bottom edges)
                // Snap my top edge to other's top edge
                if (Math.abs(myTop - otherTop) < snapThreshold) {
                    snapY = otherTop;
                }
                // Snap my top edge to other's bottom edge
                else if (Math.abs(myTop - otherBottom) < snapThreshold) {
                    snapY = otherBottom;
                }
                // Snap my bottom edge to other's top edge
                else if (Math.abs(myBottom - otherTop) < snapThreshold) {
                    snapY = otherTop - myHeight;
                }
                // Snap my bottom edge to other's bottom edge
                else if (Math.abs(myBottom - otherBottom) < snapThreshold) {
                    snapY = otherBottom - myHeight;
                }
            }
            
            // If we found both snap positions, we can stop checking
            if (snapX !== null && snapY !== null) {
                break;
            }
        }
        
        // Apply the snap positions
        if (snapX !== null) this.x = snapX;
        if (snapY !== null) this.y = snapY;
    }

    stopDrag() {
    this.isDragging = false;
    this.element.classList.remove('dragging');
    this.manualPosition = true;
        if (this._boundDrag) document.removeEventListener('mousemove', this._boundDrag);
        if (this._boundStopDrag) document.removeEventListener('mouseup', this._boundStopDrag);
        if (window.app && window.app.updateMinimap) window.app.updateMinimap();
    }

    select() {
        // Deselect all other widgets
        document.querySelectorAll('.widget.selected').forEach(w => {
            w.classList.remove('selected');
        });
        
        this.selected = true;
        this.element.classList.add('selected');
        this.element.style.zIndex = '20';
    }

    deselect() {
        this.selected = false;
        this.element.classList.remove('selected');
        this.element.style.zIndex = '10';
    }

    toggleMinimize() {
        this.minimized = !this.minimized;
        this.element.classList.toggle('minimized', this.minimized);

        if (this.minimizeButton) {
            this.minimizeButton.innerHTML = this.minimized ? '□' : '−';
            this.minimizeButton.title = this.minimized ? 'Restore widget' : 'Minimize widget';
        }

        if (this.summaryElement) {
            if (this.minimized) {
                this.summaryElement.hidden = false;
                this.summaryElement.innerHTML = '';
                if (typeof this.renderSummary === 'function') {
                    this.renderSummary(this.summaryElement);
                }
            } else {
                this.summaryElement.innerHTML = '';
                this.summaryElement.hidden = true;
            }
        }

        if (typeof this.onMinimizeStateChanged === 'function') {
            this.onMinimizeStateChanged(this.minimized);
        }

        const refresh = () => {
            this.reflowNodes();
        };

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(refresh);
        } else {
            refresh();
        }
    }

    updatePreflightIndicator(warnings = 0, errors = 0, issues = [], alerts = 0) {
        const indicator = document.getElementById(`${this.id}-preflight`);
        if (!indicator) return;

        // Check if anything actually changed
        const hasIssues = warnings > 0 || errors > 0 || alerts > 0;
        const visibilityChanged = this.lastPreflightState.visible !== hasIssues;
        const countChanged = 
            this.lastPreflightState.warnings !== warnings ||
            this.lastPreflightState.errors !== errors ||
            this.lastPreflightState.alerts !== alerts ||
            this.lastPreflightState.issuesCount !== issues.length;
        
        // If nothing changed, skip DOM updates
        if (!visibilityChanged && !countChanged) {
            return;
        }
        
        // Update cache
        this.lastPreflightState.warnings = warnings;
        this.lastPreflightState.errors = errors;
        this.lastPreflightState.alerts = alerts;
        this.lastPreflightState.issuesCount = issues.length;
        this.lastPreflightState.visible = hasIssues;
        
        // Hide indicator if no issues
        if (!hasIssues) {
            indicator.style.display = 'none';
            return;
        }
        
        // Update visibility only if changed
        if (visibilityChanged) {
            indicator.style.display = 'flex';
        }
        
        // Only rebuild badges if counts changed
        if (countChanged) {
            indicator.innerHTML = '';

            if (alerts > 0) {
                const alertBadge = document.createElement('span');
                alertBadge.className = 'preflight-badge alert';
                alertBadge.textContent = alerts;
                alertBadge.title = `${alerts} alert${alerts > 1 ? 's' : ''}`;
                indicator.appendChild(alertBadge);
            }
            
            if (warnings > 0) {
                const warningBadge = document.createElement('span');
                warningBadge.className = 'preflight-badge warning';
                warningBadge.textContent = warnings;
                warningBadge.title = `${warnings} warning${warnings > 1 ? 's' : ''}`;
                indicator.appendChild(warningBadge);
            }

            if (errors > 0) {
                const errorBadge = document.createElement('span');
                errorBadge.className = 'preflight-badge error';
                errorBadge.textContent = errors;
                errorBadge.title = `${errors} error${errors > 1 ? 's' : ''}`;
                indicator.appendChild(errorBadge);
            }
            
            if (issues.length > 0) {
                const tooltip = document.createElement('div');
                tooltip.className = 'preflight-tooltip';
                tooltip.innerHTML = issues.map(issue => 
                    `<div class="preflight-issue ${issue.type}">${issue.message}</div>`
                ).join('');
                indicator.appendChild(tooltip);
            }
        }
    }

    togglePin() {
        if (this.pinned) {
            this.unpin();
        } else {
            this.pin();
        }
    }

    duplicate() {
        // Create a new widget of the same type, offset from the original
        const duplicateX = this.x + 40;
        const duplicateY = this.y + 40;
        
        const newWidget = window.app?.createWidget(this.type, duplicateX, duplicateY);
        if (!newWidget) return;
        
        // Copy the serialized data from this widget to the new one
        const data = this.getSerializedData();
        if (data && typeof newWidget.loadSerializedData === 'function') {
            // Create a deep copy of the data to avoid reference issues
            const dataCopy = JSON.parse(JSON.stringify(data));
            newWidget.loadSerializedData(dataCopy);
            
            // The loadSerializedData method should handle all internal updates,
            // but we ensure the display is refreshed
            if (typeof newWidget.updateTitle === 'function') {
                newWidget.updateTitle();
            }
            if (typeof newWidget.refresh === 'function') {
                newWidget.refresh();
            }
        }
        
        // Trigger any necessary refreshes
        if (window.preflightCheck) {
            window.preflightCheck.runCheck();
        }
        
        return newWidget;
    }

    pin() {
        if (this.pinned) return;
        
        this.pinned = true;
        const pinBtn = this.element.querySelector('.pin');
        if (pinBtn) {
            pinBtn.innerHTML = '🖈';
            pinBtn.title = 'Unpin widget';
        }
        
        // Create editable pinned widget
        this.createPinnedWidget();
        
        // Make original widget semi-transparent
        this.element.style.opacity = '0.7';
    }

    unpin() {
        if (!this.pinned) return;
        
        this.pinned = false;
        const pinBtn = this.element.querySelector('.pin');
        if (pinBtn) {
            pinBtn.innerHTML = '🖈';
            pinBtn.title = 'Pin widget';
        }
        
        // Remove pinned widget
        if (this.pinnedWidget) {
            this.pinnedWidget.destroy();
            this.pinnedWidget = null;
        }
        
        // Restore original widget opacity
        this.element.style.opacity = '1';
    }

    createPinnedWidget() {
        const pinnedLayer = document.getElementById('pinnedLayer');
        if (!pinnedLayer) return;
        
        // Create new PinnedWidget instance that syncs with original
        this.pinnedWidget = new PinnedWidget(this);
    }

    close() {
        // Remove pinned widget if exists
        if (this.pinnedWidget) {
            this.pinnedWidget.remove();
        }
        
        // Remove all connections
        for (const nodeId of this.nodes.keys()) {
            window.nodeSystem.removeNodeConnections(nodeId);
        }
        
        // Clean up preflight issues for this widget
        if (window.preflightCheck) {
            window.preflightCheck.clearWidgetIssues(this.id);
        }
        
        // Remove from DOM
        this.element.remove();
        
        // Remove from widget manager
        if (window.widgetManager) {
            window.widgetManager.removeWidget(this.id);
        }
    }

    // Get absolute position of a node
    getNodeAbsolutePosition(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return null;
        const nodeElement = this.getNodeDomElement(nodeId);
        if (nodeElement) {
            // Since the SVG is on the canvas and transforms with it,
            // we need to return positions in canvas/world coordinates, not screen coordinates
            const canvas = document.getElementById('canvas');
            const workspace = document.getElementById('workspace');
            const transform = window.app?.workspaceTransform || { scale: 1, translateX: 0, translateY: 0 };
            
            if (canvas && workspace) {
                const workspaceRect = workspace.getBoundingClientRect();
                const rect = nodeElement.getBoundingClientRect();
                
                // Get screen position relative to workspace
                const screenX = rect.left - workspaceRect.left + rect.width / 2;
                const screenY = rect.top - workspaceRect.top + rect.height / 2;
                
                // Convert screen coordinates to canvas coordinates by reversing the transform
                // screen = (canvas * scale) + translate
                // canvas = (screen - translate) / scale
                const canvasX = (screenX - transform.translateX) / transform.scale;
                const canvasY = (screenY - transform.translateY) / transform.scale;
                
                return { x: canvasX, y: canvasY };
            }
            // Fallback: calculate from widget position
            const centerX = this.x + nodeElement.offsetLeft + nodeElement.offsetWidth / 2;
            const centerY = this.y + nodeElement.offsetTop + nodeElement.offsetHeight / 2;
            return { x: centerX, y: centerY };
        }
        // Fallback approximate (assume 16px node including border)
        const headerHeight = 40;
        const topPadding = 10;
        const bottomPadding = 20;
        const availableHeight = Math.max(60, this.height - headerHeight - topPadding - bottomPadding);
        const normalizedY = Math.max(0, Math.min(1, node.relativeY));
        const baseTop = this.y + headerHeight + topPadding + (normalizedY * availableHeight);
        const baseLeft = this.x + (this.width * node.relativeX);
        return { x: baseLeft + 8, y: baseTop + 8 };
    }

    clientToCanvas(clientX, clientY) {
        // Convert screen/client coordinates to canvas coordinates
        const workspace = document.getElementById('workspace');
        if (!workspace) return null;
        
        const workspaceRect = workspace.getBoundingClientRect();
        const transform = window.app?.workspaceTransform || { scale: 1, translateX: 0, translateY: 0 };
        
        // Get position relative to workspace
        const screenX = clientX - workspaceRect.left;
        const screenY = clientY - workspaceRect.top;
        
        // Convert screen coordinates to canvas coordinates by reversing the transform
        // screen = (canvas * scale) + translate
        // canvas = (screen - translate) / scale
        const canvasX = (screenX - transform.translateX) / transform.scale;
        const canvasY = (screenY - transform.translateY) / transform.scale;
        
        return { x: canvasX, y: canvasY };
    }

    // Serialization
    toJSON() {
        const elementWidth = this.element ? this.element.offsetWidth : null;
        const elementHeight = this.element ? this.element.offsetHeight : null;
        const inlineWidth = this.element?.style?.width;
        const inlineHeight = this.element?.style?.height;
        const width = typeof elementWidth === 'number' && elementWidth > 0 ? elementWidth : this.width;
        const height = typeof elementHeight === 'number' && elementHeight > 0 ? elementHeight : this.height;
        this.width = width;
        this.height = height;
        return {
            type: this.type,
            title: this.title,
            id: this.id,
            x: this.x,
            y: this.y,
            width,
            height,
            explicitWidth: !!inlineWidth,
            explicitHeight: !!inlineHeight,
            minimized: this.minimized,
            parents: Array.from(this.parents),
            children: Array.from(this.children),
            data: this.getSerializedData()
        };
    }

    // Generic helper to sync form field values to a data object
    // fieldMap: { dataPath: 'elementId' } or { dataPath: { id: 'elementId', type: 'text|number|checkbox|select' } }
    syncFieldsToData(dataObject, fieldMap) {
        for (const [dataPath, fieldConfig] of Object.entries(fieldMap)) {
            const elementId = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.id;
            const fieldType = typeof fieldConfig === 'string' ? 'text' : (fieldConfig.type || 'text');
            
            const element = document.getElementById(`${this.id}-${elementId}`);
            if (!element) continue;
            
            let value;
            switch (fieldType) {
                case 'checkbox':
                    value = !!element.checked;
                    break;
                case 'number':
                    const num = parseFloat(element.value);
                    value = isNaN(num) ? null : num;
                    break;
                case 'select':
                case 'text':
                default:
                    value = element.value || '';
                    break;
            }
            
            // Support nested paths like 'nested.field'
            const pathParts = dataPath.split('.');
            let target = dataObject;
            for (let i = 0; i < pathParts.length - 1; i++) {
                if (!target[pathParts[i]]) {
                    target[pathParts[i]] = {};
                }
                target = target[pathParts[i]];
            }
            target[pathParts[pathParts.length - 1]] = value;
        }
    }

    // Generic helper to sync data object values to form fields
    syncDataToFields(dataObject, fieldMap) {
        for (const [dataPath, fieldConfig] of Object.entries(fieldMap)) {
            const elementId = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.id;
            const fieldType = typeof fieldConfig === 'string' ? 'text' : (fieldConfig.type || 'text');
            
            const element = document.getElementById(`${this.id}-${elementId}`);
            if (!element) continue;
            
            // Get value from nested path
            const pathParts = dataPath.split('.');
            let value = dataObject;
            for (const part of pathParts) {
                value = value?.[part];
                if (value === undefined) break;
            }
            
            if (value === undefined || value === null) continue;
            
            switch (fieldType) {
                case 'checkbox':
                    element.checked = !!value;
                    break;
                case 'number':
                case 'select':
                case 'text':
                default:
                    element.value = value;
                    break;
            }
        }
    }

    getSerializedData() {
        // To be overridden by subclasses
        // Important: Subclasses should sync form data to internal state before returning data
        // Example pattern:
        //   getSerializedData() {
        //       this.syncDataFromForm(); // Read current form values into this.data
        //       return {
        //           ...super.getSerializedData(),
        //           myData: this.myData
        //       };
        //   }
        return {};
    }

    // Deserialization
    fromJSON(data, skipConnectionSync = false) {
        this.x = data.x || this.x;
        this.y = data.y || this.y;
    const hasExplicitWidth = data.explicitWidth ?? true;
    const hasExplicitHeight = data.explicitHeight ?? false;
    if (typeof data.width === 'number') {
        this.width = data.width;
    }
    if (typeof data.height === 'number') {
        this.height = data.height;
    }
    this.minimized = data.minimized || false;
    this.manualPosition = true;
        if (data.parents) this.parents = new Set(data.parents);
        if (data.children) this.children = new Set(data.children);
        
        this.clampToCanvasBounds();

        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        if (hasExplicitWidth && typeof this.width === 'number' && this.width > 0) {
            this.element.style.width = this.width + 'px';
        } else {
            this.element.style.width = '';
            this.width = this.element.offsetWidth || this.width;
        }
        if (hasExplicitHeight && typeof this.height === 'number' && this.height > 0) {
            this.element.style.height = this.height + 'px';
        } else {
            this.element.style.height = '';
            this.height = this.element.offsetHeight || this.height;
        }
        
        if (this.minimized) {
            this.element.classList.add('minimized');
        }
        
        if (skipConnectionSync) {
            console.log(`[Widget.fromJSON] Setting skipConnectionSync=true for ${this.id}`);
        }
        this.skipConnectionSync = skipConnectionSync;
        this.loadSerializedData(data.data || {});
        this.skipConnectionSync = false;

        if (this.minimizeButton) {
            this.minimizeButton.innerHTML = this.minimized ? '□' : '−';
            this.minimizeButton.title = this.minimized ? 'Restore widget' : 'Minimize widget';
        }

        if (this.summaryElement) {
            if (this.minimized) {
                this.summaryElement.hidden = false;
                this.summaryElement.innerHTML = '';
                if (typeof this.renderSummary === 'function') {
                    this.renderSummary(this.summaryElement);
                }
            } else {
                this.summaryElement.innerHTML = '';
                this.summaryElement.hidden = true;
            }
        }

        if (typeof this.onMinimizeStateChanged === 'function') {
            this.onMinimizeStateChanged(this.minimized);
        }

        this.updateAllNodePositions();
    }

    // Hierarchy helpers
    addChild(widget) {
        if (!widget || widget === this) return false;
        if (this.isAncestorOf(widget)) return false; // prevent cycle
        this.children.add(widget.id);
        widget.parents.add(this.id);
        if (typeof widget.onParentLinked === 'function') {
            widget.onParentLinked(this);
        }
        this.autoArrangeHierarchy();
        if (window.widgetManager) {
            this.parents.forEach(parentId => {
                const ancestor = window.widgetManager.getWidget(parentId);
                if (ancestor) {
                    ancestor.autoArrangeHierarchy();
                }
            });
        }
        return true;
    }

    removeChild(widget) {
        if (!widget) return;
        this.children.delete(widget.id);
        widget.parents.delete(this.id);
        if (typeof widget.onParentUnlinked === 'function') {
            widget.onParentUnlinked(this);
        }
        this.autoArrangeHierarchy();
        if (window.widgetManager) {
            this.parents.forEach(parentId => {
                const ancestor = window.widgetManager.getWidget(parentId);
                if (ancestor) {
                    ancestor.autoArrangeHierarchy();
                }
            });
        }
    }

    isAncestorOf(widget) {
        const visited = new Set();
        const stack = [this];
        while (stack.length) {
            const current = stack.pop();
            if (current === widget) return true;
            if (visited.has(current.id)) continue;
            visited.add(current.id);
            current.children.forEach(cid => {
                const childWidget = window.widgetManager?.getWidget(cid);
                if (childWidget) stack.push(childWidget);
            });
        }
        return false;
    }

    getDescendants() {
        const result = new Set();
        const stack = [this];
        while (stack.length) {
            const current = stack.pop();
            current.children.forEach(cid => {
                if (!result.has(cid)) {
                    result.add(cid);
                    const childWidget = window.widgetManager?.getWidget(cid);
                    if (childWidget) stack.push(childWidget);
                }
            });
        }
        result.delete(this.id);
        return Array.from(result);
    }

    autoArrangeHierarchy(options = {}) {
        const {
            spacingX = 320,
            spacingY = 220,
            visited = new Set(),
            root = true
        } = options;
        if (visited.has(this.id)) return;
        visited.add(this.id);

        if (!window.widgetManager) return;

        const children = Array.from(this.children)
            .map(id => window.widgetManager.getWidget(id))
            .filter(child => !!child);

        if (children.length === 0) {
            return;
        }

        const movableChildren = children.filter(child =>
            !child.pinned &&
            !child.manualPosition &&
            child.parents.size <= 1
        );

        if (movableChildren.length > 0) {
            const baseX = this.x + this.width + spacingX;
            const totalHeight = (movableChildren.length - 1) * spacingY;
            const startY = this.y - totalHeight / 2;
            movableChildren.forEach((child, index) => {
                const targetY = startY + index * spacingY;
                child.manualPosition = false;
                child.setPosition(baseX, targetY, { updateConnections: false, updateMinimap: false });
            });
        }

        children.forEach(child => {
            child.autoArrangeHierarchy({ spacingX, spacingY, visited, root: false });
        });

        if (root) {
            if (window.nodeSystem) {
                window.nodeSystem.updateConnections();
            }
            if (window.app && window.app.updateMinimap) {
                window.app.updateMinimap();
            }
        }
    }

    /**
     * Notify all child widgets that this widget's data has changed
     * Children will pull fresh data from their connected input nodes
     * Call this whenever your widget's data changes significantly
     * Example: Call after user edits in ShipWidget → all connected OutfitWidgets get notified
     */
    notifyChildrenOfChange() {
        if (!this.children || this.children.size === 0) return;
        
        for (const childId of this.children) {
            const childWidget = window.widgetManager?.getWidget(childId);
            if (childWidget && typeof childWidget.onParentDataChanged === 'function') {
                // Notify child of parent data change
                childWidget.onParentDataChanged(this.id);
            }
        }
    }

    /**
     * Hook for child widgets to respond when parent data changes
     * Override this in child widgets to refresh their derived data
     * @param {string} parentWidgetId - ID of parent widget that changed
     */
    onParentDataChanged(parentWidgetId) {
        // To be overridden by child widgets
        // Example in OutfitWidget:
        //   onParentDataChanged(parentWidgetId) {
        //       this.syncClassData();
        //   }
    }

    /**
     * Generic method to get parent widget data via connection hierarchy
     * Returns all serialized data from a parent of specified type
     * Automatically includes all fields that parent defines in getSerializedData()
     * @param {string} parentType - Widget type to search for (e.g., 'ship', 'outfit')
     * @returns {object|null} Complete serialized data from parent or null if not found
     */
    getParentData(parentType) {
        if (!this.parents || this.parents.size === 0) return null;
        
        for (const parentId of this.parents) {
            const parent = window.widgetManager?.getWidget(parentId);
            if (parent && parent.type === parentType && typeof parent.getSerializedData === 'function') {
                return parent.getSerializedData();
            }
        }
        return null;
    }

    /**
     * Get data connected to a specific input node
     * Supports multiple connections to nodes with the same name (e.g., two "Weapon" inputs)
     * Each connection is individually addressable and distinct
     * @param {string} nodeId - The input node ID (e.g., 'widget-xxx-input:Weapon-1')
     * @returns {object|null} The data from the widget connected to this specific node
     */
    getConnectedNodeData(nodeId) {
        if (!nodeId || !window.nodeSystem) return null;
        
        const node = window.nodeSystem.getNodeById(nodeId);
        if (!node) {
            console.warn(`[Widget.getConnectedNodeData] Node not found: ${nodeId}`);
            return null;
        }
        
        if (!node.connections || node.connections.size === 0) {
            console.warn(`[Widget.getConnectedNodeData] Node ${nodeId} has no connections`);
            return null;
        }
        
        // Input nodes have single connection (after ensureSingleInputConnection)
        const connectionId = Array.from(node.connections)[0];
        const connection = window.nodeSystem.connections.get(connectionId);
        if (!connection) {
            console.warn(`[Widget.getConnectedNodeData] Connection ${connectionId} not found`);
            return null;
        }
        
        // Find which node is the source (output)
        // For input nodes, we want the other end of the connection
        const isInputNode = node.type === 'input';
        const sourceNodeId = isInputNode ? connection.sourceNodeId : connection.targetNodeId;
        const sourceNode = window.nodeSystem.getNodeById(sourceNodeId);
        if (!sourceNode) {
            console.warn(`[Widget.getConnectedNodeData] Source node ${sourceNodeId} not found`);
            return null;
        }
        
        // Get the source widget
        const sourceWidget = window.widgetManager?.getWidget(sourceNode.widgetId);
        if (!sourceWidget) {
            console.warn(`[Widget.getConnectedNodeData] Source widget ${sourceNode.widgetId} not found`);
            return null;
        }
        
        if (typeof sourceWidget.getSerializedData !== 'function') {
            console.warn(`[Widget.getConnectedNodeData] Source widget has no getSerializedData method`);
            return null;
        }
        
        const data = sourceWidget.getSerializedData();
        console.log(`[Widget.getConnectedNodeData] Got data from ${sourceWidget.id}:`, data);
        return data;
    }

    /**
     * Get data from all inputs of a specific nodeType
     * For widgets with multiple inputs of same type (e.g., multiple "Weapon" inputs)
     * Returns array of connected data in order
     * @param {string} nodeType - The node type to search for (e.g., 'Weapon', 'Craft', 'Core')
     * @returns {Array<object>} Array of connected data, one per matching input node
     */
    getConnectedDataByNodeType(nodeType) {
        const results = [];
        
        if (!this.nodes) return results;
        
        // Find all input nodes matching this type, in order
        const matchingNodes = Array.from(this.nodes.values())
            .filter(n => n.type === 'input' && n.nodeType === nodeType)
            .sort((a, b) => {
                // Sort by node ID to maintain consistent order
                // Nodes like "widget-xxx-input:Weapon-1", "widget-xxx-input:Weapon-2"
                const aIndex = parseInt(a.id.split('-').pop()) || 0;
                const bIndex = parseInt(b.id.split('-').pop()) || 0;
                return aIndex - bIndex;
            });
        
        console.log(`[Widget.getConnectedDataByNodeType] Looking for ${nodeType} in widget ${this.id}, found ${matchingNodes.length} matching nodes`);
        
        for (const node of matchingNodes) {
            console.log(`[Widget.getConnectedDataByNodeType] Processing node ${node.id}, connections: ${node.connections.size}`);
            const data = this.getConnectedNodeData(node.id);
            if (data) {
                results.push({
                    nodeId: node.id,
                    nodeLabel: node.label,
                    data: data
                });
            }
        }
        
        console.log(`[Widget.getConnectedDataByNodeType] Returning ${results.length} results for ${nodeType}`);
        return results;
    }

    /**
     * Generic method to get all parent widget data
     * Returns map of parent type -> serialized data for ALL parents
     * Useful for widgets with multiple parent types
     * @returns {Map<string, object>} Map of parent type to their complete data
     */
    getAllParentData() {
        const parentDataMap = new Map();
        
        if (!this.parents || this.parents.size === 0) return parentDataMap;
        
        for (const parentId of this.parents) {
            const parent = window.widgetManager?.getWidget(parentId);
            if (parent && typeof parent.getSerializedData === 'function') {
                const key = parent.type;
                const data = parent.getSerializedData();
                // If multiple parents of same type, store as array
                if (parentDataMap.has(key)) {
                    const existing = parentDataMap.get(key);
                    if (Array.isArray(existing)) {
                        existing.push(data);
                    } else {
                        parentDataMap.set(key, [existing, data]);
                    }
                } else {
                    parentDataMap.set(key, data);
                }
            }
        }
        return parentDataMap;
    }

    /**
     * Cache parent data snapshot for quick reference
     * Call this in onParentLinked() to store a complete copy of parent state
     * Automatically updated whenever parent changes via node connections
     * @param {string} parentType - Type of parent to cache (e.g., 'ship')
     * @returns {object|null} The cached data or null if parent not found
     */
    cacheParentData(parentType = null) {
        if (!this.parentDataCache) {
            this.parentDataCache = new Map();
        }
        
        if (parentType) {
            const data = this.getParentData(parentType);
            if (data) {
                this.parentDataCache.set(parentType, JSON.parse(JSON.stringify(data))); // Deep clone
                return this.parentDataCache.get(parentType);
            }
            return null;
        } else {
            // Cache all parent data
            const allData = this.getAllParentData();
            for (const [type, data] of allData) {
                this.parentDataCache.set(type, JSON.parse(JSON.stringify(data))); // Deep clone
            }
            return this.parentDataCache;
        }
    }

    /**
     * Get cached parent data
     * @param {string} parentType - Type of parent data to retrieve
     * @returns {object|null} Previously cached data or null
     */
    getCachedParentData(parentType) {
        if (!this.parentDataCache) return null;
        return this.parentDataCache.get(parentType) || null;
    }

    loadSerializedData(data) {
        // To be overridden by subclasses
        // Important: Subclasses should load data into internal state and update the display
        // Example pattern:
        //   loadSerializedData(data) {
        //       super.loadSerializedData(data);
        //       if (data.myData) {
        //           this.myData = { ...this.myData, ...data.myData };
        //           // Deep merge any nested objects
        //           this.syncFormFromData(); // Update form fields from this.myData
        //           this.updateDisplay(); // Refresh any calculated displays
        //       }
        //   }
    }
}

// PinnedWidget class - Creates an editable duplicate on the pinned layer
class PinnedWidget {
    constructor(originalWidget) {
        this.originalWidget = originalWidget;
        this.id = `${originalWidget.id}-pinned`;
        this.x = window.innerWidth - originalWidget.width - 20;
        this.y = 80;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.create();
        this.setupSync();
        this.setupEventListeners();
    }
    
    create() {
        this.element = document.createElement('div');
        this.element.className = `widget ${this.originalWidget.type}-widget pinned-widget`;
        this.element.id = this.id;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.width = this.originalWidget.width + 'px';
        this.element.style.height = this.originalWidget.height + 'px';
        this.element.style.position = 'absolute';
        this.element.style.zIndex = '10000';
        this.element.style.border = '2px solid #4a90e2';
        this.element.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.3)';
        
        // Create header with only unpin button
        const header = document.createElement('div');
        header.className = 'widget-header';
        
        const titleElement = document.createElement('span');
        titleElement.className = 'widget-title';
        titleElement.textContent = this.originalWidget.title + ' (Pinned)';
        
        const controls = document.createElement('div');
        controls.className = 'widget-controls';
        
        const unpinBtn = document.createElement('button');
        unpinBtn.className = 'widget-control-btn unpin';
        unpinBtn.innerHTML = '📍';
        unpinBtn.title = 'Unpin widget';
        unpinBtn.onclick = (e) => {
            e.stopPropagation();
            this.originalWidget.unpin();
        };
        
        controls.appendChild(unpinBtn);
        header.appendChild(titleElement);
        header.appendChild(controls);
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'widget-content';
        
        this.element.appendChild(header);
        this.element.appendChild(content);
        
        // Add to pinned layer
        const pinnedLayer = document.getElementById('pinnedLayer');
        if (pinnedLayer) {
            pinnedLayer.appendChild(this.element);
        }
        
        // Sync initial content
        this.syncContent();
    }
    
    setupSync() {
        // Watch for changes in original widget content
        this.observer = new MutationObserver(() => {
            this.syncContent();
        });
        
        const originalContent = this.originalWidget.element.querySelector('.widget-content');
        if (originalContent) {
            this.observer.observe(originalContent, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        }
    }
    
    syncContent() {
        const originalContent = this.originalWidget.element.querySelector('.widget-content');
        const pinnedContent = this.element.querySelector('.widget-content');
        
        if (originalContent && pinnedContent) {
            // Clone content structure
            pinnedContent.innerHTML = originalContent.innerHTML;
            
            // Rebind event listeners for interactive elements
            this.rebindInteractions();
        }
    }
    
    rebindInteractions() {
        // Find all inputs, selects, textareas, and buttons in pinned content
        const interactiveElements = this.element.querySelectorAll(
            'input, select, textarea, button:not(.widget-control-btn)'
        );
        
        interactiveElements.forEach(element => {
            // Find corresponding element in original widget
            const elementId = element.id;
            if (elementId) {
                const originalElement = document.getElementById(elementId);
                if (originalElement) {
                    // Sync value from original to pinned
                    if (element.type === 'checkbox') {
                        element.checked = originalElement.checked;
                    } else {
                        element.value = originalElement.value;
                    }
                    
                    // Set up bidirectional sync
                    const syncToOriginal = () => {
                        if (element.type === 'checkbox') {
                            originalElement.checked = element.checked;
                        } else {
                            originalElement.value = element.value;
                        }
                        
                        // Trigger change event on original
                        originalElement.dispatchEvent(new Event('change', { bubbles: true }));
                        originalElement.dispatchEvent(new Event('input', { bubbles: true }));
                    };
                    
                    const syncToPinned = () => {
                        if (element.type === 'checkbox') {
                            element.checked = originalElement.checked;
                        } else {
                            element.value = originalElement.value;
                        }
                    };
                    
                    // Listen for changes in pinned element
                    element.addEventListener('input', syncToOriginal);
                    element.addEventListener('change', syncToOriginal);
                    element.addEventListener('click', syncToOriginal);
                    
                    // Listen for changes in original element
                    originalElement.addEventListener('input', syncToPinned);
                    originalElement.addEventListener('change', syncToPinned);
                }
            }
        });
    }
    
    setupEventListeners() {
        const header = this.element.querySelector('.widget-header');
        if (header) {
            header.addEventListener('mousedown', this.startDrag.bind(this));
        }
    }
    
    startDrag(e) {
        if (e.button !== 0) return; // Only left mouse button
        if (e.target.classList.contains('widget-control-btn')) return;
        
        this.isDragging = true;
        const rect = this.element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
        
        e.preventDefault();
    }
    
    drag(e) {
        if (!this.isDragging) return;
        
        this.x = e.clientX - this.dragOffset.x;
        this.y = e.clientY - this.dragOffset.y;
        
        // Keep within viewport
        this.x = Math.max(0, Math.min(this.x, window.innerWidth - this.element.offsetWidth));
        this.y = Math.max(0, Math.min(this.y, window.innerHeight - this.element.offsetHeight));
        
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }
    
    stopDrag() {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.drag.bind(this));
        document.removeEventListener('mouseup', this.stopDrag.bind(this));
    }
    
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.element) {
            this.element.remove();
        }
    }
}