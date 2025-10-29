// Preflight check system for validating designs and identifying issues
class PreflightCheck {
    constructor(empire, widgetManager, nodeSystem) {
        this.empire = empire;
        this.widgetManager = widgetManager;
        this.nodeSystem = nodeSystem;
        
        this.alerts = [];
        this.warnings = [];
        this.errors = [];
        this.techRequirements = [];
        
        // Track issues by widget ID
        this.widgetIssues = new Map(); // widgetId -> { alerts: [], warnings: [], errors: [], techRequirements: [] }
        this.checkedWidgetsThisRun = new Set(); // Track which widgets were checked this run
        
        // New floating overlay elements
        this.preflightToggle = document.getElementById('preflightControl');
        this.preflightOverlay = document.getElementById('preflightOverlay');
        this.preflightIssues = document.getElementById('preflightIssues');
        this.preflightSummary = document.getElementById('preflightSummary');
        
        // Start preflight issues panel in minimized state
        if (this.preflightOverlay) {
            this.preflightOverlay.classList.add('hidden');
        }
        
        // Badge buttons for filtering
        this.badgeAlerts = document.getElementById('badgeAlerts');
        this.badgeWarnings = document.getElementById('badgeWarnings');
        this.badgeErrors = document.getElementById('badgeErrors');
        
        // Track which issue types are visible
        this.visibleIssueTypes = new Set(['alert', 'warning', 'error']);
        
        // Cache last known badge states to prevent unnecessary DOM updates
        this.lastBadgeStates = {
            alerts: -1,
            warnings: -1,
            errors: -1,
            alertsVisible: null,
            warningsVisible: null,
            errorsVisible: null
        };
        
        this.initBadgeToggle();
        
        // Track previous issues for animation
        this.previousIssues = new Map(); // issueId -> issueData
        this.currentIssueElements = new Map(); // issueId -> DOM element
    }

    runCheck() {
    this.alerts = [];
    this.warnings = [];
        this.errors = [];
        this.techRequirements = [];
        this.widgetIssues.clear();
        this.checkedWidgetsThisRun.clear();
        
        // Check all widgets
        if (this.widgetManager) {
            for (const widget of this.widgetManager.widgets.values()) {
                this.checkedWidgetsThisRun.add(widget.id);
                this.checkWidget(widget);
            }
        }
        
        // Check connections
        if (this.nodeSystem) {
            this.checkConnections();
        }
        
        // Check empire-wide issues
        this.checkEmpireWide();
        
        // Update widget indicators
        this.updateWidgetIndicators();
        
        // Update UI
        this.updateUI();
    }

    checkWidget(widget) {
        switch (widget.type) {
            case 'ship':
                this.checkShipWidget(widget);
                break;
            case 'craft':
                this.checkCraftWidget(widget);
                break;
            case 'troops':
                this.checkTroopsWidget(widget);
                break;
            case 'missiles':
                this.checkMissilesWidget(widget);
                break;
            case 'outfit':
                this.checkOutfitWidget(widget);
                break;
            case 'loadouts':
                this.checkLoadoutsWidget(widget);
                break;
            case 'shipCore':
                this.checkShipCoreWidget(widget);
                break;
            case 'shipBerth':
                this.checkShipBerthWidget(widget);
                break;
            case 'shipHulls':
                this.checkShipHullsWidget(widget);
                break;
        }
    }

