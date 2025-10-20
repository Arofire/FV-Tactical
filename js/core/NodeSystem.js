// Node connection system for visual node-based design
class NodeSystem {
    constructor() {
        this.connections = new Map(); // connectionId -> connection data
        this.svg = document.getElementById('connectionSvg');
        this.tempConnection = null;
        this.isDragging = false;
        this.dragStartNode = null;
        this.connectionSelectionMenu = null;
        this.connectionSelectionMenuDismissHandler = null;
        
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
        this.destroyConnectionSelectionMenu();
        
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

    const endPoint = this.clientToWorld(event.clientX, event.clientY);
        if (!endPoint) return;
        const endX = endPoint.x;
        const endY = endPoint.y;

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
        const sourceNodeId = this.dragStartNode;
        
        // Find target node under mouse
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const targetNodeId = targetElement?.id;
        
        if (targetNodeId && targetNodeId.startsWith('widget-') && 
            targetElement.classList.contains('node') &&
            this.canConnect(sourceNodeId, targetNodeId)) {
            
            // Create actual connection honoring input/output direction
            this.connectNodesRespectingDirection(sourceNodeId, targetNodeId);
        } else {
            // Connection ended in empty space - create compatible widget
            this.createWidgetFromConnection(sourceNodeId, event);
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
            'information': ['information'],
            'core': ['core'],
            'berth': ['berth'],
            'outfit-hull': ['outfit-hull'],
            'loadout-hull': ['loadout-hull'],
            'staff': ['staff'],
            'troop': ['troop'],
            'craft': ['craft']
        };
        
        return compatibilityMap[type1]?.includes(type2) || 
               compatibilityMap[type2]?.includes(type1);
    }

