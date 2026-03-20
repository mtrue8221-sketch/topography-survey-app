import Dexie, { type Table } from 'dexie';

export interface SurveyPoint {
  id?: number;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timestamp: number;
  accuracy?: number;
}

export class SurveyDatabase extends Dexie {
  points!: Table<SurveyPoint>;

  constructor() {
    super('SurveyDatabase');
    this.version(1).stores({
      points: '++id, name, timestamp'
    });
  }
}

export const db = new SurveyDatabase();
