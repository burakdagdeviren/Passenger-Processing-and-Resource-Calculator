# Passenger Processing & Resource Calculator

An airport planning calculator for staffed check-in counters, self-service kiosks, bag-drop positions and security lanes. It estimates simultaneously open units from demand, or originating-passenger capacity from available open units. It also checks an indicative waiting-time target and compares a frozen baseline with a what-if scenario.

## Run locally

```text
npm install
npm run dev
npm test
npm run build
```

The Vite build in `dist/` is a static website. Its `.openai/hosting.json` file identifies the private Sites deployment.

## Model boundaries

- Passenger routes are mutually exclusive but can visit several processes. Staffed check-in includes bag acceptance; kiosk users with bags also visit bag drop.
- Direct input means originating passengers reaching the modelled processing area in the selected hour. Other demand bases use explicit originating and peak factors. Annual airport PAX and annual departing PAX are alternatives, never additive.
- Workload is transactions multiplied by full service-cycle seconds. Group-size assumptions convert passengers to transactions. Security uses effective whole-lane passengers/hour.
- Throughput sizing divides workload by available seconds and target utilisation. Queue sizing uses M/M/c Erlang-C with a common queue, identical servers and steady arrivals. Each dedicated pool is rounded and evaluated independently.
- Reverse capacity converts process limits back to originating passengers/hour under a fixed route mix. Transfer rescreening demand is background security work.
- The airport-size indicator converts the limiting capacity across counters, kiosks, bag drop and security into an annual airport-PAX equivalent. Its ACI EUROPE band is a scenario comparison, not a measurement of physical airport size or actual traffic.
- A 15-minute burst is a steady-rate stress case. It does not model carry-over queues or passenger walk times.
- Installed, open, unavailable and reserve units are distinct. An unavailable or reserve unit does not serve passengers.
- The default values are illustrative. The interface has provenance status by assumption group and source notes. The output is not a whole-terminal capacity certification.

The mathematical study and acceptance examples are in [the project plan](../Passenger_Processing_Resource_Calculator_Plan.md). Key planning references are linked in the app methodology.
