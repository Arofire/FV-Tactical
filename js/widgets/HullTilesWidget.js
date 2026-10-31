class HullTilesWidget extends SummaryWidget {
    constructor(x = 100, y = 100) {
        super(x, y, 'hullTiles', 'Hull Tiles');
    }

    createContent(contentElement) {
        const section = this.createSection('tiles', '');
        this.setSectionContent(section, `
            <div class="hull-plan-view" id="${this.id}-plan-view" aria-live="polite"></div>
        `);
        contentElement.querySelector('.widget-sections').appendChild(section.section);
        this.refreshPlan();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Outfit', 'Outfits', 0, 0.5, {
            sectionId: 'tiles',
            anchorId: `${this.id}-tiles`,
            minSpacing: 30,
            allowMultipleConnections: true
        });
        this.reflowNodes();
    }

    renderPlan(container, model) {
        container.replaceChildren();
        const layout = this.createLayout(
            model.counts,
            this.getQuantumSystemTotal(model.quantumSystemCounts)
        );
        const armorCount = this.numeric(model.armor);
        const utilityCount = this.numeric(model.utilityTotal);
        if (!layout.cells.length && armorCount === 0 && utilityCount === 0) {
            const empty = document.createElement('div');
            empty.className = 'hull-plan-empty';
            empty.textContent = model.outfits.length
                ? 'No hull allocations are available from the connected outfits.'
                : 'Connect a Ship Outfit to populate the hull tiles.';
            container.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'hull-plan-grid';
        const cols = layout.cols || Math.max(1, Math.ceil(Math.sqrt(Math.max(armorCount, utilityCount))));
        grid.setAttribute('role', 'grid');
        const appendRow = cells => {
            const row = document.createElement('div');
            row.className = 'hull-plan-row';
            for (let colIndex = 0; colIndex < cols; colIndex++) {
                row.appendChild(cells[colIndex] || document.createElement('span'));
            }
            grid.appendChild(row);
        };
        const appendTiles = (table, title) => {
            table.forEach(row => {
                appendRow(row.map(code => {
                    if (!code) return null;
                    const cell = document.createElement('div');
                    const tileType = { D: 'armor', A: 'hardpoint', U: 'utility' }[code] || code.toLowerCase();
                    cell.className = `hull-plan-cell hull-plan-${tileType}`;
                    cell.setAttribute('role', 'gridcell');
                    cell.title = title;
                    cell.setAttribute('aria-label', `${title}: ${code}`);
                    const label = document.createElement('strong');
                    label.className = 'hull-plan-cell-code';
                    label.textContent = code;
                    cell.appendChild(label);
                    return cell;
                }));
            });
        };

        appendTiles(this.buildArmorTable(model.armor, model.hardpoints, cols), 'Armour/Hardpoints');
        appendTiles(this.blockTable(model.utilityTotal, cols, 'U'), 'Utilities');

        const hullRows = Array.from({ length: layout.rows }, () => new Array(cols).fill(null));
        const totals = {};
        layout.cells.forEach(cell => {
            totals[cell.category] = (totals[cell.category] || 0) + 1;
            const element = document.createElement('div');
            const isQuantum = cell.category === 'Quantum';
            const tileCode = isQuantum ? 'Q' : SummaryWidget.HULL_CODES[cell.category];
            element.className = `hull-plan-cell hull-plan-${isQuantum
                ? 'quantum'
                : cell.category.toLowerCase()}`;
            element.setAttribute('role', 'gridcell');

            const items = model.hullItems[cell.category] || [];
            const item = items[totals[cell.category] - 1];
            const code = document.createElement('strong');
            code.className = 'hull-plan-cell-code';
            code.textContent = tileCode;
            element.appendChild(code);

            if (cell.category === 'Emplacement' && item) {
                const costLabel = `${item.resourceCost} emplacement${item.resourceCost === 1 ? '' : 's'}`;
                const weaponIdentifier = item.weaponInstanceNumber
                    ? `${item.name} #${item.weaponInstanceNumber}`
                    : item.name;
                if (item.weaponId) element.dataset.weaponId = item.weaponId;
                if (item.weaponInstanceId) element.dataset.weaponInstanceId = item.weaponInstanceId;
                element.title = `${weaponIdentifier} (${costLabel})`;
                element.setAttribute(
                    'aria-label',
                    `${SummaryWidget.HULL_CODES[cell.category]}: ${weaponIdentifier} (${costLabel})`
                );
                if (item.weaponInstanceNumber) {
                    const identifier = document.createElement('small');
                    identifier.className = 'hull-plan-weapon-instance';
                    identifier.textContent = `#${item.weaponInstanceNumber}`;
                    element.appendChild(identifier);
                }
            } else {
                element.title = isQuantum
                    ? 'Quantum system'
                    : cell.category === 'Emplacement'
                        ? 'Unassigned emplacement'
                        : SummaryWidget.HULL_CODES[cell.category];
                element.setAttribute(
                    'aria-label',
                    `${tileCode}: ${isQuantum ? 'Quantum system' : cell.category}`
                );
            }
            hullRows[cell.row][cell.col] = element;
        });
        hullRows.forEach(row => appendRow(row));
        container.appendChild(grid);
    }
}
