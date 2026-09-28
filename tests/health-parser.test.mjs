import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HEALTH_BYTES, parseHealthFile, parseManualHealth, parseHealthTimestamp } from '../js/health_parser.js';

const now = Date.parse('2026-09-27T12:00:00Z');
const timestamp = '2026-09-20T08:00:00Z';
const header = 'metric,value,unit,start,end\n';
const csv = rows => parseHealthFile(header + rows.join('\n'), 'measurements.csv', { now });
const observation = (code, value, unit, extra = {}) => ({
    resourceType: 'Observation', status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code }] },
    valueQuantity: { value, system: 'http://unitsofmeasure.org', code: unit },
    effectiveDateTime: timestamp, ...extra
});
const fhir = resources => parseHealthFile(JSON.stringify(Array.isArray(resources)
    ? { resourceType: 'Bundle', entry: resources.map(resource => ({ resource })) }
    : resources), 'observations.json', { now });

test('missing measurements remain null, latest resting reading wins regardless of file ordering', () => {
    const result = csv([
        'restingHeartRate,64,bpm,2026-09-20T08:00:00Z,',
        'restingHeartRate,71,bpm,2026-09-19T08:00:00Z,'
    ]);
    assert.equal(result.restingHeartRate, 64);
    assert.equal(result.averageSteps, null);
    assert.equal(result.sleepHours, null);
    assert.equal(result.oxygenSaturation, null);
    assert.equal(result.observedAt, '2026-09-20T08:00:00.000Z');
});

test('steps average observed day totals without inventing zero days or counting duplicates', () => {
    const result = csv([
        'averageSteps,1000,count,2026-09-18T08:00:00Z,2026-09-18T09:00:00Z',
        'averageSteps,1000,count,2026-09-18T08:00:00Z,2026-09-18T09:00:00Z',
        'averageSteps,500,count,2026-09-18T09:00:00Z,2026-09-18T10:00:00Z',
        'averageSteps,3500,count,2026-09-20T08:00:00Z,2026-09-20T09:00:00Z'
    ]);
    assert.equal(result.averageSteps, 2500);
    assert.equal(result.recordCount, 3);
    assert.equal(result.provenance.averageSteps.days, 2);
    assert.ok(result.warnings.some(warning => warning.includes('1 identical duplicate')));
});

test('overlapping and conflicting samples cannot silently inflate daily totals', () => {
    assert.throws(() => csv([
        'averageSteps,1000,count,2026-09-20T08:00:00Z,2026-09-20T10:00:00Z',
        'averageSteps,500,count,2026-09-20T09:00:00Z,2026-09-20T11:00:00Z'
    ]), /overlapping or conflicting/);
    assert.throws(() => csv([
        'restingHeartRate,64,bpm,2026-09-20T08:00:00Z,',
        'restingHeartRate,65,bpm,2026-09-20T08:00:00Z,'
    ]), /overlapping or conflicting/);
});

test('adjacent sleep stages combine, unit conversions and end-date provenance remain explicit', () => {
    const result = csv([
        'sleepHours,120,min,2026-09-19T23:00:00Z,2026-09-20T01:00:00Z',
        'sleepHours,18000,s,2026-09-20T01:00:00Z,2026-09-20T06:00:00Z',
        'oxygenSaturation,0.98,1,2026-09-20T08:00:00Z,'
    ]);
    assert.equal(result.sleepHours, 7);
    assert.equal(result.oxygenSaturation, 98);
    assert.equal(result.provenance.sleepHours.days, 1);
    assert.equal(result.provenance.sleepHours.start, '2026-09-19T23:00:00.000Z');
    assert.throws(() => csv(['sleepHours,8,h,2026-09-20T01:00:00Z,2026-09-20T06:00:00Z']), /cannot exceed/);
});

