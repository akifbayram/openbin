import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { generateUuid, getDb, querySync } from '../db.js';
import { config } from './config.js';
import { pushLog } from './logBuffer.js';
import { generateShortCode } from './shortCode.js';

interface DemoBin {
  name: string;
  area: string;
  items: string[];
  tags: string[];
  icon: string;
  color: string;
  notes: string;
}

const DEMO_BINS: DemoBin[] = [
  {
    name: 'Power Tools',
    area: 'Garage',
    items: ['Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander', 'Drill bit set'],
    tags: ['tools', 'electric'],
    icon: '🔧',
    color: '#e74c3c',
    notes: 'Keep batteries charged. Drill bit set is metric.',
  },
  {
    name: 'Holiday Decorations',
    area: 'Storage Room',
    items: ['String lights', 'Ornaments box', 'Wreath', 'Tree stand', 'Stockings'],
    tags: ['seasonal', 'holiday'],
    icon: '🎄',
    color: '#2ecc71',
    notes: 'Fragile ornaments wrapped in tissue paper.',
  },
  {
    name: 'Baking Supplies',
    area: 'Kitchen',
    items: ['Flour', 'Sugar', 'Baking powder', 'Vanilla extract', 'Cupcake liners', 'Rolling pin'],
    tags: ['food', 'baking'],
    icon: '🧁',
    color: '#f39c12',
    notes: 'Check expiration dates quarterly.',
  },
  {
    name: 'Office Supplies',
    area: 'Office',
    items: ['Stapler', 'Paper clips', 'Sticky notes', 'Pens', 'Highlighters', 'Tape dispenser'],
    tags: ['office', 'supplies'],
    icon: '📎',
    color: '#3498db',
    notes: '',
  },
  {
    name: 'First Aid Kit',
    area: 'Kitchen',
    items: ['Bandages', 'Antiseptic wipes', 'Gauze pads', 'Medical tape', 'Tweezers', 'Ibuprofen'],
    tags: ['medical', 'emergency'],
    icon: '🩹',
    color: '#e74c3c',
    notes: 'Restock after use. Check medication expiry dates.',
  },
  {
    name: 'Winter Gear',
    area: 'Closet',
    items: ['Snow boots', 'Thermal gloves', 'Wool scarf', 'Beanie', 'Hand warmers'],
    tags: ['seasonal', 'clothing'],
    icon: '🧤',
    color: '#9b59b6',
    notes: '',
  },
  {
    name: 'Cables & Adapters',
    area: 'Office',
    items: ['USB-C cables', 'HDMI cable', 'Ethernet cable', 'Power strip', 'USB hub', 'Lightning cable'],
    tags: ['electronics', 'cables'],
    icon: '🔌',
    color: '#1abc9c',
    notes: 'Labeled by type with colored tape.',
  },
  {
    name: 'Paint Supplies',
    area: 'Garage',
    items: ['Paint rollers', 'Drop cloth', 'Painter tape', 'Brushes', 'Paint tray'],
    tags: ['tools', 'home improvement'],
    icon: '🎨',
    color: '#e67e22',
    notes: 'Leftover wall paint colors noted on lids.',
  },
  {
    name: 'Board Games',
    area: 'Closet',
    items: ['Catan', 'Ticket to Ride', 'Codenames', 'Uno', 'Playing cards'],
    tags: ['games', 'entertainment'],
    icon: '🎲',
    color: '#8e44ad',
    notes: 'Check for missing pieces periodically.',
  },
  {
    name: 'Cleaning Supplies',
    area: 'Storage Room',
    items: ['All-purpose cleaner', 'Sponges', 'Microfiber cloths', 'Glass cleaner', 'Rubber gloves'],
    tags: ['cleaning', 'supplies'],
    icon: '🧹',
    color: '#27ae60',
    notes: '',
  },
  {
    name: 'Tax Documents',
    area: 'Office',
    items: ['W-2 forms', 'Receipts folder', 'Tax returns 2024', 'Tax returns 2025', 'Property tax records'],
    tags: ['documents', 'financial'],
    icon: '📁',
    color: '#2c3e50',
    notes: 'Shred documents older than 7 years.',
  },
  {
    name: 'Camping Gear',
    area: 'Garage',
    items: ['Tent', 'Sleeping bag', 'Headlamp', 'Camping stove', 'Water filter', 'Tarp'],
    tags: ['outdoor', 'seasonal'],
    icon: '⛺',
    color: '#16a085',
    notes: 'Dry tent completely before storing to prevent mildew.',
  },
];

const TAG_COLORS: Record<string, string> = {
  tools: '#e74c3c',
  electric: '#e67e22',
  seasonal: '#f1c40f',
  holiday: '#2ecc71',
  food: '#e67e22',
  baking: '#f39c12',
  office: '#3498db',
  supplies: '#2980b9',
  medical: '#c0392b',
  emergency: '#e74c3c',
  clothing: '#9b59b6',
  electronics: '#1abc9c',
  cables: '#16a085',
  'home improvement': '#d35400',
  games: '#8e44ad',
  entertainment: '#9b59b6',
  cleaning: '#27ae60',
  documents: '#34495e',
  financial: '#2c3e50',
  outdoor: '#16a085',
};

export function seedDemoData(): void {
  if (!config.demoMode) return;

  const startTime = Date.now();
  const db = getDb();

  const runSeed = db.transaction(() => {
    // Delete existing demo user (cascade deletes all related data)
    const existing = querySync<{ id: string }>(
      'SELECT id FROM users WHERE username = $1',
      ['demo'],
    );
    if (existing.rows.length > 0) {
      querySync('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
    }

    // Create demo user with random password (nobody needs credentials)
    const userId = generateUuid();
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = bcrypt.hashSync(randomPassword, 4);

    querySync(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)',
      [userId, 'demo', passwordHash, 'Demo User'],
    );

    // Create demo location
    const locationId = generateUuid();
    const inviteCode = crypto.randomBytes(16).toString('hex');

    querySync(
      'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
      [locationId, 'Demo Location', userId, inviteCode],
    );

    // Add user as admin
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), locationId, userId, 'admin'],
    );

    // Set active location
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [locationId, userId]);

    // Create areas
    const areaNames = ['Garage', 'Kitchen', 'Office', 'Closet', 'Storage Room'];
    const areaMap = new Map<string, string>();

    for (const areaName of areaNames) {
      const areaId = generateUuid();
      areaMap.set(areaName, areaId);
      querySync(
        'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
        [areaId, locationId, areaName, userId],
      );
    }

    // Create bins with items
    for (const bin of DEMO_BINS) {
      const binId = generateShortCode(bin.name);
      const areaId = areaMap.get(bin.area) ?? null;

      querySync(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, userId],
      );

      for (let i = 0; i < bin.items.length; i++) {
        querySync(
          'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
          [generateUuid(), binId, bin.items[i], i],
        );
      }
    }

    // Add tag colors
    for (const [tag, color] of Object.entries(TAG_COLORS)) {
      querySync(
        'INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)',
        [generateUuid(), locationId, tag, color],
      );
    }

    // Mark onboarding completed
    querySync(
      'INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)',
      [generateUuid(), userId, JSON.stringify({ onboarding_completed: true })],
    );
  });

  try {
    runSeed();
    const elapsed = Date.now() - startTime;
    const message = `Demo data seeded in ${elapsed}ms (${DEMO_BINS.length} bins, 5 areas)`;
    console.log(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    console.error('Failed to seed demo data:', err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
