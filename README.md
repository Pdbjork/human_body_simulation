# BjorkEd Body Lab

An educational body-system simulation with private, session-only health learning workspaces. This is **not a clinically validated digital twin, diagnostic medical device, radiology workstation, or replacement for a clinician**. Simulated values are not measured health. Citations document educational sources, not clinical validation of this software.

## Run

Python 3.10+ and a modern browser are sufficient to run the committed app; no package installation or AI-provider credentials are required. The 3D viewer requires WebGL2. If it is unavailable, the app explicitly reports that limitation and the accessible organ lessons remain usable.

```sh
python3 server.py --port 4790
# Open http://127.0.0.1:4790/
```

The server binds to loopback by default. Serve the same allowlisted static assets over trusted HTTPS for a phone; browser file access and home-screen installation depend on browser support. The web manifest supports a standalone launch experience, **not native HealthKit/Health Connect synchronization or an App Store/Play release**. No service worker caches personal data. The former incomplete GKE deployment template was replaced with executable checks; no cloud deployment is claimed.

To modify the anatomical renderer, use Node.js 22+, run `npm ci`, then `npm run build`. Commit the generated `js/body-model.bundle.js` alongside its sources. The bundle includes pinned three.js and its MIT license; no runtime CDN requests are made. CI rebuilds it before running the behavior suites.

## Workspaces

### Simulation and anatomy

- Fourteen existing system agents plus distinct **pancreas, liver and kidney** agents, with visible cards and pause/resume controls.
- **3D body & anatomy** replaces the flat diagram with an original proportioned, continuous skin surface, shaded organs and an illustrative skeleton. Rotate by dragging or arrow keys; zoom by wheel/pinch or buttons; use Front, Back, Side and Reset camera controls.
- Switch between body surface, internal organs, skeleton, combined layers and **Selected organ only** to inspect deep organs without overlap. Clicking the heart, lungs, liver, pancreas, kidneys or small intestine highlights it and opens its source-linked lesson and quiz. Equivalent labeled buttons support keyboard selection.
- The skin is generated once by a smooth-union isosurface; drawing occurs on camera, selection and size changes rather than an idle animation loop. Geometry and lighting are local and deterministic; no uploaded images or health measurements are used to construct the body.
- Adult-like proportions, tissue colors, lobes, bronchi, large vessels, bowel loops and skeletal landmarks are illustrative, not scan-derived. The model omits fine anatomy, anatomical variation, sex-specific anatomy, many vessels/nerves, calibrated dimensions and physiological motion. It is not a complete anatomical atlas or patient-specific model.
- Pancreas owns insulin/glucagon signals, liver owns its glycogen store and a separate urea production pool, kidneys clear that urea pool. Endocrine retains peripheral glucose uptake; Excretory displays renal state rather than removing it twice.
- Equations, ownership and omissions are documented inside 3D body & anatomy. These are hand-chosen toy dynamics, **not research-fitted human physiology**. Arbitrary-unit pools and a 1:1 illustrative glycogen/glucose mapping are not clinical concentrations or physical mass conversion.
- Scenario condition switches are hypothetical configuration, not diagnoses inferred about the user. The homeostasis index is a toy score, not a health assessment.

### Wearables and personal health

Consent → local validation → preview → explicit apply. The applied resting pulse becomes the educational baseline; step count never determines a fitness label. Other supported measurements are available to the assistant only with a separate opt-in.

Supported imports:

- **Apple Health XML**: select the unzipped `export.xml`. Resting heart rate, steps, supported asleep categories and oxygen saturation. HealthKit percent samples use fractions (`0.98` means 98%).
- **Defined CSV**, with exact header `metric,value,unit,start,end`. Metrics are `restingHeartRate`, `averageSteps`, `sleepHours`, `oxygenSaturation`; units and timezone-aware date rules are documented in the UI. CSV percentage values use 0–100.
- **FHIR Observation or Bundle JSON** with the documented recognized codes, units, timestamps and one subject. Unsupported codes are not guessed into known metrics.
- Manual measurements use the same validation and preview flow. Unknown values remain unknown, not zero.

Limits: 12 MiB/file and 100,000 records. Latest resting pulse/oxygen samples are used, not a clinically measured long-term baseline. Steps/sleep are averaged over observed UTC days across the file; missing days are not zero. Exact duplicates are removed; conflicting/overlapping samples, mixed FHIR subjects, invalid units and impossible values are rejected. The UI reports provenance and stale-data limitations. Native watch/account pairing requires future platform SDK, permission and device validation by the native departments.

### Personalized health assistant

