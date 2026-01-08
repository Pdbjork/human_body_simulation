/**
 * Definitions of medical diagnoses and their effects on the system.
 */
export const Diagnoses = {
    hypertension: {
        id: 'hypertension',
        name: 'Hypertension',
        description: 'Chronic high blood pressure',
        modifiers: {
            // Keys correspond to globalState properties or specific system logic
            baseBpSystolic: 20, // Add 20 to base
            baseBpDiastolic: 10,
            cardiacStressMultiplier: 1.2
        }
    },
    diabetes_t2: {
        id: 'diabetes_t2',
        name: 'Type 2 Diabetes',
        description: 'Insulin resistance and high blood sugar',
        modifiers: {
            insulinSensitivity: 0.3, // 30% effectiveness
            baseGlucose: 30, // Higher baseline
        }
    },
    asthma: {
        id: 'asthma',
        name: 'Asthma',
        description: 'Airway inflammation affecting breathing',
        modifiers: {
            airwayResistance: 2.0, // Harder to breathe
            attackChance: 0.05 // Chance to trigger constriction on stress/exercise
        }
    },
    anxiety: {
        id: 'anxiety',
        name: 'Generalized Anxiety',
        description: 'Heightened stress response',
        modifiers: {
            baseCortisol: 15,
            stressResponseMultiplier: 2.0,
            restingHeartRate: 10
        }
    }
};

export const UserProfile = {
    // Defaults
    restingHeartRate: 70,
    fitnessLevel: 1.0, // 1.0 = average, 1.5 = athlete
    sleepQuality: 1.0,  // 1.0 = good, 0.5 = poor

    // Personality
    personality: {
        neuroticism: 0.5, // 0-1: reaction to stress
        stoicism: 0.5,    // 0-1: suppression of symptoms
        optimism: 0.5     // 0-1: recovery speed bias
    },

    // Active diagnoses IDs
    diagnoses: new Set()
};