    checkShipWidget(widget) {
        const data = widget.getSerializedData();
        
        // Handle new hull-based ship design
        if (data.shipData) {
            this.checkHullBasedShip(widget, data.shipData);
            return;
        }
        
        // Legacy component-based system (keep for backward compatibility)
        if (!data.components || data.components.length === 0) {
            this.addWarning(`Ship "${widget.title}" has no components`, widget.id);
            return;
        }
        
        let hasHull = false;
        let hasEngine = false;
        let hasPower = false;
        let totalMass = 0;
        let totalPowerConsumption = 0;
        let totalPowerGeneration = 0;
        
        // Analyze components
        for (const component of data.components) {
            // Check tech requirements
            if (component.requiredTech && !data.ignoreTechRequirements) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Ship "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
            
            // Component type checking
            if (component.type === 'hull') hasHull = true;
            if (component.type === 'engine') hasEngine = true;
            if (component.type === 'reactor') hasPower = true;
            
            // Calculate totals
            if (component.mass) totalMass += component.mass;
            if (component.powerConsumption) totalPowerConsumption += component.powerConsumption;
            if (component.powerOutput) totalPowerGeneration += component.powerOutput;
        }
        
        // Essential component checks
        if (!hasHull) {
            this.addError(`Ship "${widget.title}" requires a hull component`, widget.id);
        }
        if (!hasEngine) {
            this.addError(`Ship "${widget.title}" requires an engine component`, widget.id);
        }
        if (!hasPower && totalPowerConsumption > 0) {
            this.addError(`Ship "${widget.title}" requires power generation for its components`, widget.id);
        }
        
        // Power balance check
        if (totalPowerConsumption > totalPowerGeneration) {
            this.addError(`Ship "${widget.title}" has insufficient power: ${totalPowerGeneration} generated, ${totalPowerConsumption} required`, widget.id);
        } else if (totalPowerConsumption < totalPowerGeneration * 0.5) {
            this.addWarning(`Ship "${widget.title}" has excess power generation`, widget.id);
        }
        
        // Mass warnings
        if (totalMass > 1000) {
            this.addWarning(`Ship "${widget.title}" is very heavy (${totalMass} mass units)`, widget.id);
        }
    }

    checkHullBasedShip(widget, shipData) {
        const hull = shipData.hullComposition;
        const totalHulls = typeof widget.getTotalHulls === 'function'
            ? widget.getTotalHulls()
            : Object.values(hull || {}).reduce((sum, count) => sum + count, 0);

        // Connection expectations for new node layout
        // Ship outputs Class connections to Outfit widgets
        const classConnections = this.countNodeConnections(widget, 'Class', 'output');
        if (classConnections === 0) {
            this.addWarning(`Ship "${widget.title}" requires an Outfit connection`, widget.id);
        }

        const loadoutConnections = this.countNodeConnections(widget, 'loadout', 'output');
        const magazineHulls = (hull?.magazine || 0);
        const hangarHulls = (hull?.hangar || 0);
        if ((magazineHulls + hangarHulls) > 0 && loadoutConnections === 0) {
            this.addWarning(`Ship "${widget.title}" has magazine or hangar hulls without a Loadout connection`, widget.id);
        }

        const parentShip = this.getShipParent(widget);
        if (parentShip) {
            const parentTotal = typeof parentShip.getTotalHulls === 'function'
                ? parentShip.getTotalHulls()
                : Object.values(parentShip.shipData?.hullComposition || {}).reduce((sum, count) => sum + count, 0);
            if (totalHulls !== parentTotal) {
                this.addError(
                    `Ship "${widget.title}" inherits from "${parentShip.title}" and must keep ${parentTotal} hulls (currently ${totalHulls}).`,
                    widget.id
                );
            }

            const parentFoundations = parentShip.shipData?.foundations || {};
            const childFoundations = shipData.foundations || {};
            const mismatched = [];
            Object.keys(parentFoundations).forEach(key => {
                if (!!parentFoundations[key] !== !!childFoundations[key]) {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
                    mismatched.push(label);
                }
            });
            if (mismatched.length > 0) {
                this.addError(
                    `Ship "${widget.title}" foundations must match parent "${parentShip.title}" (${mismatched.join(', ')}).`,
                    widget.id
                );
            }
        }
        
        // Check foundations tech requirements if not ignored
        if (!shipData.ignoreTechRequirements && shipData.foundations) {
            Object.entries(shipData.foundations).forEach(([tech, enabled]) => {
                if (enabled && !this.empire.hasTech(tech)) {
                    this.addTechRequirement(
                        `Ship "${widget.title}" foundation "${tech}" requires technology`,
                        tech, widget.id
                    );
                }
            });
        }
    }

