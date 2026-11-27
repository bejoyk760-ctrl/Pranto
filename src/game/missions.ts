import type { MissionDef } from './types';

export const CAMPAIGN_MISSIONS: MissionDef[] = [
  {
    id: 'ocean-courier',
    title: 'Ocean Drive Courier',
    subtitle: 'Deliver urgent coastal blueprints across the South Lagoon Bridge.',
    reward: 500,
    checkpoints: [
      {
        id: 'oc-1',
        label: 'Pick up blueprints at Coral Reef Hotel',
        x: 34,
        z: -24,
        radius: 5.5,
      },
      {
        id: 'oc-2',
        label: 'Cross the Ocean Drive Bridge',
        x: 48,
        z: 72,
        radius: 7.5,
      },
      {
        id: 'oc-3',
        label: 'Deliver to South Bay Marina',
        x: 24,
        z: 108,
        radius: 6.5,
      },
    ],
  },
  {
    id: 'sunset-transit',
    title: 'Coastal Grand Prix',
    subtitle: 'Grab any car or motorcycle and hit the coastal boulevard gates.',
    reward: 850,
    checkpoints: [
      {
        id: 'st-1',
        label: 'Drive through Central Blvd Gate',
        x: 0,
        z: 24,
        radius: 8,
        requireVehicle: true,
      },
      {
        id: 'st-2',
        label: 'Speed past Palm Park Curve',
        x: -48,
        z: -48,
        radius: 8,
        requireVehicle: true,
      },
      {
        id: 'st-3',
        label: 'Finish at Pier Avenue Plaza',
        x: 48,
        z: 0,
        radius: 8,
        requireVehicle: true,
      },
    ],
  },
  {
    id: 'bayfront-tour',
    title: 'Solana Bay Landmarks',
    subtitle: 'Tour the city’s iconic landmarks from the fountain to the pier tip.',
    reward: 1200,
    checkpoints: [
      {
        id: 'bt-1',
        label: 'Visit Palm Park Fountain',
        x: -24,
        z: -72,
        radius: 6.5,
      },
      {
        id: 'bt-2',
        label: 'Reach Downtown Skyline Plaza',
        x: -24,
        z: 18,
        radius: 6.5,
      },
      {
        id: 'bt-3',
        label: 'Arrive at Ocean Pier Lookout',
        x: 124,
        z: 0,
        radius: 6.5,
      },
    ],
  },
];

export interface StarPickupDef {
  id: string;
  x: number;
  z: number;
}

export const GOLDEN_STARS: StarPickupDef[] = [
  { id: 'star-1', x: 68, z: -32 }, // Beachfront
  { id: 'star-2', x: 112, z: 0 }, // Ocean Pier
  { id: 'star-3', x: -24, z: -72 }, // Palm Park Fountain
  { id: 'star-4', x: 0, z: 72 }, // Central Bridge Crest
  { id: 'star-5', x: -96, z: 72 }, // West Bridge Crest
  { id: 'star-6', x: -72, z: -24 }, // Suburban Plaza
  { id: 'star-7', x: 24, z: 24 }, // Art Deco Courtyard
  { id: 'star-8', x: -72, z: 112 }, // South Villa Garden
];
