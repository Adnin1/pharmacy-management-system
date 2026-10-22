import type { DrugInteraction } from '../types/pharmacy';

interface InteractionRule {
  drugAKeywords: string[];
  drugBKeywords: string[];
  severity: 'major' | 'moderate' | 'minor';
  title: string;
  description: string;
  management: string;
}

const CLINICAL_INTERACTION_RULES: InteractionRule[] = [
  {
    drugAKeywords: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'quinolone'],
    drugBKeywords: ['calcium', 'magnesium', 'aluminum', 'antacid', 'iron', 'sucralfate'],
    severity: 'major',
    title: 'Quinolone Antibiotic + Antacid / Cation Chelation',
    description: 'Multivalent cations form insoluble chelates with fluoroquinolones, slashing antibiotic absorption by up to 85% and causing treatment failure.',
    management: 'Administer the fluoroquinolone at least 2 hours before or 4-6 hours after antacids/calcium/iron supplements.'
  },
  {
    drugAKeywords: ['warfarin', 'enoxaparin', 'clexane', 'clopidogrel', 'aspirin', 'rivaroxaban', 'heparin'],
    drugBKeywords: ['aceclofenac', 'diclofenac', 'ketorolac', 'naproxen', 'ibuprofen', 'meloxicam', 'indomethacin'],
    severity: 'major',
    title: 'Anticoagulant / Antiplatelet + NSAID Hemorrhage Risk',
    description: 'Concurrent use dramatically increases the risk of severe gastrointestinal ulceration, upper GI bleeding, and systemic hemorrhage.',
    management: 'Avoid co-prescribing if possible. If required, co-administer a proton pump inhibitor (e.g. Omeprazole/Esomeprazole) and monitor coagulation metrics closely.'
  },
  {
    drugAKeywords: ['sildenafil', 'tadalafil', 'vardenafil'],
    drugBKeywords: ['nitroglycerin', 'isosorbide', 'nitrate', 'nitro'],
    severity: 'major',
    title: 'PDE5 Inhibitor + Nitrate Severe Hypotension',
    description: 'Co-administration produces synergistic peripheral vasodilation leading to life-threatening, refractory hypotension and cardiovascular collapse.',
    management: 'STRICTLY CONTRAINDICATED. Never dispense nitrates within 24 hours of sildenafil or 48 hours of tadalafil.'
  },
  {
    drugAKeywords: ['morphine', 'tramadol', 'fentanyl', 'codeine', 'pethidine'],
    drugBKeywords: ['clonazepam', 'diazepam', 'alprazolam', 'lorazepam', 'midazolam', 'bromazepam'],
    severity: 'major',
    title: 'Opioid Analgesic + Benzodiazepine Sedation Alert',
    description: 'Combined CNS and respiratory depression can lead to profound sedation, respiratory arrest, coma, and fatal overdose.',
    management: 'FDA Black Box Warning. Limit dosages and duration to minimum required. Advise caregiver on signs of respiratory distress.'
  },
  {
    drugAKeywords: ['losartan', 'telmisartan', 'olmesartan', 'enalapril', 'ramipril', 'captopril'],
    drugBKeywords: ['spironolactone', 'eplerenone', 'potassium', 'aldactone'],
    severity: 'moderate',
    title: 'RAAS Blocker + Potassium Sparing Hyperkalemia',
    description: 'Dual inhibition of potassium excretion can precipitate severe hyperkalemia, cardiac conduction abnormalities, and arrhythmias.',
    management: 'Monitor serum potassium and creatinine within 1-2 weeks of initiating combination therapy, especially in diabetic or elderly patients.'
  },
  {
    drugAKeywords: ['atorvastatin', 'simvastatin', 'lovastatin'],
    drugBKeywords: ['azithromycin', 'clarithromycin', 'erythromycin', 'itraconazole', 'ketoconazole'],
    severity: 'moderate',
    title: 'CYP3A4 Statin + Macrolide / Azole Myopathy Risk',
    description: 'Inhibition of CYP3A4-mediated statin clearance elevates statin plasma concentrations, elevating risk of severe rhabdomyolysis and myopathy.',
    management: 'Consider temporarily withholding the statin during short antimicrobial courses, or switch to rosuvastatin/pravastatin.'
  },
  {
    drugAKeywords: ['gliclazide', 'glimepiride', 'glipizide'],
    drugBKeywords: ['fluconazole', 'miconazole'],
    severity: 'moderate',
    title: 'Sulfonylurea + Fluconazole Severe Hypoglycemia',
    description: 'Fluconazole potently inhibits CYP2C9 metabolism of sulfonylureas, prolonging drug half-life and precipitating severe hypoglycemia.',
    management: 'Instruct patient to monitor blood glucose frequently and adjust sulfonylurea dosage downward if necessary.'
  },
  {
    drugAKeywords: ['omeprazole', 'esomeprazole', 'pantoprazole', 'rabeprazole'],
    drugBKeywords: ['famotidine', 'ranitidine'],
    severity: 'minor',
    title: 'Dual Acid Suppressants (PPI + H2 Blocker Redundancy)',
    description: 'Simultaneous administration of PPI and H2 receptor antagonist provides negligible clinical benefit and causes pharmacodynamic competition.',
    management: 'Discontinue the H2RA or space them apart (PPI in the morning before breakfast, H2RA at bedtime for nocturnal acid breakthrough).'
  }
];

export function checkDrugInteractions(
  medicines: { id: string; name: string; genericName: string }[]
): DrugInteraction[] {
  if (medicines.length < 2) return [];

  const detected: DrugInteraction[] = [];
  const checkedPairs = new Set<string>();

  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const medA = medicines[i];
      const medB = medicines[j];
      const pairKey = [medA.id, medB.id].sort().join(':');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      const strA = `${medA.name} ${medA.genericName}`.toLowerCase();
      const strB = `${medB.name} ${medB.genericName}`.toLowerCase();

      for (let rIdx = 0; rIdx < CLINICAL_INTERACTION_RULES.length; rIdx++) {
        const rule = CLINICAL_INTERACTION_RULES[rIdx];

        const matchAFirst = rule.drugAKeywords.some((k) => strA.includes(k)) && rule.drugBKeywords.some((k) => strB.includes(k));
        const matchBFirst = rule.drugAKeywords.some((k) => strB.includes(k)) && rule.drugBKeywords.some((k) => strA.includes(k));

        if (matchAFirst || matchBFirst) {
          detected.push({
            id: `inter-${Date.now()}-${rIdx}`,
            drugs: [medA.name, medB.name],
            severity: rule.severity,
            description: `${rule.title}: ${rule.description}`,
            management: rule.management
          });
        }
      }
    }
  }

  return detected;
}
