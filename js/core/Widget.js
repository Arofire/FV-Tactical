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
        this.isResizing = false;
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
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        };
        
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
        controls.appendChild(pinBtn);
        controls.appendChild(minimizeBtn);
        controls.appendChild(closeBtn);
        header.appendChild(titleElement);
        header.appendChild(controls);
        
        // Create content area with three-column layout
        const content = document.createElement('div');
        content.className = 'widget-content';
        
        // Create the main sections container
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'widget-sections';
        content.appendChild(sectionsContainer);
        
        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'widget-resize-handle';
        
        // Create nodes container
        const nodesContainer = document.createElement('div');
        nodesContainer.className = 'widget-nodes';
        
        this.element.appendChild(header);
        this.element.appendChild(content);
        this.element.appendChild(resizeHandle);
        this.element.appendChild(nodesContainer);
        
        // Populate content (to be overridden by subclasses)
        this.createContent(content);
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

    createContent(contentElement) {
        // To be overridden by subclasses
        contentElement.innerHTML = '<p>Base widget content</p>';
    }

    // Helper method to create a three-column section
    createSection(sectionId, sectionTitle, options = {}) {
        const section = document.createElement('div');
        section.className = 'widget-section';
        section.id = `${this.id}-${sectionId}`;
        
        if (options.errorState) {
            section.classList.add('section-error');
        } else if (options.warningState) {
            section.classList.add('section-warning');
        }
        
        // Create the three columns
        const leftColumn = document.createElement('div');
        leftColumn.className = 'section-left-column';
        
        const bodyColumn = document.createElement('div');
        bodyColumn.className = 'section-body-column';
        
        const rightColumn = document.createElement('div');
        rightColumn.className = 'section-right-column';
        
        // Add title to body column
        if (sectionTitle) {
            const title = document.createElement('h4');
            title.className = 'section-title';
            title.textContent = sectionTitle;
            bodyColumn.appendChild(title);
        }
        
        // Add content container to body column
        const contentContainer = document.createElement('div');
        contentContainer.className = 'section-content';
        bodyColumn.appendChild(contentContainer);
        
        section.appendChild(leftColumn);
        section.appendChild(bodyColumn);
        section.appendChild(rightColumn);
        
        return {
            section,
            leftColumn,
            bodyColumn,
            rightColumn,
            contentContainer
        };
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
                const oldElement = document.getElementById(nodeId);
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

    createNodeElement(node) {
        const nodeElement = document.createElement('div');
        nodeElement.className = `node ${node.type} ${node.nodeType}`;
        nodeElement.id = node.id;
        
        const labelElement = document.createElement('div');
        labelElement.className = `node-label ${node.type}`;
        labelElement.textContent = node.label;
        labelElement.setAttribute('data-node-id', node.id);
        
        // Find the appropriate column for this node
        let targetColumn;
        if (node.sectionId) {
            // Place in specific section's column
            const section = this.element.querySelector(`#${this.id}-${node.sectionId}`);
            if (section) {
                targetColumn = node.type === 'input' 
                    ? section.querySelector('.section-left-column')
                    : section.querySelector('.section-right-column');
            }
        }
        
        // Fallback to old widget-nodes container if no section specified or found
        if (!targetColumn) {
            targetColumn = this.element.querySelector('.widget-nodes');
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
        };

        layoutNodes(inputs, 0);
        layoutNodes(outputs, 1);
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
        const nodeElement = document.getElementById(nodeId);
        const labelElement = nodeElement?.nextElementSibling;
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
        const headerHeight = 40;
        const topPadding = 10;
        const bottomPadding = 20;
        const availableHeight = Math.max(60, this.height - headerHeight - topPadding - bottomPadding);
        const contentTop = headerHeight + topPadding;
        const contentBottom = contentTop + availableHeight;
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
        const nodeElement = document.getElementById(node.id);
        if (!nodeElement) return;
        const labelElement = nodeElement.nextElementSibling;
        const baseX = this.width * node.relativeX;
        const layout = metrics || this.getNodeLayoutMetrics();
        const clampedY = Math.max(layout.contentTop, Math.min(layout.contentBottom, targetY));

        const nodeWidth = nodeElement.offsetWidth || 12;
        const edgeOffset = 12;
    const labelSpacing = 10;
    const labelInsideOffset = 14;
        const isInput = node.type === 'input';
        const isOutput = node.type === 'output';

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
                labelElement.style.left = labelX + 'px';
            } else if (isOutput) {
                labelX = nodeX - labelSpacing;
                labelElement.style.left = labelX + 'px';
            } else {
                labelElement.style.left = labelX + 'px';
            }
        }
        // Persist normalized position for fallback layout
        node.relativeY = (clampedY - layout.contentTop) / layout.availableHeight;
    }

    setupEventListeners() {
        const header = this.element.querySelector('.widget-header');
        const resizeHandle = this.element.querySelector('.widget-resize-handle');
        
        // Dragging
        header.addEventListener('mousedown', (e) => this.startDrag(e));
        
        // Resizing
        resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        
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
        
        this.dragOffset.x = e.clientX - this.x;
        this.dragOffset.y = e.clientY - this.y;
        // Store bound handlers so we can properly remove them later
        this._boundDrag = this._boundDrag || this.drag.bind(this);
        this._boundStopDrag = this._boundStopDrag || this.stopDrag.bind(this);
        document.addEventListener('mousemove', this._boundDrag);
        document.addEventListener('mouseup', this._boundStopDrag);
        
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        const oldX = this.x;
        const oldY = this.y;
        this.x = e.clientX - this.dragOffset.x;
        this.y = e.clientY - this.dragOffset.y;

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

    stopDrag() {
    this.isDragging = false;
    this.element.classList.remove('dragging');
    this.manualPosition = true;
        if (this._boundDrag) document.removeEventListener('mousemove', this._boundDrag);
        if (this._boundStopDrag) document.removeEventListener('mouseup', this._boundStopDrag);
        if (window.app && window.app.updateMinimap) window.app.updateMinimap();
    }

    startResize(e) {
        if (e.button !== 0) return; // Only left mouse button
        
        this.isResizing = true;
        this.select();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = this.width;
        const startHeight = this.height;
        
        const resize = (e) => {
            if (!this.isResizing) return;
            
            this.width = Math.max(200, startWidth + (e.clientX - startX));
            this.height = Math.max(150, startHeight + (e.clientY - startY));
            
            this.element.style.width = this.width + 'px';
            this.element.style.height = this.height + 'px';
            
            this.updateAllNodePositions();
            window.nodeSystem.updateConnections();
            if (window.app && window.app.updateMinimap) window.app.updateMinimap();
        };
        
        const stopResize = () => {
            this.isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            if (window.app && window.app.updateMinimap) window.app.updateMinimap();
        };
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
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
        
        if (this.minimized) {
            // Store original height before minimizing
            this.originalHeight = this.height;
            this.height = 40;
            this.element.style.height = '40px';
        } else {
            // Restore original height when unminimizing
            this.height = this.originalHeight || this.height;
            this.element.style.height = this.height + 'px';
        }
        
        this.element.classList.toggle('minimized', this.minimized);
        
        if (!this.minimized) {
            this.updateAllNodePositions();
            window.nodeSystem.updateConnections();
        }
    }

    updatePreflightIndicator(warnings = 0, errors = 0, issues = [], alerts = 0) {
        const indicator = document.getElementById(`${this.id}-preflight`);
        if (!indicator) return;

        if (warnings === 0 && errors === 0 && alerts === 0) {
            indicator.style.display = 'none';
            return;
        }
        
        indicator.style.display = 'flex';
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

    togglePin() {
        if (this.pinned) {
            this.unpin();
        } else {
            this.pin();
        }
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
        const nodeElement = document.getElementById(nodeId);
        if (nodeElement) {
            const workspace = document.getElementById('workspace');
            const transform = window.app?.workspaceTransform || { scale: 1, translateX: 0, translateY: 0 };
            if (workspace) {
                const workspaceRect = workspace.getBoundingClientRect();
                const rect = nodeElement.getBoundingClientRect();
                const centerScreenX = rect.left - workspaceRect.left + rect.width / 2;
                const centerScreenY = rect.top - workspaceRect.top + rect.height / 2;
                const worldX = (centerScreenX / transform.scale) - transform.translateX;
                const worldY = (centerScreenY / transform.scale) - transform.translateY;
                return { x: worldX, y: worldY };
            }
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

    getSerializedData() {
        // To be overridden by subclasses
        return {};
    }

    // Deserialization
    fromJSON(data) {
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
        
    this.loadSerializedData(data.data || {});
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

    loadSerializedData(data) {
        // To be overridden by subclasses
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