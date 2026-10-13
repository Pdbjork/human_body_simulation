import { HEALTH_METRICS, MAX_HEALTH_BYTES, parseHealthFile, parseManualHealth } from './health_parser.js';

let consent = false;
let applied = null;
let resetView = null;

export function getHealthContext() {
    return {
        consent,
        restingHeartRate: applied?.restingHeartRate ?? null,
        averageSteps: applied?.averageSteps ?? null,
        sleepHours: applied?.sleepHours ?? null,
        oxygenSaturation: applied?.oxygenSaturation ?? null,
        source: applied?.source || 'None',
        observedAt: applied?.observedAt || null,
        warnings: [...(applied?.warnings || [])]
    };
}

function announce() {
    window.dispatchEvent(new CustomEvent('body-health-updated', { detail: getHealthContext() }));
}

export function clearHealthData() {
    consent = false;
    applied = null;
    resetView?.();
    announce();
}

window.addEventListener('body-clear-personal-data', clearHealthData);

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function button(text) {
    const node = element('button', text);
    node.type = 'button';
    return node;
}

function showSummary(target, result, title) {
    target.replaceChildren(element('h3', title));
    if (!result) {
        target.append(element('p', 'No personal measurements applied. Unknown is not zero. The simulation remains an educational scenario.'));
        return;
    }
    target.append(element('p', `${result.source} · ${result.recordCount} accepted sample(s). Latest observation: ${result.observedAt}.`, 'health-provenance'));
    const list = element('dl', null, 'health-values');
    for (const [metric, rule] of Object.entries(HEALTH_METRICS)) {
        const group = element('div');
        group.append(element('dt', metric === 'averageSteps' ? 'Steps / observed day' : metric === 'sleepHours' ? 'Sleep hours / observed day' : rule.label));
        group.append(element('dd', result[metric] === null ? 'Unknown' : `${result[metric]} ${rule.unit}`));
        const provenance = result.provenance[metric];
        if (provenance) group.append(element('dd', `${provenance.start} → ${provenance.end}${provenance.days ? ` · ${provenance.days} observed UTC day(s)` : ''}`, 'health-provenance'));
        list.append(group);
    }
    target.append(list);
    const warnings = element('ul', null, 'health-warnings');
    for (const warning of result.warnings) warnings.append(element('li', warning));
    target.append(warnings);
}

