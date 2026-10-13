import { bus, globalState } from './state.js';
import { NervousSystem, CirculatorySystem, RespiratorySystem } from './systems/core_systems.js';
import { DigestiveSystem, EndocrineSystem, MusculoskeletalSystem } from './systems/metabolic_systems.js';
import { ImmuneSystem, ExcretorySystem, BrainSystem } from './systems/defense_systems.js';
import { LymphaticSystem, SensorySystem, ThermoregulationSystem, SleepCircadianSystem, ReproductiveSystem } from './systems/advanced_systems.js';
import { Diagnoses, UserProfile } from './diagnoses.js';
import { mountWorkspaces } from './workspaces.js';
import { createOrganSystems } from './anatomy-workspace.js';
import './avatar.js'; // Initialize Avatar Bridge

class HumanSimulation {
    constructor() {
        this.systems = [];
        this.lastTime = 0;
        this.running = true;
        this.frameId = null;

        this.init();
    }

    init() {
        // Instantiate CORE systems
        this.systems.push(new NervousSystem());
        this.systems.push(new CirculatorySystem());
        this.systems.push(new RespiratorySystem());
        this.systems.push(new DigestiveSystem());
        this.systems.push(new EndocrineSystem());
        this.systems.push(new MusculoskeletalSystem());
        this.systems.push(new ImmuneSystem());
        this.systems.push(new ExcretorySystem());
        this.systems.push(new BrainSystem());

        // Instantiate NEW ADVANCED systems
        this.systems.push(new LymphaticSystem());
        this.systems.push(new SensorySystem());
        this.systems.push(new ThermoregulationSystem());
        this.systems.push(new SleepCircadianSystem());
        this.systems.push(new ReproductiveSystem());
        this.systems.push(...createOrganSystems());

        // Link globally for debugging
        globalState.userProfile = UserProfile;
        globalState.activeConditions = UserProfile.diagnoses;

        this.setupControls();
        this.startLoop();
    }

    setupControls() {
        document.getElementById('btnThreat').onclick = () => {
            const isThreat = !globalState.threatDetected;
            bus.emit(isThreat ? 'threat-detected' : 'threat-cleared');

            // Toggle button text/style
            const btn = document.getElementById('btnThreat');
            if (isThreat) {
                btn.textContent = "🛑 Clear Threat";
                btn.classList.add('active');
            } else {
                btn.textContent = "🚨 Threat (Fight/Flight)";
                btn.classList.remove('active');
            }
        };

        document.getElementById('btnFood').onclick = () => {
            bus.emit('ingest-food');
        };

        document.getElementById('btnRest').onclick = () => {
            bus.emit('threat-cleared'); // Force clear threat
            bus.emit('stop-exercise');
            document.getElementById('btnThreat').textContent = "🚨 Threat (Fight/Flight)";
        };

        document.getElementById('btnExercise').onclick = () => {
            bus.emit('start-exercise');
        };
        const pause = document.getElementById('btnPause');
        pause.onclick = () => {
            this.running = !this.running;
            pause.setAttribute('aria-pressed', String(!this.running));
            pause.textContent = this.running ? 'Pause simulation' : 'Resume simulation';
            if (this.running) {
                this.lastTime = 0;
                this.startLoop();
            } else {
                cancelAnimationFrame(this.frameId);
            }
        };

        // --- Health Data & Diagnoses UI ---

        // Resting Heart Rate Input
        const rhrInput = document.getElementById('input-rhr');
        if (rhrInput) {
            rhrInput.value = UserProfile.restingHeartRate;
            rhrInput.onchange = (e) => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value) || value < 20 || value > 250) {
                    e.target.value = UserProfile.restingHeartRate;
                    return;
                }
                UserProfile.restingHeartRate = value;
                // Reset HR to new baseline if resting
                if (!globalState.threatDetected && globalState.atp > 50) {
                    globalState.heartRate = UserProfile.restingHeartRate;
                }
            };
        }

        // Diagnoses Checkboxes
        const diagContainer = document.getElementById('diagnoses-list');
        if (diagContainer) {
            diagContainer.innerHTML = ''; // clear placeholder
            Object.values(Diagnoses).forEach(diag => {
                const div = document.createElement('div');
                div.className = 'diag-item';

                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = diag.id;

                const name = document.createElement('span');
                name.textContent = diag.name;

                label.append(checkbox, name);
                div.appendChild(label);

                checkbox.onchange = (e) => {
                    if (e.target.checked) {
                        UserProfile.diagnoses.add(diag.id);
                    } else {
                        UserProfile.diagnoses.delete(diag.id);
                    }
                };
                diagContainer.appendChild(div);
            });
        }

        window.addEventListener('body-health-updated', event => {
            const profile = event.detail;
            const baseline = profile?.consent && Number.isFinite(profile.restingHeartRate) ? profile.restingHeartRate : 70;
            UserProfile.restingHeartRate = baseline;
            if (rhrInput) rhrInput.value = baseline;
            globalState.heartRate = baseline;
        });
        window.addEventListener('body-clear-personal-data', () => {
            UserProfile.restingHeartRate = 70;
            UserProfile.fitnessLevel = 1;
            UserProfile.sleepQuality = 1;
            UserProfile.diagnoses.clear();
            if (rhrInput) rhrInput.value = 70;
            diagContainer?.querySelectorAll('input').forEach(input => { input.checked = false; });
            bus.emit('threat-cleared');
            bus.emit('stop-exercise');
            globalState.heartRate = 70;
            document.getElementById('btnThreat').textContent = 'Threat (Fight/Flight)';
            document.getElementById('btnThreat').classList.remove('active');
        });
    }

    startLoop() {
        this.frameId = requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;

        // Update all systems
        this.systems.forEach(sys => sys.update(deltaTime, timestamp));

        // Update global UI
        this.updateGlobalUI(timestamp);

        this.lastTime = timestamp;
        if (this.running) this.frameId = requestAnimationFrame((t) => this.loop(t));
    }

    updateGlobalUI(timestamp) {
        // Occasionally update global stats (every 500ms approx)
        if (Math.floor(timestamp / 500) > Math.floor(this.lastTime / 500)) {
            document.getElementById('global-state').textContent = globalState.threatDetected ? 'STRESS RESPONSE' : 'Nominal';
            document.getElementById('global-state').className = globalState.threatDetected ? 'value val-danger' : 'value val-ok';

            // Enhanced homeostasis score calculation
            let score = 100;
            if (globalState.threatDetected) score -= 30;
            if (globalState.heartRate > 100) score -= 10;
            if (globalState.atp < 50) score -= 10;
            if (globalState.inflammation > 50) score -= 15;
            if (globalState.painLevel > 70) score -= 15;
            if (globalState.hydrationLevel < 50) score -= 10;

            document.getElementById('homeostasis-score').textContent = Math.max(0, score) + '%';
            document.getElementById('sim-tick').textContent = Math.floor(timestamp / 1000);

            this.updateVisualization();
        }
    }

    updateVisualization() {
        const viz = document.querySelector('.body-outline');
        if (globalState.threatDetected) {
            viz.classList.add('stressed');
            viz.classList.remove('resting');
        } else {
            viz.classList.add('resting');
            viz.classList.remove('stressed');
        }
    }
}



// Start app
mountWorkspaces();
window.app = new HumanSimulation();
