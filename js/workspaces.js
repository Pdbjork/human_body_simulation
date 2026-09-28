import { mountHealthWorkspace } from './health-workspace.js';
import { mountAnatomyWorkspace } from './anatomy-workspace.js';
import { mountHealthAssistant } from './health-assistant.js';
import { mountImagingWorkspace } from './imaging-workspace.js';
import { mountMentalWorkspace } from './mental-workspace.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

async function mountDepartments(container) {
    container.append(element('h2', 'Body Lab departments'), element('p', 'Real scheduled development and research assignments. These agents do not receive your personal health data.'));
    const status = element('p', 'Loading department deployment record…');
    status.setAttribute('role', 'status');
    container.append(status);
    try {
        const response = await fetch('data/departments.json');
        if (!response.ok) throw new Error('Department record unavailable');
        const record = await response.json();
        status.textContent = `${record.cadence}. Configuration observed: ${new Date(record.verifiedAt).toLocaleString()}. This is a deployment snapshot, not live execution status.`;
        container.append(element('p', record.notice));
        const grid = element('div', undefined, 'department-grid');
        for (const department of record.departments) {
            const card = element('article', undefined, 'department-card');
            card.append(element('h3', department.name), element('p', department.mission));
            const values = element('dl');
            for (const [label, value] of [['Configured state', department.status], ['Schedule (cron)', department.schedule], ['Scheduler job', department.jobId], ['Private operator report location', department.reports]]) {
                values.append(element('dt', label), element('dd', value));
            }
            card.append(values);
            grid.append(card);
        }
        container.append(grid);
    } catch {
        status.textContent = 'Department deployment record could not be loaded. No agent activity is inferred.';
    }
}

export function mountWorkspaces() {
    mountAnatomyWorkspace(document.getElementById('anatomy-workspace'));
    mountHealthWorkspace(document.getElementById('health-workspace'));
    mountHealthAssistant(document.getElementById('assistant-workspace'));
    mountImagingWorkspace(document.getElementById('imaging-workspace'));
    mountMentalWorkspace(document.getElementById('mental-workspace'));
    mountDepartments(document.getElementById('departments-workspace'));

    const tabs = [...document.querySelectorAll('[data-workspace]')];
    function select(tab, focus = false) {
        for (const item of tabs) {
            const active = item === tab;
            item.setAttribute('aria-selected', String(active));
            item.tabIndex = active ? 0 : -1;
            document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
        }
        // Stop wellbeing exercises whenever their workspace becomes hidden.
        window.dispatchEvent(new CustomEvent('body-workspace-changed', { detail: tab.dataset.workspace }));
        if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
            if (next !== null) { event.preventDefault(); select(tabs[next], true); }
        });
    });
    document.getElementById('clear-personal-data').addEventListener('click', () => {
        window.dispatchEvent(new Event('body-clear-personal-data'));
        document.getElementById('privacy-status').textContent = 'Personal session data cleared. Consent revoked; simulation baseline reset.';
    });
    window.addEventListener('pagehide', () => window.dispatchEvent(new Event('body-clear-personal-data')));
}