    createConnection(sourceNodeId, targetNodeId) {
        const connectionId = this.getConnectionId(sourceNodeId, targetNodeId);
        const sourceNode = this.getNodeById(sourceNodeId);
        const targetNode = this.getNodeById(targetNodeId);

        // Ensure inputs only maintain a single parent connection
        this.ensureSingleInputConnection(sourceNodeId, sourceNode);
        this.ensureSingleInputConnection(targetNodeId, targetNode);

        const connection = {
            id: connectionId,
            sourceNodeId: sourceNodeId,
            targetNodeId: targetNodeId,
            selected: false
        };
        
        this.connections.set(connectionId, connection);
        
        // Update node connection tracking
        
    if (sourceNode) sourceNode.connections.add(connectionId);
    if (targetNode) targetNode.connections.add(connectionId);
        this.notifyWidgetNodeChanged(sourceNode);
        this.notifyWidgetNodeChanged(targetNode);
        
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
        
    this.notifyWidgetNodeChanged(sourceNode);
    this.notifyWidgetNodeChanged(targetNode);

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
        this.destroyConnectionSelectionMenu();
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

    createWidgetFromConnection(sourceNodeId, event) {
        const sourceNode = this.getNodeById(sourceNodeId);
        if (!sourceNode) return;
        
        // Determine compatible widget type based on source node type
        const compatibleWidgets = this.getCompatibleWidgetTypes(sourceNode.nodeType, sourceNode.type);
        if (compatibleWidgets.length === 0) return;
        this.showConnectionSelectionMenu(sourceNode, sourceNodeId, compatibleWidgets, event);
    }

    clientToWorld(clientX, clientY) {
        const workspace = document.getElementById('workspace');
        if (!workspace) return null;
        const rect = workspace.getBoundingClientRect();
        const transform = window.app?.workspaceTransform || { scale: 1, translateX: 0, translateY: 0 };
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = (screenX / transform.scale) - transform.translateX;
        const worldY = (screenY / transform.scale) - transform.translateY;
        return { x: worldX, y: worldY };
    }

    destroyConnectionSelectionMenu() {
        if (this.connectionSelectionMenu) {
            this.connectionSelectionMenu.remove();
            this.connectionSelectionMenu = null;
        }
        if (this.connectionSelectionMenuDismissHandler) {
            document.removeEventListener('click', this.connectionSelectionMenuDismissHandler);
            this.connectionSelectionMenuDismissHandler = null;
        }
    }

    showConnectionSelectionMenu(sourceNode, sourceNodeId, compatibleWidgets, event) {
        this.destroyConnectionSelectionMenu();

        const menu = document.createElement('div');
        menu.className = 'connection-selection-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.style.background = '#2d2d2d';
        menu.style.border = '1px solid #555';
        menu.style.borderRadius = '4px';
        menu.style.padding = '4px 0';
        menu.style.minWidth = '200px';
        menu.style.zIndex = '10010';
        menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        const worldTarget = this.clientToWorld(event.clientX, event.clientY);
        const targetWorld = worldTarget ? {
            x: worldTarget.x - 150,
            y: worldTarget.y - 100
        } : { x: 0, y: 0 };

        const widgetLabels = {
            ship: 'Ship Design',
            craft: 'Craft Design',
            troops: 'Troop Unit',
            missiles: 'Missile Design',
            outfit: 'Ship Outfit',
            loadouts: 'Equipment Loadout',
            powerplants: 'Powerplant',
            factories: 'Factory',
            shipyards: 'Shipyard',
            shipCore: 'Ship Core',
            shipBerth: 'Ship Berths',
            shipHulls: 'Hull Plan',
            statistics: 'Statistics Hub',
            reroute: 'Reroute Node',
            power: 'Power',
            data: 'Data'
        };

        compatibleWidgets.forEach((widgetType) => {
            const label = widgetLabels[widgetType] || widgetType;
            const item = document.createElement('div');
            item.className = 'connection-selection-menu-item';
            item.textContent = label;
            item.style.padding = '8px 16px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '14px';
            item.style.color = '#e0e0e0';
            item.style.transition = 'background 0.2s';
            item.addEventListener('mouseenter', () => {
                item.style.background = '#4a4a4a';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });
            item.addEventListener('click', () => {
                this.handleConnectionSelection(sourceNode, sourceNodeId, widgetType, targetWorld);
            });
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        this.connectionSelectionMenu = menu;

        this.connectionSelectionMenuDismissHandler = (dismissEvent) => {
            if (menu.contains(dismissEvent.target)) return;
            this.destroyConnectionSelectionMenu();
        };
        setTimeout(() => {
            document.addEventListener('click', this.connectionSelectionMenuDismissHandler);
        }, 0);
    }

    handleConnectionSelection(sourceNode, sourceNodeId, widgetType, targetWorld) {
        this.destroyConnectionSelectionMenu();
        const newWidget = window.app.createWidget(widgetType, targetWorld.x, targetWorld.y);
        if (!newWidget) return;

        if (widgetType === 'reroute' && typeof newWidget.configureForNodeType === 'function') {
            newWidget.configureForNodeType(sourceNode.nodeType);
        }

        setTimeout(() => {
            const compatibleNodeId = this.findCompatibleNode(newWidget, sourceNode);
            if (compatibleNodeId && this.canConnect(sourceNodeId, compatibleNodeId)) {
                this.connectNodesRespectingDirection(sourceNodeId, compatibleNodeId);
            }
        }, 100);
    }

    connectNodesRespectingDirection(nodeIdA, nodeIdB) {
        const nodeA = this.getNodeById(nodeIdA);
        const nodeB = this.getNodeById(nodeIdB);
        if (!nodeA || !nodeB) return;

        if (nodeA.type === 'output' && nodeB.type === 'input') {
            this.createConnection(nodeIdA, nodeIdB);
        } else if (nodeA.type === 'input' && nodeB.type === 'output') {
            this.createConnection(nodeIdB, nodeIdA);
        } else {
            this.createConnection(nodeIdA, nodeIdB);
        }
    }

    ensureSingleInputConnection(nodeId, cachedNode = null) {
        const node = cachedNode || this.getNodeById(nodeId);
        if (!node || node.type !== 'input' || !node.connections) return;
        if (node.allowMultipleConnections) return;

        const existingConnections = Array.from(node.connections);
        for (const connectionId of existingConnections) {
            this.removeConnection(connectionId);
        }
    }

    notifyWidgetNodeChanged(nodeInfo) {
        if (!nodeInfo) return;
        const widget = window.widgetManager?.getWidget(nodeInfo.widgetId);
        if (widget?.handleNodeConnectionChange) {
            widget.handleNodeConnectionChange(nodeInfo.id);
        }
    }
    
    getCompatibleWidgetTypes(nodeType, nodeDirection) {
        // Define compatible widget types for different node types
        const compatibilityMap = {
            'power': {
                'input': ['powerplants'],
                'output': ['ship', 'craft']
            },
            'weapon': {
                'input': ['missiles'],
                'output': ['loadouts']
            },
            'component': {
                'input': ['factories'],
                'output': ['ship', 'craft', 'troops']
            },
            'magazine': {
                'input': ['loadouts'],
                'output': ['ship', 'craft']
            },
            'loadout': {
                'input': ['ship'],
                'output': []
            },
            'powerplant': {
                'input': ['powerplants'],
                'output': ['ship', 'craft']
            },
            'data': {
                'input': ['ship', 'craft', 'troops'],
                'output': ['factories', 'shipyards']
            },
            'outfit': {
                'input': ['ship'],
                'output': []
            },
            'statistics': {
                'input': ['ship', 'outfit'],
                'output': ['statistics']
            },
            'ship-class': {
                'input': ['ship'],
                'output': ['ship']
            },
            'core': {
                'input': ['shipCore'],
                'output': ['outfit']
            },
            'berth': {
                'input': ['outfit'],
                'output': ['shipBerth']
            },
            'outfit-hull': {
                'input': ['outfit'],
                'output': ['shipHulls']
            },
            'loadout-hull': {
                'input': ['loadouts'],
                'output': ['shipHulls']
            },
            'staff': {
                'input': ['shipBerth'],
                'output': ['shipHulls']
            },
            'troop': {
                'input': ['troops'],
                'output': ['shipBerth']
            },
            'craft': {
                'input': ['craft'],
                'output': ['loadouts']
            }
        };

        const base = compatibilityMap[nodeType]?.[nodeDirection] || [];
        const results = Array.from(new Set([...base, 'reroute']));
        return results;
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
            const sourceNode = this.getNodeById(connection.sourceNodeId);
            const targetNode = this.getNodeById(connection.targetNodeId);
            connectionsData.push({
                sourceNodeId: connection.sourceNodeId,
                targetNodeId: connection.targetNodeId,
                sourceWidgetId: sourceNode?.widgetId || null,
                targetWidgetId: targetNode?.widgetId || null,
                sourceNodeType: sourceNode?.nodeType || null,
                targetNodeType: targetNode?.nodeType || null,
                sourceDirection: sourceNode?.type || null,
                targetDirection: targetNode?.type || null
            });
        }
        return connectionsData;
    }

    fromJSON(connectionsData) {
        // Clear existing connections
        this.clearAllConnections();
        
        // Recreate connections
        for (const connectionData of connectionsData) {
            let sourceId = connectionData.sourceNodeId;
            let targetId = connectionData.targetNodeId;

            if (!this.getNodeById(sourceId) && connectionData.sourceWidgetId && connectionData.sourceNodeType) {
                const fallbackSource = this.findNodeByMetadata(
                    connectionData.sourceWidgetId,
                    connectionData.sourceNodeType,
                    connectionData.sourceDirection
                );
                if (fallbackSource) {
                    sourceId = fallbackSource;
                }
            }

            if (!this.getNodeById(targetId) && connectionData.targetWidgetId && connectionData.targetNodeType) {
                const fallbackTarget = this.findNodeByMetadata(
                    connectionData.targetWidgetId,
                    connectionData.targetNodeType,
                    connectionData.targetDirection
                );
                if (fallbackTarget) {
                    targetId = fallbackTarget;
                }
            }

            if (sourceId && targetId && this.canConnect(sourceId, targetId)) {
                this.createConnection(sourceId, targetId);
            }
        }
    }

    clearAllConnections() {
        for (const connectionId of Array.from(this.connections.keys())) {
            this.removeConnection(connectionId);
        }
    }

    findNodeByMetadata(widgetId, nodeType, direction) {
        if (!widgetId || !nodeType) return null;
        const widget = window.widgetManager?.getWidget(widgetId);
        if (!widget) return null;
        for (const [nodeId, node] of widget.nodes.entries()) {
            if (node.nodeType === nodeType && (!direction || node.type === direction)) {
                return nodeId;
            }
        }
        return null;
    }
}