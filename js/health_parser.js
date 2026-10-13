// Local-only, deliberately narrow import formats. No native wearable connection.
export const MAX_HEALTH_BYTES = 12 * 1024 * 1024;
export const MAX_HEALTH_RECORDS = 100000;
export const HEALTH_METRICS = Object.freeze({
    restingHeartRate: { label: 'Resting heart rate', unit: 'bpm', min: 20, max: 250 },
    averageSteps: { label: 'Steps', unit: 'count', min: 0, max: 100000 },
    sleepHours: { label: 'Sleep', unit: 'h', min: 0, max: 24 },
    oxygenSaturation: { label: 'Oxygen saturation', unit: '%', min: 0, max: 100 }
});
const CSV_HEADER = ['metric', 'value', 'unit', 'start', 'end'];
const LOINC = Object.freeze({ '40443-4': 'restingHeartRate', '55423-8': 'averageSteps', '93832-4': 'sleepHours', '59408-5': 'oxygenSaturation', '2708-6': 'oxygenSaturation' });
const APPLE_TYPES = Object.freeze({
    HKQuantityTypeIdentifierRestingHeartRate: 'restingHeartRate',
    HKQuantityTypeIdentifierStepCount: 'averageSteps',
    HKQuantityTypeIdentifierOxygenSaturation: 'oxygenSaturation',
    HKCategoryTypeIdentifierSleepAnalysis: 'sleepHours'
});
const ASLEEP = new Set(['HKCategoryValueSleepAnalysisAsleep', 'HKCategoryValueSleepAnalysisAsleepUnspecified', 'HKCategoryValueSleepAnalysisAsleepCore', 'HKCategoryValueSleepAnalysisAsleepDeep', 'HKCategoryValueSleepAnalysisAsleepREM']);

export function parseHealthTimestamp(value, now = Date.now()) {
    if (typeof value !== 'string') throw new Error('Every measurement needs a timestamp with a timezone.');
    const iso = value.trim().replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/, '$1T$2$3:$4');
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(iso);
    if (!match) throw new Error('Use a full date/time with seconds and timezone, such as 2026-09-20T08:00:00Z.');
    const [, year, month, day, hour, minute, second, zone] = match;
    const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    if (+year < 1900 || +month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59 || (zone !== 'Z' && (+zone.slice(1, 3) > 14 || +zone.slice(4) > 59 || (+zone.slice(1, 3) === 14 && +zone.slice(4) !== 0)))) {
        throw new Error('A measurement contains an invalid calendar date or timezone.');
    }
    const timestamp = Date.parse(iso);
    if (!Number.isFinite(timestamp) || timestamp > now) throw new Error('Measurement timestamps must be valid and not in the future.');
    return new Date(timestamp).toISOString();
}

function numeric(value) {
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) {
        throw new Error('Measurements must contain complete numeric values, not blanks or text.');
    }
    const result = Number(value);
    if (!Number.isFinite(result)) throw new Error('Measurements must be finite numbers.');
    return result;
}

function normalize(metric, value, unit, start, end, now) {
    if (!Object.hasOwn(HEALTH_METRICS, metric)) throw new Error('Unsupported measurement type.');
    let amount = numeric(value);
    const units = {
        restingHeartRate: { bpm: 1, '/min': 1, 'count/min': 1, '{H.B.}/min': 1 },
        averageSteps: { count: 1, '{steps}': 1 },
        sleepHours: { h: 1, min: 1 / 60, s: 1 / 3600 },
        oxygenSaturation: { '%': 1, '1': 100 }
    }[metric];
    if (!Object.hasOwn(units, unit)) throw new Error(`Unsupported unit for ${HEALTH_METRICS[metric].label}.`);
    amount *= units[unit];
    const rule = HEALTH_METRICS[metric];
    if (amount < rule.min || amount > rule.max || (metric === 'averageSteps' && !Number.isInteger(amount))) {
        throw new Error(`${rule.label} must be ${rule.min}–${rule.max} ${rule.unit}${metric === 'averageSteps' ? ' in whole steps' : ''}. These are import limits, not healthy ranges.`);
    }
    const from = parseHealthTimestamp(start, now);
    const to = parseHealthTimestamp(end || start, now);
    if (to < from) throw new Error('Measurement end must not precede start.');
    if (metric === 'averageSteps' && to === from) throw new Error('Step counts need a nonzero observation interval.');
    if (metric === 'sleepHours' && to > from && amount > (Date.parse(to) - Date.parse(from)) / 3600000 + 0.000001) {
        throw new Error('Sleep duration cannot exceed its observation interval.');
    }
    return { metric, value: amount, unit: rule.unit, start: from, end: to };
}

function csvRows(text) {
    const rows = [];
    let row = [], cell = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') { quoted = false; closed = true; }
            else cell += ch;
        } else if (ch === '"') {
            if (cell || closed) throw new Error('Malformed CSV quoting.');
            quoted = true;
        } else if (ch === ',' || ch === '\n' || ch === '\r') {
            row.push(cell.trim()); cell = ''; closed = false;
            if (ch !== ',') {
                if (row.some(value => value !== '')) rows.push(row);
                row = [];
                if (ch === '\r' && text[i + 1] === '\n') i++;
                if (rows.length > MAX_HEALTH_RECORDS + 1) throw new Error('Too many CSV records.');
            }
        } else {
            if (closed) throw new Error('Unexpected text after a CSV quoted value.');
            cell += ch;
        }
    }
    if (quoted) throw new Error('Unclosed CSV quote.');
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows;
}

