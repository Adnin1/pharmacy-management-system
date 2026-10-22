import { describe, it, expect } from 'vitest';
import { checkDrugInteractions } from './clinicalRules';

describe('Clinical Decision Support System (CDSS) - Drug Interaction Engine', () => {
  it('returns empty array if less than 2 medicines are in the cart', () => {
    expect(checkDrugInteractions([])).toEqual([]);
    expect(
      checkDrugInteractions([
        { id: '1', name: 'Napa 500mg', genericName: 'Paracetamol' },
      ])
    ).toEqual([]);
  });

  it('detects Quinolone + Multivalent Cation Antacid chelation interaction', () => {
    const cart = [
      { id: '1', name: 'Ciprocin 500mg', genericName: 'Ciprofloxacin' },
      { id: '2', name: 'Antacid Plus', genericName: 'Magnesium Hydroxide + Aluminium Hydroxide' },
    ];

    const interactions = checkDrugInteractions(cart);
    expect(interactions.length).toBe(1);
    expect(interactions[0].severity).toBe('major');
    expect(interactions[0].description).toContain('insoluble chelates');
    expect(interactions[0].management).toContain('at least 2 hours before');
  });

  it('detects Anticoagulant + NSAID life-threatening bleeding risk', () => {
    const cart = [
      { id: '1', name: 'Warfarin 5mg', genericName: 'Warfarin Sodium' },
      { id: '2', name: 'Aceclofenac 100mg', genericName: 'Aceclofenac' },
    ];

    const interactions = checkDrugInteractions(cart);
    expect(interactions.length).toBe(1);
    expect(interactions[0].severity).toBe('major');
    expect(interactions[0].description).toContain('gastrointestinal ulceration');
  });

  it('detects PDE5 Inhibitor + Nitrate severe refractory hypotension contraindication', () => {
    const cart = [
      { id: '1', name: 'Silagra 50mg', genericName: 'Sildenafil' },
      { id: '2', name: 'Nitrocard 2.6mg', genericName: 'Nitroglycerin' },
    ];

    const interactions = checkDrugInteractions(cart);
    expect(interactions.length).toBe(1);
    expect(interactions[0].severity).toBe('major');
    expect(interactions[0].management).toContain('STRICTLY CONTRAINDICATED');
  });

  it('detects Opioid Analgesic + Benzodiazepine sedation and respiratory depression', () => {
    const cart = [
      { id: '1', name: 'Tramadol 50mg', genericName: 'Tramadol Hydrochloride' },
      { id: '2', name: 'Rivotril 0.5mg', genericName: 'Clonazepam' },
    ];

    const interactions = checkDrugInteractions(cart);
    expect(interactions.length).toBe(1);
    expect(interactions[0].severity).toBe('major');
    expect(interactions[0].management).toContain('FDA Black Box Warning');
  });

  it('returns no alerts for safe clinical combinations', () => {
    const cart = [
      { id: '1', name: 'Napa 500mg', genericName: 'Paracetamol' },
      { id: '2', name: 'Seclo 20mg', genericName: 'Omeprazole' },
      { id: '3', name: 'Fexo 120mg', genericName: 'Fexofenadine' },
    ];

    const interactions = checkDrugInteractions(cart);
    expect(interactions.length).toBe(0);
  });
});
