import { organs, anatomySources, evidenceReviewedAt, existingSystemAudit } from './anatomy-data.js';
export { createOrganSystems } from './systems/organ_systems.js';

import { mountBodyModel } from './body-model.bundle.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function mountAnatomyWorkspace(container) {
    container.replaceChildren();
    container.append(element('h2', 'Anatomy & connected systems'));
    container.append(element('p', 'Explore how organs cooperate, then check your understanding. These are educational, unvalidated models—not a diagnosis, a digital twin, or a prediction of your health.', 'anatomy-intro'));
    const layout = element('div', undefined, 'anatomy-layout');
    const figure = element('figure', undefined, 'anatomy-map');
    const modelHost = element('div');
    figure.append(modelHost);
    const model = mountBodyModel(modelHost, id => selectOrgan(id));
    figure.append(element('figcaption', 'Original 3D illustration with adult-like proportions and approximate organ positions. Anatomy varies; surfaces, tissue colors and skeletal detail are simplified. Not a scan, sex-specific atlas, or clinically validated model.'));
    const navigation = element('div', undefined, 'anatomy-organ-buttons');
    navigation.setAttribute('aria-label', 'Choose an organ');
    const buttons = organs.map((organ, index) => {
        const button = element('button', `${index + 1}. ${organ.name}`);
        button.type = 'button';
        button.dataset.organ = organ.id;
        button.setAttribute('aria-controls', 'anatomy-organ-detail');
        navigation.append(button);
        return button;
    });
    figure.append(navigation);
    const detail = element('article', undefined, 'anatomy-detail');
    detail.id = 'anatomy-organ-detail';
    const announcement = element('p', undefined, 'anatomy-selection');
    announcement.setAttribute('role', 'status');
    layout.append(figure, detail);
    container.append(announcement, layout);

    function selectOrgan(id) {
        const organ = organs.find(item => item.id === id);
        if (!organ) return;
        for (const target of buttons) {
            target.setAttribute('aria-pressed', String(target.dataset.organ === id));
        }
        model.select(id);
        detail.replaceChildren(element('p', organ.system, 'anatomy-eyebrow'), element('h3', organ.name));
        for (const [heading, text] of [['What it does', organ.function], ['Working together', organ.connection], ['What this app actually models', organ.model]]) {
            detail.append(element('h4', heading), element('p', text));
        }
        const sources = element('ul', undefined, 'anatomy-sources');
        for (const key of organ.sources) {
            const source = anatomySources[key];
            const item = element('li');
            const link = element('a', source.title);
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            item.append(link, element('small', `Source review/update: ${source.publisherReviewed}. Consulted: ${evidenceReviewedAt}.`));
            sources.append(item);
        }
        detail.append(element('h4', 'Learn from the sources'), sources);
        const quiz = element('form', undefined, 'anatomy-quiz');
        const fieldset = element('fieldset');
        fieldset.append(element('legend', `Knowledge check: ${organ.question}`));
        organ.options.forEach((option, index) => {
            const label = element('label');
            const input = element('input');
            input.type = 'radio';
            input.name = 'anatomy-answer';
            input.value = String(index);
            input.required = true;
            label.append(input, document.createTextNode(option));
            fieldset.append(label);
        });
        const submit = element('button', 'Check answer');
        submit.type = 'submit';
        const feedback = element('p', undefined, 'anatomy-feedback');
        feedback.setAttribute('role', 'status');
        quiz.append(fieldset, submit, feedback);
        quiz.addEventListener('submit', event => {
            event.preventDefault();
            const answer = quiz.querySelector('input:checked');
            if (!answer) return;
            const correct = Number(answer.value) === organ.answer;
            feedback.textContent = `${correct ? 'Correct.' : 'Not quite. Try again.'} ${organ.explanation}`;
        });
        detail.append(quiz);
        announcement.textContent = `Exploring ${organ.name}.`;
    }
    figure.addEventListener('click', event => {
        const target = event.target.closest('[data-organ]');
        if (target) selectOrgan(target.dataset.organ);
    });

    container.append(element('h3', 'Three connected organ agents'));
    container.append(element('p', 'Use the main simulation controls to run or pause these agents. A fictional meal drives the pancreas signal and liver storage; the liver produces a urea pool that the kidneys clear. AU means arbitrary units, not a medical measurement.'));
    const cards = element('div', undefined, 'anatomy-model-cards');
    for (const name of ['Pancreas', 'Liver', 'Kidneys']) {
        const card = element('section', undefined, 'anatomy-model-card');
        card.id = `${name.toLowerCase()}-system`;
        card.setAttribute('aria-label', `${name} educational agent`);
        cards.append(card);
    }
    container.append(cards);
    const assumptions = element('details', undefined, 'anatomy-assumptions');
    assumptions.append(element('summary', 'Model assumptions, units & ownership audit'));
    const assumptionsList = element('ul');
    for (const text of [
        'These sources support qualitative anatomy and relationships, not the equations below. Constants are hand-chosen teaching assumptions, not fitted or validated research parameters. Source review never automatically changes model parameters.',
        'Pancreas: insulin target = clamp(10 + 0.6 × max(glucose − 100, 0), 10, 100); glucagon target = clamp(2 × max(90 − glucose, 0), 0, 100). Both approach their target with an assumed 3-second response. Signals use a 0–100 AU scale, not hormone lab units.',
        'Peripheral uptake remains in the legacy Endocrine tick: min(1, max(insulin − 10, 0)/30) × sensitivity, with the existing toy glucose floor of 70. Tapering prevents a signal infinitesimally above baseline from consuming glucose at full strength. The fictional insulin-resistance checkbox retains its 0.3 sensitivity factor.',
        'Liver: initial glycogen reserve 60 AU, capacity 100 AU. Above toy glucose 100, storage is at most 2 × insulin/100 AU/s; below 90, release is at most 2 × glucagon/100 AU/s. Transfers cannot exceed available reserve, capacity, or the target gap. The 1:1 exchange with the legacy mg/dL-labeled glucose variable is deliberately artificial: no blood volume, grams, or mass-calibrated physiology.',
        'Liver-to-kidney pathway: assumed constant production 0.8 AU urea/s; initial urea pool 20 AU. Kidney clearance factor = clamp(hydration/80, 0.2, 1), with exponential removal at 0.04 × factor per second. No BUN, creatinine, urine volume, eGFR, disease stage, or clinical hydration requirement is calculated.',
        'New agents use 200 ms fixed steps accumulated from active simulation time. Older agents retain legacy simplified dynamics, including peripheral glucose uptake and sweating. These accelerated time scales are not a physiological clock.',
        'Not modeled: individual anatomy, drugs, meals by nutrient mass, bile flow, renal glucose handling, acid–base chemistry, ammonia concentrations, or validated disease progression. Knowledge-check answers stay only in the current page and clear with the global clear-data control.'
    ]) assumptionsList.append(element('li', text));
    assumptions.append(assumptionsList, element('h4', 'Audit of the 14 existing agents'));
    const audit = element('dl', undefined, 'anatomy-audit');
    for (const [name, role] of existingSystemAudit) audit.append(element('dt', name), element('dd', role));
    assumptions.append(audit);
    container.append(assumptions);
    window.addEventListener('body-clear-personal-data', () => selectOrgan('heart'));
    selectOrgan('heart');
}
