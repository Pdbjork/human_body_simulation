import { SystemAgent } from '../system-agent.js';
import { bus, globalState } from '../state.js';

/**
 * LymphaticSystem: Manages lymph circulation, waste filtration, and immune response coordination
 */
export class LymphaticSystem extends SystemAgent {
    constructor() {
        super('Lymphatic', 300); // Slow circulation
        this.lymphFlowRate = 2; // L/day baseline
        this.nodularActivity = 'Low';
        this.lymphCount = 50; // White blood cells
    }

    getIcon() { return '🌊'; }

    process(dt) {
        // Lymph flow increases with muscle activity and heart rate
        const heartRateIntensity = (globalState.heartRate - 70) / 60; // Normalize
        this.lymphFlowRate = Math.max(1, Math.min(4, 2 + heartRateIntensity));

        // Immune cells increase when threat detected or infection present
        if (globalState.threatDetected) {
            this.nodularActivity = 'Elevated (Threat Response)';
            this.lymphCount = Math.min(100, this.lymphCount + 1);
        } else if (globalState.inflammation > 30) {
            this.nodularActivity = 'Active (Fighting Infection)';
            this.lymphCount = Math.min(100, this.lymphCount + 0.5);
        } else {
            this.nodularActivity = 'Normal Patrol';
            this.lymphCount = Math.max(40, this.lymphCount - 0.2);
        }

        // Lymph aids in clearing toxins/waste
        globalState.toxinLevel = Math.max(0, globalState.toxinLevel - (this.lymphFlowRate * 0.1));
    }

    getMetrics() {
        return {
            'Flow Rate': this.lymphFlowRate.toFixed(1) + ' L/day',
            'Nodular Activity': this.nodularActivity,
            'Lymphocytes': Math.round(this.lymphCount) + ' K/μL'
        };
    }
}

/**
 * SensorySystem: Manages sensory input, pain, proprioception, and sensory integration
 */
export class SensorySystem extends SystemAgent {
    constructor() {
        super('Sensory', 30); // Fast response to stimuli
        this.visionAcuity = 100;
        this.painLevel = 0;
        this.proprioception = 80; // Balance/body awareness
        this.stressFromStimuli = 0;
    }

    getIcon() { return '👁️'; }

    process(dt) {
        // Pain is triggered by injury/inflammation
        if (globalState.inflammation > 50) {
            this.painLevel = Math.min(100, 50 + globalState.inflammation * 0.5);
            // High pain contributes to stress
            if (this.painLevel > 70) {
                bus.emit('threat-detected'); // Acute pain is a threat signal
                this.stressFromStimuli = 80;
            }
        } else {
            this.painLevel = Math.max(0, this.painLevel - 2);
            this.stressFromStimuli = Math.max(0, this.stressFromStimuli - 1);
        }

        // Vision degrades with fatigue
        const fatigueEffect = Math.max(0, (100 - globalState.atp) / 50);
        this.visionAcuity = Math.max(60, 100 - fatigueEffect * 20);

        // Proprioception (balance) decreases with high cortisol and fatigue
        this.proprioception = Math.max(50, 100 - (globalState.cortisol * 0.3) - fatigueEffect * 10);

        // Send pain and sensory info to global state
        globalState.painLevel = this.painLevel;
    }

    getMetrics() {
        let painClass = this.painLevel > 70 ? 'val-danger' : (this.painLevel > 30 ? 'val-warn' : 'val-ok');
        return {
            'Pain Level': `<span class="${painClass}">${Math.round(this.painLevel)}/100</span>`,
            'Vision Acuity': Math.round(this.visionAcuity) + '%',
            'Proprioception': Math.round(this.proprioception) + '%'
        };
    }
}

/**
 * ThermoregulationSystem: Maintains core body temperature through sweating, shivering, and vasodilation
 */
export class ThermoregulationSystem extends SystemAgent {
    constructor() {
        super('Thermoregulation', 100);
        this.coreTemp = 37.0; // °C
        this.skinTemp = 33.0; // °C
        this.sweatingRate = 0;
        this.isShivering = false;
    }

    getIcon() { return '🌡️'; }

    process(dt) {
        const targetTemp = 37.0;

        // Temperature increases with exercise and stress
        const metabolicHeat = (globalState.atp < 30 ? 0.2 : 0) + // Fatigue increases heat
                              (globalState.threatDetected ? 0.3 : 0) + // Stress raises temp
                              (globalState.adrenaline / 100) * 0.5; // Adrenaline increases heat

        this.coreTemp += metabolicHeat;

        // Passive cooling / environment effects
        this.coreTemp -= 0.05; // Natural cooling

        // Active thermoregulation
        if (this.coreTemp > targetTemp + 0.5) {
            this.sweatingRate = Math.min(2, (this.coreTemp - targetTemp) * 2); // Liters/hour
            globalState.hydrationLevel = Math.max(0, globalState.hydrationLevel - this.sweatingRate * 0.1);
        } else if (this.coreTemp < targetTemp - 0.5) {
            this.isShivering = true;
            this.sweatingRate = 0;
            globalState.atp -= 0.3; // Shivering burns energy
        } else {
            this.sweatingRate = Math.max(0, this.sweatingRate - 0.1);
            this.isShivering = false;
        }

        // Clamp temp
        this.coreTemp = Math.max(35, Math.min(40, this.coreTemp));
    }