A transparent **offline, fixed-rule English-language conversational assistant**, not a hidden cloud LLM. It covers heart/breathing, fatigue/sleep, headache, digestive symptoms, exercise/wearables and stress/mood. It gathers duration, severity, progression and relevant context; offers possible explanations and low-risk education; and routes uncertainty and concerning symptoms to professional care.

Medical emergencies and self-harm concerns take precedence. Normal wearable readings never override concerning symptoms. The assistant cannot rule out emergencies, make confirmed diagnoses, prescribe or change medication/oxygen, interpret scans, monitor someone, or summon help. It is not comprehensive screening; phrase recognition and negation are limited. Pediatric, pregnancy and serious-condition contexts need clinician review. The interface exposes sources and limitations. A diagnostic product requires qualified clinical validation and appropriate regulatory, security and privacy review; none is implied by this app.

### Medical images

Files are selected into browser memory, **not uploaded to a server**. View/delete PNG and JPEG images, or supported **DICOM Part 10**, with zoom and contrast controls.

DICOM support: single-frame, 8/16-bit MONOCHROME1/2, Implicit/Explicit VR Little Endian; signed/stored bits, rescale and LINEAR windowing. Maximum 32 MiB/file, 4096 pixels/side and 8,388,608 pixels. Unsupported compressed/encapsulated/deflated/Big Endian, multiframe, color/palette, floating point, LUT/nonlinear presentation and raw non-Part-10 studies are rejected explicitly. Animated PNG is unsupported.

No disease detection, radiology interpretation, orientation correction or calibrated clinical measurement. Patient tags/filenames are not listed, but identifiers burned into pixels can still be visible. Deletion releases/zeros retained buffers and canvases; JavaScript cannot promise secure erasure of browser/OS copies or original files.

### Mental wellbeing

Optional consented mood/stress/sleep check-ins and a session journal, individual deletion, self-paced sensory grounding and a stoppable gentle breathing exercise. Exercises stop when leaving the workspace or hiding the tab. Check-ins are unscored self-reports, **not diagnoses or crisis monitoring**. Crisis resources include local emergency guidance, US 988, Samaritans and country-based support. Breathing exercises are not for acute breathing difficulty.

### Development departments

Thirteen real recurring Hermes jobs were configured on the owner's VPS: Organ Systems Research, Wearable Integration, Sales, iOS Engineering, Android Engineering, Web Engineering, Art & Visualization, Education, Finance, Research, Mental Health, Clinical Safety & Chat, and Medical Imaging.

`data/departments.json` is a timestamped **deployment snapshot**, not live worker status. The Departments workspace shows actual configured job IDs, missions and Monday/Thursday schedules (scheduler timezone, UTC−05:00 when configured). Reports live under `/root/reports/body-lab/<department>/` on that private VPS, not in this public app. The Business Village also observes the jobs in its Body Lab room. These agents research and develop the product with synthetic data; they have no access or authority to process user health records. Native teams are deployed, but no native build, device integration, signing or store publication is claimed.

## Privacy and security

- Consent is off by default; imported summaries, chat, image data and wellbeing entries stay in the current page's memory. No cloud AI calls, analytics, IndexedDB or local/session storage for health data.
- **Clear all personal data**, consent withdrawal, local clear and page exit erase relevant app-held state. Reloading loses the session. External source links only open when deliberately selected; their sites have separate privacy policies.
- The local server serves allowlisted assets, denies private/repository files and all POST/PUT/PATCH/DELETE health routes, uses `no-store`, and restricts network connections through CSP. It is not a multi-user healthcare backend.
- Browser extensions, keyboard services, OS memory, screenshots and shared devices remain outside the app's guarantees. Do not use someone else's medical records without authorization. No HIPAA/GDPR compliance certification is claimed.
- The legacy health-aggregate upload, randomly mutated “research” parameters, their demo data and the obsolete standalone `prototype` entrypoint were removed. Reviewed source/code updates replace synthetic research claims.

## Verification

Node.js 22+ runs the behavior tests and renderer build; Python runs the HTTP boundary checks:

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

The suites cover importer boundaries, organ transfer invariants, symptom escalation/uncertainty, DICOM parsing/rendering and HTTP privacy boundaries. Synthetic fixtures are used; no real patient data is required.

Integrated Chromium checks exercised Apple XML import/preview/apply, baseline personalization, educational quiz feedback, organ response to food, emergency precedence despite normal wearable values, DICOM pixel rendering, wellbeing check-ins, stopped exercises, cross-workspace consent/data clearing, department cards and 390px layouts. This is engineering verification, not clinical validation or native iOS/Android device testing.

The 3D viewer was also checked in Chromium for actual organ raycast selection, linked lessons, surface/skeleton/combined/isolated layers, camera presets and zoom, keyboard rotation, reset, mobile layout and absence of external network requests. Visual realism does not establish anatomical or clinical validation.
