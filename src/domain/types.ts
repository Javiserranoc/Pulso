export type Sport = 'run' | 'swim' | 'bike' | 'gym' | 'rest' | 'race';
export type Subtype = 'pool' | 'open_water' | 'road' | 'trainer';
export type Status = 'planned' | 'done';
export type Source = 'garmin' | 'strava' | 'file';

/** Una sesión de entrenamiento, planificada o hecha. */
export interface Session {
  id?: number;
  /** Fecha local en formato YYYY-MM-DD. */
  date: string;
  sport: Sport;
  subtype?: Subtype;
  title: string;
  /** Estructura en texto libre (p. ej. «10×100 a 1:45, rec. 20″»). */
  notes: string;
  /** Distancia siempre en metros, sea cual sea el deporte. */
  distanceM?: number;
  /** Duración en segundos. */
  durationS?: number;
  /** Intensidad 1–5 (Z1–Z5), opcional. */
  zone?: number;
  /** Tipo de sesión de gimnasio (empuje, tracción…). */
  gymTags?: string[];
  status: Status;
  /** De dónde vienen la distancia y el tiempo, si se importaron. */
  source?: Source;
  /** Identificador de la actividad en origen («garmin:123», «strava:456», «file:…»), para no duplicar. */
  externalId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Plantilla reutilizable para rellenar una sesión con un toque. */
export interface Template {
  id?: number;
  sport: Sport;
  subtype?: Subtype;
  title: string;
  notes: string;
  distanceM?: number;
  gymTags?: string[];
  builtin?: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}
