import type { Category } from '../src/db/schema.ts';

/** Commodities commonly tracked in Davao City public markets. Prices are not seeded here. */
export const CATALOG: { slug: string; name: string; category: Category; unit: string }[] = [
  { slug: 'pork-kasim', name: 'Pork Kasim (shoulder)', category: 'meat', unit: 'kg' },
  { slug: 'pork-liempo', name: 'Pork Liempo (belly)', category: 'meat', unit: 'kg' },
  { slug: 'beef-brisket', name: 'Beef Brisket', category: 'meat', unit: 'kg' },
  { slug: 'chicken-whole-dressed', name: 'Whole Chicken (dressed)', category: 'meat', unit: 'kg' },
  { slug: 'yellowfin-tuna', name: 'Yellowfin Tuna', category: 'fish', unit: 'kg' },
  { slug: 'bangus', name: 'Bangus (milkfish)', category: 'fish', unit: 'kg' },
  { slug: 'tilapia', name: 'Tilapia', category: 'fish', unit: 'kg' },
  { slug: 'galunggong', name: 'Galunggong (round scad)', category: 'fish', unit: 'kg' },
  { slug: 'squid', name: 'Pusit (squid)', category: 'fish', unit: 'kg' },
  { slug: 'egg-chicken-medium', name: 'Chicken Egg (medium)', category: 'eggs', unit: 'pc' },
  { slug: 'egg-chicken-large', name: 'Chicken Egg (large)', category: 'eggs', unit: 'pc' },
  { slug: 'egg-duck', name: 'Duck Egg (itlog pato)', category: 'eggs', unit: 'pc' },
  { slug: 'tomato', name: 'Tomato', category: 'vegetables', unit: 'kg' },
  { slug: 'onion-red', name: 'Red Onion', category: 'vegetables', unit: 'kg' },
  { slug: 'cabbage', name: 'Cabbage', category: 'vegetables', unit: 'kg' },
  { slug: 'eggplant', name: 'Eggplant (talong)', category: 'vegetables', unit: 'kg' },
  { slug: 'ampalaya', name: 'Ampalaya (bitter gourd)', category: 'vegetables', unit: 'kg' },
  { slug: 'pechay', name: 'Pechay', category: 'vegetables', unit: 'kg' },
  { slug: 'carrots', name: 'Carrots', category: 'vegetables', unit: 'kg' },
  { slug: 'banana-lakatan', name: 'Banana (lakatan)', category: 'fruits', unit: 'kg' },
  { slug: 'durian', name: 'Durian', category: 'fruits', unit: 'kg' },
  { slug: 'pomelo', name: 'Pomelo', category: 'fruits', unit: 'kg' },
  { slug: 'mango-carabao', name: 'Mango (carabao)', category: 'fruits', unit: 'kg' },
  { slug: 'mangosteen', name: 'Mangosteen', category: 'fruits', unit: 'kg' },
];
