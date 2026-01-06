import { SystemAgent } from '../system-agent.js';
import { bus, globalState } from '../state.js';

export class DigestiveSystem extends SystemAgent {
    constructor() {
        super('Digestive', 200); // Slower
        this.isDigesting = false;
        this.status = 'Idle';

        bus.on('ingest-food', () => {
            if (!globalState.threatDetected) {
                this.isDigesting = true;
                globalState.glucose += 50;
                bus.emit('digestive-active', true);
            }
        });
    }

    getIcon() { return '🍽️'; }

    process(dt) {
        if (globalState.threatDetected) {
            this.status = 'Inhibited (Stress)';
            this.isDigesting = false;
        } else if (this.isDigesting) {
            this.status = 'Digesting';
            // Slowly convert glucose to glycogen/fat (abstracted) or just burn it
            if (globalState.glucose > 80) {
                bus.emit('request-hormone', { type: 'insulin', amount: 5 });
            } else {
                this.isDigesting = false;
                this.status = 'Idle';
            }
        } else {
            this.status = 'Idle';
        }
    }

    getMetrics() {
        return {
            'Status': this.status,
            'Glucose': Math.round(globalState.glucose) + ' mg/dL'
        };
    }
}

export class EndocrineSystem extends SystemAgent {
    constructor() {
        super('Endocrine', 100);

        bus.on('request-hormone', (req) => {
            // Simply acknowledge for now, actual leveling handled in Nervous for stress
            // But Insulin handled here
            if (req.type === 'insulin') {
                globalState.insulin = Math.min(100, globalState.insulin + req.amount);
            }
        });
    }

    getIcon() { return '🧬'; }

    process(dt) {
        // Insulin regulation
        let insulinEffectiveness = 1.0;
        if (globalState.activeConditions && globalState.activeConditions.has('diabetes_t2')) {
            insulinEffectiveness = 0.3; // Insulin resistance
        }

        if (globalState.insulin > 10) {
            // Degrade over time
            globalState.insulin -= 0.5;
            // Insulin lowers glucose (modulated by sensitivity)
            globalState.glucose = Math.max(70, globalState.glucose - (1 * insulinEffectiveness));
        }
    }

    getMetrics() {
        return {
            'Insulin': Math.round(globalState.insulin) + ' µU/mL',
            'Adrenaline': Math.round(globalState.adrenaline) + ' pg/mL'
        };
    }
}

export class MusculoskeletalSystem extends SystemAgent {
    constructor() {
        super('Musculoskeletal', 50);
        this.activity = 'Resting';

        bus.on('start-exercise', () => this.activity = 'Exercise');
        bus.on('stop-exercise', () => this.activity = 'Resting');
    }

    getIcon() { return '🦴'; }

    process(dt) {
        if (globalState.threatDetected) {
            this.activity = 'Tensed (Ready)';
            globalState.atp -= 0.5;
        } else if (this.activity === 'Exercise') {
            globalState.atp -= 1.0;
            if (globalState.atp < 20) {
                bus.emit('fatigue', true);
            }
            // Exercise raises HR
            globalState.heartRate = Math.min(180, globalState.heartRate + 2);
        } else {
            // Recovery
            this.activity = 'Resting';
            globalState.atp = Math.min(100, globalState.atp + 0.5);
        }
    }

    getMetrics() {
        return {
            'Activity': this.activity,
            'Energy (ATP)': Math.round(globalState.atp) + '%'
        };
    }
}
