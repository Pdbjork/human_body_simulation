// Editorial review date means these linked pages were consulted, not clinical validation.
export const evidenceReviewedAt = '2026-09-27';
export const anatomySources = {
    digestion: { title: 'NIDDK — Your Digestive System & How It Works', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works', publisherReviewed: 'December 2017' },
    insulin: { title: 'NIDDK — Insulin Resistance & Prediabetes', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/what-is-diabetes/prediabetes-insulin-resistance', publisherReviewed: 'March 2025' },
    glucagon: { title: 'NIDDK — Low Blood Glucose (Hypoglycemia)', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia', publisherReviewed: 'July 2021' },
    kidneys: { title: 'NIDDK — Your Kidneys & How They Work', url: 'https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work', publisherReviewed: 'June 2018' },
    urea: { title: 'MedlinePlus — Ammonia Levels (liver-to-kidney pathway)', url: 'https://medlineplus.gov/lab-tests/ammonia-levels/', publisherReviewed: 'Not displayed on source page' },
    heart: { title: 'NHLBI — How the Heart Works', url: 'https://www.nhlbi.nih.gov/health/heart', publisherReviewed: 'March 24, 2022' },
    lungs: { title: 'NHLBI — How the Lungs Work', url: 'https://www.nhlbi.nih.gov/health/lungs', publisherReviewed: 'March 24, 2022' }
};

export const organs = [
    {
        id: 'heart', name: 'Heart', system: 'Circulatory system',
        function: 'The heart pumps blood through vessels. Blood brings oxygen and nutrients to organs and carries carbon dioxide back to the lungs.',
        connection: 'The lungs exchange gases; the heart moves the blood that carries them. Nervous and endocrine signals also influence heart rate.',
        model: 'The existing Circulatory agent changes a fictional heart-rate and pressure display. It does not model cardiac output, blood volume, arrhythmias, or disease risk.',
        sources: ['heart'],
        question: 'What connects lung gas exchange to the rest of the body?',
        options: ['Blood pumped through the circulatory system', 'Food moving through the stomach', 'Urine moving through the ureters'], answer: 0,
        explanation: 'Blood carries oxygen from the lungs to tissues and returns carbon dioxide to the lungs.'
    },
    {
        id: 'lungs', name: 'Lungs', system: 'Respiratory system',
        function: 'Oxygen moves from inhaled air into the blood, while carbon dioxide moves from blood into the lungs to be exhaled.',
        connection: 'Gas exchange depends on the respiratory and circulatory systems working together. The brain helps regulate breathing.',
        model: 'The existing Respiratory agent has a simplified breathing/oxygen relationship. Its values are not pulse-oximeter readings or a test of lung function.',
        sources: ['lungs', 'heart'],
        question: 'Which gas normally moves from the blood into the lungs to be exhaled?',
        options: ['Oxygen only', 'Carbon dioxide', 'Neither gas'], answer: 1,
        explanation: 'Carbon dioxide leaves the blood and is breathed out; oxygen moves into the blood.'
    },
    {
        id: 'liver', name: 'Liver', system: 'Digestive and metabolic systems',
        function: 'The liver processes and stores absorbed nutrients and makes bile. It also converts ammonia into urea, which the kidneys remove.',
        connection: 'Nutrients arrive from the intestine. Hormone signals coordinate glucose storage and release; urea moves through blood from liver to kidneys.',
        model: 'New Liver agent: a finite glycogen reserve exchanges toy glucose units with the shared glucose variable. A constant assumed turnover adds urea to a separate pool cleared only by the Kidneys agent. Bile and ammonia concentrations are not modeled.',
        sources: ['digestion', 'insulin', 'glucagon', 'urea'],
        question: 'Which pathway correctly describes the liver–kidney partnership?',
        options: ['Kidneys make bile and the liver stores urine', 'The liver pumps urine directly to the lungs', 'The liver makes urea from ammonia; kidneys remove urea in urine'], answer: 2,
        explanation: 'The liver changes ammonia into urea. The bloodstream carries this waste to the kidneys for removal.'
    },
    {
        id: 'pancreas', name: 'Pancreas', system: 'Endocrine and digestive systems',
        function: 'The pancreas makes insulin, a hormone that helps glucose enter cells. It also sends digestive enzymes through ducts into the small intestine.',
        connection: 'Insulin links the pancreas to muscle, fat and liver metabolism. Glucagon is a counter-regulatory hormone that raises blood glucose.',
        model: 'New Pancreas agent alone updates insulin and glucagon signals. Endocrine retains peripheral glucose uptake; the Liver agent handles only storage/release. Enzymes and individual insulin dosing are not simulated.',
        sources: ['insulin', 'digestion', 'glucagon'],
        question: 'Why does the pancreas belong to more than one body system?',
        options: ['It produces hormones and digestive enzymes', 'It filters urine and pumps blood', 'It exchanges oxygen and carbon dioxide'], answer: 0,
        explanation: 'Hormones enter the blood (endocrine function), while digestive enzymes enter the intestine through ducts (exocrine function).'
    },
    {
        id: 'kidneys', name: 'Kidneys', system: 'Urinary system',
        function: 'Kidney nephrons filter blood. Tubules return needed water and substances to the blood; wastes and extra water become urine.',
        connection: 'The kidneys receive blood through renal arteries and remove wastes including urea from liver metabolism. They also help regulate water, minerals, acids and blood pressure.',
        model: 'New Kidneys agent removes only the shared toy urea pool. Its assumed hydration-dependent factor is not eGFR. Excretory is now a read-only overview; the legacy lymphatic toxin pool is separate. No extra fluid loss is added.',
        sources: ['kidneys', 'urea'],
        question: 'Does all the fluid filtered by the kidneys become urine?',
        options: ['Yes, none returns to blood', 'No, tubules return most water and needed substances to blood', 'Only if the heart stops'], answer: 1,
        explanation: 'Filtration is followed by reabsorption. Most filtered water and needed substances return to the blood.'
    },
    {
        id: 'intestine', name: 'Small intestine', system: 'Digestive system',
        function: 'The small intestine mixes food with digestive juices and absorbs most digested nutrients into the bloodstream.',
        connection: 'Pancreatic enzymes and liver-produced bile assist digestion; absorbed nutrients travel through the circulation to other organs.',
        model: 'The existing Digestive agent adds a single fictional glucose increment when the meal button is used. It does not model meal composition, absorption delays, allergies or nutrition needs.',
        sources: ['digestion'],
        question: 'Where are most digested food nutrients absorbed?',
        options: ['The bladder', 'The lungs', 'The small intestine'], answer: 2,
        explanation: 'The small intestine absorbs most nutrients. The large intestine also absorbs water and helps form stool.'
    }
];

// Implementation audit: these describe code ownership, not physiological evidence.
export const existingSystemAudit = [
    ['Nervous', 'Stress signaling; retains adrenaline/cortisol ownership.'],
    ['Circulatory', 'Fictional heart-rate/pressure response; no new duplicate pump.'],
    ['Respiratory', 'Existing breathing/oxygen dynamics retained.'],
    ['Digestive', 'Meal glucose input retained; insulin requests removed.'],
    ['Endocrine', 'Peripheral glucose uptake retained; insulin secretion/decay moved to Pancreas.'],
    ['Musculoskeletal', 'Activity/ATP effects retained; no second exercise sink.'],
    ['Immune', 'Existing stress-dependent status retained.'],
    ['Excretory', 'Former status-only model now reads kidney pool; does not clear it.'],
    ['Brain', 'Existing derived state retained; no new cognitive model.'],
    ['Lymphatic', 'Legacy toxinLevel sink retained; not reused as urea.'],
    ['Sensory', 'Existing inflammation/pain relationship retained.'],
    ['Thermoregulation', 'Existing temperature/sweating fluid loss retained; kidney adds no fluid loss.'],
    ['Sleep/Circadian', 'Existing sleep/ATP dynamics retained.'],
    ['Reproductive', 'Existing illustrative cycle retained; not personalized.']
];