function parseCSV(text, now) {
    const rows = csvRows(text.replace(/^\uFEFF/, ''));
    if (!rows.length || rows[0].join(',') !== CSV_HEADER.join(',')) throw new Error('CSV header must be exactly metric,value,unit,start,end.');
    return { source: 'Local CSV', skipped: 0, records: rows.slice(1).map((row, index) => {
        if (row.length !== 5) throw new Error(`CSV row ${index + 2} must contain five columns.`);
        try { return normalize(row[0], row[1], row[2], row[3], row[4], now); }
        catch (error) { throw new Error(`CSV row ${index + 2}: ${error.message}`); }
    }) };
}

function parseApple(text, now) {
    if (typeof DOMParser === 'undefined') throw new Error('Apple XML import requires a browser XML parser.');
    if (/<!ENTITY\b/i.test(text) || /<!DOCTYPE\s+[^\[>]*\b(?:SYSTEM|PUBLIC)\b/i.test(text)) throw new Error('XML external declarations and custom entities are not supported.');
    const document = new DOMParser().parseFromString(text, 'application/xml');
    if (document.querySelector('parsererror') || document.documentElement?.tagName !== 'HealthData') throw new Error('Choose a valid Apple Health export.xml file with a HealthData root.');
    const entries = document.getElementsByTagName('Record');
    if (entries.length > MAX_HEALTH_RECORDS) throw new Error('Too many Apple Health records; export a smaller date range.');
    const records = [];
    let skipped = 0;
    for (const entry of entries) {
        const type = entry.getAttribute('type');
        const metric = Object.hasOwn(APPLE_TYPES, type) ? APPLE_TYPES[type] : null;
        if (!metric || (metric === 'sleepHours' && !ASLEEP.has(entry.getAttribute('value')))) { skipped++; continue; }
        const start = entry.getAttribute('startDate');
        const end = entry.getAttribute('endDate');
        if (!end) throw new Error('Apple measurements need both startDate and endDate.');
        let value = entry.getAttribute('value');
        let unit = entry.getAttribute('unit');
        if (metric === 'oxygenSaturation' && unit === '%') {
            // HealthKit percent uses a fraction, unlike CSV/FHIR UCUM percent.
            if (numeric(value) < 0 || numeric(value) > 1) throw new Error('Apple oxygen saturation must be a HealthKit fraction between 0 and 1.');
            unit = '1';
        }
        if (metric === 'sleepHours') {
            value = (Date.parse(parseHealthTimestamp(end, now)) - Date.parse(parseHealthTimestamp(start, now))) / 3600000;
            unit = 'h';
            if (value <= 0) throw new Error('Apple sleep intervals must have positive duration.');
        }
        records.push(normalize(metric, value, unit, start, end, now));
    }
    return { source: 'Apple Health XML', records, skipped };
}

function parseFHIR(text, now) {
    let root;
    try { root = JSON.parse(text); } catch { throw new Error('Malformed JSON file.'); }
    let entries;
    if (root?.resourceType === 'Observation') entries = [root];
    else if (root?.resourceType === 'Bundle' && Array.isArray(root.entry)) entries = root.entry.map(entry => entry?.resource);
    else throw new Error('FHIR JSON must be an Observation or a Bundle with an entry array.');
    if (entries.length > MAX_HEALTH_RECORDS) throw new Error('Too many FHIR resources.');
    const records = [], subjects = new Set();
    let skipped = 0;
    for (const observation of entries) {
        if (observation?.resourceType !== 'Observation') { skipped++; continue; }
        const coding = observation.code?.coding;
        const metrics = new Set(Array.isArray(coding) ? coding.filter(code => code?.system === 'http://loinc.org' && Object.hasOwn(LOINC, code.code)).map(code => LOINC[code.code]) : []);
        if (!metrics.size) { skipped++; continue; }
        if (metrics.size !== 1) throw new Error('A FHIR observation contains conflicting supported codes.');
        if (!['final', 'amended', 'corrected'].includes(observation.status)) throw new Error('Supported FHIR observations must have final, amended, or corrected status.');
        if (observation.subject) {
            if (typeof observation.subject.reference !== 'string' || !observation.subject.reference.trim()) throw new Error('FHIR subjects must use a reference so mixed-person imports can be checked.');
            subjects.add(observation.subject.reference);
        }
        if (subjects.size > 1) throw new Error('Import measurements for only one person at a time.');
        const quantity = observation.valueQuantity;
        if (!quantity || quantity.comparator) throw new Error('Supported FHIR observations require an exact valueQuantity, without a comparator.');
        if (quantity.system && quantity.system !== 'http://unitsofmeasure.org') throw new Error('FHIR quantities must use UCUM units.');
        const start = observation.effectivePeriod?.start || observation.effectiveDateTime;
        const end = observation.effectivePeriod ? observation.effectivePeriod.end : start;
        if (!end) throw new Error('FHIR observation periods need a start and end.');
        records.push(normalize([...metrics][0], quantity.value, quantity.code || quantity.unit, start, end, now));
    }
    return { source: 'FHIR Observation JSON', records, skipped };
}

function summarize(parsed, now) {
    if (!parsed.records.length) throw new Error('No supported measurements were found. Review the supported types and units.');
    if (parsed.records.length > MAX_HEALTH_RECORDS) throw new Error('Too many measurements.');
    const records = [], warnings = [], seen = new Set();
    let duplicates = 0;
    for (const record of parsed.records) {
        const key = `${record.metric}|${record.start}|${record.end}|${record.value}`;
        if (seen.has(key)) { duplicates++; continue; }
        seen.add(key); records.push(record);
    }
    const values = {}, provenance = {};
    for (const [metric, rule] of Object.entries(HEALTH_METRICS)) {
        const series = records.filter(record => record.metric === metric).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
        let previous = null;
        for (const record of series) {
            if (previous && (record.start < previous.end || record.start === previous.start)) throw new Error(`${rule.label} has overlapping or conflicting samples. Choose one source or remove overlapping summaries before importing.`);
            previous = record;
        }
        values[metric] = null;
        if (!series.length) continue;
        if (metric === 'averageSteps' || metric === 'sleepHours') {
            const days = new Map();
            for (const record of series) {
                const day = (metric === 'sleepHours' ? record.end : record.start).slice(0, 10);
                days.set(day, (days.get(day) || 0) + record.value);
            }
            if ([...days.values()].some(value => value > rule.max + 0.000001)) throw new Error(`${rule.label} daily total exceeds the import limit. Check for duplicate summaries.`);
            values[metric] = Math.round([...days.values()].reduce((sum, value) => sum + value, 0) / days.size * 100) / 100;
            provenance[metric] = { start: series[0].start, end: series.at(-1).end, count: series.length, days: days.size };
        } else {
            const latest = series.at(-1);
            values[metric] = Math.round(latest.value * 100) / 100;
            provenance[metric] = { start: latest.start, end: latest.end, count: 1 };
        }
    }
    const observedAt = records.reduce((latest, record) => record.end > latest ? record.end : latest, records[0].end);
    if (duplicates) warnings.push(`${duplicates} identical duplicate sample(s) removed, including duplicates across sources.`);
    if (parsed.skipped) warnings.push(`${parsed.skipped} unsupported record(s), including non-asleep sleep categories, ignored.`);
    if (Object.values(values).some(value => value === null)) warnings.push('Missing measurements remain unknown; they are not treated as zero.');
    if (Object.values(provenance).some(value => now - Date.parse(value.end) > 30 * 86400000)) warnings.push('At least one measurement is over 30 days old; it may not describe your current health.');
    warnings.push('Steps and sleep are averages over observed UTC days only, across the entire file; missing days are not zero. Step intervals belong to their start day; sleep intervals to their end day.');
    warnings.push('Resting heart rate and oxygen saturation use the latest sample, not a clinical baseline. Observation times can differ by measurement.');
    warnings.push('These unverified personal measurements cannot diagnose conditions or establish fitness. No identity matching is performed; confirm this file belongs to you.');
    return { ...values, source: parsed.source, observedAt, warnings, provenance, recordCount: records.length };
}

export function parseHealthFile(text, filename, { now = Date.now() } = {}) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.');
    if (text.length > MAX_HEALTH_BYTES || new TextEncoder().encode(text).byteLength > MAX_HEALTH_BYTES) throw new Error('Health files must be 12 MiB or smaller.');
    const extension = String(filename).split('.').at(-1).toLowerCase();
    const parsers = { xml: parseApple, csv: parseCSV, json: parseFHIR };
    if (!Object.hasOwn(parsers, extension)) throw new Error('Choose an uncompressed .xml, .csv, or .json file. ZIP archives are not supported.');
    return summarize(parsers[extension](text, now), now);
}

export function parseManualHealth(input, observedAt, { now = Date.now() } = {}) {
    const timestamp = parseHealthTimestamp(observedAt, now);
    const records = [];
    for (const [metric, rule] of Object.entries(HEALTH_METRICS)) {
        if (input[metric] === '' || input[metric] === null || input[metric] === undefined) continue;
        // Manual steps and sleep are explicitly one-day summaries, not instantaneous readings.
        const start = metric === 'averageSteps' || metric === 'sleepHours' ? new Date(Date.parse(timestamp) - 86400000).toISOString() : timestamp;
        records.push(normalize(metric, input[metric], rule.unit, start, timestamp, now));
    }
    const result = summarize({ source: 'Manual self-reported values', records, skipped: 0 }, now);
    result.warnings = result.warnings.filter(warning => !warning.startsWith('Steps and sleep'));
    result.warnings.push('Manual steps and sleep describe the 24 hours ending at the entered timestamp, not a long-term average.');
    return result;
}
