export const RESOURCE_KEYS = ['counter', 'kiosk', 'bagDrop', 'security'];

export const RESOURCE_META = {
  counter: { label: 'Check-in counters', short: 'Counters', unit: 'counters' },
  kiosk: { label: 'Self-service kiosks', short: 'Kiosks', unit: 'kiosks' },
  bagDrop: { label: 'Bag-drop positions', short: 'Bag drop', unit: 'positions' },
  security: { label: 'Security lanes', short: 'Security', unit: 'lanes' },
};

const resource = (serviceSec, open) => ({
  serviceSec,
  utilisation: 80,
  targetPercent: 95,
  targetMinutes: 5,
  open,
  installed: open,
  unavailable: 0,
  reserve: 0,
  minimum: 0,
  groupSize: 1,
  burstShare: 25,
  secondaryShare: 0,
  secondaryOpen: 0,
});

export function defaultScenario() {
  return {
    schemaVersion: 1,
    name: 'Illustrative peak hour',
    demandBasis: 'direct',
    directOriginating: 1200,
    departingHour: 1500,
    annualAirport: 10000000,
    annualDeparting: 5000000,
    departureShare: 50,
    originatingShare: 80,
    operatingDays: 365,
    designDayFactor: 1.25,
    designHourShare: 10,
    counterShare: 40,
    kioskShare: 20,
    onlineShare: 40,
    counterBagShare: 60,
    kioskBagShare: 60,
    onlineBagShare: 60,
    onlineTagKioskShare: 0,
    securityOriginShare: 100,
    transferSecurityPassengers: 0,
    transferRescreenShare: 100,
    burstEnabled: false,
    bagDropType: 'self-service',
    bagServiceMode: 'inclusive',
    bagFixedSeconds: 25,
    bagSecondsPerBag: 25,
    bagsPerTransaction: 1.4,
    bagExceptionShare: 0,
    bagExceptionExtraSeconds: 0,
    provenance: {
      demand: 'illustrative', routing: 'illustrative', bags: 'illustrative', security: 'illustrative',
      counter: 'illustrative', kiosk: 'illustrative', bagDrop: 'illustrative', lanes: 'illustrative', queues: 'illustrative',
    },
    sourceNote: '',
    resources: {
      counter: resource(90, 15),
      kiosk: resource(60, 5),
      bagDrop: resource(60, 9),
      security: resource(18, 8),
    },
  };
}

const value = (x) => x === '' || x === null || x === undefined ? NaN : Number(x);
const finite = (x) => Number.isFinite(value(x));
const pct = (x) => value(x) / 100;
const nearCeil = (x) => Math.max(1, Math.ceil(x - 1e-10));

