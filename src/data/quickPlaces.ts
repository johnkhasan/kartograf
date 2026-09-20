import type { LocationInfo } from '../types';

/**
 * One-tap starting points for the opening dialog. Coordinates are inlined so
 * picking one costs no geocoding round-trip — on a phone that is the
 * difference between the poster appearing instantly and waiting on Nominatim
 * with the keyboard covering half the screen.
 */
export const QUICK_PLACES: LocationInfo[] = [
  { name: 'Tashkent', country: 'Uzbekistan', lat: 41.3123, lng: 69.2787 },
  { name: 'Samarkand', country: 'Uzbekistan', lat: 39.6542, lng: 66.9597 },
  { name: 'Bukhara', country: 'Uzbekistan', lat: 39.7686, lng: 64.4556 },
  { name: 'Istanbul', country: 'Türkiye', lat: 41.0082, lng: 28.9784 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 },
];