export function mountHealthWorkspace(container) {
    let pending = null;
    let reader = null;
    let revision = 0;
    container.replaceChildren();
    container.classList.add('health-workspace');
    container.append(element('h2', 'Your measurements, your control'));
    container.append(element('p', 'Import a local export or enter measurements yourself. Nothing connects to your watch or phone automatically. This educational app cannot verify a device, confirm a diagnosis, or infer fitness from steps.'));
    const privacy = element('p', 'Session-only: accepted values stay in this page’s memory and may be used by the educational simulation and offline assistant. Files, identifiers and raw records are not retained after parsing. No health data is uploaded or saved by this app. Clear here or use “Clear all personal data” to withdraw consent.', 'health-privacy');
    container.append(privacy);
    const consentLabel = element('label', null, 'health-consent');
    const consentInput = document.createElement('input');
    consentInput.type = 'checkbox';
    consentInput.checked = consent;
    consentInput.id = 'health-consent';
    consentLabel.append(consentInput, document.createTextNode(' I consent to local processing and session-only use of my own measurements. I understand this is not medical care.'));
    container.append(consentLabel);

    const inputs = element('fieldset', null, 'health-inputs');
    inputs.disabled = !consent;
    inputs.append(element('legend', 'Choose an input method'));
    const importGroup = element('div', null, 'health-input-group');
    importGroup.append(element('h3', '1. Import a local file'));
    const fileLabel = element('label', 'Apple XML, defined CSV, or FHIR JSON (up to 12 MiB)');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xml,.csv,.json';
    fileInput.id = 'health-import-file';
    fileLabel.htmlFor = fileInput.id;
    const previewFile = button('Validate and preview file');
    importGroup.append(fileLabel, fileInput, previewFile);
    importGroup.append(element('p', 'Unzip an Apple Health export first and choose export.xml. If it exceeds the limit or contains overlapping device records, prepare a smaller, single-source CSV using the schema below. Do not upload a ZIP archive.'));
    inputs.append(importGroup);

    const manualGroup = element('div', null, 'health-input-group');
    manualGroup.append(element('h3', 'Or enter your own values'));
    manualGroup.append(element('p', 'Leave unknown values blank. Steps and sleep describe the 24 hours ending at your timestamp; resting heart rate and oxygen saturation are readings at that time. Limits below prevent invalid imports; they are not healthy ranges.'));
    const manualInputs = {};
    const grid = element('div', null, 'health-manual-grid');
    for (const [metric, rule] of Object.entries(HEALTH_METRICS)) {
        const label = element('label', `${rule.label} (${rule.unit}; ${rule.min}–${rule.max})`);
        const input = document.createElement('input');
        input.type = 'number'; input.min = rule.min; input.max = rule.max;
        input.step = metric === 'averageSteps' ? '1' : 'any';
        input.id = `health-manual-${metric}`;
        input.autocomplete = 'off';
        label.htmlFor = input.id;
        label.append(input); grid.append(label); manualInputs[metric] = input;
    }
    const timeLabel = element('label', 'Observed at (ISO date/time with timezone)');
    const timeInput = document.createElement('input');
    timeInput.type = 'text'; timeInput.id = 'health-observed-at'; timeInput.autocomplete = 'off';
    timeInput.placeholder = '2026-09-20T08:00:00Z';
    timeLabel.htmlFor = timeInput.id;
    timeLabel.append(timeInput); grid.append(timeLabel);
    manualGroup.append(grid);
    const previewManual = button('Validate and preview manual values');
    manualGroup.append(previewManual); inputs.append(manualGroup); container.append(inputs);

    const schema = element('details', null, 'health-schema');
    schema.append(element('summary', 'Supported formats, units and aggregation rules'));
    schema.append(element('p', 'CSV must have exactly this header and one measurement per row. Example (not imported automatically):'));
    schema.append(element('pre', 'metric,value,unit,start,end\nrestingHeartRate,62,bpm,2026-09-20T08:00:00Z,2026-09-20T08:00:00Z\naverageSteps,4200,count,2026-09-20T00:00:00Z,2026-09-20T23:59:59Z\nsleepHours,7.5,h,2026-09-19T23:00:00Z,2026-09-20T06:30:00Z\noxygenSaturation,98,%,2026-09-20T08:00:00Z,2026-09-20T08:00:00Z'));
    schema.append(element('p', 'CSV metric names: restingHeartRate, averageSteps, sleepHours, oxygenSaturation. Allowed units: heart rate bpm, /min, count/min, {H.B.}/min; steps count or {steps}; sleep h, min or s; oxygen % (98 means 98%) or 1 (0.98 means 98%). Start and end require full timestamps with seconds and an explicit timezone. Blank end means a point reading, but steps require a nonzero interval. Future timestamps are rejected.'));
    schema.append(element('p', 'Apple Health: resting heart rate, step count, oxygen saturation and asleep sleep stages. Awake/in-bed and other measurement types are ignored and counted in the preview. Apple HealthKit oxygen percent uses fractions (0.98 means 98%), not the CSV/FHIR percent convention. External XML declarations and custom entities are rejected.'));
    schema.append(element('p', 'FHIR: one Observation or a Bundle.entry[].resource collection. Supported LOINC codes (system http://loinc.org): 40443-4 resting heart rate; 55423-8 steps; 93832-4 sleep duration; 59408-5 or 2708-6 oxygen saturation. Generic heart rate is not treated as resting heart rate. Observations need final/amended/corrected status, valueQuantity with an exact numeric value and supported UCUM code/unit, plus effectiveDateTime or complete effectivePeriod. Step counts require effectivePeriod. Components, absent values, comparators and other resource types are not imported. Mixed subject references are rejected; identity is otherwise not verified.'));
    schema.append(element('p', 'Aggregation uses the entire file, not an invented recent baseline: latest resting heart rate and oxygen reading; mean of step/sleep daily totals over observed UTC days only. Missing days do not count as zero. A step interval belongs to its start UTC date and a sleep interval to its end UTC date, even if it crosses midnight. Identical records are deduplicated; overlapping or conflicting samples are rejected to avoid double counting. Maximum 100,000 records. Applying a preview replaces all previous values, including unknowns.'));
    const sources = element('p', 'Format references: ');
    for (const [index, [label, href]] of [['Apple export', 'https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios'], ['HealthKit percent units', 'https://developer.apple.com/documentation/healthkit/hkunit/percent()'], ['FHIR Observation', 'https://hl7.org/fhir/R4/observation.html'], ['LOINC sleep duration', 'https://loinc.org/93832-4/']].entries()) {
        if (index) sources.append(document.createTextNode(' · '));
        const link = element('a', label); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; sources.append(link);
    }
    schema.append(sources); container.append(schema);

    const status = element('p', 'Consent is required before a file is read or values are processed.', 'health-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const preview = element('div', null, 'health-preview'); preview.hidden = true;
    const apply = button('Apply this preview to this session'); apply.disabled = true;
    const cancel = button('Discard preview'); cancel.disabled = true;
    const clear = button('Clear health measurements and withdraw consent');
    const actions = element('div', null, 'health-actions'); actions.append(apply, cancel, clear);
    const active = element('div', null, 'health-active');
    container.append(status, preview, actions, active);
    showSummary(active, applied, 'Applied measurements');

    function invalidatePreview() {
        revision++;
        if (reader) { reader.abort(); reader = null; }
        pending = null;
        preview.replaceChildren(); preview.hidden = true;
        apply.disabled = true; cancel.disabled = true;
    }
    function setPreview(result) {
        pending = result;
        showSummary(preview, pending, '2. Review before applying');
        preview.hidden = false; apply.disabled = false; cancel.disabled = false;
        status.textContent = 'Validated locally. Nothing from this preview is applied yet. Confirm the values, dates and ownership, then apply.';
    }
    function showError(error) {
        status.textContent = `${error.message} No new values were applied.`;
    }
    resetView = () => {
        invalidatePreview(); consentInput.checked = false; inputs.disabled = true;
        fileInput.value = ''; timeInput.value = '';
        for (const input of Object.values(manualInputs)) input.value = '';
        showSummary(active, null, 'Applied measurements');
        status.textContent = 'Health measurements and preview cleared from this page; consent withdrawn. Delete the original file separately if desired.';
    };
    consentInput.addEventListener('change', () => {
        if (!consentInput.checked) { clearHealthData(); return; }
        consent = true; inputs.disabled = false;
        status.textContent = 'Local processing enabled. Choose a file or enter measurements, then validate and review.';
        announce();
    });
    fileInput.addEventListener('change', () => {
        invalidatePreview();
        status.textContent = 'File selected but not read. Select “Validate and preview file” to process it locally.';
    });
    for (const input of [...Object.values(manualInputs), timeInput]) input.addEventListener('input', () => {
        invalidatePreview(); status.textContent = 'Values changed. Validate again before applying.';
    });
    previewFile.addEventListener('click', () => {
        if (!consent) return;
        invalidatePreview();
        const file = fileInput.files?.[0];
        if (!file) { showError(new Error('Choose a file first.')); return; }
        if (!/\.(xml|csv|json)$/i.test(file.name)) { showError(new Error('Choose an uncompressed .xml, .csv or .json file.')); return; }
        if (!file.size || file.size > MAX_HEALTH_BYTES) { showError(new Error('Choose a nonempty file no larger than 12 MiB.')); return; }
        const token = revision;
        const current = new FileReader(); reader = current;
        status.textContent = 'Reading and validating locally…';
        current.onload = () => {
            if (token !== revision || !consent) return;
            reader = null;
            try { setPreview(parseHealthFile(current.result, file.name)); }
            catch (error) { showError(error); }
            fileInput.value = '';
        };
        current.onerror = () => {
            if (token !== revision) return;
            reader = null; fileInput.value = '';
            showError(new Error('The browser could not read this file.'));
        };
        current.readAsText(file);
    });
    previewManual.addEventListener('click', () => {
        if (!consent) return;
        invalidatePreview();
        try {
            const values = Object.fromEntries(Object.entries(manualInputs).map(([metric, input]) => [metric, input.value]));
            setPreview(parseManualHealth(values, timeInput.value));
        } catch (error) { showError(error); }
    });
    apply.addEventListener('click', () => {
        if (!consent || !pending) return;
        applied = pending; invalidatePreview();
        showSummary(active, applied, 'Applied measurements');
        status.textContent = 'Preview applied to this session. Any previous measurements were replaced. Simulation outputs are not measured health data.';
        announce();
    });
    cancel.addEventListener('click', () => {
        invalidatePreview(); status.textContent = 'Preview discarded. Applied measurements are unchanged.';
    });
    clear.addEventListener('click', clearHealthData);
}
