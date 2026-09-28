import { getHealthContext } from './health-workspace.js';
import { assessHealthConcern, ASSISTANT_TOPICS, ASSISTANT_SOURCES, ASSISTANT_REVIEWED_AT } from './assistant-rules.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function sourceLink(id) {
    const source = ASSISTANT_SOURCES[id];
    const link = element('a', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    return link;
}

function selectField(parent, name, label, choices) {
    const wrapper = element('label', undefined, 'assistant-field');
    const select = element('select');
    select.name = name;
    select.id = `assistant-${name}`;
    for (const [value, text] of choices) {
        const option = element('option', text);
        option.value = value;
        select.append(option);
    }
    wrapper.append(element('span', label), select);
    parent.append(wrapper);
    return select;
}

function checkboxField(parent, id, text) {
    const label = element('label', undefined, 'assistant-check');
    const input = element('input');
    input.type = 'checkbox';
    input.id = id;
    input.autocomplete = 'off';
    label.append(input, element('span', text));
    parent.append(label);
    return input;
}

function addList(parent, title, items) {
    if (!items.length) return;
    if (title) parent.append(element('h4', title));
    const list = element('ul');
    for (const item of items) list.append(element('li', item));
    parent.append(list);
}

export function mountHealthAssistant(container) {
    container.replaceChildren();
    container.classList.add('health-assistant');
    let messages = [];
    let characterCount = 0;
    let turns = 0;
    // These flags intentionally survive follow-ups within one concern. A later
    // reassuring phrase or selector change must not erase an earlier warning.
    let physicalWarning = false;
    let harmWarning = 'unknown';

    container.append(element('h2', 'Health assistant'));
    container.append(element('p', 'Private, offline, rule-based guidance', 'assistant-eyebrow'));
    container.append(element('p', 'Describe one concern, review the safety questions, then add context in follow-ups. This is an educational conversation guide, not AI diagnosis or a clinician. It uses fixed English-language rules and source-backed explanations; it cannot examine you, monitor you, interpret scans, or reliably screen for every emergency.'));
    container.append(element('p', 'Supported: heart/breathing, fatigue/sleep, headache, digestion, exercise/wearables, and stress/mood. Children, pregnancy/recent birth, and serious conditions need clinician-led advice. Fictional simulation settings are never treated as your medical history.', 'assistant-limit'));

    const safety = element('aside', undefined, 'assistant-safety');
    safety.setAttribute('aria-label', 'Emergency help, available without consent');
    safety.append(element('h3', 'Do not wait here in an emergency'));
    safety.append(element('p', 'Chest pressure or pain, difficulty breathing, fainting, stroke-like symptoms, sudden severe headache, severe abdominal pain, uncontrolled bleeding, or overdose: call your local emergency number (911 in the US; 112 in much of Europe). These are examples, not a complete checklist.'));
    safety.append(element('p', 'If you might harm yourself or someone else, or cannot stay safe, contact emergency help now. In the US, call or text 988 for crisis support. Outside the US, contact a local crisis line. This app cannot call for you.'));
    const safetyLinks = element('div', undefined, 'assistant-source-links');
    safetyLinks.append(sourceLink('crisis'), sourceLink('international'), sourceLink('emergency'));
    safety.append(safetyLinks);
    container.append(safety);

    const privacy = element('div', undefined, 'assistant-privacy');
    privacy.append(element('p', 'No cloud model, account, telemetry, or automatic health-data transmission. Entries stay in this page’s memory until cleared or the page is closed/reloaded. Avoid names and identifying details. External sources open only when you choose a link; those sites have their own privacy policies.'));
    const consent = checkboxField(privacy, 'assistant-consent', 'I consent to processing my entries locally in this browser session.');
    container.append(privacy);

    const status = element('p', 'Enable consent to enter a concern. Emergency resources above remain available.', 'assistant-status');
    status.id = 'assistant-status';
    status.setAttribute('role', 'status');
    container.append(status);

    const transcript = element('div', undefined, 'assistant-transcript');
    transcript.id = 'assistant-transcript';
    transcript.setAttribute('role', 'log');
    transcript.setAttribute('aria-label', 'Private assistant conversation');
    transcript.setAttribute('aria-live', 'polite');
    transcript.setAttribute('aria-relevant', 'additions');
    container.append(transcript);

    const form = element('form', undefined, 'assistant-form');
    form.autocomplete = 'off';
    const fields = element('fieldset');
    fields.disabled = true;
    fields.append(element('legend', 'Your concern and context'));
    const messageLabel = element('label', undefined, 'assistant-field');
    const message = element('textarea');
    message.id = 'assistant-message';
    message.name = 'concern';
    message.rows = 3;
    message.maxLength = 1800;
    message.autocomplete = 'off';
    message.spellcheck = false;
    message.setAttribute('autocorrect', 'off');
    message.setAttribute('aria-describedby', 'assistant-message-help');
    message.placeholder = 'For example: I have been tired for several days. What should I discuss with my clinician?';
    messageLabel.append(element('span', 'Describe a symptom or add a follow-up (up to 1,800 characters)'), message);
    fields.append(messageLabel);
    const messageHelp = element('p', 'One concern at a time. Update the fields to answer context questions; follow-up text is optional after the first message. Earlier warning signs stay active until you clear this conversation.', 'assistant-help');
    messageHelp.id = 'assistant-message-help';
    fields.append(messageHelp);

    const controls = {};
    controls.topic = selectField(fields, 'topic', 'Educational topic', [['auto', 'Match from my words (limited English rules)'], ...Object.entries(ASSISTANT_TOPICS)]);

    const safetyGroup = element('div', undefined, 'assistant-safety-fields');
    safetyGroup.append(element('h3', 'Safety first'));
    const physicalHelp = element('p', 'Examples: chest pain/pressure; difficulty breathing; fainting; new one-sided weakness or trouble speaking; sudden severe headache; severe abdominal pain; blood in vomit/stool; uncontrolled bleeding; poisoning/overdose. “No” does not mean an emergency has been ruled out.', 'assistant-help');
    physicalHelp.id = 'assistant-physical-help';
    safetyGroup.append(physicalHelp);
    const safetyGrid = element('div', undefined, 'assistant-grid');
    controls.physicalSafety = selectField(safetyGrid, 'physicalSafety', 'Any physical warning signs happening now?', [['unknown', 'Not answered / unsure'], ['yes', 'Yes — get emergency help now'], ['no', 'None of these reported']]);
    controls.physicalSafety.setAttribute('aria-describedby', physicalHelp.id);
    controls.selfHarm = selectField(safetyGrid, 'selfHarm', 'Thoughts of harming yourself or someone else?', [['unknown', 'Not answered / unsure'], ['immediate', 'Immediate danger / cannot stay safe'], ['thoughts', 'Thoughts, without immediate danger'], ['no', 'No thoughts of harm reported']]);
    safetyGroup.append(safetyGrid);
    fields.append(safetyGroup);

    const contextDetails = element('details', undefined, 'assistant-context');
    contextDetails.open = true;
    contextDetails.append(element('summary', 'Context for safer guidance (unknown is not assumed normal)'));
    const contextGrid = element('div', undefined, 'assistant-grid');
    controls.duration = selectField(contextGrid, 'duration', 'How long has this been happening?', [['unknown', 'Not answered / unsure'], ['new', 'Just started'], ['hours', 'Several hours / less than a day'], ['days', 'Several days'], ['weeks', 'One or more weeks'], ['months', 'One or more months']]);
    controls.severity = selectField(contextGrid, 'severity', 'Effect on normal activities', [['unknown', 'Not answered / unsure'], ['mild', 'Mild — little interference'], ['moderate', 'Moderate — interferes with activities'], ['severe', 'Severe — unable to do usual activities']]);
    controls.course = selectField(contextGrid, 'course', 'How is it changing?', [['unknown', 'Not answered / unsure'], ['stable', 'About the same'], ['improving', 'Improving'], ['worsening', 'Worsening']]);
    controls.ageGroup = selectField(contextGrid, 'ageGroup', 'Who is this about?', [['unknown', 'Not answered / prefer not to say'], ['adult', 'Adult (18 or older)'], ['child', 'Child or adolescent (under 18)']]);
    controls.pregnancy = selectField(contextGrid, 'pregnancy', 'Pregnant, possibly pregnant, or recently gave birth?', [['unknown', 'Not answered / unsure / prefer not to say'], ['yes', 'Yes / possible'], ['no', 'No / does not apply']]);
    controls.conditions = selectField(contextGrid, 'conditions', 'Serious medical condition or reduced immunity?', [['unknown', 'Not answered / unsure / prefer not to say'], ['yes', 'Yes'], ['no', 'None reported']]);
    contextDetails.append(contextGrid);
    fields.append(contextDetails);

    const useBaseline = checkboxField(fields, 'assistant-use-health', 'Also use my consented, applied health baseline from this session (optional; never simulated values).');
    fields.append(element('p', 'No baseline is needed to use the assistant. Imported measurements may be old or inaccurate and can never override symptoms. Health-workspace consent and this separate opt-in are both required.', 'assistant-help'));
    const buttons = element('div', undefined, 'assistant-actions');
    const send = element('button', 'Send / update context', 'control-btn primary');
    send.type = 'submit';
    buttons.append(send);
    fields.append(buttons);
    form.append(fields);
    container.append(form);

    const clear = element('button', 'Clear conversation and revoke assistant consent', 'control-btn');
    clear.type = 'button';
    container.append(clear);

    const references = element('details', undefined, 'assistant-references');
    references.append(element('summary', 'Sources, transparency, and limitations'));
    references.append(element('p', `Source pages were checked on ${ASSISTANT_REVIEWED_AT}. These sources support general education and warning signs, not clinical validation of this software. Rules are fixed, may misunderstand negation or timing, and are not comprehensive. No disease probabilities, automatic diagnoses, or medication plans are generated.`));
    references.append(element('p', 'A message can receive an emergency response even if it describes a past event or someone else. Tell a clinician what actually happened. If your concern is not understood, seek human advice rather than trying to make the app approve home care. Source links require internet; local guidance does not.'));
    const referenceList = element('ul');
    for (const id of Object.keys(ASSISTANT_SOURCES)) {
        const item = element('li');
        item.append(sourceLink(id));
        referenceList.append(item);
    }
    references.append(referenceList);
    container.append(references);

    function renderReply(result) {
        const reply = element('article', undefined, `assistant-reply assistant-${result.kind}`);
        reply.setAttribute('aria-label', 'Offline assistant response');
        const heading = element('h3', result.title);
        heading.tabIndex = -1;
        reply.append(heading);
        for (const paragraph of result.paragraphs) reply.append(element('p', paragraph));
        addList(reply, 'What to do', result.actions);
        addList(reply, 'Questions to consider / answer below', result.questions);
        if (result.sourceIds.length) {
            const links = element('div', undefined, 'assistant-source-links');
            links.setAttribute('aria-label', 'Sources for this response');
            for (const id of result.sourceIds) links.append(sourceLink(id));
            reply.append(links);
        }
        transcript.append(reply);
        if (result.kind === 'emergency' || result.kind === 'crisis') heading.focus({ preventScroll: false });
        else reply.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    function clearConversation() {
        messages = [];
        characterCount = 0;
        turns = 0;
        physicalWarning = false;
        harmWarning = 'unknown';
        form.reset();
        // Explicit values also defeat browser-restored checkbox state.
        consent.checked = false;
        useBaseline.checked = false;
        message.value = '';
        fields.disabled = true;
        transcript.replaceChildren();
        status.textContent = 'Assistant entries, context, and conversation cleared; consent revoked. Other workspaces have their own clear controls or use Clear all personal data.';
    }

    consent.addEventListener('change', () => {
        if (!consent.checked) clearConversation();
        else {
            fields.disabled = false;
            status.textContent = 'Local processing enabled. Nothing is sent to a server. Enter one concern and review the safety questions.';
            message.focus();
        }
    });
    clear.addEventListener('click', clearConversation);
    window.addEventListener('body-clear-personal-data', clearConversation);
    // Clearing on pagehide also prevents a back/forward-cache restore from
    // reopening a previous personal conversation.
    window.addEventListener('pagehide', clearConversation);

    function updateImmediateSafety() {
        if (!consent.checked) return;
        if (controls.physicalSafety.value === 'yes') physicalWarning = true;
        if (controls.selfHarm.value === 'immediate') harmWarning = 'immediate';
        else if (controls.selfHarm.value === 'thoughts' && harmWarning !== 'immediate') harmWarning = 'thoughts';
        if (controls.physicalSafety.value === 'yes' || controls.selfHarm.value === 'immediate' || controls.selfHarm.value === 'thoughts') {
            renderReply(assessHealthConcern({ consent: true, context: { physicalSafety: physicalWarning ? 'yes' : 'unknown', selfHarm: harmWarning } }));
            status.textContent = 'A safety concern needs human help now. Do not wait to complete the form.';
        }
    }
    controls.physicalSafety.addEventListener('change', updateImmediateSafety);
    controls.selfHarm.addEventListener('change', updateImmediateSafety);

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!consent.checked) {
            status.textContent = 'Consent is required before local processing.';
            return;
        }
        const text = message.value.trim();
        if (!text && !messages.length && !physicalWarning && harmWarning === 'unknown') {
            status.textContent = 'Describe your concern first. Safety help is available above without sending a message.';
            message.focus();
            return;
        }
        if (text.length > 1800 || characterCount + text.length > 18000 || turns >= 20) {
            // Never let a transcript limit block newly entered emergency cues.
            const safetyReply = assessHealthConcern({ consent: true, messages: [text], context: { physicalSafety: physicalWarning ? 'yes' : 'unknown', selfHarm: harmWarning } });
            if (safetyReply.kind === 'emergency' || safetyReply.kind === 'crisis') renderReply(safetyReply);
            status.textContent = 'This private conversation has reached its limit (20 replies / 18,000 characters). Clear it before starting a new concern. Do not delay urgent help.';
            return;
        }
        if (text) {
            messages.push(text);
            characterCount += text.length;
        }
        const context = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
        if (physicalWarning) context.physicalSafety = 'yes';
        if (harmWarning !== 'unknown') context.selfHarm = harmWarning;
        const health = useBaseline.checked ? getHealthContext() : null;
        const result = assessHealthConcern({ messages, context, consent: true, useHealthContext: useBaseline.checked, healthContext: health });
        if (result.kind === 'emergency') physicalWarning = true;
        if (result.kind === 'crisis' && harmWarning !== 'immediate') harmWarning = 'thoughts';
        const userEntry = element('article', undefined, 'assistant-user-message');
        userEntry.append(element('h3', text ? 'You' : 'You updated the context'));
        if (text) userEntry.append(element('p', text));
        const contextLabels = Object.values(controls).map(control => control.selectedOptions[0].textContent);
        userEntry.append(element('p', `Context: ${contextLabels.join(' · ')}. Health baseline: ${useBaseline.checked ? 'requested' : 'not used'}.`, 'assistant-context-summary'));
        transcript.append(userEntry);
        message.value = '';
        turns += 1;
        status.textContent = `Reply ${turns}: local rules only. This is not a diagnosis or confirmation of safety. Update the fields or add a follow-up; clear to start a different concern.`;
        renderReply(result);
    });

    consent.checked = false;
    useBaseline.checked = false;
}
