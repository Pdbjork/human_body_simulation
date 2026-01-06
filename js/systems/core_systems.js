import { SystemAgent } from '../system-agent.js';
import { bus, globalState } from '../state.js';

export class NervousSystem extends SystemAgent {
    constructor() {
        super('Nervous', 50); // Fast response
        this.mode = 'Parasympathetic'; // or Sympathetic

        bus.on('threat-detected', () => this.handleThreat(true));
        bus.on('threat-cleared', () => this.handleThreat(false));
    }

    getIcon() { return '🧠'; }

    handleThreat(isThreat) {
        if (isThreat) {
            this.mode = 'Sympathetic';
            // Trigger fight or flight hormones
            bus.emit('request-hormone', { type: 'adrenaline', amount: 50 });
            bus.emit('request-hormone', { type: 'cortisol', amount: 20 });
        } else {
            this.mode = 'Parasympathetic';
        }
        globalState.threatDetected = isThreat;
    }

    process(dt) {
        // Continuous adjustment
        if (this.mode === 'Sympathetic') {
            globalState.adrenaline = Math.min(100, globalState.adrenaline + 2);
            globalState.cortisol = Math.min(100, globalState.cortisol + 0.1);
        } else {
            globalState.adrenaline = Math.max(0, globalState.adrenaline - 3);
            globalState.cortisol = Math.max(0, globalState.cortisol - 0.2);
        }
    }

    getMetrics() {
        return {
            'ANS State': this.mode,
            'Adrenaline': Math.round(globalState.adrenaline) + '%',
            'Cortisol': Math.round(globalState.cortisol) + '%'
        };
    }
}

export class CirculatorySystem extends SystemAgent {
    constructor() {
        super('Circulatory', 20); // Very fast
    }

    getIcon() { return '❤️'; }

    process(dt) {
        // Heart rate mechanics
        let restingHR = globalState.userProfile ? globalState.userProfile.restingHeartRate : 70;

        let targetHR = restingHR;
        if (globalState.threatDetected) targetHR = restingHR + 90;
        else if (globalState.adrenaline > 20) targetHR = restingHR + globalState.adrenaline; // Linear correlation

        // Apply Hypertension modifier
        let sysBP = 120;
        let diaBP = 80;

        if (globalState.activeConditions && globalState.activeConditions.has('hypertension')) {
            sysBP += 20;
            diaBP += 10;
            targetHR += 5; // Slightly elevated
        }

        if (globalState.activeConditions && globalState.activeConditions.has('anxiety')) {
            targetHR += 10;
        }

        // Smooth transition
        if (globalState.heartRate < targetHR) globalState.heartRate++;
        if (globalState.heartRate > targetHR) globalState.heartRate--;

        // Blood Pressure (Simulated)
        // Dynamic BP based on HR
        let load = (globalState.heartRate - restingHR) / 2;
        sysBP += load;
        diaBP += load / 2;

        this.bp = `${Math.round(sysBP)}/${Math.round(diaBP)}`;
        if (sysBP > 140 || diaBP > 90) this.bp += ' (High)';
        else this.bp += ' (Normal)';
    }

    getMetrics() {
        let hrClass = 'val-ok';
        if (globalState.heartRate > 120) hrClass = 'val-danger';
        else if (globalState.heartRate > 90) hrClass = 'val-warn';

        return {
            'Heart Rate': `<span class="${hrClass}">${Math.round(globalState.heartRate)} bpm</span>`,
            'Blood Pressure': this.bp,
            'O2 Transport': 'Active'
        };
    }
}

export class RespiratorySystem extends SystemAgent {
    constructor() {
        super('Respiratory', 40);
    }

    getIcon() { return '🫁'; }

    process(dt) {
        // Breathing follows Heart Rate somewhat
        let targetBR = 14 + (globalState.heartRate - 70) / 4;

        // Asthma modifier
        let airwayResistance = 1.0;
        if (globalState.activeConditions && globalState.activeConditions.has('asthma')) {
            // If stressed or exercising, asthma triggers
            if (globalState.heartRate > 100) {
                airwayResistance = 2.0; // Harder to breathe
                targetBR += 5; // Compensate with faster breathing
            }
        }

        if (globalState.breathingRate < targetBR) globalState.breathingRate += 0.5;
        if (globalState.breathingRate > targetBR) globalState.breathingRate -= 0.5;

        // Gas exchange logic
        // High HR consumes O2
        const consumption = globalState.heartRate / 1000;
        const intake = (globalState.breathingRate / 500) / airwayResistance; // Resistance reduces intake

        globalState.o2Saturation = Math.min(100, Math.max(75, globalState.o2Saturation + intake - consumption));
    }

    getMetrics() {
        let o2Class = globalState.o2Saturation < 90 ? 'val-danger' : 'val-ok';

        return {
            'Breathing Rate': `${Math.round(globalState.breathingRate)} bpm`,
            'O2 Saturation': `<span class="${o2Class}">${globalState.o2Saturation.toFixed(1)}%</span>`
        };
    }
}
