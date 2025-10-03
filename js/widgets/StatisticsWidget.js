class StatisticsWidget extends Widget {
    constructor(shipWidget, x = 900, y = 100) {
        super('statistics', 'Statistics', x, y, 340, 480);
        this.shipWidget = shipWidget;
        this.stats = {
            endurance: 0,
            developmentPoints: 0,
            shipyardMonths: 0,
            thrustRatio: 0,
            burns: 0,
            cargo: 0,
            remass: 0,
            hFuel: 0,
            hangarBays: 0,
            quantumRating: 0,
            qcm: 0,
            troopCapacity: 0
        };
        this.init();
    }

    createContent(contentElement) {
        const statFields = [
            ['endurance','Endurance'],
            ['developmentPoints','Development Points'],
            ['shipyardMonths','Shipyard Months'],
            ['thrustRatio','Thrust Ratio'],
            ['burns','Burns'],
            ['cargo','Cargo Capacity'],
            ['remass','Remass'],
            ['hFuel','H-Fuel'],
            ['hangarBays','Hangar Bays'],
            ['quantumRating','Quantum Rating'],
            ['qcm','QCM'],
            ['troopCapacity','Troop Capacity']
        ];
        contentElement.innerHTML = `
            <div class="stats-grid">
                ${statFields.map(([key,label]) => `
                    <div class="stat-input">
                        <label>${label}</label>
                        <input type="number" id="${this.id}-stat-${key}" value="${this.stats[key]}" min="0">
                    </div>
                `).join('')}
            </div>
        `;
        this.setupEventListeners();
    }

    setupEventListeners() {
        super.setupEventListeners();
        Object.keys(this.stats).forEach(key => {
            const input = document.getElementById(`${this.id}-stat-${key}`);
            if (input) {
                input.addEventListener('input', e => {
                    const val = parseFloat(e.target.value) || 0;
                    this.stats[key] = val;
                    this.syncToShip();
                });
            }
        });
    }

    syncToShip() {
        if (!this.shipWidget) return;
        this.shipWidget.shipData.statistics = { ...this.stats };
    }

    getSerializedData() {
        return { ...super.getSerializedData(), stats: this.stats };
    }

    loadSerializedData(data) {
        super.loadSerializedData(data);
        if (data.stats) this.stats = { ...this.stats, ...data.stats };
    }
}
