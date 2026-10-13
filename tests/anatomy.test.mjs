import test from 'node:test';
import assert from 'node:assert/strict';
import { globalState } from '../js/state.js';
import { LiverSystem, KidneySystem, PancreasSystem, organModelState } from '../js/systems/organ_systems.js';
import { EndocrineSystem } from '../js/systems/metabolic_systems.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function reset() {
    Object.assign(globalState, { glucose: 100, insulin: 10, glucagon: 0, hydrationLevel: 80, toxinLevel: 31, activeConditions: new Set() });
    Object.assign(organModelState, { glycogen: 60, urea: 20, clearance: 1, glucoseTransfer: 0, ureaRemoved: 0 });
}

test('liver storage conserves its toy transfer and cannot overfill the reserve', () => {
    reset();
    globalState.glucose = 150;
    globalState.insulin = 100;
    organModelState.glycogen = 99.9;
    const total = globalState.glucose + organModelState.glycogen;
    LiverSystem.prototype.process(1000);
    close(organModelState.glycogen, 100);
    close(globalState.glucose, 149.9);
    close(globalState.glucose + organModelState.glycogen, total);
});

test('liver cannot release unavailable glycogen or push glucose beyond release target', () => {
    reset();
    globalState.glucose = 89.9;
    globalState.glucagon = 100;
    LiverSystem.prototype.process(1000);
    close(globalState.glucose, 90);
    close(organModelState.glycogen, 59.9);
    globalState.glucose = 70;
    organModelState.glycogen = 0;
    LiverSystem.prototype.process(1000);
    close(globalState.glucose, 70);
    close(organModelState.glycogen, 0);
});

test('kidney clears only the urea pool without inventing hydration loss or negative waste', () => {
    reset();
    KidneySystem.prototype.process(1000);
    close(organModelState.urea, 20 * Math.exp(-0.04));
    close(globalState.hydrationLevel, 80);
    close(globalState.toxinLevel, 31);
    globalState.hydrationLevel = 0;
    KidneySystem.prototype.process(1000);
    close(organModelState.clearance, 0.2);
    close(organModelState.urea, 20 * Math.exp(-0.048));
    KidneySystem.prototype.process(1e9);
    assert.ok(organModelState.urea >= 0);
});

test('pancreas signals do not independently consume glucose and endocrine does not decay insulin', () => {
    reset();
    globalState.glucose = 150;
    PancreasSystem.prototype.process(3000);
    close(globalState.glucose, 150);
    close(globalState.insulin, 10 + 30 * (1 - Math.exp(-1)));
    const signal = globalState.insulin;
    EndocrineSystem.prototype.process(100);
    close(globalState.insulin, signal);
    close(globalState.glucose, 150 - (signal - 10) / 30);
});

test('peripheral uptake tends to zero near baseline rather than remaining at full strength', () => {
    reset();
    globalState.insulin = 10.003;
    EndocrineSystem.prototype.process(100);
    close(globalState.glucose, 99.9999);
    globalState.insulin = 10;
    EndocrineSystem.prototype.process(100);
    close(globalState.glucose, 99.9999);
});