    getMetrics() {
        let tempClass = this.coreTemp > 38.5 ? 'val-danger' : (this.coreTemp < 36 ? 'val-warn' : 'val-ok');
        const sweating = this.sweatingRate > 0 ? `${this.sweatingRate.toFixed(2)} L/h` : 'None';
        return {
            'Core Temp': `<span class="${tempClass}">${this.coreTemp.toFixed(1)}°C</span>`,
            'Sweating': sweating,
            'Shivering': this.isShivering ? 'Yes' : 'No'
        };
    }
}

/**
 * SleepCircadianSystem: Manages circadian rhythms, melatonin, and sleep pressure
 */
export class SleepCircadianSystem extends SystemAgent {
    constructor() {
        super('Sleep/Circadian', 500);
        this.sleepStage = 'Awake'; // Awake, Light, Deep, REM
        this.sleepPressure = 0; // 0-100 (builds up when awake)
        this.melatonin = 20; // ng/mL
        this.circadianPhase = 0; // 0-24 hours (simulated)
        this.timeAwake = 0; // seconds
    }

    getIcon() { return '😴'; }

    process(dt) {
        // Circadian rhythm (simulated 24-hour cycle every 5 minutes of sim time for testing)
        this.circadianPhase = (this.circadianPhase + dt / 12500) % 24; // 24-hour cycle

        // Melatonin follows circadian pattern (higher at night ~22:00-08:00)
        const hour = this.circadianPhase;
        const isNight = hour > 22 || hour < 8;
        if (isNight) {
            this.melatonin = Math.min(100, this.melatonin + 1);
        } else {
            this.melatonin = Math.max(10, this.melatonin - 0.5);
        }

        // Sleep pressure builds up when awake
        if (this.sleepStage === 'Awake') {
            this.timeAwake += dt / 1000; // Convert to seconds
            this.sleepPressure = Math.min(100, (this.timeAwake / 86400) * 100); // Max at 24hrs awake

            // If pressure too high and it's night-time, trigger sleep
            if (this.sleepPressure > 60 && isNight) {
                this.sleepStage = 'Light';
                globalState.atp = Math.min(100, globalState.atp + 1); // Sleep starts restoring ATP
            }
        } else {
            // During sleep, restore ATP and lower pressure
            this.sleepPressure = Math.max(0, this.sleepPressure - 0.5);
            globalState.atp = Math.min(100, globalState.atp + 2); // Sleep restores energy
            
            // Random stage changes during sleep
            if (Math.random() < 0.02) {
                const stages = ['Light', 'Deep', 'REM'];
                this.sleepStage = stages[Math.floor(Math.random() * stages.length)];
            }
        }

        // If awake during day and refreshed, wake up
        if (this.sleepPressure < 20 && !isNight) {
            this.sleepStage = 'Awake';
            this.timeAwake = 0;
        }
    }

    getMetrics() {
        const circadianDisplay = `${Math.floor(this.circadianPhase)}:00`;
        return {
            'Sleep Stage': this.sleepStage,
            'Sleep Pressure': Math.round(this.sleepPressure) + '%',
            'Circadian Time': circadianDisplay,
            'Melatonin': Math.round(this.melatonin) + ' ng/mL'
        };
    }
}

/**
 * ReproductiveSystem: Models hormonal cycles, testosterone, estrogen, progesterone
 */
export class ReproductiveSystem extends SystemAgent {
    constructor() {
        super('Reproductive', 600); // Slow hormonal changes
        this.cycle = 0; // 0-28 days (menstrual cycle simulation)
        this.testosterone = 6; // ng/dL (baseline for display)
        this.estrogen = 100; // pg/mL
        this.progesterone = 5; // ng/mL
        this.sexDrive = 50; // 0-100
        this.cyclePhase = 'Follicular';
    }

    getIcon() { return '🧬'; }

    process(dt) {
        // 28-day cycle simulation (28 seconds = 1 cycle for testing)
        this.cycle = (this.cycle + dt / 28000) % 28;

        // Hormone levels fluctuate throughout cycle
        // Follicular phase (0-14 days): estrogen rises
        if (this.cycle < 14) {
            this.cyclePhase = 'Follicular';
            this.estrogen = 100 + (this.cycle / 14) * 100; // Rises to peak
            this.progesterone = 5;
            this.testosterone = 4 + (this.cycle / 14) * 4; // Slight rise
        } 
        // Ovulation (14-16 days): peak estrogen and testosterone
        else if (this.cycle < 16) {
            this.cyclePhase = 'Ovulation';
            this.estrogen = 200;
            this.testosterone = 8; // Peak
            this.progesterone = 10;
            this.sexDrive = 75; // Higher during ovulation
        } 
        // Luteal phase (16-28 days): progesterone rises
        else {
            this.cyclePhase = 'Luteal';
            this.progesterone = 5 + ((this.cycle - 16) / 12) * 15; // Rises then falls
            this.estrogen = Math.max(70, 150 - (this.cycle - 16) * 5);
            this.testosterone = 5;
            this.sexDrive = Math.max(30, 50 + globalState.atp / 2 - globalState.cortisol * 0.3);
        }

        // Stress (cortisol) suppresses reproductive function
        if (globalState.cortisol > 70) {
            this.estrogen *= 0.8;
            this.progesterone *= 0.8;
            this.sexDrive = Math.max(0, this.sexDrive - 10);
        }

        // Contribute to overall endocrine state
        globalState.sexDrive = this.sexDrive;
    }

    getMetrics() {
        return {
            'Cycle Phase': this.cyclePhase,
            'Cycle Day': Math.round(this.cycle) + '/28',
            'Estrogen': Math.round(this.estrogen) + ' pg/mL',
            'Progesterone': this.progesterone.toFixed(1) + ' ng/mL',
            'Sex Drive': Math.round(this.sexDrive) + '%'
        };
    }
}
