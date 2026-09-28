import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHealthConcern } from '../js/assistant-rules.js';

const adultContext = {
    topic: 'auto', duration: 'days', severity: 'mild', course: 'stable',
    physicalSafety: 'no', selfHarm: 'no', ageGroup: 'adult',
    pregnancy: 'no', conditions: 'no'
};
const baseline = {
    consent: true, restingHeartRate: 64, averageSteps: 8000,
    sleepHours: 8, oxygenSaturation: 99, source: 'manual',
    observedAt: '2026-09-26T12:00:00Z', warnings: []
};
function assess(text, context = {}, extra = {}) {
    return assessHealthConcern({
        consent: true, messages: [text], context: { ...adultContext, ...context }, ...extra
    });
}

test('without consent the engine does not process even alarming health input', () => {
    const result = assess('I have chest pain', {}, { consent: false });
    assert.equal(result.kind, 'consent');
    assert.equal(result.topic, null);
});

test('explicit warning sign takes precedence over an unrelated topic and absent context', () => {
    const result = assessHealthConcern({ consent: true, messages: ['Tell me about sleep'], context: { physicalSafety: 'yes' } });
    assert.equal(result.kind, 'emergency');
});

test('normal baseline measurements cannot downgrade chest pain or turn it into exercise advice', () => {
    const result = assess('I have chest pain. My watch says I am fine.', { topic: 'exercise' }, { useHealthContext: true, healthContext: baseline });
    assert.equal(result.kind, 'emergency');
});

test('a nearby negation must not hide a separate breathing emergency', () => {
    assert.equal(assess('No chest pain but I can’t breathe').kind, 'emergency');
});

test('a directly denied chest symptom does not override an affirmative fatigue concern', () => {
    const result = assess('No chest pain. I am tired.');
    assert.equal(result.kind, 'education');
    assert.equal(result.topic, 'fatigue');
});

test('severe headache in prose cannot be overridden by mild form severity', () => {
    assert.equal(assess('I have a severe headache').kind, 'emergency');
});

test('headache with fever escalates even without severe reported pain', () => {
    assert.equal(assess('I have a mild headache and fever').kind, 'emergency');
});

test('potential overdose precedes a medication-boundary response', () => {
    assert.equal(assess('I took too many pills. Should I change my dose?').kind, 'emergency');
});

test('self-harm language precedes both medicine requests and general stress education', () => {
    assert.equal(assess('I want to die. Should I stop my antidepressants?').kind, 'crisis');
});

test('inability to stay safe receives immediate emergency routing', () => {
    assert.equal(assess('I cannot keep myself safe').kind, 'emergency');
});

test('passive wish to die is not ignored because the phrase contains a negation', () => {
    assert.equal(assess('I don’t want to live').kind, 'crisis');
});

test('a structured crisis response works without a recognized symptom phrase', () => {
    assert.equal(assess('I need some help', { selfHarm: 'thoughts' }).kind, 'crisis');
});

test('medication dose changes and missed doses are routed to a prescriber or pharmacist', () => {
    assert.equal(assess('Can I double my insulin dose?').kind, 'medication');
    assert.equal(assess('I missed my medication. What should I do?').kind, 'medication');
});

test('unknown duration blocks personalized self-care until supplied', () => {
    const initial = assess('I feel tired', { duration: 'unknown' });
    assert.equal(initial.kind, 'context');
    const followup = assessHealthConcern({ consent: true, messages: ['I feel tired', 'for three days'], context: adultContext });
    assert.equal(followup.kind, 'education');
    assert.equal(followup.topic, 'fatigue');
});

test('unanswered safety and special-population fields are not assumed negative', () => {
    const result = assessHealthConcern({ consent: true, messages: ['I feel tired'], context: { duration: 'days', severity: 'mild' } });
    assert.equal(result.kind, 'context');
});

test('child symptoms are not given the adult educational self-care path', () => {
    assert.equal(assess('I feel tired', { ageGroup: 'child' }).kind, 'urgent');
    assert.equal(assess('My baby has trouble sleeping').kind, 'urgent');
});

test('abdominal symptoms with possible pregnancy bypass routine guidance', () => {
    assert.equal(assess('I have stomach pain', { pregnancy: 'yes' }).kind, 'emergency');
    assert.equal(assess('I am pregnant and my stomach hurts').kind, 'emergency');
});

test('a serious condition needs clinician-led guidance even for mild symptoms', () => {
    assert.equal(assess('I feel tired', { conditions: 'yes' }).kind, 'urgent');
});

test('worsening described in text takes priority over a stable form selection', () => {
    assert.equal(assess('My fatigue is getting worse').kind, 'urgent');
});

test('unsupported medical topics cannot be forced into a selected supported topic', () => {
    assert.equal(assess('Please interpret my MRI scan', { topic: 'headache' }).kind, 'unknown');
});

test('unrelated follow-up does not inherit a previous topic and fabricate an answer', () => {
    const result = assessHealthConcern({ consent: true, messages: ['I am tired', 'Who won the election?'], context: adultContext });
    assert.equal(result.kind, 'unknown');
});

test('an earlier emergency is not erased by a reassuring follow-up', () => {
    const result = assessHealthConcern({ consent: true, messages: ['My chest hurts', 'I feel better now'], context: adultContext });
    assert.equal(result.kind, 'emergency');
});

test('all supported non-emergency concerns have distinct educational topic routing', () => {
    for (const [text, topic] of [
        ['I have an occasional cough', 'cardio'],
        ['I feel tired', 'fatigue'],
        ['I have a familiar mild headache', 'headache'],
        ['I am mildly bloated', 'digestion'],
        ['How do I start exercising?', 'exercise'],
        ['I feel stressed', 'stress']
    ]) {
        const result = assess(text);
        assert.equal(result.kind, 'education', text);
        assert.equal(result.topic, topic, text);
    }
});

test('health context requires both permissions before affecting a response', () => {
    const without = assess('I feel tired');
    const notRequested = assess('I feel tired', {}, { healthContext: baseline });
    assert.deepEqual(notRequested, without);
    const unconsentedBaseline = assess('I feel tired', {}, { useHealthContext: true, healthContext: { ...baseline, consent: false } });
    const noBaseline = assess('I feel tired', {}, { useHealthContext: true, healthContext: null });
    assert.deepEqual(unconsentedBaseline, noBaseline);
});
