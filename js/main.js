import { bus, globalState } from './state.js';
import { NervousSystem, CirculatorySystem, RespiratorySystem } from './systems/core_systems.js';
import { DigestiveSystem, EndocrineSystem, MusculoskeletalSystem } from './systems/metabolic_systems.js';
import { ImmuneSystem, ExcretorySystem, BrainSystem } from './systems/defense_systems.js';
import { Diagnoses, UserProfile } from './diagnoses.js';
import { HealthParser } from './health_parser.js';

class HumanSimulation {
    constructor() {
        this.systems = [];
        this.lastTime = 0;
        this.running = true;

        this.init();
    }

    init() {
        // Instantiate all systems
        this.systems.push(new NervousSystem());
        this.systems.push(new CirculatorySystem());
        this.systems.push(new RespiratorySystem());
        this.systems.push(new DigestiveSystem());
        this.systems.push(new EndocrineSystem());
        this.systems.push(new MusculoskeletalSystem());
        this.systems.push(new ImmuneSystem());
        this.systems.push(new ExcretorySystem());
        this.systems.push(new ExcretorySystem());
        this.systems.push(new BrainSystem());

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

        // --- Health Data & Diagnoses UI ---

        // Resting Heart Rate Input
        const rhrInput = document.getElementById('input-rhr');
        if (rhrInput) {
            rhrInput.value = UserProfile.restingHeartRate;
            rhrInput.onchange = (e) => {
                UserProfile.restingHeartRate = parseInt(e.target.value);
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
                div.innerHTML = `
                    <label>
                        <input type="checkbox" value="${diag.id}">
                        ${diag.name}
                    </label>
                `;
                const checkbox = div.querySelector('input');
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

        // Apple Health Import
        const fileInput = document.getElementById('health-file');
        const statusText = document.getElementById('import-status');

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                statusText.textContent = "Parsing XML... (This may take a moment)";
                statusText.className = "status-text";

                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const xmlContent = evt.target.result;
                        const parser = new HealthParser();
                        const data = parser.parse(xmlContent);

                        console.log("Parsed Health Data:", data);

                        if (data.restingHeartRate) {
                            UserProfile.restingHeartRate = data.restingHeartRate;
                            // Update UI
                            if (rhrInput) rhrInput.value = data.restingHeartRate;

                            // Reset Sim
                            if (!globalState.threatDetected && globalState.atp > 50) {
                                globalState.heartRate = UserProfile.restingHeartRate;
                            }
                        }

                        if (data.averageSteps > 0) {
                            // Simple logic: > 8000 steps = fit
                            UserProfile.fitnessLevel = data.averageSteps > 8000 ? 1.5 : (data.averageSteps > 4000 ? 1.0 : 0.8);
                        }

                        statusText.textContent = `✅ Imported! RHR: ${data.restingHeartRate} | Avg Steps: ${data.averageSteps}`;
                        statusText.className = "status-text success";

                    } catch (err) {
                        console.error(err);
                        statusText.textContent = "❌ Error parsing file.";
                        statusText.className = "status-text error";
                    }
                };
                reader.readAsText(file);
            };
        }
    }

    startLoop() {
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;

        // Update all systems
        this.systems.forEach(sys => sys.update(deltaTime, timestamp));

        // Update global UI
        this.updateGlobalUI(timestamp);

        this.lastTime = timestamp;
        if (this.running) requestAnimationFrame((t) => this.loop(t));
    }

    updateGlobalUI(timestamp) {
        // Occasionally update global stats (every 500ms approx)
        if (Math.floor(timestamp / 500) > Math.floor(this.lastTime / 500)) {
            document.getElementById('global-state').textContent = globalState.threatDetected ? 'STRESS RESPONSE' : 'Nominal';
            document.getElementById('global-state').className = globalState.threatDetected ? 'value val-danger' : 'value val-ok';

            // Simple homeostasis score calc
            let score = 100;
            if (globalState.threatDetected) score -= 30;
            if (globalState.heartRate > 100) score -= 10;
            if (globalState.atp < 50) score -= 10;

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
window.app = new HumanSimulation();
