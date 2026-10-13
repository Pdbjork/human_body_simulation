const mountedWorkspaces = new WeakMap();

const groundingSteps = [
    'Notice five things you can see. Look for a colour, a shape, or a small detail.',
    'Notice four things you can feel, such as the chair supporting you or fabric against your hand.',
    'Notice three sounds you can hear, near or far.',
    'Notice two smells, if comfortable. There is no need to find or inhale anything.',
    'Notice one taste already in your mouth, or simply one neutral detail around you.'
];

/** Mount a private, non-diagnostic check-in and optional self-care exercises. */
export function mountMentalWorkspace(container) {
    mountedWorkspaces.get(container)?.();
    const listeners = new AbortController();
    const on = (target, event, handler) => target.addEventListener(event, handler, { signal: listeners.signal });
    let entries = [];
    let nextEntryId = 1;
    let timer = null;
    let activeExercise = null;
    let groundingStep = 0;

    container.classList.add('mental-workspace');
    container.innerHTML = `
        <h2>Mental wellbeing</h2>
        <p>A private space to check in, pause, and find support. This is not a diagnostic assessment, therapy, or a monitored crisis service.</p>
        <aside class="mental-crisis" aria-label="Immediate support">
            <h3>Need support now?</h3>
            <p>If you may act on thoughts of suicide or self-harm, have taken an overdose, or cannot stay safe, contact your local emergency number or go to the nearest emergency department now. If possible, ask someone you trust to stay with you and move away from things you could use to harm yourself.</p>
            <ul>
                <li><strong>United States:</strong> call or text <a href="tel:988">988</a>, or use <a href="https://988lifeline.org/" target="_blank" rel="noopener noreferrer">988 Lifeline chat and support</a>. For immediate danger, call 911.</li>
                <li><strong>UK and Ireland:</strong> call Samaritans on <a href="tel:116123">116 123</a>, free, day or night. <a href="https://www.samaritans.org/how-we-can-help/contact-samaritan/" target="_blank" rel="noopener noreferrer">Samaritans contact options</a>.</li>
                <li><strong>Other countries or other support needs:</strong> <a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer">find a local helpline by country</a>. Availability, languages, and contact methods vary. In immediate danger, use local emergency services rather than waiting for a helpline.</li>
            </ul>
            <p class="mental-note">Resources and exercises do not require journal consent. External links open another site with its own privacy policy; this app does not send your entries to it.</p>
        </aside>
        <div class="mental-grid">
            <section class="mental-card" aria-labelledby="mental-checkin-heading">
                <h3 id="mental-checkin-heading">Your session check-in</h3>
                <p id="mental-privacy">Optional inputs stay in this page's memory only: no account, upload, analysis by AI, or saved browser history of entries. Reloading, leaving the page, withdrawing consent, or clearing removes them from the app. Anyone viewing this open page can see them. Avoid names and identifying details. Your browser, keyboard tools, or device may have separate data practices.</p>
                <label class="mental-consent"><input type="checkbox" id="mental-consent" autocomplete="off" aria-describedby="mental-privacy"> I consent to keeping my check-ins in this page for this session.</label>
                <form id="mental-checkin-form" autocomplete="off">
                    <fieldset id="mental-fields" disabled>
                        <legend>How are things right now? All fields are optional.</legend>
                        <div class="mental-fields-grid">
                            <label for="mental-mood">Mood
                                <select id="mental-mood" name="mood">
                                    <option value="">Not recorded</option>
                                    <option>Very low</option><option>Low</option><option>Mixed / neutral</option><option>Good</option><option>Very good</option>
                                </select>
                            </label>
                            <label for="mental-stress">Stress
                                <select id="mental-stress" name="stress">
                                    <option value="">Not recorded</option>
                                    <option>Low</option><option>Moderate</option><option>High</option><option>Overwhelming</option>
                                </select>
                            </label>
                            <label for="mental-sleep">Sleep in the last 24 hours (hours)
                                <input id="mental-sleep" name="sleep" type="number" min="0" max="24" step="any" inputmode="decimal" placeholder="Optional; 0 to 24">
                            </label>
                        </div>
                        <label for="mental-journal">Optional reflection (up to 2,000 characters)</label>
                        <p class="mental-note" id="mental-journal-help">What has been on your mind? What might help next? Entries are not read for danger signs, and no one is alerted. Use the support links above when you need a person.</p>
                        <textarea id="mental-journal" name="journal" rows="4" maxlength="2000" spellcheck="false" aria-describedby="mental-journal-help"></textarea>
                        <button type="submit" class="control-btn primary">Add session check-in</button>
                    </fieldset>
                </form>
                <button type="button" id="mental-clear" class="control-btn">Clear all mental wellbeing data and stop exercises</button>
                <p id="mental-status" role="status" aria-live="polite"></p>
                <h4>Session journal</h4>
                <p id="mental-summary"></p>
                <ol id="mental-entries" class="mental-entries" aria-label="Session check-ins, newest first"></ol>
            </section>
            <section class="mental-card" aria-labelledby="mental-exercise-heading">
                <h3 id="mental-exercise-heading">A moment to pause</h3>
                <p>Choose an optional exercise. Keep your eyes open if you prefer. Skip any sense or instruction that is uncomfortable or inaccessible. Nothing you notice is recorded.</p>
                <p><strong>Breathing is not for new or severe breathlessness, chest pain, or another emergency.</strong> Seek urgent medical help instead. Breathe gently without forcing, taking unusually deep breaths, or holding your breath. Stop if dizzy, short of breath, panicky, or uncomfortable. Grounding is an alternative.</p>
                <div class="mental-actions">
                    <button type="button" id="mental-ground-start" class="control-btn">Start sensory grounding</button>
                    <button type="button" id="mental-breathe-start" class="control-btn">Start 1-minute gentle breathing</button>
                </div>
                <div class="mental-exercise-display">
                    <p id="mental-exercise-status" role="status" aria-live="polite" aria-atomic="true">No exercise running. You can stop at any time.</p>
                    <p id="mental-exercise-help">Grounding moves at your pace. Breathing offers a text cue every five seconds, with no flashing, sound, or animation.</p>
                </div>
                <div class="mental-actions">
                    <button type="button" id="mental-ground-next" class="control-btn" hidden>Next / skip this step</button>
                    <button type="button" id="mental-exercise-stop" class="control-btn" disabled>Stop exercise</button>
                </div>
                <p class="mental-note">Exercises stop when this tab is hidden. The breathing pace is only a suggestion; breathe at your own comfortable pace instead if needed. This brief practice is adapted from NHS guidance, which describes longer practice. Benefit is not guaranteed.</p>
                <h3>Learn and choose your next step</h3>
                <ul class="mental-education">
                    <li><strong>Small, practical support:</strong> regular meals, a manageable activity, time to unwind, and contact with a trusted person can support wellbeing. Self-care complements professional care; it does not replace it.</li>
                    <li><strong>Sleep and stress:</strong> a regular sleep schedule and a quieter wind-down can help. Consider how caffeine and alcohol affect you. A single night's sleep or a check-in cannot diagnose a mental health condition.</li>
                    <li><strong>When to reach out:</strong> speak with a qualified clinician if distress is persistent, worsening, or affecting daily life. NIMH highlights severe or distressing symptoms lasting two weeks or more; do not wait two weeks if you feel unsafe, symptoms are severe, or you need support sooner.</li>
                    <li><strong>About your entries:</strong> mood and stress labels are your own descriptions, not validated questionnaire scores. Multiple entries in one day are not independent daily measurements. This app does not infer a diagnosis, a cause, or improvement from them.</li>
                </ul>
                <h4>Sources and further reading</h4>
                <ul>
                    <li><a href="https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health" target="_blank" rel="noopener noreferrer">NIMH: Caring for Your Mental Health</a></li>
                    <li><a href="https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" target="_blank" rel="noopener noreferrer">NHS: Breathing exercises for stress</a></li>
                    <li><a href="https://www.nhsinform.scot/healthy-living/mental-wellbeing/breathing-and-relaxation-exercises/grounding-exercises/" target="_blank" rel="noopener noreferrer">NHS inform: Grounding exercises</a></li>
                </ul>
                <p class="mental-note">Sources checked 27 September 2026. These sources support general education, not clinical validation of this app.</p>
            </section>
        </div>
    `;

    const find = id => container.querySelector(`#${id}`);
    const consent = find('mental-consent');
    const form = find('mental-checkin-form');
    const fields = find('mental-fields');
    const mood = find('mental-mood');
    const stress = find('mental-stress');
    const sleep = find('mental-sleep');
    const journal = find('mental-journal');
    const status = find('mental-status');
    const summary = find('mental-summary');
    const entryList = find('mental-entries');
    const groundStart = find('mental-ground-start');
    const breatheStart = find('mental-breathe-start');
    const nextStep = find('mental-ground-next');
    const stopButton = find('mental-exercise-stop');
    const exerciseStatus = find('mental-exercise-status');
    const exerciseHelp = find('mental-exercise-help');

    function renderEntries() {
        entryList.replaceChildren();
        if (!entries.length) {
            summary.textContent = 'No check-ins recorded. There is no sample or inferred history.';
            return;
        }
        const sleepEntries = entries.filter(entry => entry.sleep !== null);
        summary.textContent = `${entries.length} check-in${entries.length === 1 ? '' : 's'} recorded this session. ` +
            (sleepEntries.length ? `Most recent self-reported sleep: ${sleepEntries[sleepEntries.length - 1].sleep} hours in the previous 24 hours. ` : 'Sleep has not been recorded. ') +
            'These are snapshots, not a clinical trend or score.';
        for (let index = entries.length - 1; index >= 0; index--) {
            const entry = entries[index];
            const item = document.createElement('li');
            const time = document.createElement('time');
            time.dateTime = entry.createdAt.toISOString();
            time.textContent = entry.createdAt.toLocaleString();
            const details = document.createElement('p');
            details.textContent = `Mood: ${entry.mood || 'not recorded'} · Stress: ${entry.stress || 'not recorded'} · Sleep: ${entry.sleep === null ? 'not recorded' : `${entry.sleep} hours in the last 24 hours`}`;
            item.append(time, details);
            if (entry.note) {
                const note = document.createElement('p');
                note.className = 'mental-entry-note';
                note.textContent = entry.note;
                item.append(note);
            }
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'control-btn';
            remove.textContent = 'Delete check-in';
            remove.dataset.entryId = String(entry.id);
            remove.setAttribute('aria-label', `Delete check-in from ${entry.createdAt.toLocaleString()}`);
            item.append(remove);
            entryList.append(item);
        }
    }

    function stopExercise(message = 'Exercise stopped. Return to your natural breathing and take your time.') {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        activeExercise = null;
        groundingStep = 0;
        groundStart.disabled = false;
        breatheStart.disabled = false;
        nextStep.hidden = true;
        stopButton.disabled = true;
        exerciseStatus.textContent = message;
        exerciseHelp.textContent = 'You can choose another exercise, or leave it here. Nothing about the exercise is recorded.';
    }

    function clearData(message = 'Mental wellbeing entries and unfinished inputs cleared. Consent withdrawn; exercises stopped.') {
        entries = [];
        nextEntryId = 1;
        form.reset();
        consent.checked = false;
        fields.disabled = true;
        stopExercise('No exercise running.');
        renderEntries();
        status.textContent = message;
    }

    on(consent, 'change', () => {
        if (!consent.checked) {
            clearData();
            return;
        }
        fields.disabled = false;
        status.textContent = 'Session-only check-in enabled. You can withdraw consent or clear all at any time.';
    });
    on(form, 'submit', event => {
        event.preventDefault();
        if (!consent.checked || !form.reportValidity()) return;
        const hours = sleep.value === '' ? null : sleep.valueAsNumber;
        if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 24)) {
            status.textContent = 'Enter sleep as a number from 0 to 24 hours, or leave it blank.';
            sleep.focus();
            return;
        }
        const note = journal.value.trim();
        if (!mood.value && !stress.value && hours === null && !note) {
            status.textContent = 'Choose at least one description, enter sleep, or write a reflection before adding a check-in.';
            mood.focus();
            return;
        }
        entries.push({ id: nextEntryId++, createdAt: new Date(), mood: mood.value, stress: stress.value, sleep: hours, note });
        form.reset();
        renderEntries();
        status.textContent = 'Check-in added to this session only. No diagnosis or risk score has been calculated.';
    });
    on(entryList, 'click', event => {
        const button = event.target.closest('button[data-entry-id]');
        if (!button || !entryList.contains(button)) return;
        const id = Number(button.dataset.entryId);
        entries = entries.filter(entry => entry.id !== id);
        renderEntries();
        status.textContent = 'Check-in deleted from this session.';
        find('mental-clear').focus();
    });
    on(find('mental-clear'), 'click', () => clearData());
    on(window, 'body-clear-personal-data', () => clearData());
    on(window, 'pagehide', () => clearData());

    function beginExercise(kind) {
        stopExercise();
        activeExercise = kind;
        groundStart.disabled = true;
        breatheStart.disabled = true;
        stopButton.disabled = false;
    }

    function renderGrounding() {
        exerciseStatus.textContent = `Grounding, step ${groundingStep + 1} of 5. ${groundingSteps[groundingStep]}`;
        exerciseHelp.textContent = 'Take as long as you like. Use another sense or a neutral detail if this step does not suit you. Next also skips the step; Stop ends the exercise.';
        nextStep.textContent = groundingStep === groundingSteps.length - 1 ? 'Finish grounding' : 'Next / skip this step';
    }

    on(groundStart, 'click', () => {
        beginExercise('grounding');
        nextStep.hidden = false;
        renderGrounding();
        nextStep.focus();
    });
    on(nextStep, 'click', () => {
        if (activeExercise !== 'grounding') return;
        groundingStep++;
        if (groundingStep >= groundingSteps.length) {
            stopExercise('Grounding finished. Notice how you feel, without needing to feel any particular way.');
            groundStart.focus();
        } else {
            renderGrounding();
        }
    });
    on(breatheStart, 'click', () => {
        beginExercise('breathing');
        const started = performance.now();
        exerciseHelp.textContent = 'Let air flow gently in and out, without holding or forcing. Follow your own pace if these five-second cues are not comfortable. Use Stop at any time.';
        function cue() {
            if (activeExercise !== 'breathing') return;
            const elapsed = performance.now() - started;
            if (elapsed >= 60000) {
                const stopHadFocus = document.activeElement === stopButton;
                stopExercise('One-minute breathing practice finished. Return to your natural pace.');
                if (stopHadFocus) breatheStart.focus();
                return;
            }
            const phase = Math.floor(elapsed / 5000);
            exerciseStatus.textContent = `${phase % 2 === 0 ? 'Breathe in gently, if comfortable.' : 'Let your breath flow out gently.'} Cycle ${Math.floor(phase / 2) + 1} of 6. No breath holding.`;
            timer = window.setTimeout(cue, 5000 - (elapsed % 5000));
        }
        cue();
        stopButton.focus();
    });
    on(stopButton, 'click', () => {
        const wasBreathing = activeExercise === 'breathing';
        stopExercise();
        (wasBreathing ? breatheStart : groundStart).focus();
    });
    on(document, 'visibilitychange', () => {
        if (document.hidden && activeExercise) stopExercise('Exercise stopped because this tab was hidden. Restart only when comfortable.');
    });
    on(window, 'body-workspace-changed', event => {
        if (event.detail !== 'mental' && activeExercise) stopExercise('Exercise stopped because you left the wellbeing workspace.');
    });

    clearData('Consent is off. Education, exercises, and crisis resources are available without recording a check-in.');
    const unmount = () => {
        clearData();
        listeners.abort();
        container.replaceChildren();
        mountedWorkspaces.delete(container);
    };
    mountedWorkspaces.set(container, unmount);
    return unmount;
}
