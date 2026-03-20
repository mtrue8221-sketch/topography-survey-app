import { SurveyPoint } from './db';

/**
 * Calculates the Haversine distance between two points in meters.
 */
export function calculateDistance(p1: SurveyPoint, p2: SurveyPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates the area of a polygon in square meters using the Shoelace formula.
 * Simplified for small areas (planar approximation).
 */
export function calculateArea(points: SurveyPoint[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const R = 6371000; // Earth radius in meters

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    // Convert lat/lng to meters (approximate)
    const x1 = R * (p1.longitude * Math.PI / 180) * Math.cos(p1.latitude * Math.PI / 180);
    const y1 = R * (p1.latitude * Math.PI / 180);
    const x2 = R * (p2.longitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180);
    const y2 = R * (p2.latitude * Math.PI / 180);

    area += (x1 * y2) - (x2 * y1);
  }

  return Math.abs(area) / 2;
}

/**
 * Calculates slope between two points as a percentage.
 */
export function calculateSlope(p1: SurveyPoint, p2: SurveyPoint): number {
  const horizontalDist = calculateDistance(p1, p2);
  if (horizontalDist === 0) return 0;
  const verticalDist = Math.abs(p1.elevation - p2.elevation);
  return (verticalDist / horizontalDist) * 100;
}

/**
 * Generates a GeoJSON representation of the points.
 */
export function exportToGeoJSON(points: SurveyPoint[]): string {
  const featureCollection = {
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.longitude, p.latitude, p.elevation]
      },
      properties: {
        id: p.id,
        name: p.name,
        description: p.description,
        timestamp: new Date(p.timestamp).toISOString()
      }
    }))
  };
  return JSON.stringify(featureCollection, null, 2);
}

/**
 * Generates a CSV representation of the points.
 */
export function exportToCSV(points: SurveyPoint[]): string {
  const header = 'ID,Name,Description,Latitude,Longitude,Elevation,Timestamp\n';
  const rows = points.map(p => 
    `${p.id},"${p.name}","${p.description}",${p.latitude},${p.longitude},${p.elevation},"${new Date(p.timestamp).toISOString()}"`
  ).join('\n');
  return header + rows;
}
