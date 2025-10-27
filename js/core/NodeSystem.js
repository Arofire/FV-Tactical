// Node connection system for visual node-based design
class NodeSystem {
    constructor() {
        this.connections = new Map(); // connectionId -> connection data
        this.svg = document.getElementById('connectionSvg');
        this.tempConnection = null;
        this.isDragging = false;
        this.dragStartNode = null;
        this.isReconnecting = false;
        this.reconnectionData = null;
        this.connectionSelectionMenu = null;
        this.connectionSelectionMenuDismissHandler = null;
        this.lastSnapTargetElement = null;  // Track last highlighted snap target for cleanup
        
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
        
        // Check if this is an input node with an existing connection
        if (node.type === 'input' && node.connections && node.connections.size > 0) {
            // Pick up the existing connection instead of creating a new one
            const connectionId = Array.from(node.connections)[0];
            const existingConnection = this.connections.get(connectionId);
            
            if (existingConnection) {
                // Find the other end of the connection (the anchor node)
                const sourceNode = this.getNodeById(existingConnection.sourceNodeId);
                const targetNode = this.getNodeById(existingConnection.targetNodeId);
                const anchorNode = (sourceNode.id === nodeId) ? targetNode : sourceNode;
                
                if (!anchorNode) return;
                
                // Mark this as a reconnection operation
                this.isReconnecting = true;
                this.reconnectionData = {
                    originalConnectionId: connectionId,
                    originalConnection: existingConnection,
                    draggedNodeId: nodeId,
                    draggedNode: node,
                    anchorNodeId: anchorNode.id,
                    anchorNode: anchorNode
                };
                
                // Keep the original connection element but mark it as being dragged
                const connectionElement = document.getElementById(connectionId);
                if (connectionElement) {
                    connectionElement.classList.add('dragging');
                }
                
                // Temporarily remove the connection from the node's tracking to make it appear disconnected
                const connectedNode = this.getNodeById(nodeId);
                if (connectedNode) {
                    connectedNode.connections.delete(connectionId);
                }
                
                // Update the input node's visual state to disconnected
                this.updateNodeConnectionState(nodeId);
                
                // Deselect any selected connections
                this.deselectAllConnections();
                
                // Start dragging - use the connection element as the temp connection
                this.isDragging = true;
                this.dragStartNode = anchorNode.id;
                
                const anchorPos = this.getNodeAbsolutePosition(anchorNode.id);
                
                this.tempConnection = {
                    element: connectionElement,  // Reuse the original connection element
                    startNodeId: anchorNode.id,
                    startPos: anchorPos,
                    startNodeType: anchorNode.type,
                    isPickedUpConnection: true  // Flag to indicate this is a picked-up connection
                };
                
                this.updateTempConnection(event);
                
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
        
        // Normal behavior: create a new temporary connection
        this.isDragging = true;
        this.dragStartNode = nodeId;
        
        // Create temporary connection line
        this.createTempConnection(nodeId, event);
        
        event.preventDefault();
        event.stopPropagation();
    }


    createTempConnection(startNodeId, event) {
        const startNode = this.getNodeById(startNodeId);
        const startPos = this.getNodeAbsolutePosition(startNodeId);
        if (!startPos || !startNode) return;
        
        // Create SVG line element
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-preview');
        
        this.tempConnection = {
            element: line,
            startNodeId: startNodeId,
            startPos: startPos,
            startNodeType: startNode.type  // Store whether it's input or output
        };
        
        this.svg.appendChild(line);
        this.updateTempConnection(event);
    }

    updateTempConnection(event) {
        if (!this.tempConnection) return;

        const endPoint = this.clientToWorld(event.clientX, event.clientY);
        if (!endPoint) return;
        let endX = endPoint.x;
        let endY = endPoint.y;

        // Find a compatible node under the cursor for snapping
        let snapNode = null;
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        
        // Skip over connection lines to find potential target nodes
        let checkElement = targetElement;
        let tempHiddenElements = [];
        while (checkElement && checkElement.classList.contains('connection-line')) {
            checkElement.style.pointerEvents = 'none';
            tempHiddenElements.push(checkElement);
            checkElement = document.elementFromPoint(event.clientX, event.clientY);
        }
        
        // Restore pointer events
        tempHiddenElements.forEach(el => el.style.pointerEvents = '');
        
        // Check if we found a node and if it's compatible
        if (checkElement && checkElement.id && checkElement.id.startsWith('widget-') && 
            checkElement.classList.contains('node')) {
            const targetNodeId = checkElement.id;
            const startNode = this.getNodeById(this.tempConnection.startNodeId);
            const targetNode = this.getNodeById(targetNodeId);
            
            // Check if nodes are compatible for connection
            if (startNode && targetNode &&
                startNode.id !== targetNode.id &&
                startNode.widgetId !== targetNode.widgetId &&
                startNode.type !== targetNode.type &&
                this.areNodeTypesCompatible(startNode.nodeType, targetNode.nodeType)) {
                
                snapNode = targetNode;
                // Snap the end point to the target node's center
                const targetPos = this.getNodeAbsolutePosition(targetNodeId);
                if (targetPos) {
                    endX = targetPos.x;
                    endY = targetPos.y;
                }
                
                // Highlight the compatible node
                checkElement.classList.add('snap-target');
            }
        }
        
        // Clear snap target highlighting from any previously highlighted node
        if (this.lastSnapTargetElement && this.lastSnapTargetElement !== checkElement) {
            this.lastSnapTargetElement.classList.remove('snap-target');
        }
        if (snapNode) {
            this.lastSnapTargetElement = checkElement;
        } else {
            this.lastSnapTargetElement = null;
        }

        // For input nodes, we want the path to go from node (left) to cursor (right)
        // but with control points that curve as if expecting a connection from the right
        let path;
        if (this.tempConnection.startNodeType === 'input') {
            path = this.createBezierPath(
                this.tempConnection.startPos.x,
                this.tempConnection.startPos.y,
                endX,
                endY,
                true  // isInputNode flag - reverses control points
            );
        } else {
            path = this.createBezierPath(
                this.tempConnection.startPos.x,
                this.tempConnection.startPos.y,
                endX,
                endY,
                false
            );
        }
        
        this.tempConnection.element.setAttribute('d', path);
    }

    endConnection(event) {
        if (!this.isDragging || !this.tempConnection) return;
        
        this.isDragging = false;
        const sourceNodeId = this.dragStartNode;
        const isPickedUpConnection = this.tempConnection.isPickedUpConnection;
        
        // Find target node under mouse, excluding connection lines and the temp connection itself
        let targetElement = document.elementFromPoint(event.clientX, event.clientY);
        
        // Skip over connection lines to find the node underneath
        while (targetElement && targetElement.classList.contains('connection-line')) {
            targetElement.style.pointerEvents = 'none';
            targetElement = document.elementFromPoint(event.clientX, event.clientY);
            targetElement.style.pointerEvents = '';
        }
        
        const targetNodeId = targetElement?.id;
        
        // If we were reconnecting, remove the old connection first
        if (this.isReconnecting && this.reconnectionData) {
            this.removeConnection(this.reconnectionData.originalConnectionId);
        }
        
        if (targetNodeId && targetNodeId.startsWith('widget-') && 
            targetElement.classList.contains('node')) {
            
            // Create actual connection honoring input/output direction
            this.connectNodesRespectingDirection(sourceNodeId, targetNodeId);
        } else {
            // Connection ended in empty space
            if (!this.isReconnecting) {
                // Normal drag to empty space - create compatible widget
                this.createWidgetFromConnection(sourceNodeId, event);
            }
            // If we were reconnecting and dropped in empty space, the connection was already removed
        }
        
        // Clean up reconnection state
        if (this.isReconnecting && this.reconnectionData) {
            // If the connection still exists, restore it visually and to the node's tracking
            const connectionElement = document.getElementById(this.reconnectionData.originalConnectionId);
            if (connectionElement && this.connections.has(this.reconnectionData.originalConnectionId)) {
                connectionElement.classList.remove('dragging');
                // Restore the connection to the dragged node's tracking
                const draggedNode = this.getNodeById(this.reconnectionData.draggedNodeId);
                if (draggedNode) {
                    draggedNode.connections.add(this.reconnectionData.originalConnectionId);
                    this.updateNodeConnectionState(this.reconnectionData.draggedNodeId);
                }
                // Update to proper position
                this.updateConnectionElement(this.connections.get(this.reconnectionData.originalConnectionId));
            }
        }
        
        this.isReconnecting = false;
        this.reconnectionData = null;
        
        // Clear snap target highlighting
        if (this.lastSnapTargetElement) {
            this.lastSnapTargetElement.classList.remove('snap-target');
            this.lastSnapTargetElement = null;
        }
        
        // Clean up temporary connection (but only if it's not a picked-up connection that we're reusing)
        if (this.tempConnection.element && !isPickedUpConnection) {
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
        
        // Check if connection already exists (but allow it during reconnection)
        const connectionId = this.getConnectionId(sourceNodeId, targetNodeId);
        if (this.connections.has(connectionId) && !this.isReconnecting) return false;
        
        // Check node type compatibility
        return this.areNodeTypesCompatible(sourceNode.nodeType, targetNode.nodeType);
    }

    areNodeTypesCompatible(type1, type2) {
        // New system: nodes connect if they share the same name
        // This allows flexible connections between any widgets
        return type1 === type2;
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

    createBezierPath(x1, y1, x2, y2, isInputNode = false) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(distance * 0.3, 100);
        
        // For input nodes: the path goes node (left) -> cursor (right)
        // Control points should curve LEFT from node, and RIGHT to cursor (opposite of output)
        let cpx1, cpy1, cpx2, cpy2;
        if (isInputNode) {
            cpx1 = x1 - curvature;  // Extend LEFT from the input node
            cpy1 = y1;
            cpx2 = x2 + curvature;  // Approach from RIGHT to the cursor
            cpy2 = y2;
        } else {
            // For output nodes: the path goes node (left) -> cursor (right)
            // Control points curve RIGHT from node, and LEFT to cursor
            cpx1 = x1 + curvature;  // Extend RIGHT from the output node
            cpy1 = y1;
            cpx2 = x2 - curvature;  // Approach from LEFT to the cursor
            cpy2 = y2;
        }
        
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
        // Convert screen coordinates to canvas/world coordinates
        // screen = (world * scale) + translate
        // world = (screen - translate) / scale
        const worldX = (screenX - transform.translateX) / transform.scale;
        const worldY = (screenY - transform.translateY) / transform.scale;
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
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

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
            shipCore: 'Ship Core',
            shipBerth: 'Ship Berths',
            shipHulls: 'Hull Plan',
            statistics: 'Statistics Hub',
            reroute: 'Reroute Node'
        };

        compatibleWidgets.forEach((widgetType) => {
            const label = widgetLabels[widgetType] || widgetType;
            const item = document.createElement('div');
            item.className = 'connection-selection-menu-item';
            item.textContent = label;
            item.addEventListener('click', (clickEvent) => {
                // Capture cursor position at the moment of menu item click, not at drag end
                const clickWorldPos = this.clientToWorld(clickEvent.clientX, clickEvent.clientY);
                const clickTargetWorld = clickWorldPos ? {
                    x: clickWorldPos.x - 150,
                    y: clickWorldPos.y - 100
                } : targetWorld;
                
                // Pass both the initial widget position and the current cursor position
                this.handleConnectionSelection(sourceNode, sourceNodeId, widgetType, clickTargetWorld, clickWorldPos);
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

    handleConnectionSelection(sourceNode, sourceNodeId, widgetType, initialPos, cursorPos) {
        this.destroyConnectionSelectionMenu();
        
        // Use cursorPos if provided, otherwise fall back to initialPos for backward compatibility
        const targetCursorPos = cursorPos || initialPos;
        
        // Create widget at initial position (with offset so it doesn't cover the cursor)
        const newWidget = window.app.createWidget(widgetType, initialPos.x, initialPos.y);
        if (!newWidget) return;

        if (widgetType === 'reroute' && typeof newWidget.configureForNodeType === 'function') {
            newWidget.configureForNodeType(sourceNode.nodeType);
        }

        // Get the source widget and mark it as manually positioned to prevent auto-arrange
        const sourceWidget = window.widgetManager?.getWidget(sourceNode.widgetId);
        if (sourceWidget) {
            sourceWidget.manualPosition = true;
        }

        // Use requestAnimationFrame for faster, smoother repositioning
        requestAnimationFrame(() => {
            const compatibleNodeId = this.findCompatibleNode(newWidget, sourceNode);
            if (compatibleNodeId && this.canConnect(sourceNodeId, compatibleNodeId)) {
                // Get the node's absolute position in world coordinates
                const nodeWorldPos = newWidget.getNodeAbsolutePosition(compatibleNodeId);
                
                if (nodeWorldPos) {
                    // Calculate the offset from widget position to node position in world coords
                    const nodeOffsetX = nodeWorldPos.x - newWidget.x;
                    const nodeOffsetY = nodeWorldPos.y - newWidget.y;
                    
                    // Position widget so the node is at the target cursor position
                    newWidget.x = targetCursorPos.x - nodeOffsetX;
                    newWidget.y = targetCursorPos.y - nodeOffsetY;
                    
                    // Mark as manually positioned to prevent autoArrangeHierarchy from moving it
                    newWidget.manualPosition = true;
                    
                    // Clamp to canvas bounds
                    newWidget.clampToCanvasBounds();
                    
                    // Update widget position in DOM
                    if (newWidget.element) {
                        newWidget.element.style.left = newWidget.x + 'px';
                        newWidget.element.style.top = newWidget.y + 'px';
                    }
                    
                    // Update all connections to reflect new position
                    this.updateConnections();
                }
                
                // Create the connection AFTER repositioning
                // This way hierarchy is assigned after the widget is in its final position
                // and manualPosition=true prevents autoArrangeHierarchy from moving it
                this.connectNodesRespectingDirection(sourceNodeId, compatibleNodeId);
            }
        });
    }

    connectNodesRespectingDirection(nodeIdA, nodeIdB) {
        const nodeA = this.getNodeById(nodeIdA);
        const nodeB = this.getNodeById(nodeIdB);
        
        if (!nodeA || !nodeB) {
            return;
        }

        // Validate nodes are compatible
        if (nodeA.widgetId === nodeB.widgetId) {
            return;  // Same widget
        }
        if (nodeA.type === nodeB.type) {
            return;  // Both same direction (input/output)
        }
        if (!this.areNodeTypesCompatible(nodeA.nodeType, nodeB.nodeType)) {
            return;  // Different node types
        }

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
        // New system: find all widget types that have nodes matching this node name
        // and have the opposite direction (input connects to output, vice versa)
        const oppositeDirection = nodeDirection === 'input' ? 'output' : 'input';
        
        // Define node configurations for each widget type
        const widgetNodeConfig = {
            'ship': {
                inputs: ['Class'],
                outputs: ['Class', 'Statistics']
            },
            'outfit': {
                inputs: ['Class', 'Core'],
                outputs: ['Outfit', 'Statistics']
            },
            'craft': {
                inputs: ['Core'],
                outputs: ['Craft']
            },
            'troops': {
                inputs: [],
                outputs: ['Troop']
            },
            'missiles': {
                inputs: [],
                outputs: ['Weapon']
            },
            'loadouts': {
                inputs: ['Class', 'Craft', 'Weapon'],
                outputs: ['Loadout']
            },
            'shipCore': {
                inputs: [],
                outputs: ['Core']
            },
            'shipBerth': {
                inputs: ['Outfit', 'Troop'],
                outputs: ['Berth']
            },
            'shipHulls': {
                inputs: ['Outfit', 'Berth', 'Loadout'],
                outputs: ['Statistics']
            },
            'statistics': {
                inputs: ['Statistics'],
                outputs: []
            },
            'reroute': {
                inputs: [],
                outputs: []
            }
        };
        
        const compatibleWidgets = [];
        
        // Find widgets that have matching nodes in the opposite direction
        for (const [widgetType, config] of Object.entries(widgetNodeConfig)) {
            const nodesToCheck = oppositeDirection === 'input' ? config.inputs : config.outputs;
            if (nodesToCheck.includes(nodeType)) {
                compatibleWidgets.push(widgetType);
            }
        }
        
        // Always include reroute as an option
        if (!compatibleWidgets.includes('reroute')) {
            compatibleWidgets.push('reroute');
        }
        
        return compatibleWidgets;
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