test('timestamps reject calendar rollover, missing timezone and future observations', () => {
    assert.equal(parseHealthTimestamp('2026-09-20 10:00:00 +0200', now), '2026-09-20T08:00:00.000Z');
    for (const date of ['2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '2026-09-20T08:00:00', '2026-09-20T24:00:00Z', '2026-09-20T08:00:00+14:01', '2026-09-28T00:00:00Z']) {
        assert.throws(() => parseHealthTimestamp(date, now));
    }
    assert.equal(parseHealthTimestamp('2024-02-29T00:00:00Z', now), '2024-02-29T00:00:00.000Z');
});

test('CSV rejects partial numbers, wrong units, unsupported metrics and ambiguous step intervals', () => {
    for (const row of [
        'restingHeartRate,64oops,bpm,2026-09-20T08:00:00Z,',
        'restingHeartRate,,bpm,2026-09-20T08:00:00Z,',
        'restingHeartRate,64,kg,2026-09-20T08:00:00Z,',
        'heartRate,64,bpm,2026-09-20T08:00:00Z,',
        'averageSteps,42.5,count,2026-09-20T08:00:00Z,2026-09-20T09:00:00Z',
        'averageSteps,42,count,2026-09-20T08:00:00Z,',
        'oxygenSaturation,101,%,2026-09-20T08:00:00Z,',
        'averageSteps,-42,count,2026-09-20T08:00:00Z,2026-09-20T09:00:00Z'
    ]) assert.throws(() => csv([row]));
});

test('CSV handles quoted values and CRLF but rejects malformed quoting and wrong schema', () => {
    const result = parseHealthFile('\uFEFF' + header.replace('\n', '\r\n') + '"restingHeartRate","64","bpm","2026-09-20T08:00:00Z",""\r\n', 'a.CSV', { now });
    assert.equal(result.restingHeartRate, 64);
    assert.throws(() => csv(['"restingHeartRate,64,bpm,2026-09-20T08:00:00Z,']), /Unclosed/);
    assert.throws(() => csv(['"restingHeartRate"x,64,bpm,2026-09-20T08:00:00Z,']), /Unexpected/);
    assert.throws(() => parseHealthFile('metric,value\nrestingHeartRate,64', 'a.csv', { now }), /header/);
});

test('FHIR exact resting and oxygen observations preserve units and ignore unrelated clinical data', () => {
    const result = fhir([
        observation('40443-4', 63, '/min'),
        observation('59408-5', 97, '%'),
        observation('8867-4', 140, '/min'),
        { resourceType: 'Patient', name: [{ text: 'Not retained' }] }
    ]);
    assert.equal(result.restingHeartRate, 63);
    assert.equal(result.oxygenSaturation, 97);
    assert.equal(result.averageSteps, null);
    assert.ok(result.warnings.some(warning => warning.startsWith('2 unsupported')));
    assert.equal(JSON.stringify(result).includes('Not retained'), false);
    assert.throws(() => fhir(observation('8867-4', 140, '/min')), /No supported measurements/);
});

test('FHIR steps require an observation period and sleep converts minutes to hours', () => {
    const result = fhir([
        observation('55423-8', 5000, '{steps}', { effectivePeriod: { start: '2026-09-19T08:00:00Z', end: timestamp } }),
        observation('93832-4', 420, 'min')
    ]);
    assert.equal(result.averageSteps, 5000);
    assert.equal(result.sleepHours, 7);
    assert.throws(() => fhir(observation('55423-8', 5000, '{steps}')), /nonzero observation interval/);
});

test('FHIR rejects mixed people, uncertain quantities and unfinished observations', () => {
    assert.throws(() => fhir([
        observation('40443-4', 63, '/min', { subject: { reference: 'Patient/one' } }),
        observation('59408-5', 97, '%', { subject: { reference: 'Patient/two' } })
    ]), /one person/);
    assert.throws(() => fhir(observation('40443-4', 63, '/min', { status: 'preliminary' })), /final/);
    assert.throws(() => fhir(observation('40443-4', 63, '/min', { valueQuantity: { value: 63, code: '/min', comparator: '<' } })), /exact valueQuantity/);
    assert.throws(() => fhir(observation('40443-4', 63, '/min', { valueQuantity: { value: null, code: '/min' } })), /numeric/);
});

test('daily bounds catch duplicate summaries even when observation intervals do not overlap', () => {
    assert.throws(() => csv([
        'averageSteps,75000,count,2026-09-20T01:00:00Z,2026-09-20T02:00:00Z',
        'averageSteps,75000,count,2026-09-20T03:00:00Z,2026-09-20T04:00:00Z'
    ]), /daily total exceeds/);
});

test('manual zero steps remain an explicit observation while blank values stay unknown', () => {
    const result = parseManualHealth({ averageSteps: '0', sleepHours: '', restingHeartRate: '60', oxygenSaturation: null }, timestamp, { now });
    assert.equal(result.averageSteps, 0);
    assert.equal(result.sleepHours, null);
    assert.equal(result.restingHeartRate, 60);
    assert.equal(result.source, 'Manual self-reported values');
    assert.equal(result.provenance.averageSteps.start, '2026-09-19T08:00:00.000Z');
    assert.ok(result.warnings.some(warning => warning.includes('24 hours ending')));
    assert.throws(() => parseManualHealth({}, timestamp, { now }), /No supported measurements/);
});

test('stale values remain dated and warn even if another metric is recent', () => {
    const result = csv([
        'restingHeartRate,60,bpm,2025-01-01T08:00:00Z,',
        'oxygenSaturation,98,%,2026-09-20T08:00:00Z,'
    ]);
    assert.ok(result.warnings.some(warning => warning.includes('over 30 days old')));
    assert.equal(result.provenance.restingHeartRate.end, '2025-01-01T08:00:00.000Z');
});

test('malformed, empty, unsupported and oversized files fail instead of inventing a baseline', () => {
    assert.throws(() => parseHealthFile('', 'a.csv', { now }), /empty/);
    assert.throws(() => parseHealthFile('{}', 'a.json', { now }), /Observation or a Bundle/);
    assert.throws(() => parseHealthFile('{', 'a.json', { now }), /Malformed JSON/);
    assert.throws(() => parseHealthFile('abc', 'export.zip', { now }), /uncompressed/);
    assert.throws(() => parseHealthFile('a'.repeat(MAX_HEALTH_BYTES + 1), 'a.csv', { now }), /12 MiB/);
});