export function validateScenario(s) {
  const errors = [];
  const req = (key, label, min = 0, max = Infinity, integer = false) => {
    const n = value(s[key]);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) errors.push(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max === Infinity ? 'above' : max}.`);
  };
  req('directOriginating', 'Originating passengers');
  req('departingHour', 'Departing passengers in the hour');
  req('annualAirport', 'Annual airport passengers');
  req('annualDeparting', 'Annual departing passengers');
  req('departureShare', 'Departure share', 0, 100);
  req('originatingShare', 'Originating share', 0, 100);
  req('operatingDays', 'Operating days', 1, 366);
  req('designDayFactor', 'Design-day factor', 0.000001);
  req('designHourShare', 'Design-hour share', 0, 100);
  for (const [key, label] of [
    ['counterShare', 'Counter share'], ['kioskShare', 'Kiosk share'], ['onlineShare', 'Online share'],
    ['counterBagShare', 'Counter bag participation'], ['kioskBagShare', 'Kiosk bag participation'],
    ['onlineBagShare', 'Online bag participation'], ['onlineTagKioskShare', 'Online tag-printing share'],
    ['securityOriginShare', 'Originating security share'], ['transferRescreenShare', 'Transfer rescreen share'],
  ]) req(key, label, 0, 100);
  req('transferSecurityPassengers', 'Transfer passengers at security');
  if (finite(s.counterShare) && finite(s.kioskShare) && finite(s.onlineShare) &&
      Math.abs(value(s.counterShare) + value(s.kioskShare) + value(s.onlineShare) - 100) > 1e-7) {
    errors.push('Counter, kiosk and online shares must add to 100%.');
  }
  if (!['direct', 'departing-hour', 'annual-airport', 'annual-departing'].includes(s.demandBasis)) errors.push('Choose a valid passenger basis.');
  if (!['inclusive', 'decomposed'].includes(s.bagServiceMode)) errors.push('Choose a valid bag-drop service mode.');
  if (!['self-service', 'staffed'].includes(s.bagDropType)) errors.push('Choose a bag-drop type.');
  if (s.provenance && Object.values(s.provenance).some(status => !['illustrative', 'user-supplied', 'measured'].includes(status))) errors.push('Assumption provenance has an unsupported status.');
  for (const [key, label, min, max] of [
    ['bagFixedSeconds', 'Bag-drop fixed time', 0, Infinity],
    ['bagSecondsPerBag', 'Time per bag', 0, Infinity],
    ['bagsPerTransaction', 'Bags per bag-drop transaction', 0, Infinity],
    ['bagExceptionShare', 'Bag-drop exception share', 0, 100],
    ['bagExceptionExtraSeconds', 'Extra exception time', 0, Infinity],
  ]) req(key, label, min, max);
  for (const key of RESOURCE_KEYS) {
    const r = s.resources?.[key];
    if (!r) { errors.push(`${RESOURCE_META[key].label} settings are missing.`); continue; }
    const check = (field, label, min, max = Infinity, integer = false) => {
      const n = value(r[field]);
      if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) errors.push(`${RESOURCE_META[key].short}: ${label} is invalid.`);
    };
    check('serviceSec', 'service time or equivalent lane time', 0.000001);
    check('utilisation', 'utilisation target', 0.000001, 100);
    check('targetPercent', 'queue target percentage', 0.000001, 99.999999);
    check('targetMinutes', 'queue target time', 0);
    check('open', 'open units', 0, 10000, true);
    check('installed', 'installed units', 0, 10000, true);
    check('unavailable', 'unavailable units', 0, 10000, true);
    check('reserve', 'reserve units', 0, 10000, true);
    check('minimum', 'minimum open units', 0, 10000, true);
    check('groupSize', 'passengers per transaction', 0.000001);
    check('burstShare', 'busiest 15-minute share', 25, 100);
    check('secondaryShare', 'dedicated pool share', 0, 100);
    check('secondaryOpen', 'dedicated open units', 0, Infinity, true);
    if (finite(r.open) && finite(r.installed) && finite(r.unavailable) && value(r.open) > value(r.installed) - value(r.unavailable)) errors.push(`${RESOURCE_META[key].short}: open units exceed installed minus unavailable units.`);
    if (finite(r.secondaryOpen) && finite(r.open) && value(r.secondaryOpen) > value(r.open)) errors.push(`${RESOURCE_META[key].short}: dedicated open units exceed open units.`);
    if (value(r.secondaryShare) === 0 && value(r.secondaryOpen) > 0) errors.push(`${RESOURCE_META[key].short}: dedicated open units need a positive dedicated demand share.`);
  }
  if (s.bagServiceMode === 'decomposed') {
    const effective = value(s.bagFixedSeconds) + value(s.bagsPerTransaction) * value(s.bagSecondsPerBag) + pct(s.bagExceptionShare) * value(s.bagExceptionExtraSeconds);
    if (!(effective > 0)) errors.push('Decomposed bag-drop service time must be positive.');
  }
  return errors;
}

export function originatingDemand(s) {
  switch (s.demandBasis) {
    case 'direct': return value(s.directOriginating);
    case 'departing-hour': return value(s.departingHour) * pct(s.originatingShare);
    case 'annual-airport': return value(s.annualAirport) * pct(s.departureShare) * pct(s.originatingShare) / value(s.operatingDays) * value(s.designDayFactor) * pct(s.designHourShare);
    case 'annual-departing': return value(s.annualDeparting) * pct(s.originatingShare) / value(s.operatingDays) * value(s.designDayFactor) * pct(s.designHourShare);
    default: return NaN;
  }
}

export function routeBreakdown(s, originating = originatingDemand(s)) {
  const c = pct(s.counterShare), k = pct(s.kioskShare), o = pct(s.onlineShare);
  const kb = pct(s.kioskBagShare), ob = pct(s.onlineBagShare), z = pct(s.onlineTagKioskShare);
  const routes = [
    { label: 'Staffed check-in', passengers: originating * c, counter: 1, kiosk: 0, bagDrop: 0, security: pct(s.securityOriginShare) },
    { label: 'Kiosk · no checked bag', passengers: originating * k * (1 - kb), counter: 0, kiosk: 1, bagDrop: 0, security: pct(s.securityOriginShare) },
    { label: 'Kiosk → bag drop', passengers: originating * k * kb, counter: 0, kiosk: 1, bagDrop: 1, security: pct(s.securityOriginShare) },
    { label: 'Online → bag drop', passengers: originating * o * ob * (1 - z), counter: 0, kiosk: 0, bagDrop: 1, security: pct(s.securityOriginShare) },
    { label: 'Online → kiosk → bag drop', passengers: originating * o * ob * z, counter: 0, kiosk: 1, bagDrop: 1, security: pct(s.securityOriginShare) },
    { label: 'Online · no checked bag', passengers: originating * o * (1 - ob), counter: 0, kiosk: 0, bagDrop: 0, security: pct(s.securityOriginShare) },
  ];
  const visits = Object.fromEntries(RESOURCE_KEYS.map(key => [key, routes.reduce((sum, r) => sum + r.passengers * r[key], 0)]));
  const bagsAtCounter = originating * c * pct(s.counterBagShare);
  const bagDropPassengers = visits.bagDrop;
  return { routes, visits, bagsAtCounter, bagDropPassengers, uniquePassengers: originating };
}

export function effectiveServiceSeconds(s, key) {
  if (key === 'bagDrop' && s.bagServiceMode === 'decomposed') {
    return value(s.bagFixedSeconds) + value(s.bagsPerTransaction) * value(s.bagSecondsPerBag) + pct(s.bagExceptionShare) * value(s.bagExceptionExtraSeconds);
  }
  return value(s.resources[key].serviceSec);
}

function demandForResource(s, key, originating, visits) {
  const r = s.resources[key];
  const coefficient = visits[key] / Math.max(originating, 1e-15) / (key === 'security' ? 1 : value(r.groupSize));
  const exactCoefficient = originating === 0 ? routeBreakdown(s, 1).visits[key] / (key === 'security' ? 1 : value(r.groupSize)) : coefficient;
  const background = key === 'security' ? value(s.transferSecurityPassengers) * pct(s.transferRescreenShare) : 0;
  const burstFactor = s.burstEnabled ? 4 * pct(r.burstShare) : 1;
  return { coefficient: exactCoefficient * burstFactor, background: background * burstFactor,
    lambda: (originating * exactCoefficient + background) * burstFactor, burstFactor };
}

export function erlangC(lambda, mu, servers, waitMinutes = 5, percentile = 0.95) {
  if (!Number.isFinite(lambda) || !Number.isFinite(mu) || !Number.isInteger(servers) || lambda < 0 || mu <= 0 || servers < 0) return { status: 'invalid' };
  if (lambda === 0) return { status: 'ok', rho: 0, pWait: 0, meanWaitMinutes: 0, meanQueue: 0, p95Minutes: 0, serviceLevel: 1 };
  if (servers === 0) return { status: 'unavailable', rho: Infinity, pWait: 1, meanWaitMinutes: null, meanQueue: null, p95Minutes: null, serviceLevel: null };
  const a = lambda / mu;
  const rho = a / servers;
  if (rho >= 1) return { status: 'unstable', rho, pWait: 1, meanWaitMinutes: null, meanQueue: null, p95Minutes: null, serviceLevel: null };
  let b = 1;
  for (let i = 1; i <= servers; i++) b = a * b / (i + a * b);
  const pWait = b / (1 - rho + rho * b);
  const clearance = servers * mu - lambda;
  const meanWaitMinutes = pWait / clearance * 60;
  const serviceLevel = 1 - pWait * Math.exp(-clearance * waitMinutes / 60);
  const p95Minutes = percentile <= 1 - pWait ? 0 : Math.log(pWait / (1 - percentile)) / clearance * 60;
  return { status: 'ok', rho, pWait, meanWaitMinutes, meanQueue: lambda * meanWaitMinutes / 60, p95Minutes, serviceLevel };
}

function queueRequired(lambda, mu, targetMinutes, targetFraction) {
  if (lambda === 0) return 0;
  let n = Math.max(1, Math.floor(lambda / mu) + 1);
  for (; n <= 10000; n++) {
    const q = erlangC(lambda, mu, n, targetMinutes);
    if (q.status === 'ok' && q.serviceLevel + 1e-12 >= targetFraction) return n;
  }
  return null;
}

function poolShares(r) {
  const secondary = pct(r.secondaryShare);
  return secondary === 0 ? [{ name: 'Shared pool', share: 1, open: value(r.open) }] : [
    { name: 'Primary pool', share: 1 - secondary, open: value(r.open) - value(r.secondaryOpen) },
    { name: 'Dedicated pool', share: secondary, open: value(r.secondaryOpen) },
  ].filter(p => p.share > 0);
}

function capacityAtTarget(open, mu, util, targetMinutes, targetFraction) {
  if (open <= 0) return 0;
  const throughput = open * mu * util;
  if (erlangC(throughput, mu, open, targetMinutes).serviceLevel >= targetFraction) return throughput;
  let low = 0, high = Math.min(throughput, open * mu * (1 - 1e-12));
  for (let i = 0; i < 65; i++) {
    const mid = (low + high) / 2;
    const q = erlangC(mid, mu, open, targetMinutes);
    if (q.status === 'ok' && q.serviceLevel >= targetFraction) low = mid;
    else high = mid;
  }
  return low;
}

export function calculateScenario(s, mode = 'demand') {
  const errors = validateScenario(s);
  if (errors.length) return { errors, valid: false };
  const originating = originatingDemand(s);
  if (!Number.isFinite(originating) || originating < 0) return { errors: ['The selected passenger basis produces an invalid peak-hour demand.'], valid: false };
  const routes = routeBreakdown(s, originating);
  const resources = {};
  let systemCapacity = Infinity;
  let bottlenecks = [];
  let backgroundExceeded = false;

  for (const key of RESOURCE_KEYS) {
    const r = s.resources[key];
    const seconds = effectiveServiceSeconds(s, key);
    const mu = 3600 / seconds;
    const util = pct(r.utilisation);
    const targetFraction = pct(r.targetPercent);
    const demand = demandForResource(s, key, originating, routes.visits);
    if (!Number.isFinite(demand.lambda) || demand.lambda / (mu * util) > 10000) return { errors: [`${RESOURCE_META[key].short}: the selected traffic and service assumptions exceed the supported 10,000-unit planning range.`], valid: false };
    const pools = poolShares(r).map(pool => {
      const lambda = demand.lambda * pool.share;
      const throughput = lambda === 0 ? 0 : nearCeil(lambda / (mu * util));
      const queue = queueRequired(lambda, mu, value(r.targetMinutes), targetFraction);
      const minimum = lambda > 0 ? Math.max(throughput, queue ?? 0, value(r.minimum)) : 0;
      const chosen = mode === 'capacity' ? pool.open : minimum;
      const q = erlangC(lambda, mu, chosen, value(r.targetMinutes));
      const usableLambda = capacityAtTarget(pool.open, mu, util, value(r.targetMinutes), targetFraction);
      const fixed = demand.background * pool.share;
      const coefficient = demand.coefficient * pool.share;
      const originatingCapacity = coefficient > 0 ? Math.max(0, (usableLambda - fixed) / coefficient) : Infinity;
      return { ...pool, lambda, throughput, queue, minimum, chosen, q, usableLambda, originatingCapacity, backgroundExceeded: fixed > usableLambda + 1e-9 };
    });
    const throughput = pools.reduce((a, p) => a + p.throughput, 0);
    const queueUnits = pools.reduce((a, p) => a + (p.queue ?? 0), 0);
    const recommended = pools.reduce((a, p) => a + p.minimum, 0);
    if (pools.some(p => p.queue === null) || recommended > 10000) return { errors: [`${RESOURCE_META[key].short}: the queue target exceeds the supported 10,000-unit planning range.`], valid: false };
    const chosen = pools.reduce((a, p) => a + p.chosen, 0);
    const capacity = Math.min(...pools.map(p => p.originatingCapacity));
    if (pools.some(p => p.backgroundExceeded)) backgroundExceeded = true;
    if (capacity < systemCapacity - 1e-8) { systemCapacity = capacity; bottlenecks = [key]; }
    else if (Number.isFinite(capacity) && Math.abs(capacity - systemCapacity) <= Math.max(1e-7, systemCapacity * 1e-8)) bottlenecks.push(key);
    const allFinite = pools.every(p => p.q.status === 'ok');
    const weightedWait = allFinite && demand.lambda > 0 ? pools.reduce((a, p) => a + p.lambda * p.q.meanWaitMinutes, 0) / demand.lambda : (demand.lambda === 0 ? 0 : null);
    const weightedServiceLevel = allFinite && demand.lambda > 0 ? pools.reduce((a, p) => a + p.lambda * p.q.serviceLevel, 0) / demand.lambda : (demand.lambda === 0 ? 1 : null);
    const maxUtilisation = Math.max(...pools.map(p => p.q.rho || 0));
    resources[key] = { key, visits: routes.visits[key], transactions: demand.lambda, seconds, mu, burstFactor: demand.burstFactor,
      throughput, queueUnits, recommended, chosen, installedRecommended: recommended + value(r.reserve),
      capacity, pools, weightedWait, weightedServiceLevel, maxUtilisation,
      targetMet: pools.every(p => p.q.status === 'ok' && p.q.serviceLevel + 1e-12 >= targetFraction && p.q.rho <= util + 1e-12),
      status: allFinite ? 'ok' : pools.some(p => p.q.status === 'unavailable') ? 'unavailable' : 'unstable' };
  }
  if (!Number.isFinite(systemCapacity)) bottlenecks = [];
  return { valid: true, errors: [], originating, routes, resources, systemCapacity,
    bottlenecks, backgroundExceeded,
    demandCapacityRatio: Number.isFinite(systemCapacity) && systemCapacity > 0 ? originating / systemCapacity : null };
}

export function applyGrowth(s, percent) {
  const next = structuredClone(s);
  const factor = 1 + percent / 100;
  const field = { direct: 'directOriginating', 'departing-hour': 'departingHour', 'annual-airport': 'annualAirport', 'annual-departing': 'annualDeparting' }[next.demandBasis];
  next[field] = value(next[field]) * factor;
  return next;
}
