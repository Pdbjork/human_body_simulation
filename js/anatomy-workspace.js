import { organs, anatomySources, evidenceReviewedAt, existingSystemAudit } from './anatomy-data.js';
export { createOrganSystems } from './systems/organ_systems.js';

// Original schematic drawn for this project; not copied from source illustrations.
const illustration = `<svg class="anatomy-figure" viewBox="0 0 360 490" role="group" aria-labelledby="anatomy-art-title anatomy-art-description">
    <title id="anatomy-art-title">Explore six organs</title>
    <desc id="anatomy-art-description">Original front-view schematic, not to scale. Your right appears on the viewer's left. Kidneys and pancreas are shown through overlying structures. Select an organ using its shape or the labeled buttons.</desc>
    <path class="anatomy-body" d="M151 21 Q180 7 209 21 Q229 40 217 72 L209 92 Q247 95 263 126 L295 258 Q298 277 282 281 Q268 285 260 261 L236 180 L235 304 L217 463 Q215 482 197 478 L182 328 L178 328 L163 478 Q145 482 143 463 L125 304 L124 180 L100 261 Q92 285 78 281 Q62 277 65 258 L97 126 Q113 95 151 92 L143 72 Q131 40 151 21 Z"/>
    <path class="anatomy-airway" d="M180 94 V126 M180 126 L155 149 M180 126 L205 149"/>
    <g data-organ="lungs" role="button" tabindex="0" aria-label="Explore lungs" aria-pressed="false">
        <path d="M165 127 Q129 127 123 178 Q119 207 155 206 L173 192 L173 137 Z M195 127 Q231 127 237 178 Q241 207 208 206 L187 192 L187 137 Z"/>
        <text x="145" y="171">2</text>
    </g>
    <g data-organ="heart" role="button" tabindex="0" aria-label="Explore heart" aria-pressed="false">
        <path d="M179 171 Q176 151 190 151 Q201 152 204 164 Q219 157 224 175 Q227 196 200 217 Q177 195 179 171 Z"/>
        <text x="201" y="185">1</text>
    </g>
    <g data-organ="liver" role="button" tabindex="0" aria-label="Explore liver" aria-pressed="false">
        <path d="M126 215 Q149 204 181 215 L218 224 Q199 247 169 246 L131 257 Q118 244 126 215 Z"/>
        <text x="148" y="236">3</text>
    </g>
    <g data-organ="kidneys" role="button" tabindex="0" aria-label="Explore kidneys" aria-pressed="false">
        <path d="M135 258 Q115 257 116 282 Q118 307 136 304 Q150 298 138 286 Q133 280 142 273 Q147 266 135 258 Z M225 258 Q245 257 244 282 Q242 307 224 304 Q210 298 222 286 Q227 280 218 273 Q213 266 225 258 Z"/>
        <text x="127" y="283">5</text><text x="233" y="283">5</text>
    </g>
    <g data-organ="pancreas" role="button" tabindex="0" aria-label="Explore pancreas" aria-pressed="false">
        <path d="M151 260 Q175 247 218 249 Q231 253 218 263 L168 277 Q149 283 151 260 Z"/>
        <text x="184" y="263">4</text>
    </g>
    <g data-organ="intestine" role="button" tabindex="0" aria-label="Explore small intestine" aria-pressed="false">
        <path d="M152 292 Q168 284 180 293 Q192 283 208 294 L210 335 Q196 347 181 335 Q168 348 150 335 Z"/>
        <path class="anatomy-fold" d="M160 300 Q199 292 199 305 Q154 305 160 315 Q202 310 199 325 Q177 331 160 326"/>
        <text x="182" y="314">6</text>
    </g>
    <text class="anatomy-orientation" x="78" y="410">Body right</text><text class="anatomy-orientation" x="273" y="410">Body left</text>
</svg>`;

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
    figure.innerHTML = illustration;
    figure.append(element('figcaption', 'Original front-view schematic. Not to scale; overlapping organs are separated for learning.'));
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
        for (const target of [...buttons, ...figure.querySelectorAll('svg [data-organ]')]) {
            target.setAttribute('aria-pressed', String(target.dataset.organ === id));
        }
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
    figure.addEventListener('keydown', event => {
        const target = event.target.closest('svg [data-organ]');
        if (target && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            selectOrgan(target.dataset.organ);
        }
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
