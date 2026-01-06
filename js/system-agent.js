import { bus, globalState } from './state.js';

export class SystemAgent {
    constructor(name, tickRateMs = 1000) {
        this.name = name;
        this.tickRateMs = tickRateMs;
        this.lastTick = 0;
        this.containerId = `${name.toLowerCase().replace(' ', '-')}-system`;
        this.element = document.getElementById(this.containerId);

        // Local state separate from global
        this.localState = {
            status: 'Nominal',
            load: 0 // 0-100%
        };

        this.setupUI();
    }

    setupUI() {
        if (!this.element) {
            console.warn(`container for ${this.name} not found`);
            return;
        }
        this.element.innerHTML = `<h3>${this.getIcon()} ${this.name}</h3>
                                  <div class="metrics"></div>`;
        this.metricsContainer = this.element.querySelector('.metrics');
    }

    /**
     * Override this to provide specific metrics to render
     */
    getMetrics() {
        return {};
    }

    getIcon() {
        return '⚙️';
    }

    /**
     * Called every simulation loop.
     * @param {number} deltaTime - Time in ms since last global update
     */
    update(deltaTime, now) {
        if (now - this.lastTick >= this.tickRateMs) {
            this.process(deltaTime);
            this.render();
            this.lastTick = now;
        }
    }

    /**
     * Core logic for the system. Override this.
     */
    process(deltaTime) {
        // Default behavior: random small fluctuation
    }

    /**
     * Renders metrics to the DOM.
     * Uses a simple diffing or just rebuilds strings for this prototype.
     */
    render() {
        if (!this.metricsContainer) return;

        const metrics = this.getMetrics();
        let html = '';
        for (const [key, val] of Object.entries(metrics)) {
            let colorClass = '';
            if (typeof val === 'string') {
                if (val.includes('High') || val.includes('Danger')) colorClass = 'val-danger';
                else if (val.includes('Nominal') || val.includes('Optimal')) colorClass = 'val-ok';
            }
            // Simple coloring logic for numbers can be added here or in subclass

            html += `<div class="metric-row">
                        <span class="metric-label">${key}</span>
                        <span class="metric-value ${colorClass}">${val}</span>
                     </div>`;
        }
        this.metricsContainer.innerHTML = html;
    }
}
