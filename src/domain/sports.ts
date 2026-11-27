import type { Sport, Subtype, Template } from './types';

export interface SportConfig {
  id: Sport;
  name: string;
  short: string;
  /** Unidad en la que se escribe y se muestra la distancia. */
  unit: 'km' | 'm' | null;
  subtypes: { id: Subtype; name: string }[];
  /** Distancias rápidas, en la unidad del deporte. */
  presets: number[];
  /** Atajos de texto para la estructura. */
  inserts: string[];
  /** Cuenta para los acumulados de volumen. */
  counts: boolean;
}

export const SPORTS: Record<Sport, SportConfig> = {
  run: { id: 'run', name: 'Correr', short: 'Correr', unit: 'km', subtypes: [], presets: [5, 8, 10, 12, 16, 21.1], inserts: ['Calentamiento', 'Series', '×', 'rec.', 'Z2', 'a ritmo', 'Vuelta calma'], counts: true },
  swim: { id: 'swim', name: 'Natación', short: 'Nadar', unit: 'm', subtypes: [{ id: 'pool', name: 'Piscina' }, { id: 'open_water', name: 'Aguas abiertas' }], presets: [1000, 1500, 2000, 2400, 3000], inserts: ['Calentamiento', 'Series', '×', 'rec.', 'pull', 'técnica', 'Vuelta calma'], counts: true },
  bike: { id: 'bike', name: 'Bici', short: 'Bici', unit: 'km', subtypes: [{ id: 'road', name: 'Calle' }, { id: 'trainer', name: 'Rodillo' }], presets: [20, 30, 45, 60, 80], inserts: ['Calentamiento', 'Series', '×', 'rec.', 'Z2', 'cadencia', 'Vuelta calma'], counts: true },
  gym: { id: 'gym', name: 'Gimnasio', short: 'Gym', unit: null, subtypes: [], presets: [], inserts: ['Series', '×', 'rec.', 'Core', 'Circuito'], counts: true },
  rest: { id: 'rest', name: 'Descanso', short: 'Descanso', unit: null, subtypes: [], presets: [], inserts: [], counts: false },
  race: { id: 'race', name: 'Competición', short: 'Carrera', unit: 'km', subtypes: [], presets: [5, 10, 21.1, 42.2], inserts: ['Objetivo', 'Resultado'], counts: false }
};

export const SPORT_ORDER: Sport[] = ['run', 'swim', 'bike', 'gym', 'rest', 'race'];
export const VOLUME_SPORTS: Sport[] = ['swim', 'run', 'bike', 'gym'];
export const GYM_TAGS = ['Empuje', 'Tracción', 'Torso', 'Pierna', 'Core', 'Full body'];
export const ZONES = [1, 2, 3, 4, 5];

export function subtypeName(subtype?: Subtype): string {
  if (!subtype) return '';
  for (const s of Object.values(SPORTS)) {
    const f = s.subtypes.find((x) => x.id === subtype);
    if (f) return f.name;
  }
  return '';
}

export const BUILTIN_TEMPLATES: Template[] = [
  { sport: 'run', title: 'Rodaje Z2', distanceM: 10000, notes: '10 km Z2 continuo', builtin: true },
  { sport: 'run', title: 'Series MTT', distanceM: 8000, notes: 'Calentamiento 2 km · 6×1000 a 4:10, rec. 1′30″ · 1 km suave', builtin: true },
  { sport: 'run', title: 'Tirada larga', distanceM: 16000, notes: '16 km Z2, últimos 3 a ritmo', builtin: true },
  { sport: 'swim', subtype: 'pool', title: 'Series MTT', distanceM: 2400, notes: 'Calentamiento 400 · 10×100 a 1:45, rec. 20″ · 4×200 pull · 200 suave', builtin: true },
  { sport: 'swim', subtype: 'pool', title: 'Técnica', distanceM: 1500, notes: 'Calentamiento 300 · 8×50 técnica · 6×100 suave', builtin: true },
  { sport: 'swim', subtype: 'open_water', title: 'Mar continuo', distanceM: 2000, notes: '2.000 continuo Z2', builtin: true },
  { sport: 'bike', subtype: 'trainer', title: '45′ Rodillo', distanceM: 22000, notes: '45′ Z2 en rodillo', builtin: true },
  { sport: 'bike', subtype: 'road', title: '90′ Z2', distanceM: 45000, notes: '90′ Z2 llano', builtin: true },
  { sport: 'bike', subtype: 'road', title: 'Salida larga', distanceM: 80000, notes: 'Salida larga, 3 h Z2', builtin: true },
  { sport: 'gym', title: 'Empuje + Core', gymTags: ['Empuje', 'Core'], notes: '', builtin: true },
  { sport: 'gym', title: 'Tracción', gymTags: ['Tracción'], notes: '', builtin: true },
  { sport: 'gym', title: 'Torso', gymTags: ['Torso'], notes: '', builtin: true }
];
