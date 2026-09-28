/**
 * Simple Pub/Sub Event Bus for decoupling systems
 */
class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const bus = new EventBus();

/**
 * Shared Global State
 * Systems can read this, but should try to communicate via events.
 */
export const globalState = {
    // Top level flags
    isAlive: true,
    threatDetected: false,

    // Core physiological vars (simplified shared access)
    heartRate: 70,     // bpm
    breathingRate: 14, // bpm
    temperature: 37.0, // Celsius

    // Resources
    glucose: 100,      // mg/dL (approx)
    atp: 100,          // %
    o2Saturation: 98,  // %
    co2Level: 40,      // mmHg

    // Hormones (0-100 scales for simplicity)
    adrenaline: 0,
    cortisol: 0,
    insulin: 10,
    glucagon: 0,

    // NEW: Advanced system variables
    toxinLevel: 0,         // 0-100 (accumulated metabolic waste)
    inflammation: 0,       // 0-100 (immune response level)
    hydrationLevel: 80,    // 0-100 (% hydration)
    painLevel: 0,          // 0-100 (pain perception)
    sexDrive: 50,          // 0-100 (libido)
    lymphCount: 50,        // K/μL (immune cells)
    
    // Calculated fields based on modifiers
    modifiers: {}
};

// Log state changes for debug
bus.on('global-state-update', (changes) => {
    Object.assign(globalState, changes);
});

