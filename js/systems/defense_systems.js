import { SystemAgent } from '../system-agent.js';
import { bus, globalState } from '../state.js';

export class ImmuneSystem extends SystemAgent {
    constructor() {
        super('Immune', 500); // Slow
    }

    getIcon() { return '🧫'; }

    process(dt) {
        // High cortisol suppresses immune system
        if (globalState.cortisol > 60) {
            this.localState.status = 'Suppressed (Stress)';
        } else {
            this.localState.status = 'Active Scanning';
        }
    }

    getMetrics() {
        return {
            'Status': this.localState.status,
            'Inflammation': 'None'
        };
    }
}

export class ExcretorySystem extends SystemAgent {
    constructor() {
        super('Excretory', 200);
    }

    getIcon() { return '🧪'; }

    process(dt) {
        if (globalState.adrenaline > 50) {
            this.localState.status = 'Reduced Filtration';
        } else {
            this.localState.status = 'Optimal';
        }
    }

    getMetrics() {
        return {
            'Filtration': this.localState.status,
            'Hydration': 'Normal'
        };
    }
}

export class BrainSystem extends SystemAgent {
    constructor() {
        super('Brain', 40);
    }

    getIcon() { return '🧠'; }

    process(dt) {
        // Brain state derived from others
        let stress = (globalState.adrenaline + globalState.cortisol) / 2;

        if (stress > 80) this.localState.status = 'Panicked';
        else if (stress > 40) this.localState.status = 'Alert';
        else if (globalState.atp < 30) this.localState.status = 'Fatigued';
        else this.localState.status = 'Calm / Focused';
    }

    getMetrics() {
        return {
            'Consciousness': 'Awake',
            'State': this.localState.status
        };
    }
}
