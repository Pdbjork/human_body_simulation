// Educational routing only: these English-language rules are not a validated
// symptom checker. Structured safety answers supplement, not validate, text cues.
export const ASSISTANT_REVIEWED_AT = '2026-09-27';
export const ASSISTANT_SOURCES = Object.freeze({
    emergency: { title: 'MedlinePlus: Recognizing medical emergencies', url: 'https://medlineplus.gov/ency/article/001927.htm' },
    chest: { title: 'MedlinePlus: Chest pain', url: 'https://medlineplus.gov/ency/article/003079.htm' },
    fatigue: { title: 'MedlinePlus: Fatigue', url: 'https://medlineplus.gov/ency/article/003088.htm' },
    headache: { title: 'MedlinePlus: Headache', url: 'https://medlineplus.gov/headache.html' },
    digestion: { title: 'MedlinePlus: Abdominal pain', url: 'https://medlineplus.gov/ency/article/003120.htm' },
    exercise: { title: 'MedlinePlus: Physical activity', url: 'https://medlineplus.gov/ency/article/001941.htm' },
    stress: { title: 'MedlinePlus: Learn to manage stress', url: 'https://medlineplus.gov/ency/article/001942.htm' },
    medication: { title: 'MedlinePlus: Taking multiple medicines safely', url: 'https://medlineplus.gov/ency/patientinstructions/000883.htm' },
    wearable: { title: 'FDA: Pulse Oximeter Basics', url: 'https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics' },
    crisis: { title: '988 Suicide & Crisis Lifeline (United States)', url: 'https://988lifeline.org/' },
    international: { title: 'Find A Helpline: choose your country', url: 'https://findahelpline.com/' }
});

export const ASSISTANT_TOPICS = Object.freeze({
    cardio: 'Heart / breathing',
    fatigue: 'Fatigue / sleep',
    headache: 'Headache',
    digestion: 'Digestion / abdominal discomfort',
    exercise: 'Exercise / wearables',
    stress: 'Stress / mood'
});

const TOPIC_CUES = {
    cardio: /\b(?:chest|heart|palpitations?|breath\w*|wheez\w*|cough\w*)\b/i,
    fatigue: /\b(?:fatigu\w*|tired\w*|exhaust\w*|sleep\w*|insomnia|snor\w*|low energy)\b/i,
    headache: /\b(?:headaches?|migraine\w*|head (?:hurts|pain))\b/i,
    digestion: /\b(?:stomach\w*|belly|abdom\w*|digest\w*|nause\w*|vomit\w*|diarrh\w*|constipat\w*|bloat\w*|reflux|heartburn)\b/i,
    exercise: /\b(?:exercis\w*|workout\w*|walking|running|steps?|wearable\w*|fitness|oximet\w*|oxygen|spo2|watch|training)\b/i,
    stress: /\b(?:stress\w*|anxi\w*|panic\w*|mood|sad\w*|depress\w*|overwhelm\w*|lonely|worr\w*)\b/i
};
const ASSERTED_TOPICS = Object.entries(TOPIC_CUES).map(([topic, cue]) => [topic, [new RegExp(cue.source, 'gi')]]);

