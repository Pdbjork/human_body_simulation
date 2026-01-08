import { globalState, bus } from './state.js';

/**
 * AvatarBridge: Mediation layer between the biological simulation and the personality layer.
 */
export class AvatarBridge {
    constructor() {
        this.ctx = {
            mood: 'Neutral',
            physicalSensation: 'Normal',
            dominantUrge: 'None'
        };

        // Listen to bio events to update mood
        this.startMonitoring();
    }

    startMonitoring() {
        // Poll every second to update "Qualia" (Subjective experience)
        setInterval(() => this.updateSubjectiveExperience(), 1000);
    }

    updateSubjectiveExperience() {
        const { heartRate, adrenaline, cortisol, atp, glucose } = globalState;

        // Determine Mood
        if (globalState.threatDetected) {
            this.ctx.mood = 'Panicked';
            this.ctx.physicalSensation = 'Heart racing, muscles tense';
            this.ctx.dominantUrge = 'Run or Fight';
        } else if (atp < 30) {
            this.ctx.mood = 'Exhausted';
            this.ctx.physicalSensation = 'Heavy limbs, mental fog';
            this.ctx.dominantUrge = 'Sleep';
        } else if (glucose < 60) {
            this.ctx.mood = 'Hangry'; // Irritable
            this.ctx.physicalSensation = 'Empty stomach, shaky';
            this.ctx.dominantUrge = 'Eat';
        } else if (adrenaline > 40) {
            this.ctx.mood = 'Anxious / Wired';
            this.ctx.physicalSensation = 'Jittery energy';
        } else {
            this.ctx.mood = 'Calm';
            this.ctx.physicalSensation = 'Comfortable';
            this.ctx.dominantUrge = 'None';
        }

        // Notify UI or Chatbot if mood changed significantly
        // (For now just log or expose)
    }

    /**
     * Get a natural language context summary for the LLM.
     */
    getContext() {
        return `Current State:
        - Mood: ${this.ctx.mood}
        - Feeling: ${this.ctx.physicalSensation}
        - Urge: ${this.ctx.dominantUrge}
        - Biology: HR ${globalState.heartRate}, Energy ${Math.round(globalState.atp)}%`;
    }

    /**
     * Actions the Avatar can take to influence the body
     */
    performAction(actionId) {
        console.log(`Avatar performing: ${actionId}`);
        switch (actionId) {
            case 'deep_breath':
                bus.emit('threat-cleared'); // Force calm
                globalState.breathingRate = 6; // Slow deep breath
                break;
            case 'psych_up':
                bus.emit('request-hormone', { type: 'adrenaline', amount: 30 });
                break;
            case 'meditate':
                bus.emit('stop-exercise');
                globalState.brain.focus = 100;
                break;
        }
    }
}

export const avatar = new AvatarBridge();
window.avatar = avatar; // Expose for debug
