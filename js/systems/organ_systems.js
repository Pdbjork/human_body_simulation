import { SystemAgent } from '../system-agent.js';
import { globalState } from '../state.js';

// Fictional pools, not measurements. Urea is deliberately separate from the
// legacy toxinLevel (which already has a lymphatic sink).
export const organModelState = {
    glycogen: 60,
    urea: 20,
    clearance: 1,
    glucoseTransfer: 0,
    ureaRemoved: 0
};

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

class OrganAgent extends SystemAgent {
    constructor(name) {
        super(name, 200);
        this.elapsed = 0;
    }

    // Accumulate active simulation time, not wall time or just the last frame.
    update(deltaTime) {
        this.elapsed += deltaTime;
        if (this.elapsed < this.tickRateMs) return;
        while (this.elapsed >= this.tickRateMs) {
            this.process(this.tickRateMs);
            this.elapsed -= this.tickRateMs;
        }
        this.render();
    }

    getIcon() { return ''; }
}

export class PancreasSystem extends OrganAgent {
    constructor() { super('Pancreas'); }

    process(dt) {
        const response = 1 - Math.exp(-dt / 3000);
        const insulinTarget = clamp(10 + Math.max(0, globalState.glucose - 100) * 0.6, 10, 100);
        const glucagonTarget = clamp(Math.max(0, 90 - globalState.glucose) * 2, 0, 100);
        // Sole owner of insulin/glucagon secretion and return toward baseline.
        globalState.insulin += (insulinTarget - globalState.insulin) * response;
        globalState.glucagon += (glucagonTarget - globalState.glucagon) * response;
    }

    getMetrics() {
        return {
            'Insulin signal': globalState.insulin.toFixed(1) + ' /100 AU',
            'Glucagon signal': globalState.glucagon.toFixed(1) + ' /100 AU',
            'Role': 'Signals only; no direct glucose removal'
        };
    }
}

export class LiverSystem extends OrganAgent {
    constructor() { super('Liver'); }

    process(dt) {
        const seconds = dt / 1000;
        let transfer = 0;
        if (globalState.glucose > 100) {
            transfer = Math.min(2 * seconds * globalState.insulin / 100,
                globalState.glucose - 100, 100 - organModelState.glycogen);
        } else if (globalState.glucose < 90) {
            transfer = -Math.min(2 * seconds * globalState.glucagon / 100,
                90 - globalState.glucose, organModelState.glycogen);
        }
        // An artificial 1:1 pool mapping conserves transfer in this toy model;
        // it is not a conversion from real glycogen mass to blood concentration.
        organModelState.glycogen += transfer;
        globalState.glucose -= transfer;
        organModelState.glucoseTransfer = seconds > 0 ? transfer / seconds : 0;
        // Constant protein turnover proxy. Not meal protein or a BUN estimate.
        organModelState.urea += 0.8 * seconds;
    }

    getMetrics() {
        const transfer = organModelState.glucoseTransfer;
        return {
            'Glycogen reserve': organModelState.glycogen.toFixed(1) + ' /100 AU',
            'Glucose transfer': (transfer >= 0 ? 'Storage ' : 'Release ') + Math.abs(transfer).toFixed(2) + ' AU/s',
            'Urea production': '0.80 AU/s (assumed)'
        };
    }
}

export class KidneySystem extends OrganAgent {
    constructor() { super('Kidneys'); }

    process(dt) {
        const seconds = dt / 1000;
        // An illustrative hydration dependence, not eGFR or renal blood flow.
        organModelState.clearance = clamp(globalState.hydrationLevel / 80, 0.2, 1);
        const removed = organModelState.urea * (1 - Math.exp(-0.04 * organModelState.clearance * seconds));
        organModelState.urea -= removed;
        organModelState.ureaRemoved = seconds > 0 ? removed / seconds : 0;
    }

    getMetrics() {
        return {
            'Shared urea pool': organModelState.urea.toFixed(2) + ' AU (not BUN)',
            'Clearance factor': organModelState.clearance.toFixed(2) + ' /1 (not eGFR)',
            'Urea removal': organModelState.ureaRemoved.toFixed(2) + ' AU/s'
        };
    }
}

export function createOrganSystems() {
    return [new PancreasSystem(), new LiverSystem(), new KidneySystem()];
}