const EMERGENCY_CUES = [
    /\b(?:chest (?:pain|pressure|tightness|discomfort)|(?:pain|pressure|tightness) in (?:my |the )?chest|(?:crushing|tight) chest|(?:my )?chest (?:hurts|feels tight))\b/gi,
    /\b(?:can(?:not|'t|t) breathe|(?:difficulty|trouble) breathing|(?:struggling|gasping) (?:for air|to breathe)|short(?:ness)? of breath|blue lips|bluish lips|severe (?:wheezing|breathlessness)|(?:can't|cannot) catch (?:my |a )?breath)\b/gi,
    /\b(?:face droop\w*|facial droop\w*|slurred speech|one[- ]sided (?:weakness|numbness)|(?:sudden|new) (?:confusion|vision loss|loss of vision)|can(?:not|'t|t) (?:speak|move (?:my )?arm))\b/gi,
    /\b(?:faint(?:ed|ing)?|passed out|unconscious|seizures?|coughing (?:up )?blood|vomiting blood|blood in (?:my )?(?:vomit|stool)|(?:black|tarry) stools?|bleeding (?:that )?(?:won't|will not|doesn't|does not) stop)\b/gi,
    /\b(?:swollen (?:tongue|throat)|(?:tongue|throat|face) (?:is )?swelling|anaphylaxis|choking|overdos\w*|poison(?:ed|ing)?|took too (?:many|much) (?:pills?|tablets?|medicin\w*|medication\w*))\b/gi,
    /\b(?:(?:sudden|severe|worst|thunderclap)(?:\s+\w+){0,3}\s+headache|headache(?:\s+\w+){0,4}\s+(?:stiff neck|head injury)|(?:sudden|severe)(?:\s+\w+){0,2}\s+(?:abdominal|belly|stomach) pain)\b/gi
];
const CRISIS_CUES = [
    /\b(?:suicid\w*|self[- ]harm\w*|kill (?:myself|yourself|himself|herself|themselves)|(?:hurt|harm|cut)(?:ting)? (?:myself|yourself|someone|others)|end (?:my|your) life|want to die|wish (?:i (?:was|were) dead|to die)|(?:don't|do not|dont) want to (?:live|be alive)|better off dead|can't go on|cannot go on|can(?:not|'t|t) (?:keep myself|stay) safe)\b/gi
];
const MEDICATION_CUES = /\b(?:medicat\w*|medicin\w*|prescri\w*|dos(?:e|es|age|ing)|pills?|tablets?|drug\w*|supplement\w*|antibiotic\w*|insulin|aspirin|ibuprofen|paracetamol|acetaminophen|metformin|warfarin|sertraline|antidepressant\w*|beta[- ]blocker\w*)\b/i;
const OUT_OF_SCOPE_CUES = /\b(?:diagnos\w*|cancer|tumou?r|rash|moles?|kidney|urine|urinary|infection|scan|mri|x[- ]?ray|ct scan|radiology|blood test|lab results?|ecg|ekg|surgery|vaccine\w*|fertility|genetic\w*)\b/i;
const FOLLOWUP_CUES = /^(?:yes|no|thanks?|thank you|(?:it(?:'s| is)?\s+)?(?:mild|moderate|severe|stable|improving|worse|worsening)|(?:for |about |since )?(?:(?:a|one|two|three|four|five|six|seven|several|few|\d+)\s+)?(?:hours?|days?|weeks?|months?|yesterday)|what (?:should|can) i do\??)[.!?]?$/i;

function normalize(text) {
    return String(text ?? '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'");
}

// Only a narrow, direct denial is ignored. Ambiguous language still routes to
// human help. This deliberately cannot understand all negations or timelines.
function hasConcern(text, patterns) {
    return patterns.some(pattern => {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
            const prefix = text.slice(Math.max(0, match.index - 60), match.index);
            if (!/\b(?:no|not|without|denies|denying)\s+(?:(?:any|a|current|having|experiencing)\s+){0,2}$/.test(prefix)) return true;
        }
        return false;
    });
}

function response(kind, title, paragraphs, actions = [], questions = [], sourceIds = [], topic = null) {
    return { kind, title, paragraphs, actions, questions, sourceIds: [...new Set(sourceIds)], topic };
}

const SAFETY_NET = 'This cannot rule out illness or emergencies. If symptoms become sudden, severe, or rapidly worse, or you feel unsafe, seek urgent medical help. Do not wait for another reply.';
const MEDICATION_BOUNDARY = 'Do not start, stop, double, or change a medicine or oxygen dose based on this assistant. Ask your prescriber or pharmacist about doses, missed doses, interactions, and side effects.';
const CRISIS_ACTIONS = [
    'If you might act on thoughts of harming yourself or someone else, have taken an overdose, or cannot stay safe: call your local emergency number or go to the nearest emergency department now. This app cannot contact help.',
    'In the United States, call or text 988 for immediate crisis support. Outside the US, use a local crisis line or Find A Helpline to choose your country; 988 is not a worldwide number.',
    'If possible, stay with a trusted person and move away from things you could use to hurt yourself. Tell that person you need help staying safe.'
];

const EDUCATION = {
    cardio: {
        explanation: 'Palpitations or cough can have many causes, including medicines, stimulants, infections, or heart and lung problems. Text and wearable readings cannot distinguish them. Chest discomfort or difficulty breathing needs urgent assessment, not an assumption of anxiety.',
        actions: ['Contact a clinician promptly for new or unexplained heart or breathing symptoms, even if intermittent. Stop strenuous activity until the symptoms have been assessed.', 'Note when symptoms occur, whether they occur at rest or during activity, and any fever or dizziness. Share this with your clinician.'],
        questions: ['Are symptoms present now, brought on by activity, or associated with chest discomfort, faintness, or breathing difficulty?'],
        sources: ['chest', 'emergency']
    },
    fatigue: {
        explanation: 'Poor sleep and stress can contribute to fatigue. Medicines, anemia, thyroid problems, infection, and sleep disorders are other possibilities a clinician may consider; none is diagnosed here.',
        actions: ['Keep a consistent sleep/wake routine and regular meals. Avoid using stimulants, alcohol, or sedatives to treat fatigue. Do not drive if sleepy.', 'Arrange a clinician appointment if fatigue persists despite rest, interferes with daily life, or comes with weight change, fever, or snoring/gasping during sleep.'],
        questions: ['Is this sleepiness or a lack of energy? Has sleep been refreshing, and does anyone notice loud snoring or pauses in breathing?'],
        sources: ['fatigue', 'stress']
    },
    headache: {
        explanation: 'Tension-type headache and migraine are possibilities, but this tool cannot identify the cause or exclude a serious condition. A sudden severe headache, neurological change, fever with stiff neck, or headache after head injury needs immediate medical help.',
        actions: ['For mild, familiar symptoms without warning signs, take a screen break, rest in a quiet place, and keep regular meals and your usual hydration within any clinician-set fluid limit.', 'Contact a clinician for a new pattern, recurrent headaches, or symptoms that persist or worsen. Do not rely on this tool to select pain medicine.'],
        questions: ['Is this a familiar pattern or a new headache? Did it start suddenly, follow a head injury, or occur with fever, stiff neck, weakness, or vision changes?'],
        sources: ['headache', 'emergency']
    },
    digestion: {
        explanation: 'Indigestion, constipation, and infection are among many possible causes of abdominal symptoms. Pain intensity alone cannot show how serious the cause is; even mild pain may need assessment.',
        actions: ['For mild symptoms without warning signs, small sips of fluid may help if tolerated and not against a clinician-set fluid restriction. Avoid foods that clearly aggravate your symptoms; do not start medicines based on this chat.', 'Seek prompt medical advice for persistent or localized pain, fever, repeated vomiting, or inability to keep liquids down. Sudden severe pain, blood in vomit or stool, a rigid belly, or pain with possible pregnancy needs immediate medical help.'],
        questions: ['Where is the discomfort? Can you keep fluids down, and is there fever, blood, repeated vomiting, or a chance of pregnancy?'],
        sources: ['digestion', 'emergency']
    },
    exercise: {
        explanation: 'Step counts, pulse, sleep estimates, and oxygen estimates provide context, not a diagnosis or fitness score. Device accuracy varies. A normal-looking reading cannot exclude a medical emergency.',
        actions: ['If you feel well, choose an enjoyable activity within your current ability and increase gradually. Check with your clinician before starting a new program if you have a long-term condition or have been inactive.', 'Stop activity and seek help for chest discomfort, faintness, or unusual breathlessness. Follow device instructions; discuss concerning readings and symptoms with a clinician rather than changing treatment.'],
        questions: ['Are you asking about an activity goal or a particular measured reading? Was it taken at rest, when, and with what device?'],
        sources: ['exercise', 'wearable', 'emergency']
    },
    stress: {
        explanation: 'Stress can affect sleep, mood, and physical comfort. These symptoms do not by themselves establish anxiety or depression, and new physical symptoms must not be dismissed as stress.',
        actions: ['Consider a small manageable break, naming things you can see around you, or contacting someone you trust. Keep a regular sleep routine when possible; use the separate mental wellbeing workspace for a private check-in.', 'If distress persists, feels unmanageable, or interferes with daily activities, contact a mental health professional or primary care clinician. Crisis support is available even when you are unsure whether it is an emergency.'],
        questions: ['What has changed recently, and how is this affecting daily life? Are you able to stay safe right now?'],
        sources: ['stress', 'crisis', 'international']
    }
};

function missingContext(context) {
    const questions = [];
    if (!context.duration || context.duration === 'unknown') questions.push('How long has this been happening? Choose a duration below; say if it began suddenly.');
    if (!context.severity || context.severity === 'unknown') questions.push('How much does it affect your normal activities? Choose mild, moderate, or severe, or tell a clinician if you are unsure.');
    if (!context.physicalSafety || context.physicalSafety === 'unknown') questions.push('Review the physical warning signs below. Are any happening now? If unsure and unwell, seek urgent help rather than waiting.');
    if (!context.selfHarm || context.selfHarm === 'unknown') questions.push('Are there thoughts of harming yourself or someone else, or difficulty staying safe? Use the safety selector below.');
    if (!context.ageGroup || context.ageGroup === 'unknown') questions.push('Is this about an adult or someone under 18? This tool does not assess children.');
    if (!context.pregnancy || context.pregnancy === 'unknown') questions.push('Could pregnancy or a recent birth apply? If you prefer not to answer, seek personalized advice from a clinician.');
    if (!context.conditions || context.conditions === 'unknown') questions.push('Is there a serious medical condition or reduced immunity? Do not use fictional simulation checkboxes as your medical history.');
    return questions;
}

function wearableNotes(health, topic) {
    if (!health?.consent) return [];
    const notes = ['You opted to include your applied health baseline. It is self-reported or imported, not clinically verified; no simulated values are used. It cannot lower the urgency of symptoms.'];
    if (health.observedAt) notes.push(`Baseline observation timestamp: ${health.observedAt}. This may not represent your current state.`);
    else notes.push('The baseline has no observation timestamp. Its recency is unknown.');
    if ((topic === 'fatigue' || topic === 'stress') && Number.isFinite(health.sleepHours)) {
        notes.push(`Your baseline lists ${health.sleepHours} hours of sleep. A sleep estimate does not show sleep quality or explain fatigue. A consistent routine may help; persistent tiredness needs clinical review.`);
    }
    if (topic === 'exercise' && Number.isFinite(health.averageSteps)) {
        notes.push(`Your baseline lists ${health.averageSteps} average daily steps. There is no universal step target here, and this number is not used to infer your fitness or diagnose disease.`);
    }
    if (Number.isFinite(health.restingHeartRate)) notes.push(`Your baseline resting pulse is ${health.restingHeartRate} beats/min. A single pulse value cannot establish or exclude a heart condition; discuss unexpected readings with a clinician.`);
    if (Number.isFinite(health.oxygenSaturation)) notes.push(`Your baseline oxygen estimate is ${health.oxygenSaturation}%. Pulse oximeters can be inaccurate, including across skin pigmentations. Follow your existing care plan and contact a clinician about a concerning reading; do not delay help for symptoms or change oxygen treatment.`);
    if (health.warnings?.length) notes.push('Your imported baseline carries data-quality warnings. Review them in the health data workspace before relying on those measurements.');
    return notes;
}

/** No network, persistence, simulation state, or probabilistic diagnoses. */
export function assessHealthConcern({ messages = [], context = {}, consent = false, useHealthContext = false, healthContext = null } = {}) {
    if (!consent) return response('consent', 'Consent is needed', ['Enable private session processing before entering personal information. Emergency resources remain available without consent.']);
    const text = normalize(messages.join('\n'));
    const latest = normalize(messages.at(-1) ?? '').trim();
    const selectedTopic = Object.hasOwn(ASSISTANT_TOPICS, context.topic) ? context.topic : null;
    const latestTopic = ASSERTED_TOPICS.find(([, cues]) => hasConcern(latest, cues))?.[0];
    const previousTopic = ASSERTED_TOPICS.find(([, cues]) => hasConcern(text, cues))?.[0];
    const topic = selectedTopic ?? latestTopic ?? (FOLLOWUP_CUES.test(latest) ? previousTopic : null) ?? null;
    const immediateHarm = context.selfHarm === 'immediate' || hasConcern(text, [/\bcan(?:not|'t|t) (?:keep myself|stay) safe\b/gi]);
    const crisis = context.selfHarm === 'thoughts' || immediateHarm || hasConcern(text, CRISIS_CUES);
    const headacheDanger = TOPIC_CUES.headache.test(text) && hasConcern(text, [/\b(?:stiff neck|head injury|hit (?:my |the )?head|fever|vision (?:loss|changes?))\b/gi]);
    const pregnancy = context.pregnancy === 'yes' || hasConcern(text, [/\b(?:pregnant|postpartum|recently gave birth)\b/gi]);
    const abdominalPregnancy = TOPIC_CUES.digestion.test(text) && pregnancy;
    const emergency = context.physicalSafety === 'yes' || immediateHarm || hasConcern(text, EMERGENCY_CUES) || headacheDanger || abdominalPregnancy || ((topic === 'headache' || topic === 'digestion') && context.severity === 'severe');
    if (emergency) {
        return response('emergency', 'Get urgent help now — do not wait for this chat', [
            'A safety answer or phrase in this conversation may describe a medical emergency. I cannot tell the cause, whether it is current, or whether you are safe.',
            'If these signs are happening now or have just happened, call your local emergency number (for example, 911 in the US or 112 in much of Europe). Do not drive yourself. If this was only a past event, contact a clinician promptly to clarify what happened.',
            'Normal wearable readings and the toy simulation cannot rule out an emergency. This app cannot monitor you or call for help.'
        ], [...(crisis ? CRISIS_ACTIONS : []), MEDICATION_BOUNDARY], [], ['emergency', ...(headacheDanger ? ['headache'] : []), ...(abdominalPregnancy ? ['digestion'] : []), ...(crisis ? ['crisis', 'international'] : [])], topic);
    }
    if (crisis) return response('crisis', 'You deserve support from a person now', [
        'Your words or safety answer may describe thoughts of self-harm or harm to someone else. I cannot assess your immediate safety through this chat. Please connect with a crisis counselor or a trusted person now.'
    ], CRISIS_ACTIONS, ['Are you in immediate danger or unable to stay safe? If yes or unsure, use emergency help now rather than answering here.'], ['crisis', 'international', 'emergency'], topic);

    const highRisk = context.ageGroup === 'child' || pregnancy || context.conditions === 'yes' || hasConcern(text, [/\b(?:my (?:baby|toddler|child|infant)|my \d+[- ]year[- ]old|(?:i am|i'm) (?:[1-9]|1[0-7]) years? old|immunocompromised|immunosuppressed|chemotherapy|heart failure|kidney failure)\b/gi]);
    const worsening = context.course === 'worsening' || hasConcern(text, [/\b(?:getting worse|rapidly worsening|severe symptoms|unbearable pain)\b/gi]);
    if (context.severity === 'severe' || worsening || highRisk) {
        return response('urgent', 'Use a clinician-led assessment', [
            context.severity === 'severe' || worsening ? 'You reported severe or worsening symptoms. Seek urgent medical advice today; do not rely on self-care guidance from this assistant.' : 'Children, pregnancy/recent birth, and serious conditions or reduced immunity need individualized assessment. This assistant does not safely tailor treatment for those circumstances.',
            'For new or concerning symptoms, contact your clinician or local urgent care promptly. For a child, involve a parent or trusted caregiver when safe. For pregnancy or after birth, contact your maternity team.',
            SAFETY_NET
        ], [MEDICATION_BOUNDARY], [], ['emergency', 'medication', ...(topic ? EDUCATION[topic].sources : [])], topic);
    }
    if (MEDICATION_CUES.test(text)) return response('medication', 'A pharmacist or prescriber must guide medicines', [
        'I cannot recommend a medicine, calculate a dose, check interactions reliably, or decide whether you should start or stop treatment. Simulation results and wearable measurements are not prescribing information.',
        'For a missed dose, suspected side effect, or dose question, contact your pharmacist or prescriber and use the specific written instructions for that medicine. Have the medicine name, strength, timing, and other medicines/supplements available for them.',
        'If you may have taken too much or the wrong medicine, contact your local poison service or urgent medical service immediately; do not wait for symptoms. Call emergency services for collapse, seizures, breathing difficulty, or inability to stay awake.',
        SAFETY_NET
    ], [MEDICATION_BOUNDARY], [], ['medication', 'emergency'], topic);

    if (!topic || OUT_OF_SCOPE_CUES.test(latest)) return response('unknown', 'This question is outside my reliable scope', [
        'I do not have a supported educational response for this question. I cannot diagnose, interpret scans or laboratory results, or invent an explanation. Contact a qualified clinician for medical concerns, or a pharmacist for medicine questions.',
        'I cover heart/breathing symptoms, fatigue/sleep, headache, digestion, exercise/wearables, and stress/mood in English only. For one of these, choose a topic and describe the symptom rather than asking the simulation for a diagnosis.',
        SAFETY_NET
    ], [], [], ['emergency'], null);

    const missing = missingContext(context);
    if (missing.length) return response('context', 'A little more context before general guidance', [
        `I matched the educational topic “${ASSISTANT_TOPICS[topic]}”, not a diagnosis. My language rules can misunderstand or miss warning signs.`,
        'Update the context fields and send again; you do not have to repeat your concern. If you prefer not to share this context, contact a clinician for personalized advice.',
        SAFETY_NET
    ], [], [...missing, ...EDUCATION[topic].questions], ['emergency', ...EDUCATION[topic].sources], topic);

    const education = EDUCATION[topic];
    const notes = useHealthContext ? wearableNotes(healthContext, topic) : [];
    const persistent = context.duration === 'weeks' || context.duration === 'months';
    return response('education', `General guidance: ${ASSISTANT_TOPICS[topic]}`, [
        'This is educational guidance, not a diagnosis, risk score, or confirmation that home care is safe.',
        education.explanation,
        ...(persistent ? ['You reported symptoms lasting weeks or longer. Arrange a clinician appointment rather than relying on self-care alone.'] : []),
        ...(context.severity === 'moderate' ? ['Because this interferes with your daily activities, contact a clinician rather than waiting for it to become severe.'] : []),
        ...notes,
        ...(useHealthContext && !healthContext?.consent ? ['No consented health baseline is available. No measurements were used.'] : []),
        SAFETY_NET
    ], [...education.actions, MEDICATION_BOUNDARY], education.questions, [...education.sources, 'medication', ...(notes.length ? ['wearable'] : [])], topic);
}