    getShipParent(widget) {
        if (!widget?.parents || widget.parents.size === 0 || !this.widgetManager) return null;
        for (const parentId of widget.parents) {
            const parentWidget = this.widgetManager.getWidget(parentId);
            if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
                return parentWidget;
            }
        }
        return null;
    }

    hasConnectedNode(widget, nodeType, nodeDirection) {
        return this.countNodeConnections(widget, nodeType, nodeDirection) > 0;
    }

    countNodeConnections(widget, nodeType, nodeDirection) {
        if (!widget?.nodes) return 0;
        let total = 0;
        for (const node of widget.nodes.values()) {
            if (node.nodeType === nodeType && node.type === nodeDirection) {
                total += node.connections ? node.connections.size : 0;
            }
        }
        return total;
    }

    getParentWidgetByType(widget, type) {
        if (!widget?.parents || widget.parents.size === 0 || !this.widgetManager) return null;
        for (const parentId of widget.parents) {
            const parentWidget = this.widgetManager.getWidget(parentId);
            if (parentWidget && parentWidget.type === type) {
                return parentWidget;
            }
        }
        return null;
    }

    checkCraftWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.components || data.components.length === 0) {
            this.addWarning(`Craft "${widget.title}" has no components`, widget.id);
            return;
        }
        
        // Similar to ship but with different thresholds
        let totalMass = 0;
        for (const component of data.components) {
            if (component.requiredTech) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Craft "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
            if (component.mass) totalMass += component.mass;
        }
        
        // Craft should be lighter than ships
        if (totalMass > 200) {
            this.addWarning(`Craft "${widget.title}" is heavy for a small craft (${totalMass} mass units)`, widget.id);
        }

        const craftLinks = this.countNodeConnections(widget, 'craft', 'output');
        if (craftLinks === 0) {
            this.addAlert(`Craft "${widget.title}" is not assigned to any loadout`, widget.id);
        }
    }

    checkTroopsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.equipment || data.equipment.length === 0) {
            this.addWarning(`Troop unit "${widget.title}" has no equipment`, widget.id);
        }
        
        // Check equipment tech requirements
        if (data.equipment) {
            for (const equipment of data.equipment) {
                if (equipment.requiredTech) {
                    for (const tech of equipment.requiredTech) {
                        if (!this.empire.hasTech(tech)) {
                            this.addTechRequirement(
                                `Troop unit "${widget.title}" equipment "${equipment.name}" requires ${tech}`,
                                tech, widget.id
                            );
                        }
                    }
                }
            }
        }

        const troopLinks = this.countNodeConnections(widget, 'troop', 'output');
        if (troopLinks === 0) {
            this.addAlert(`Troop unit "${widget.title}" is not assigned to any berth plan`, widget.id);
        }
    }

    checkMissilesWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.warhead && !data.guidance) {
            this.addError(`Missile "${widget.title}" requires warhead and guidance systems`, widget.id);
        }
        
        // Check tech requirements for missile components
        const components = [data.warhead, data.guidance, data.propulsion].filter(Boolean);
        for (const component of components) {
            if (component.requiredTech) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Missile "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
        }

        const weaponLinks = this.countNodeConnections(widget, 'weapon', 'output');
        if (weaponLinks === 0) {
            this.addAlert(`Missile design "${widget.title}" is not assigned to any loadout`, widget.id);
        }
    }

    checkOutfitWidget(widget) {
        // Outfit receives Class input from Ship widgets
        const classLinks = this.countNodeConnections(widget, 'Class', 'input');
        if (classLinks === 0) {
            this.addError(`Outfit "${widget.title}" must connect to a Ship Class`, widget.id);
        }

        // Outfit receives Core input from ShipCore widgets
        const coreLinks = this.countNodeConnections(widget, 'Core', 'input');
        if (coreLinks === 0) {
            this.addError(`Outfit "${widget.title}" requires at least one Ship Core`, widget.id);
        }

        const hullLinks = this.countNodeConnections(widget, 'outfit-hull', 'output');
        if (hullLinks === 0) {
            this.addAlert(`Outfit "${widget.title}" is not assigned to any Hull plan`, widget.id);
        }
    }

    checkShipCoreWidget(widget) {
        // Only alert if the core has no connections (unused)
        const coreLinks = this.countNodeConnections(widget, 'Core', 'output');
        if (coreLinks > 0) {
            return; // Has at least one connection, no alert needed
        }
        // No connections - could add an alert here if desired
    }

    checkShipBerthWidget(widget) {
        const outfitLinks = this.countNodeConnections(widget, 'berth', 'input');
        if (outfitLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" is not linked to an Outfit`, widget.id);
        }

        const troopLinks = this.countNodeConnections(widget, 'troop', 'input');
        if (troopLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" has unused berth capacity`, widget.id);
        }

        const staffLinks = this.countNodeConnections(widget, 'staff', 'output');
        if (staffLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" does not produce a staff plan`, widget.id);
        }
    }

    checkShipHullsWidget(widget) {
        const outfitLinks = this.countNodeConnections(widget, 'outfit-hull', 'input');
        if (outfitLinks === 0) {
            this.addError(`Hull plan "${widget.title}" requires an Outfit connection`, widget.id);
        }

        const loadoutLinks = this.countNodeConnections(widget, 'loadout-hull', 'input');
        const staffLinks = this.countNodeConnections(widget, 'staff', 'input');

        const outfitWidget = this.getParentWidgetByType(widget, 'outfit');
        const shipWidget = outfitWidget ? this.getShipParent(outfitWidget) : null;

        if (shipWidget) {
            const hulls = shipWidget.shipData?.hullComposition || {};
            const magazineHulls = hulls.magazine || 0;
            const hangarHulls = hulls.hangar || 0;
            if ((magazineHulls + hangarHulls) > 0 && loadoutLinks === 0) {
                this.addAlert(`Hull plan "${widget.title}" has magazine or hangar capacity without a Loadout connection`, widget.id);
            }
        }

        if (outfitWidget) {
            const modules = outfitWidget.outfitData?.systemsData?.modules || [];
            const hasBerthingSystems = modules.some(module => {
                const key = (module?.moduleId || module?.name || '').toString().toLowerCase();
                return key.includes('berth');
            });
            if (hasBerthingSystems && staffLinks === 0) {
                this.addAlert(`Hull plan "${widget.title}" has berthing systems but no Staff plan connection`, widget.id);
            }
        }
    }

    checkLoadoutsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.items || data.items.length === 0) {
            this.addWarning(`Loadout "${widget.title}" is empty`, widget.id);
        }
        
        // Check for conflicting items or missing dependencies
        if (data.items) {
            const weaponCount = data.items.filter(item => item.type === 'weapon').length;
            const ammoCount = data.items.filter(item => item.type === 'ammunition').length;
            
            if (weaponCount > 0 && ammoCount === 0) {
                this.addWarning(`Loadout "${widget.title}" has weapons but no ammunition`, widget.id);
            }
        }

        const classLinks = this.countNodeConnections(widget, 'loadout', 'input');
        if (classLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" is not linked to a ship class`, widget.id);
        }

        const craftLinks = this.countNodeConnections(widget, 'craft', 'input');
        if (craftLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" has unused hangar bays`, widget.id);
        }

        const weaponLinks = this.countNodeConnections(widget, 'weapon', 'input');
        if (weaponLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" has unused magazines`, widget.id);
        }

        const hullLinks = this.countNodeConnections(widget, 'loadout-hull', 'output');
        if (hullLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" is not assigned to a hull plan`, widget.id);
        }
    }

    checkConnections() {
        const connectionValidation = this.nodeSystem.validateConnections();
        
        for (const error of connectionValidation.errors) {
            this.addError(error.message, error.connectionId);
        }
        
        for (const warning of connectionValidation.warnings) {
            this.addWarning(warning.message, warning.connectionId);
        }
        
        // Check for unconnected critical nodes
        if (this.widgetManager) {
            for (const widget of this.widgetManager.widgets.values()) {
                for (const [nodeId, node] of widget.nodes) {
                    if (node.nodeType === 'power' && node.type === 'input' && node.connections.size === 0) {
                        this.addWarning(`${widget.title} has unconnected power input`, widget.id);
                    }
                }
            }
        }
    }

    checkEmpireWide() {
        // Check for orphaned designs
        for (const [type, designs] of Object.entries(this.empire.designs)) {
            if (designs.length === 0) {
                continue;
            }
            
            // Check if designs use components that are no longer available
            for (const design of designs) {
                if (design.components) {
                    for (const component of design.components) {
                        if (component.requiredTech) {
                            for (const tech of component.requiredTech) {
                                if (!this.empire.hasTech(tech)) {
                                    this.addTechRequirement(
                                        `Saved ${type} design "${design.name}" uses unavailable technology ${tech}`,
                                        tech, design.id
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    addAlert(message, sourceId) {
        this.alerts.push({ message, sourceId, type: 'alert' });
        this.addToWidgetIssues(sourceId, 'alerts', { message, type: 'alert' });
    }

    addWarning(message, sourceId) {
        this.warnings.push({ message, sourceId, type: 'warning' });
        this.addToWidgetIssues(sourceId, 'warnings', { message, type: 'warning' });
    }

    addError(message, sourceId) {
        this.errors.push({ message, sourceId, type: 'error' });
        this.addToWidgetIssues(sourceId, 'errors', { message, type: 'error' });
    }

    addTechRequirement(message, tech, sourceId) {
        this.techRequirements.push({ message, tech, sourceId, type: 'tech' });
        this.addToWidgetIssues(sourceId, 'techRequirements', { message, tech, type: 'tech' });
    }

    addToWidgetIssues(sourceId, category, issue) {
        if (!sourceId || sourceId === 'empire' || sourceId.startsWith('connection-')) return;
        
        if (!this.widgetIssues.has(sourceId)) {
            this.widgetIssues.set(sourceId, { alerts: [], warnings: [], errors: [], techRequirements: [] });
        }
        
        this.widgetIssues.get(sourceId)[category].push(issue);
    }

    clearWidgetIssues(widgetId) {
        this.widgetIssues.delete(widgetId);
        // Trigger a new check to update the UI
        setTimeout(() => this.runCheck(), 50);
    }

    updateWidgetIndicators() {
        // Update all widgets that were checked this run
        for (const widgetId of this.checkedWidgetsThisRun) {
            const widget = this.widgetManager.getWidget(widgetId);
            if (!widget) continue;
            
            const issues = this.widgetIssues.get(widgetId);
            if (issues) {
                // Has issues - update with the issues
                const allIssues = [
                    ...issues.alerts,
                    ...issues.errors,
                    ...issues.warnings,
                    ...issues.techRequirements
                ];
                widget.updatePreflightIndicator(
                    issues.warnings.length,
                    issues.errors.length + issues.techRequirements.length,
                    allIssues,
                    issues.alerts.length
                );
            } else {
                // No issues - clear the indicator
                widget.updatePreflightIndicator(0, 0, [], 0);
            }
        }
    }

    updateUI() {
        this.updateSummaryBadges();
        this.updateFloatingIssues();
    }

    initBadgeToggle() {
        // Toggle preflight panel visibility when clicking on the control header
        if (this.preflightToggle) {
            this.preflightToggle.addEventListener('click', () => {
                if (this.preflightOverlay) {
                    this.preflightOverlay.classList.toggle('hidden');
                }
            });
            // Make the header look clickable
            this.preflightToggle.style.cursor = 'pointer';
        }
        
        if (this.badgeAlerts) {
            this.badgeAlerts.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleIssueType('alert');
            });
        }
        if (this.badgeWarnings) {
            this.badgeWarnings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleIssueType('warning');
            });
        }
        if (this.badgeErrors) {
            this.badgeErrors.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleIssueType('error');
            });
        }
    }

    toggleIssueType(type) {
        if (this.visibleIssueTypes.has(type)) {
            this.visibleIssueTypes.delete(type);
        } else {
            this.visibleIssueTypes.add(type);
        }
        this.updateBadgeStates();
        this.updateFloatingIssuesVisibility();
    }

    updateBadgeStates() {
        if (this.badgeAlerts) {
            if (this.visibleIssueTypes.has('alert')) {
                this.badgeAlerts.classList.add('active');
            } else {
                this.badgeAlerts.classList.remove('active');
            }
        }
        if (this.badgeWarnings) {
            if (this.visibleIssueTypes.has('warning')) {
                this.badgeWarnings.classList.add('active');
            } else {
                this.badgeWarnings.classList.remove('active');
            }
        }
        if (this.badgeErrors) {
            if (this.visibleIssueTypes.has('error')) {
                this.badgeErrors.classList.add('active');
            } else {
                this.badgeErrors.classList.remove('active');
            }
        }
    }

    updateFloatingIssuesVisibility() {
        if (!this.preflightIssues) return;
        
        // Hide/show issue items based on current filter - only update cached elements
        for (const [id, element] of this.currentIssueElements) {
            const isAlert = element.classList.contains('alert');
            const isWarning = element.classList.contains('warning');
            const isError = element.classList.contains('error');
            
            let shouldShow = false;
            if (isAlert && this.visibleIssueTypes.has('alert')) shouldShow = true;
            if (isWarning && this.visibleIssueTypes.has('warning')) shouldShow = true;
            if (isError && this.visibleIssueTypes.has('error')) shouldShow = true;
            
            const newDisplay = shouldShow ? '' : 'none';
            // Only update if display value changed
            if (element.style.display !== newDisplay) {
                element.style.display = newDisplay;
            }
        }
    }


    updateSummaryBadges() {
        if (!this.badgeErrors || !this.badgeWarnings) return;
        
        const filteredWarnings = this.warnings;
        const techErrors = this.techRequirements.length > 0 ? this.techRequirements : [];
        const totalErrors = this.errors.length + techErrors.length;
        
        // Only update if values actually changed
        const alertsChanged = this.lastBadgeStates.alerts !== this.alerts.length;
        const warningsChanged = this.lastBadgeStates.warnings !== filteredWarnings.length;
        const errorsChanged = this.lastBadgeStates.errors !== totalErrors;
        
        const alertsShouldShow = this.alerts.length > 0;
        const warningsShouldShow = filteredWarnings.length > 0;
        const errorsShouldShow = totalErrors > 0;
        
        const alertsVisibilityChanged = this.lastBadgeStates.alertsVisible !== alertsShouldShow;
        const warningsVisibilityChanged = this.lastBadgeStates.warningsVisible !== warningsShouldShow;
        const errorsVisibilityChanged = this.lastBadgeStates.errorsVisible !== errorsShouldShow;
        
        // Update alerts badge only if changed
        if (alertsChanged || alertsVisibilityChanged) {
            if (this.badgeAlerts) {
                if (alertsShouldShow) {
                    this.badgeAlerts.textContent = this.alerts.length;
                    this.badgeAlerts.style.display = 'inline-block';
                } else {
                    this.badgeAlerts.style.display = 'none';
                }
            }
            this.lastBadgeStates.alerts = this.alerts.length;
            this.lastBadgeStates.alertsVisible = alertsShouldShow;
        }
        
        // Update warnings badge only if changed
        if (warningsChanged || warningsVisibilityChanged) {
            if (warningsShouldShow) {
                this.badgeWarnings.textContent = filteredWarnings.length;
                this.badgeWarnings.style.display = 'inline-block';
            } else {
                this.badgeWarnings.style.display = 'none';
            }
            this.lastBadgeStates.warnings = filteredWarnings.length;
            this.lastBadgeStates.warningsVisible = warningsShouldShow;
        }
        
        // Update errors badge only if changed
        if (errorsChanged || errorsVisibilityChanged) {
            if (errorsShouldShow) {
                this.badgeErrors.textContent = totalErrors;
                this.badgeErrors.style.display = 'inline-block';
            } else {
                this.badgeErrors.style.display = 'none';
            }
            this.lastBadgeStates.errors = totalErrors;
            this.lastBadgeStates.errorsVisible = errorsShouldShow;
        }
        
        // Ensure badges have the active class if they're visible
        this.updateBadgeStates();
    }

    updateFloatingIssues() {
        if (!this.preflightIssues) return;
        
        // Create current issues list with unique IDs
        const currentIssues = new Map();
        
        // Add alerts
        this.alerts.forEach(alert => {
            const id = `alert_${alert.message}_${alert.sourceId}`;
            currentIssues.set(id, {
                type: 'alert',
                message: alert.message,
                sourceId: alert.sourceId
            });
        });

        // Add warnings
        this.warnings.forEach(warning => {
            const id = `warning_${warning.message}_${warning.sourceId}`;
            currentIssues.set(id, {
                type: 'warning',
                message: warning.message,
                sourceId: warning.sourceId
            });
        });
        
        // Add errors
        this.errors.forEach(error => {
            const id = `error_${error.message}_${error.sourceId}`;
            currentIssues.set(id, {
                type: 'error',
                message: error.message,
                sourceId: error.sourceId
            });
        });
        
        // Convert tech requirements to errors
        this.techRequirements.forEach(req => {
            const id = `tech_error_${req.message}_${req.sourceId}`;
            currentIssues.set(id, {
                type: 'error',
                message: req.message,
                sourceId: req.sourceId
            });
        });
        
        // Animate changes
        this.animateIssueChanges(currentIssues);
        
        // Update tracking
        this.previousIssues = new Map(currentIssues);
    }

    animateIssueChanges(currentIssues) {
        // Find issues to remove
        const toRemove = [];
        for (const [id, element] of this.currentIssueElements) {
            if (!currentIssues.has(id)) {
                toRemove.push({ id, element });
            }
        }
        
        // Find issues to add
        const toAdd = [];
        for (const [id, issue] of currentIssues) {
            if (!this.currentIssueElements.has(id)) {
                toAdd.push({ id, issue });
            }
        }
        
        // Animate out removed issues
        toRemove.forEach(({ id, element }) => {
            element.style.animation = 'slideOutRight 0.3s ease-out';
            element.addEventListener('animationend', () => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.currentIssueElements.delete(id);
            }, { once: true });
        });
        
        // Add new issues with animation
        toAdd.forEach(({ id, issue }) => {
            const item = document.createElement('div');
            item.className = `preflight-issue-item ${issue.type}`;
            item.textContent = issue.message;
            item.onclick = () => this.focusOnSource(issue.sourceId);
            item.style.animation = 'slideInRight 0.3s ease-out';
            
            this.preflightIssues.appendChild(item);
            this.currentIssueElements.set(id, item);
        });
        
        // Apply current visibility filter
        this.updateFloatingIssuesVisibility();
    }

    focusOnSource(sourceId) {
        if (!sourceId || sourceId === 'empire') return;
        
        // Try to find and focus the widget
        if (this.widgetManager) {
            const widget = this.widgetManager.widgets.get(sourceId);
            if (widget) {
                widget.select();
                
                // Scroll widget into view
                const canvas = document.getElementById('canvas');
                const canvasRect = canvas.getBoundingClientRect();
                const widgetRect = widget.element.getBoundingClientRect();
                
                if (widgetRect.top < canvasRect.top || widgetRect.bottom > canvasRect.bottom ||
                    widgetRect.left < canvasRect.left || widgetRect.right > canvasRect.right) {
                    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    updatePreflightSummary() {
        const summaryErrors = document.getElementById('summaryErrors');
        const summaryWarnings = document.getElementById('summaryWarnings');
        
        if (summaryErrors && summaryWarnings) {
            const totalErrors = this.errors.length + this.techRequirements.length;
            const totalWarnings = this.warnings.length;
            const summaryAlerts = document.getElementById('summaryAlerts');
            
            summaryErrors.textContent = totalErrors;
            summaryWarnings.textContent = totalWarnings;
            if (summaryAlerts) {
                summaryAlerts.textContent = this.alerts.length;
                summaryAlerts.style.display = this.alerts.length > 0 ? 'inline' : 'none';
            }
            
            // Hide badges if count is 0
            summaryErrors.style.display = totalErrors > 0 ? 'inline' : 'none';
            summaryWarnings.style.display = totalWarnings > 0 ? 'inline' : 'none';
        }
    }

    getSummary() {
        return {
            alertCount: this.alerts.length,
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            techRequirementCount: this.techRequirements.length,
            hasIssues: this.errors.length > 0 || this.techRequirements.length > 0
        };
    }
}