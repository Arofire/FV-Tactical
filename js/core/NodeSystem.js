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
                
                this.tempConnection = {
                    element: connectionElement,  // Reuse the original connection element
                    startNodeId: anchorNode.id,
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
        if (!startNode) return;
        
        // Create SVG line element
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-preview');
        
        this.tempConnection = {
            element: line,
            startNodeId: startNodeId,
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

        this.tempConnection.endPoint = { x: endX, y: endY };
        this.tempConnection.snapNodeId = snapNode ? snapNode.id : null;
        // Route synchronously so the ghost tracks the cursor; it is routed with the same
        // pipeline as real connections so it previews the final shape.
        this.routeAllConnections();
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
        if (!connection) return;
        // Routes are separated from each other, so any change re-routes every connection together
        this.updateConnections();
    }

    updateConnections() {
        if (this._routeFrame) return;
        this._routeFrame = requestAnimationFrame(() => {
            this._routeFrame = null;
            this.routeAllConnections();
        });
    }

    getRoutingGap() {
        return Widget.WIDGET_GAP;
    }

    collectWidgetRects() {
        const rects = new Map();
        for (const widget of window.widgetManager?.widgets.values() || []) {
            const element = widget.element;
            if (!element?.isConnected) continue;
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            if (!width && !height) continue; // hidden
            rects.set(widget.id, {
                left: widget.x,
                top: widget.y,
                right: widget.x + width,
                bottom: widget.y + height
            });
        }
        return rects;
    }

    routeAllConnections() {
        const gap = this.getRoutingGap();
        const rects = this.collectWidgetRects();
        const usage = { h: new Map(), v: new Map() };
        const routes = [];

        for (const connection of this.connections.values()) {
            const element = document.getElementById(connection.id);
            if (!element || element.classList.contains('dragging')) continue;
            const points = this.computeConnectionRoute(connection, rects, gap, usage);
            if (points) routes.push({ element, route: { points } });
        }

        // The pending connection is routed last, matching where a new connection lands in the map
        const ghost = this.getGhostPorts(rects, gap);
        if (ghost) {
            const points = this.routeBetweenPorts(ghost.a, ghost.b, rects, gap, usage, ghost.nodeIds);
            routes.push({ element: this.tempConnection.element, route: { points } });
        }

        this.separateParallelRoutes(routes.map(entry => entry.route), rects);

        for (const { element, route } of routes) {
            element.setAttribute('d', this.createSmoothPath(route.points));
        }
    }

    // Port = node position, the widget side it exits from, and the stub point just outside the widget
    getConnectionPort(nodeId, rects, gap) {
        const node = this.getNodeById(nodeId);
        const pos = this.getNodeAbsolutePosition(nodeId);
        if (!node || !pos) return null;
        const rect = rects.get(node.widgetId);
        const pad = gap / 2;
        let dir;
        if (rect) {
            dir = (pos.x - rect.left) <= (rect.right - pos.x) ? -1 : 1;
        } else {
            dir = node.type === 'input' ? -1 : 1;
        }
        const stubX = rect
            ? (dir < 0 ? Math.min(rect.left - pad, pos.x) : Math.max(rect.right + pad, pos.x))
            : pos.x + dir * pad;
        return {
            widgetId: node.widgetId,
            node: { x: pos.x, y: pos.y },
            stub: { x: stubX, y: pos.y },
            dir
        };
    }

    // Ports for the connection being dragged out. Off a node, the cursor stands in for the node of
    // the widget that will be created there, which is placed with that node under the cursor.
    getGhostPorts(rects, gap) {
        const temp = this.tempConnection;
        if (!this.isDragging || !temp?.endPoint) return null;
        const start = this.getConnectionPort(temp.startNodeId, rects, gap);
        if (!start) return null;
        const startIsOutput = temp.startNodeType === 'output';
        let end;
        if (temp.snapNodeId) {
            end = this.getConnectionPort(temp.snapNodeId, rects, gap);
            if (!end) return null;
        } else {
            const dir = startIsOutput ? -1 : 1;
            const inset = this.getNodeEdgeInset(startIsOutput ? 'input' : 'output', rects, gap);
            const { x, y } = temp.endPoint;
            end = { widgetId: null, node: { x, y }, stub: { x: x + dir * (inset + gap / 2), y }, dir };
        }
        const nodeIds = [temp.startNodeId, temp.snapNodeId];
        return startIsOutput ? { a: start, b: end, nodeIds } : { a: end, b: start, nodeIds };
    }

    // How far nodes of a direction sit inside their widget's edge, measured from an existing node
    getNodeEdgeInset(nodeType, rects, gap) {
        for (const widget of window.widgetManager.widgets.values()) {
            for (const [nodeId, node] of widget.nodes) {
                if (node.type !== nodeType || !rects.has(widget.id)) continue;
                const port = this.getConnectionPort(nodeId, rects, gap);
                if (port) return Math.abs(port.stub.x - port.node.x) - gap / 2;
            }
        }
        return 0;
    }

    computeConnectionRoute(connection, rects, gap, usage = null) {
        const a = this.getConnectionPort(connection.sourceNodeId, rects, gap);
        const b = this.getConnectionPort(connection.targetNodeId, rects, gap);
        if (!a || !b) return null;
        const nodeIds = [connection.sourceNodeId, connection.targetNodeId];
        return this.routeBetweenPorts(a, b, rects, gap, usage, nodeIds);
    }

    routeBetweenPorts(a, b, rects, gap, usage, nodeIds) {
        const pad = gap / 2;
        const obstacles = Array.from(rects.values(), rect => ({
            left: rect.left - pad,
            right: rect.right + pad,
            top: rect.top - pad,
            bottom: rect.bottom + pad
        }));

        const interior = this.findOrthogonalRoute(a, b, obstacles, gap, usage, nodeIds);
        if (usage) this.recordRouteUsage(usage, interior, nodeIds);
        return this.simplifyPolyline([a.node, ...interior, b.node]);
    }

    // Orthogonal visibility-graph A* between the two stub points, penalising bends.
    // Crossing an obstacle is allowed but very expensive, so a route always exists and only
    // passes through widgets that are placed closer together than the routing gap.
    findOrthogonalRoute(a, b, obstacles, gap, usage = null, nodeIds = []) {
        const start = a.stub;
        const end = b.stub;
        const xs = new Set([start.x, end.x]);
        const ys = new Set([start.y, end.y]);
        let minX = Math.min(start.x, end.x);
        let maxX = Math.max(start.x, end.x);
        let minY = Math.min(start.y, end.y);
        let maxY = Math.max(start.y, end.y);
        for (const rect of obstacles) {
            xs.add(rect.left); xs.add(rect.right);
            ys.add(rect.top); ys.add(rect.bottom);
            minX = Math.min(minX, rect.left); maxX = Math.max(maxX, rect.right);
            minY = Math.min(minY, rect.top); maxY = Math.max(maxY, rect.bottom);
        }
        // Outer ring guarantees a way around everything
        xs.add(minX - gap); xs.add(maxX + gap);
        ys.add(minY - gap); ys.add(maxY + gap);

        const sortedX = Array.from(xs).sort((p, q) => p - q);
        const sortedY = Array.from(ys).sort((p, q) => p - q);
        const cols = sortedX.length;
        const rows = sortedY.length;
        const inside = (x, y) => obstacles.some(rect =>
            x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);

        // Every obstacle edge is a grid line, so a segment between adjacent grid lines lies inside
        // an obstacle exactly when its midpoint does.
        const hBlocked = new Uint8Array(cols * rows); // edge from (xi, yi) to (xi + 1, yi)
        const vBlocked = new Uint8Array(cols * rows); // edge from (xi, yi) to (xi, yi + 1)
        for (let yi = 0; yi < rows; yi++) {
            for (let xi = 0; xi < cols; xi++) {
                const index = yi * cols + xi;
                if (xi + 1 < cols && inside((sortedX[xi] + sortedX[xi + 1]) / 2, sortedY[yi])) {
                    hBlocked[index] = 1;
                }
                if (yi + 1 < rows && inside(sortedX[xi], (sortedY[yi] + sortedY[yi + 1]) / 2)) {
                    vBlocked[index] = 1;
                }
            }
        }
        const crossingCost = 1000;

        const startIndex = sortedY.indexOf(start.y) * cols + sortedX.indexOf(start.x);
        const endIndex = sortedY.indexOf(end.y) * cols + sortedX.indexOf(end.x);
        if (startIndex === endIndex) return [start];

        // Directions: 0 = +x, 1 = -x, 2 = +y, 3 = -y
        const bendCost = gap * 3;
        const startDir = a.dir > 0 ? 0 : 1;
        // The route must arrive heading into the target widget, i.e. opposite to its exit direction
        const endDir = b.dir > 0 ? 1 : 0;

        const stateCount = cols * rows * 4;
        const dist = new Float64Array(stateCount).fill(Infinity);
        const prev = new Int32Array(stateCount).fill(-1);
        const heap = [];
        const push = (state, priority) => {
            heap.push({ state, priority });
            let child = heap.length - 1;
            const item = heap[child];
            while (child > 0) {
                const parent = (child - 1) >> 1;
                if (heap[parent].priority <= priority) break;
                heap[child] = heap[parent];
                child = parent;
            }
            heap[child] = item;
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length > 0) {
                let parent = 0;
                while (true) {
                    const left = parent * 2 + 1;
                    if (left >= heap.length) break;
                    const right = left + 1;
                    const smaller = right < heap.length && heap[right].priority < heap[left].priority ? right : left;
                    if (heap[smaller].priority >= last.priority) break;
                    heap[parent] = heap[smaller];
                    parent = smaller;
                }
                heap[parent] = last;
            }
            return top;
        };
        const heuristic = index => {
            const x = sortedX[index % cols];
            const y = sortedY[Math.floor(index / cols)];
            return Math.abs(x - end.x) + Math.abs(y - end.y);
        };

        const startState = startIndex * 4 + startDir;
        dist[startState] = 0;
        push(startState, heuristic(startIndex));
        let bestEndState = -1;
        let bestEndCost = Infinity;

        while (heap.length > 0) {
            const { state, priority } = pop();
            const cost = dist[state];
            if (priority > cost + heuristic(state >> 2) + 1e-9) continue;
            if (cost >= bestEndCost) break;
            const index = state >> 2;
            const dir = state & 3;
            if (index === endIndex) {
                const total = cost + (dir === endDir ? 0 : bendCost * 2);
                if (total < bestEndCost) {
                    bestEndCost = total;
                    bestEndState = state;
                }
                continue;
            }
            const xi = index % cols;
            const yi = (index - xi) / cols;
            for (let nd = 0; nd < 4; nd++) {
                // Never double back on ourselves
                if ((nd ^ 1) === dir) continue;
                let nextIndex;
                let crosses;
                if (nd === 0) { if (xi + 1 >= cols) continue; nextIndex = index + 1; crosses = hBlocked[index]; }
                else if (nd === 1) { if (xi === 0) continue; nextIndex = index - 1; crosses = hBlocked[index - 1]; }
                else if (nd === 2) { if (yi + 1 >= rows) continue; nextIndex = index + cols; crosses = vBlocked[index]; }
                else { if (yi === 0) continue; nextIndex = index - cols; crosses = vBlocked[index - cols]; }
                const nxi = nextIndex % cols;
                const nyi = (nextIndex - nxi) / cols;
                const length = Math.abs(sortedX[nxi] - sortedX[xi]) + Math.abs(sortedY[nyi] - sortedY[yi]);
                const nextCost = cost + length * (crosses ? crossingCost : 1) + (nd === dir ? 0 : bendCost) +
                    this.getCongestionCost(usage, nd < 2 ? 'h' : 'v',
                        nd < 2 ? sortedY[yi] : sortedX[xi],
                        nd < 2 ? sortedX[xi] : sortedY[yi],
                        nd < 2 ? sortedX[nxi] : sortedY[nyi],
                        nodeIds);
                const nextState = nextIndex * 4 + nd;
                if (nextCost < dist[nextState]) {
                    dist[nextState] = nextCost;
                    prev[nextState] = state;
                    push(nextState, nextCost + heuristic(nextIndex));
                }
            }
        }

        const path = [];
        for (let state = bestEndState; state >= 0; state = prev[state]) {
            const index = state >> 2;
            path.push({ x: sortedX[index % cols], y: sortedY[Math.floor(index / cols)] });
            if (state === startState) break;
        }
        path.reverse();
        return path;
    }

    // Channel usage by already-routed connections, so later routes prefer free channels
    getCongestionCost(usage, axis, coord, from, to, nodeIds) {
        if (!usage) return 0;
        const intervals = usage[axis].get(Math.round(coord * 2) / 2);
        if (!intervals) return 0;
        const min = Math.min(from, to);
        const max = Math.max(from, to);
        let cost = 0;
        for (const interval of intervals) {
            // Routes sharing a node are expected to run together near it
            if (nodeIds.some(id => interval.nodeIds.includes(id))) continue;
            const overlap = Math.min(max, interval.max) - Math.max(min, interval.min);
            if (overlap > 0) cost += overlap;
        }
        return cost;
    }

    recordRouteUsage(usage, points, nodeIds) {
        for (let i = 0; i < points.length - 1; i++) {
            const p = points[i];
            const q = points[i + 1];
            let axis;
            let coord;
            let min;
            let max;
            if (p.y === q.y && p.x !== q.x) {
                axis = 'h'; coord = p.y; min = Math.min(p.x, q.x); max = Math.max(p.x, q.x);
            } else if (p.x === q.x && p.y !== q.y) {
                axis = 'v'; coord = p.x; min = Math.min(p.y, q.y); max = Math.max(p.y, q.y);
            } else {
                continue;
            }
            const key = Math.round(coord * 2) / 2;
            if (!usage[axis].has(key)) usage[axis].set(key, []);
            usage[axis].get(key).push({ min, max, nodeIds });
        }
    }

    simplifyPolyline(points) {
        const result = [];
        for (const point of points) {
            const last = result[result.length - 1];
            if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) continue;
            result.push({ x: point.x, y: point.y });
            while (result.length >= 3) {
                const p0 = result[result.length - 3];
                const p1 = result[result.length - 2];
                const p2 = result[result.length - 1];
                const collinear = (Math.abs(p0.x - p1.x) < 0.01 && Math.abs(p1.x - p2.x) < 0.01) ||
                    (Math.abs(p0.y - p1.y) < 0.01 && Math.abs(p1.y - p2.y) < 0.01);
                if (!collinear) break;
                result.splice(result.length - 2, 1);
            }
        }
        return result;
    }

    // Offset overlapping collinear segments of different routes so they run side by side
    separateParallelRoutes(routes, rects = new Map(), spacing = 3) {
        const segments = { h: [], v: [] };
        routes.forEach((route, routeIndex) => {
            const points = route.points;
            // The first and last segments end on a node; routes sharing a node legitimately converge there
            for (let i = 1; i < points.length - 2; i++) {
                const p = points[i];
                const q = points[i + 1];
                if (Math.abs(p.y - q.y) < 0.01 && Math.abs(p.x - q.x) > 0.01) {
                    segments.h.push({
                        routeIndex, i, coord: p.y, min: Math.min(p.x, q.x), max: Math.max(p.x, q.x),
                        before: points[i - 1].y - p.y, after: points[i + 2].y - p.y
                    });
                } else if (Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) > 0.01) {
                    segments.v.push({
                        routeIndex, i, coord: p.x, min: Math.min(p.y, q.y), max: Math.max(p.y, q.y),
                        before: points[i - 1].x - p.x, after: points[i + 2].x - p.x
                    });
                }
            }
        });

        const offsets = routes.map(route => route.points.map(() => ({ x: 0, y: 0 })));
        const processAxis = (list, axis) => {
            const byCoord = new Map();
            for (const segment of list) {
                const key = Math.round(segment.coord * 2) / 2;
                if (!byCoord.has(key)) byCoord.set(key, []);
                byCoord.get(key).push(segment);
            }
            for (const group of byCoord.values()) {
                if (group.length < 2) continue;
                group.sort((p, q) => p.min - q.min);
                let cluster = [];
                let clusterMax = -Infinity;
                const flush = () => {
                    const routeIds = new Set(cluster.map(segment => segment.routeIndex));
                    if (routeIds.size > 1) this.assignTracks(cluster, offsets, axis, spacing, rects);
                    cluster = [];
                    clusterMax = -Infinity;
                };
                for (const segment of group) {
                    if (cluster.length && segment.min >= clusterMax - 0.5) flush();
                    cluster.push(segment);
                    clusterMax = Math.max(clusterMax, segment.max);
                }
                if (cluster.length) flush();
            }
        };
        processAxis(segments.h, 'y');
        processAxis(segments.v, 'x');

        routes.forEach((route, routeIndex) => {
            route.points.forEach((point, pointIndex) => {
                point.x += offsets[routeIndex][pointIndex].x;
                point.y += offsets[routeIndex][pointIndex].y;
            });
        });
    }

    assignTracks(cluster, offsets, axis, spacing, rects = new Map()) {
        // Routes that turn towards the negative side sit on the negative side, reducing crossings
        const side = segment => Math.sign(segment.before) + Math.sign(segment.after);
        cluster.sort((p, q) => {
            const diff = side(p) - side(q);
            if (diff !== 0) return diff;
            // Among routes bending the same way, the shorter one sits on the inside of the bend
            const lengthDiff = (p.max - p.min) - (q.max - q.min);
            return side(p) < 0 ? lengthDiff : -lengthDiff;
        });
        // Keep the bundle inside the free channel, squeezing the spacing if the channel is narrow
        const coord = cluster[0].coord;
        const spanMin = Math.min(...cluster.map(segment => segment.min));
        const spanMax = Math.max(...cluster.map(segment => segment.max));
        let low = -Infinity;
        let high = Infinity;
        for (const rect of rects.values()) {
            const [near, far, alongMin, alongMax] = axis === 'x'
                ? [rect.left, rect.right, rect.top, rect.bottom]
                : [rect.top, rect.bottom, rect.left, rect.right];
            if (alongMax <= spanMin || alongMin >= spanMax) continue;
            if (far <= coord) low = Math.max(low, far);
            else if (near >= coord) high = Math.min(high, near);
        }
        const clearance = 1.5;
        const minOffset = low - coord + clearance;
        const maxOffset = high - coord - clearance;
        const count = cluster.length;
        let trackSpacing = spacing;
        if (count > 1 && Number.isFinite(minOffset) && Number.isFinite(maxOffset) && maxOffset > minOffset) {
            trackSpacing = Math.min(spacing, Math.max(1, (maxOffset - minOffset) / (count - 1)));
        }
        const width = (count - 1) * trackSpacing;
        let first = -width / 2;
        if (first + width > maxOffset) first = maxOffset - width;
        if (first < minOffset) first = minOffset;
        cluster.forEach((segment, track) => {
            const offset = first + track * trackSpacing;
            const routeOffsets = offsets[segment.routeIndex];
            routeOffsets[segment.i][axis] = offset;
            routeOffsets[segment.i + 1][axis] = offset;
        });
    }

    // Polyline -> path with rounded corners
    createSmoothPath(points, maxRadius = 10) {
        if (!points || points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
        const fmt = value => Math.round(value * 100) / 100;
        let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
        const lastIndex = points.length - 1;
        for (let i = 1; i < lastIndex; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const inLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            const outLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (inLength < 0.01 || outLength < 0.01) continue;
            // Segments touching the ends can give their full length to a single corner
            const inAvailable = i - 1 === 0 ? inLength : inLength / 2;
            const outAvailable = i + 1 === lastIndex ? outLength : outLength / 2;
            const radius = Math.min(maxRadius, inAvailable, outAvailable);
            const ax = p1.x - ((p1.x - p0.x) / inLength) * radius;
            const ay = p1.y - ((p1.y - p0.y) / inLength) * radius;
            const bx = p1.x + ((p2.x - p1.x) / outLength) * radius;
            const by = p1.y + ((p2.y - p1.y) / outLength) * radius;
            d += ` L ${fmt(ax)} ${fmt(ay)} Q ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(bx)} ${fmt(by)}`;
        }
        d += ` L ${fmt(points[lastIndex].x)} ${fmt(points[lastIndex].y)}`;
        return d;
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
            munitions: 'Munition Design',
            outfit: 'Ship Outfit',
            shipLoadout: 'Ship Loadout',
            shipCore: 'Ship Core',
            summary: 'Summary',
            hullTiles: 'Hull Tiles'
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
                outputs: ['Class']
            },
            'outfit': {
                inputs: ['Core','Class', 'Loadout'],
                outputs: ['Outfit']
            },
            'shipLoadout': {
                inputs: ['Class'],
                outputs: ['Loadout']
            },
            'craft': {
                inputs: ['Core'],
                outputs: ['Craft']
            },
            'troops': {
                inputs: [],
                outputs: ['Troop']
            },
            'munitions': {
                inputs: [],
                outputs: []
            },
            'shipCore': {
                inputs: ['Class'],
                outputs: ['Core']
            },
            'summary': {
                inputs: ['Outfit', 'Craft'],
                outputs: []
            },
            'hullTiles': {
                inputs: ['Outfit'],
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
            connectionsData.push({
                sourceNodeId: connection.sourceNodeId,
                targetNodeId: connection.targetNodeId
            });
        }
        return connectionsData;
    }

    fromJSON(connectionsData) {
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        widgets.forEach(widget => { widget.deferExpandableNodeUpdates = true; });
        try {
            this.clearAllConnections();

            for (const { sourceNodeId, targetNodeId } of connectionsData) {
                for (const nodeId of [sourceNodeId, targetNodeId]) {
                    if (!nodeId) continue;
                    widgets.forEach(widget => widget.ensureNodeForConnection?.(nodeId));
                }
            }

            for (const connectionData of connectionsData) {
                const { sourceNodeId, targetNodeId } = connectionData;
                if (sourceNodeId && targetNodeId && this.canConnect(sourceNodeId, targetNodeId)) {
                    this.createConnection(sourceNodeId, targetNodeId);
                } else {
                    console.warn('Skipping invalid connection:', connectionData);
                }
            }
        } finally {
            widgets.forEach(widget => { widget.deferExpandableNodeUpdates = false; });
            widgets.forEach(widget => {
                for (const groupId of widget.expandableNodeGroups?.keys?.() || []) {
                    widget.updateExpandableGroup(groupId);
                }
            });
        }
    }

    clearAllConnections() {
        for (const connectionId of Array.from(this.connections.keys())) {
            this.removeConnection(connectionId);
        }
    }
}