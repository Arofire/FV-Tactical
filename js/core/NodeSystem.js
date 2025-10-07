// Node connection system for visual node-based design
class NodeSystem {
    constructor() {
        this.connections = new Map(); // connectionId -> connection data
        this.svg = document.getElementById('connectionSvg');
        this.tempConnection = null;
        this.isDragging = false;
        this.dragStartNode = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Global mouse events for connection dragging
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.tempConnection) {
                this.updateTempConnection(e);
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.endConnection(e);
            }
        });
        
        // Canvas click to deselect connections
        document.getElementById('canvas').addEventListener('click', (e) => {
            if (e.target.id === 'canvas') {
                this.deselectAllConnections();
            }
        });
    }

    startConnection(nodeId, event) {
        const node = this.getNodeById(nodeId);
        if (!node) return;
        
        this.isDragging = true;
        this.dragStartNode = nodeId;
        
        // Create temporary connection line
        this.createTempConnection(nodeId, event);
        
        event.preventDefault();
        event.stopPropagation();
    }

    createTempConnection(startNodeId, event) {
        const startPos = this.getNodeAbsolutePosition(startNodeId);
        if (!startPos) return;
        
        // Create SVG line element
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-preview');
        
        this.tempConnection = {
            element: line,
            startNodeId: startNodeId,
            startPos: startPos
        };
        
        this.svg.appendChild(line);
        this.updateTempConnection(event);
    }

    updateTempConnection(event) {
        if (!this.tempConnection) return;
        
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const endX = event.clientX - canvasRect.left;
        const endY = event.clientY - canvasRect.top;
        
        const path = this.createBezierPath(
            this.tempConnection.startPos.x,
            this.tempConnection.startPos.y,
            endX,
            endY
        );
        
        this.tempConnection.element.setAttribute('d', path);
    }

    endConnection(event) {
        if (!this.isDragging || !this.tempConnection) return;
        
        this.isDragging = false;
        
        // Find target node under mouse
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const targetNodeId = targetElement?.id;
        
        if (targetNodeId && targetNodeId.startsWith('widget-') && 
            targetElement.classList.contains('node') &&
            this.canConnect(this.dragStartNode, targetNodeId)) {
            
            // Create actual connection
            this.createConnection(this.dragStartNode, targetNodeId);
        } else {
            // Connection ended in empty space - create compatible widget
            this.createWidgetFromConnection(event);
        }
        
        // Clean up temporary connection
        if (this.tempConnection.element) {
            this.tempConnection.element.remove();
        }
        this.tempConnection = null;
        this.dragStartNode = null;
    }

    canConnect(sourceNodeId, targetNodeId) {
        if (sourceNodeId === targetNodeId) return false;
        
        const sourceNode = this.getNodeById(sourceNodeId);
        const targetNode = this.getNodeById(targetNodeId);
        
        if (!sourceNode || !targetNode) return false;
        
        // Can't connect nodes of same widget
        if (sourceNode.widgetId === targetNode.widgetId) return false;
        
        // Can't connect input to input or output to output
        if (sourceNode.type === targetNode.type) return false;
        
        // Check if connection already exists
        const connectionId = this.getConnectionId(sourceNodeId, targetNodeId);
        if (this.connections.has(connectionId)) return false;
        
        // Check node type compatibility
        return this.areNodeTypesCompatible(sourceNode.nodeType, targetNode.nodeType);
    }

    areNodeTypesCompatible(type1, type2) {
        const compatibilityMap = {
            'power': ['power'],
            'weapon': ['weapon'],
            'magazine': ['weapon'],
            'component': ['component'],
            'data': ['data'],
            'loadout': ['loadout'],
            'powerplant': ['powerplant'],
            'statistics': ['statistics'],
            'outfit': ['outfit'],
            'ship-class': ['ship-class'],
            'information': ['information']
        };
        
        return compatibilityMap[type1]?.includes(type2) || 
               compatibilityMap[type2]?.includes(type1);
    }

    createConnection(sourceNodeId, targetNodeId) {
        const connectionId = this.getConnectionId(sourceNodeId, targetNodeId);
        
        const connection = {
            id: connectionId,
            sourceNodeId: sourceNodeId,
            targetNodeId: targetNodeId,
            selected: false
        };
        
        this.connections.set(connectionId, connection);
        
        // Update node connection tracking
        const sourceNode = this.getNodeById(sourceNodeId);
        const targetNode = this.getNodeById(targetNodeId);
        
        if (sourceNode) sourceNode.connections.add(connectionId);
        if (targetNode) targetNode.connections.add(connectionId);
        
        // Create visual connection
        this.createConnectionElement(connection);
        
        // Update node visual state
        this.updateNodeConnectionState(sourceNodeId);
        this.updateNodeConnectionState(targetNodeId);
        
        // Trigger validation
        if (window.preflightCheck) {
            window.preflightCheck.runCheck();
        }

        // Establish parent/child relationship (source -> target if output->input)
        this.assignHierarchy(sourceNodeId, targetNodeId);
    }

    createConnectionElement(connection) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-line');
        line.id = connection.id;
        
        // Add node type class for styling
        const sourceNode = this.getNodeById(connection.sourceNodeId);
        if (sourceNode) {
            line.classList.add(sourceNode.nodeType);
        }
        
        // Add click handler for selection
        line.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectConnection(connection.id);
        });
        
        // Add context menu
        line.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showConnectionContextMenu(connection.id, e);
        });
        
        this.svg.appendChild(line);
        this.updateConnectionElement(connection);
    }

    updateConnectionElement(connection) {
        const element = document.getElementById(connection.id);
        if (!element) return;
        
        const sourcePos = this.getNodeAbsolutePosition(connection.sourceNodeId);
        const targetPos = this.getNodeAbsolutePosition(connection.targetNodeId);
        
        if (!sourcePos || !targetPos) return;
        
        const path = this.createBezierPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
        element.setAttribute('d', path);
    }

    createBezierPath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(distance * 0.3, 100);
        
        const cpx1 = x1 + curvature;
        const cpy1 = y1;
        const cpx2 = x2 - curvature;
        const cpy2 = y2;
        
        return `M ${x1} ${y1} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x2} ${y2}`;
    }

    updateConnections() {
        for (const connection of this.connections.values()) {
            this.updateConnectionElement(connection);
        }
    }

    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        // Remove from nodes
        const sourceNode = this.getNodeById(connection.sourceNodeId);
        const targetNode = this.getNodeById(connection.targetNodeId);
        
        if (sourceNode) sourceNode.connections.delete(connectionId);
        if (targetNode) targetNode.connections.delete(connectionId);
        
        // Remove visual element
        const element = document.getElementById(connectionId);
        if (element) element.remove();
        
        // Before deletion, adjust hierarchy if this was the last connection between two widgets
        if (sourceNode && targetNode) {
            const sourceWidget = window.widgetManager?.getWidget(sourceNode.widgetId);
            const targetWidget = window.widgetManager?.getWidget(targetNode.widgetId);
            if (sourceWidget && targetWidget) {
                // Determine parent/child direction as when assigning
                let parentWidget = null;
                let childWidget = null;
                if (sourceNode.type === 'output' && targetNode.type === 'input') {
                    parentWidget = sourceWidget; childWidget = targetWidget;
                } else if (targetNode.type === 'output' && sourceNode.type === 'input') {
                    parentWidget = targetWidget; childWidget = sourceWidget;
                }
                if (parentWidget && childWidget) {
                    // Check if ANY remaining connection still links parent->child
                    const stillLinked = Array.from(this.connections.values()).some(c => {
                        if (c.id === connectionId) return false; // skip the one being removed
                        const a = this.getNodeById(c.sourceNodeId);
                        const b = this.getNodeById(c.targetNodeId);
                        if (!a || !b) return false;
                        const aWidget = a.widgetId;
                        const bWidget = b.widgetId;
                        // Check directionally consistent linkage (output->input) between same widgets
                        if (aWidget === parentWidget.id && bWidget === childWidget.id && a.type === 'output' && b.type === 'input') return true;
                        if (bWidget === parentWidget.id && aWidget === childWidget.id && b.type === 'output' && a.type === 'input') return true;
                        return false;
                    });
                    if (!stillLinked) {
                        parentWidget.removeChild(childWidget);
                    }
                }
            }
        }

        // Remove from connections map
        this.connections.delete(connectionId);
        
        // Update node visual state
        this.updateNodeConnectionState(connection.sourceNodeId);
        this.updateNodeConnectionState(connection.targetNodeId);
        
        // Trigger validation
        if (window.preflightCheck) {
            window.preflightCheck.runCheck();
        }
    }

    removeNodeConnections(nodeId) {
        const node = this.getNodeById(nodeId);
        if (!node) return;
        
        // Create copy of connections set to avoid modification during iteration
        const connectionsToRemove = Array.from(node.connections);
        
        for (const connectionId of connectionsToRemove) {
            this.removeConnection(connectionId);
        }
    }

    selectConnection(connectionId) {
        this.deselectAllConnections();
        
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.selected = true;
            const element = document.getElementById(connectionId);
            if (element) {
                element.classList.add('selected');
            }
        }
    }

    deselectAllConnections() {
        for (const connection of this.connections.values()) {
            connection.selected = false;
            const element = document.getElementById(connection.id);
            if (element) {
                element.classList.remove('selected');
            }
        }
    }

    showConnectionContextMenu(connectionId, event) {
        // Remove existing menu
        const existingMenu = document.querySelector('.connection-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'connection-menu';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        
        const deleteItem = document.createElement('div');
        deleteItem.className = 'connection-menu-item danger';
        deleteItem.textContent = 'Delete Connection';
        deleteItem.onclick = () => {
            this.removeConnection(connectionId);
            menu.remove();
        };
        
        menu.appendChild(deleteItem);
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }

    updateNodeConnectionState(nodeId) {
        const node = this.getNodeById(nodeId);
        const nodeElement = document.getElementById(nodeId);
        
        if (node && nodeElement) {
            if (node.connections.size > 0) {
                nodeElement.classList.add('connected');
            } else {
                nodeElement.classList.remove('connected');
            }
        }
    }

    getNodeById(nodeId) {
        // Find node in all widgets
        if (window.widgetManager) {
            for (const widget of window.widgetManager.widgets.values()) {
                const node = widget.nodes.get(nodeId);
                if (node) {
                    return { ...node, widgetId: widget.id };
                }
            }
        }
        return null;
    }

    getNodeAbsolutePosition(nodeId) {
        if (window.widgetManager) {
            for (const widget of window.widgetManager.widgets.values()) {
                if (widget.nodes.has(nodeId)) {
                    return widget.getNodeAbsolutePosition(nodeId);
                }
            }
        }
        return null;
    }

    assignHierarchy(sourceNodeId, targetNodeId) {
        const sourceNode = this.getNodeById(sourceNodeId);
        const targetNode = this.getNodeById(targetNodeId);
        if (!sourceNode || !targetNode) return;
        // Direction: output -> input defines parent (source widget) -> child (target widget)
        if (sourceNode.type === 'output' && targetNode.type === 'input') {
            const parentWidget = window.widgetManager?.getWidget(sourceNode.widgetId);
            const childWidget = window.widgetManager?.getWidget(targetNode.widgetId);
            if (parentWidget && childWidget) {
                parentWidget.addChild(childWidget);
            }
        } else if (targetNode.type === 'output' && sourceNode.type === 'input') {
            const parentWidget = window.widgetManager?.getWidget(targetNode.widgetId);
            const childWidget = window.widgetManager?.getWidget(sourceNode.widgetId);
            if (parentWidget && childWidget) {
                parentWidget.addChild(childWidget);
            }
        }
    }

    createWidgetFromConnection(event) {
        const sourceNode = this.getNodeById(this.dragStartNode);
        if (!sourceNode) return;
        
        // Determine compatible widget type based on source node type
        const compatibleWidgets = this.getCompatibleWidgetTypes(sourceNode.nodeType, sourceNode.type);
        if (compatibleWidgets.length === 0) return;
        
        // Calculate position for new widget
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left - 150; // Offset to center widget
        const y = event.clientY - canvasRect.top - 100;
        
        // Create the first compatible widget type
        const widgetType = compatibleWidgets[0];
        const newWidget = window.app.createWidget(widgetType, x, y);
        
        if (newWidget) {
            // Find compatible node in new widget and connect
            setTimeout(() => {
                const compatibleNodeId = this.findCompatibleNode(newWidget, sourceNode);
                if (compatibleNodeId && this.canConnect(this.dragStartNode, compatibleNodeId)) {
                    this.createConnection(this.dragStartNode, compatibleNodeId);
                }
            }, 100); // Small delay to ensure widget is fully initialized
        }
    }
    
    getCompatibleWidgetTypes(nodeType, nodeDirection) {
        // Define compatible widget types for different node types
        const compatibilityMap = {
            'power': {
                'input': ['powerplants'], // Power input needs power output
                'output': ['ship', 'craft'] // Power output can connect to ships/craft
            },
            'weapon': {
                'input': ['missiles'], // Weapon input needs missiles
                'output': ['ship', 'craft'] // Weapon output can connect to ships/craft
            },
            'component': {
                'input': ['factories'], // Component input needs factories
                'output': ['ship', 'craft', 'troops'] // Component output can connect to various widgets
            },
            'magazine': {
                'input': ['loadouts'], // Magazine input needs loadouts
                'output': ['ship', 'craft'] // Magazine output can connect to ships/craft
            },
            'loadout': {
                'input': ['loadouts'], // Loadout input needs loadout widgets
                'output': ['ship', 'craft'] // Loadout output can connect to ships/craft
            },
            'powerplant': {
                'input': ['powerplants'], // Powerplant input needs powerplant widgets
                'output': ['ship', 'craft'] // Powerplant output can connect to ships/craft
            },
            'data': {
                'input': ['ship', 'craft', 'troops'], // Data input can come from various widgets
                'output': ['factories', 'shipyards'] // Data output can go to production widgets
            },
            'outfit': {
                'input': ['ship', 'craft'],
                'output': ['outfit']
            },
            'statistics': {
                'input': ['ship', 'craft'],
                'output': ['statistics']
            },
            'ship-class': {
                'input': ['ship'],
                'output': ['ship']
            }
        };
        
        return compatibilityMap[nodeType]?.[nodeDirection] || [];
    }
    
    findCompatibleNode(widget, sourceNode) {
        // Find a node in the widget that can connect to the source node
        for (const [nodeId, node] of widget.nodes) {
            if (node.type !== sourceNode.type && // Different direction (input/output)
                this.areNodeTypesCompatible(sourceNode.nodeType, node.nodeType)) {
                return nodeId;
            }
        }
        return null;
    }

    getConnectionId(sourceNodeId, targetNodeId) {
        // Ensure consistent ordering for connection IDs
        const ids = [sourceNodeId, targetNodeId].sort();
        return `connection-${ids[0]}-${ids[1]}`;
    }

    // Validation methods
    validateConnections() {
        const errors = [];
        const warnings = [];
        
        for (const connection of this.connections.values()) {
            const sourceNode = this.getNodeById(connection.sourceNodeId);
            const targetNode = this.getNodeById(connection.targetNodeId);
            
            if (!sourceNode || !targetNode) {
                errors.push({
                    type: 'connection',
                    message: 'Invalid connection: missing node',
                    connectionId: connection.id
                });
                continue;
            }
            
            // Check for power flow issues
            if (sourceNode.nodeType === 'power' || targetNode.nodeType === 'power') {
                // Add power-specific validation logic here
            }
            
            // Check for weapon-magazine compatibility
            if ((sourceNode.nodeType === 'weapon' && targetNode.nodeType === 'magazine') ||
                (sourceNode.nodeType === 'magazine' && targetNode.nodeType === 'weapon')) {
                // Add weapon-magazine compatibility checking here
            }
        }
        
        return { errors, warnings };
    }

    // Serialization
    toJSON() {
        const connectionsData = [];
        for (const connection of this.connections.values()) {
            connectionsData.push({
                sourceNodeId: connection.sourceNodeId,
                targetNodeId: connection.targetNodeId
            });
        }
        return connectionsData;
    }

    fromJSON(connectionsData) {
        // Clear existing connections
        this.clearAllConnections();
        
        // Recreate connections
        for (const connectionData of connectionsData) {
            if (this.canConnect(connectionData.sourceNodeId, connectionData.targetNodeId)) {
                this.createConnection(connectionData.sourceNodeId, connectionData.targetNodeId);
            }
        }
    }

    clearAllConnections() {
        for (const connectionId of Array.from(this.connections.keys())) {
            this.removeConnection(connectionId);
        }
    }
}