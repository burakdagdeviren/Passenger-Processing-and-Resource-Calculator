import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultScenario, calculateScenario, erlangC, applyGrowth, routeBreakdown, estimateAirportSize } from './calculations.js';

test('baseline conserves passengers and produces four resource counts', () => {
  const s = defaultScenario();
  const result = calculateScenario(s);
  assert.equal(result.valid, true);
  assert.equal(result.routes.routes.reduce((sum, route) => sum + route.passengers, 0), 1200);
  assert.equal(result.routes.visits.counter, 480);
  assert.equal(result.routes.visits.kiosk, 240);
  assert.equal(result.routes.visits.bagDrop, 432);
  assert.equal(result.routes.visits.security, 1200);
  assert.deepEqual(Object.fromEntries(Object.entries(result.resources).map(([key, row]) => [key, row.recommended])), {
    counter: 15, kiosk: 5, bagDrop: 9, security: 8,
  });
});

test('traffic growth and online shift transfer work to the correct processes', () => {
  const growth = calculateScenario(applyGrowth(defaultScenario(), 30));
  assert.deepEqual(Object.fromEntries(Object.entries(growth.resources).map(([key, row]) => [key, row.throughput])), {
    counter: 20, kiosk: 7, bagDrop: 12, security: 10,
  });
  const online = defaultScenario();
  online.counterShare = 20;
  online.onlineShare = 60;
  const shifted = calculateScenario(online);
  assert.equal(shifted.routes.visits.counter, 240);
  assert.equal(shifted.routes.visits.kiosk, 240);
  assert.ok(Math.abs(shifted.routes.visits.bagDrop - 576) < 1e-8);
  assert.equal(shifted.resources.counter.throughput, 8);
  assert.equal(shifted.resources.bagDrop.throughput, 12);
});

test('tighter waiting target increases kiosk recommendation', () => {
  const s = defaultScenario();
  s.resources.kiosk.targetMinutes = 1;
  const row = calculateScenario(s).resources.kiosk;
  assert.equal(row.throughput, 5);
  assert.equal(row.queueUnits, 6);
  assert.equal(row.recommended, 6);
  assert.ok(Math.abs(erlangC(240, 60, 5, 1).serviceLevel - 0.796153383246993) < 1e-10);
  assert.ok(Math.abs(erlangC(240, 60, 6, 1).serviceLevel - 0.961461810335292) < 1e-10);
});

test('M/M/1 reference, instability, and zero demand are distinct', () => {
  const q = erlangC(0.5, 1, 1, 60);
  assert.equal(q.status, 'ok');
  assert.equal(q.rho, 0.5);
  assert.equal(q.pWait, 0.5);
  assert.equal(q.meanWaitMinutes, 60);
  assert.equal(q.meanQueue, 0.5);
  assert.equal(erlangC(1, 1, 1).status, 'unstable');
  assert.equal(erlangC(1, 1, 0).status, 'unavailable');
  assert.equal(erlangC(0, 1, 0).meanWaitMinutes, 0);
});

test('capacity mode reports the originating-passenger bottleneck', () => {
  const result = calculateScenario(defaultScenario(), 'capacity');
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.systemCapacity - 1200) < 1e-7);
  assert.deepEqual(result.bottlenecks, ['counter', 'kiosk', 'bagDrop']);
  assert.ok(Math.abs(result.resources.security.capacity - 1280) < 1e-7);
});

test('annual bases are separate and do not double count departures', () => {
  const s = defaultScenario();
  s.demandBasis = 'annual-airport';
  const fromAirport = calculateScenario(s);
  s.demandBasis = 'annual-departing';
  const fromDeparting = calculateScenario(s);
  assert.ok(Math.abs(fromAirport.originating - 1369.8630136986303) < 1e-9);
  assert.ok(Math.abs(fromAirport.originating - fromDeparting.originating) < 1e-9);
});

test('dedicated pools round independently, and online bag tag creates sequential visits', () => {
  const s = defaultScenario();
  s.onlineTagKioskShare = 50;
  const routes = routeBreakdown(s);
  assert.equal(routes.visits.kiosk, 384);
  assert.equal(routes.visits.bagDrop, 432);
  s.resources.kiosk.secondaryShare = 50;
  s.resources.kiosk.secondaryOpen = 2;
  const result = calculateScenario(s);
  assert.equal(result.resources.kiosk.pools.length, 2);
  assert.equal(result.resources.kiosk.throughput, 8);
});

test('invalid scope and impossible open counts return explicit errors', () => {
  const s = defaultScenario();
  s.onlineShare = 41;
  s.resources.security.open = 9;
  const result = calculateScenario(s);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('add to 100%')));
  assert.ok(result.errors.some(e => e.includes('open units exceed')));
});

test('burst demand and transfer rescreening each affect their own workload once', () => {
  const s = defaultScenario();
  s.burstEnabled = true;
  s.resources.counter.burstShare = 35;
  s.transferSecurityPassengers = 200;
  s.transferRescreenShare = 50;
  const result = calculateScenario(s);
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.resources.counter.transactions - 672) < 1e-9);
  assert.equal(result.resources.kiosk.transactions, 240);
  assert.equal(result.resources.security.transactions, 1300);
});

test('capacity mode detects screening background demand that consumes the whole lane pool', () => {
  const s = defaultScenario();
  s.transferSecurityPassengers = 2000;
  const result = calculateScenario(s, 'capacity');
  assert.equal(result.valid, true);
  assert.equal(result.systemCapacity, 0);
  assert.equal(result.backgroundExceeded, true);
  assert.deepEqual(result.bottlenecks, ['security']);
});

test('unrealistically large unit requirements produce a bounded error', () => {
  const s = defaultScenario();
  s.directOriginating = 1000000;
  const result = calculateScenario(s);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].includes('supported'));
});

test('airport-size estimate uses all four recommended process capacities', () => {
  const s = defaultScenario();
  s.directOriginating = 2300;
  const size = estimateAirportSize(s, 'demand');
  assert.equal(size.available, true);
  assert.equal(size.band.name, 'Large');
  assert.ok(Math.abs(size.annualPax - 16_936_000) < 1e-6);
  assert.deepEqual(size.processes.map(row => row.units), [29, 10, 18, 15]);
  assert.deepEqual(size.bottlenecks, ['counter']);
  assert.ok(size.processes.every(row => row.annualPax >= size.annualPax));
});

test('annual-size estimate does not invent a category without conversion or capacity', () => {
  const s = defaultScenario();
  s.departureShare = 0;
  assert.equal(estimateAirportSize(s).available, false);
  s.departureShare = 50;
  s.resources.security.open = 0;
  assert.equal(estimateAirportSize(s, 'capacity').available, false);
});
