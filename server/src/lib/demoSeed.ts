import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { generateUuid, getDb, querySync } from '../db.js';
import { config } from './config.js';
import { pushLog } from './logBuffer.js';
import { generateShortCode } from './shortCode.js';

interface DemoBin {
  name: string;
  location: 'home' | 'storage';
  area: string;
  items: string[];
  tags: string[];
  icon: string;
  color: string;
  cardStyle: string;
  notes: string;
}

const HOME_AREAS = ['Garage', 'Kitchen', "Kids' Room", 'Basement', 'Closet'];

const DEMO_BINS: DemoBin[] = [
  // ── Garage ──
  {
    name: 'Power Tools',
    location: 'home',
    area: 'Garage',
    items: ['Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander', 'Drill bit set'],
    tags: ['tools', 'dad'],
    icon: 'Wrench',
    color: '0:3',
    cardStyle: '',
    notes: 'Keep batteries charged. Drill bit set is metric.',
  },
  {
    name: 'Camping Gear',
    location: 'home',
    area: 'Garage',
    items: ['Tent', 'Sleeping bags (x4)', 'Headlamps', 'Camping stove', 'Water filter', 'Tarp'],
    tags: ['outdoor', 'seasonal', 'family'],
    icon: 'Leaf',
    color: '140:3',
    cardStyle: '',
    notes: 'Dry tent completely before storing to prevent mildew.',
  },
  {
    name: 'Bike Gear',
    location: 'home',
    area: 'Garage',
    items: ['Helmets (x3)', 'Bike pump', 'Tire patch kit', 'Bike lock', 'Training wheels'],
    tags: ['outdoor', 'sports'],
    icon: 'Bike',
    color: '45:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: 'neutral:3', stripePosition: 'top', stripeWidth: 3 }),
    notes: 'Check tire pressure before each ride. Training wheels fit 16" bike.',
  },
  {
    name: 'Sports Equipment',
    location: 'home',
    area: 'Garage',
    items: ['Soccer ball', 'Baseball gloves', 'Basketball', 'Jump ropes', 'Frisbee', 'Badminton set'],
    tags: ['sports', 'kids', 'outdoor'],
    icon: 'Star',
    color: '200:2',
    cardStyle: '',
    notes: 'Deflate balls slightly for storage. Pump in bike gear bin.',
  },
  {
    name: 'Gardening',
    location: 'home',
    area: 'Garage',
    items: ['Trowel', 'Pruning shears', 'Garden gloves', 'Seed packets', 'Plant food', 'Watering can'],
    tags: ['outdoor', 'garden'],
    icon: 'Leaf',
    color: '80:2',
    cardStyle: '',
    notes: 'Start seeds indoors in March. Tomato cages in shed.',
  },
  {
    name: 'Car Supplies',
    location: 'home',
    area: 'Garage',
    items: ['Jumper cables', 'Tire pressure gauge', 'Windshield washer fluid', 'Ice scraper', 'Emergency flares', 'First aid kit (car)'],
    tags: ['tools', 'emergency'],
    icon: 'Car',
    color: 'neutral:2',
    cardStyle: '',
    notes: 'Check emergency kit every spring. Washer fluid freezes below -20F.',
  },
  {
    name: 'Paint & Stain',
    location: 'home',
    area: 'Garage',
    items: ['Interior paint (eggshell white)', 'Deck stain', 'Paint rollers', 'Drop cloths', 'Painter tape', 'Brushes'],
    tags: ['tools', 'supplies'],
    icon: 'Paintbrush',
    color: '25:2',
    cardStyle: '',
    notes: 'Leftover paint colors noted on lids. Deck stain is semi-transparent cedar.',
  },

  // ── Kitchen ──
  {
    name: 'Baking Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['Flour', 'Sugar', 'Baking powder', 'Vanilla extract', 'Cupcake liners', 'Rolling pin'],
    tags: ['food', 'baking'],
    icon: 'Utensils',
    color: '25:1',
    cardStyle: '',
    notes: 'Check expiration dates quarterly.',
  },
  {
    name: 'First Aid Kit',
    location: 'home',
    area: 'Kitchen',
    items: ['Bandages', 'Antiseptic wipes', 'Gauze pads', 'Medical tape', 'Tweezers', 'Ibuprofen', "Children's Tylenol"],
    tags: ['medical', 'emergency'],
    icon: 'Heart',
    color: '0:4',
    cardStyle: '',
    notes: "Restock after use. Check medication expiry dates. Children's dosage chart taped inside lid.",
  },
  {
    name: 'Dog Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['Kibble', 'Treats', 'Leash', 'Poop bags', 'Chew toys', 'Flea medicine'],
    tags: ['pets', 'dog'],
    icon: 'Dog',
    color: '25:3',
    cardStyle: '',
    notes: 'Flea medicine due on the 1st of each month.',
  },
  {
    name: 'Cleaning Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['All-purpose cleaner', 'Sponges', 'Microfiber cloths', 'Glass cleaner', 'Rubber gloves'],
    tags: ['cleaning', 'supplies'],
    icon: 'Home',
    color: '140:1',
    cardStyle: '',
    notes: 'Keep out of reach of children.',
  },
  {
    name: 'Coffee & Tea',
    location: 'home',
    area: 'Kitchen',
    items: ['Coffee beans', 'Filters', 'Loose leaf tea', 'Honey', 'Travel mugs'],
    tags: ['food', 'beverages'],
    icon: 'Coffee',
    color: '25:4',
    cardStyle: '',
    notes: 'Beans stay fresh 2 weeks after opening. Grinder on counter.',
  },
  {
    name: 'Lunch Boxes & Bottles',
    location: 'home',
    area: 'Kitchen',
    items: ['Lunch boxes (x3)', 'Water bottles (x4)', 'Ice packs', 'Reusable snack bags', 'Thermos'],
    tags: ['kids', 'school'],
    icon: 'Box',
    color: '200:1',
    cardStyle: '',
    notes: 'Label everything with names. Replace ice packs each fall.',
  },

  // ── Kids' Room ──
  {
    name: 'School Supplies',
    location: 'home',
    area: "Kids' Room",
    items: ['Pencils', 'Crayons', 'Notebooks', 'Glue sticks', 'Safety scissors', 'Rulers'],
    tags: ['school', 'kids'],
    icon: 'Book',
    color: '220:2',
    cardStyle: '',
    notes: 'Restock at back-to-school sales in August.',
  },
  {
    name: 'Art & Craft Supplies',
    location: 'home',
    area: "Kids' Room",
    items: ['Watercolor paints', 'Construction paper', 'Pipe cleaners', 'Googly eyes', 'Pom poms', 'Markers', 'Sticker sheets'],
    tags: ['art', 'kids', 'hobbies'],
    icon: 'Paintbrush',
    color: '280:1',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '320:1' }),
    notes: 'Washable markers only! Keep paint lids sealed tight.',
  },
  {
    name: 'Baby & Toddler',
    location: 'home',
    area: "Kids' Room",
    items: ['Diapers', 'Wipes', 'Bottles', 'Pacifiers', 'Burp cloths', 'Teething rings'],
    tags: ['baby', 'kids'],
    icon: 'Baby',
    color: '320:1',
    cardStyle: '',
    notes: 'Rotate out items as baby grows. Size 3 diapers currently.',
  },
  {
    name: 'Costumes & Dress-Up',
    location: 'home',
    area: "Kids' Room",
    items: ['Princess dresses', 'Superhero capes', 'Pirate hat', 'Fairy wings', 'Face paint', 'Wigs'],
    tags: ['kids', 'costumes', 'seasonal'],
    icon: 'Scissors',
    color: '280:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '45:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: 'Halloween costumes on top. Wash face paint brushes after use.',
  },
  {
    name: 'LEGO & Building Toys',
    location: 'home',
    area: "Kids' Room",
    items: ['LEGO Classic bucket', 'LEGO City set', 'Magna-Tiles', 'Lincoln Logs', 'Instruction booklets'],
    tags: ['kids', 'games'],
    icon: 'Blocks',
    color: '45:1',
    cardStyle: '',
    notes: 'Sort by color or set. Small pieces — keep away from baby.',
  },
  {
    name: 'Stuffed Animals & Dolls',
    location: 'home',
    area: "Kids' Room",
    items: ['Teddy bear', 'Bunny plush', 'Dinosaur collection', 'Baby dolls (x2)', 'Doll clothes'],
    tags: ['kids', 'toys'],
    icon: 'Heart',
    color: '340:1',
    cardStyle: '',
    notes: 'Machine wash on gentle cycle. Air dry.',
  },

  // ── Basement ──
  {
    name: 'Holiday Decorations',
    location: 'home',
    area: 'Basement',
    items: ['String lights', 'Ornaments box', 'Wreath', 'Tree stand', 'Stockings', 'Advent calendar'],
    tags: ['seasonal', 'holiday'],
    icon: 'Gift',
    color: '140:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '0:3', stripePosition: 'left', stripeWidth: 4 }),
    notes: 'Fragile ornaments wrapped in tissue paper. Lights tested and working.',
  },
  {
    name: 'Important Documents',
    location: 'home',
    area: 'Basement',
    items: ['Birth certificates', 'Passports', 'Insurance policies', 'Property deed', 'Tax returns'],
    tags: ['documents', 'financial'],
    icon: 'Briefcase',
    color: 'neutral:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: 'Shred documents older than 7 years. Originals in fireproof safe.',
  },
  {
    name: 'Board Games',
    location: 'home',
    area: 'Basement',
    items: ['Candy Land', 'Uno', 'Sorry!', 'Jenga', 'Playing cards', 'Puzzles'],
    tags: ['games', 'family'],
    icon: 'Star',
    color: '280:3',
    cardStyle: '',
    notes: 'Check for missing pieces periodically.',
  },
  {
    name: 'Cables & Chargers',
    location: 'home',
    area: 'Basement',
    items: ['USB-C cables', 'HDMI cable', 'Lightning cable', 'Power strip', 'USB hub', 'Laptop charger'],
    tags: ['electronics', 'cables'],
    icon: 'Laptop',
    color: '170:2',
    cardStyle: '',
    notes: 'Labeled by type with colored tape.',
  },

  // ── Closet ──
  {
    name: 'Winter Gear',
    location: 'home',
    area: 'Closet',
    items: ['Snow boots', 'Thermal gloves', 'Wool scarf', 'Beanie', 'Hand warmers'],
    tags: ['seasonal', 'clothing'],
    icon: 'Shirt',
    color: '245:2',
    cardStyle: '',
    notes: 'Kids outgrow boots yearly — check sizes in October.',
  },
  {
    name: 'Gift Wrap',
    location: 'home',
    area: 'Closet',
    items: ['Wrapping paper rolls', 'Gift bags', 'Ribbon', 'Tissue paper', 'Gift tags', 'Tape'],
    tags: ['holiday', 'supplies'],
    icon: 'Gift',
    color: '340:2',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '25:1' }),
    notes: 'Birthday and holiday patterns sorted separately.',
  },
  {
    name: 'Backpacks & Bags',
    location: 'home',
    area: 'Closet',
    items: ['School backpacks (x2)', 'Gym bag', 'Reusable grocery bags', 'Diaper bag', 'Beach tote'],
    tags: ['kids', 'supplies'],
    icon: 'Backpack',
    color: '200:3',
    cardStyle: '',
    notes: 'Wash backpacks at end of school year.',
  },

  // ── Self Storage (no areas) ──
  {
    name: 'Outgrown Kids Clothes',
    location: 'storage',
    area: '',
    items: ['0-3 month onesies', '6-12 month outfits', '2T winter jackets', '3T shoes', 'Newborn hats'],
    tags: ['kids', 'clothing'],
    icon: 'Shirt',
    color: '320:2',
    cardStyle: '',
    notes: 'Sorted by size. Save for next baby or donate.',
  },
  {
    name: 'Old Electronics',
    location: 'storage',
    area: '',
    items: ['iPad (2nd gen)', 'Old laptop', 'Kindle', 'Phone chargers', 'Camera', 'External hard drive'],
    tags: ['electronics'],
    icon: 'Laptop',
    color: 'neutral:2',
    cardStyle: '',
    notes: 'Wipe data before donating. Hard drive has family photos backup.',
  },
  {
    name: 'Seasonal Furniture',
    location: 'storage',
    area: '',
    items: ['Patio cushions', 'Folding table', 'Camp chairs (x4)', 'Patio umbrella'],
    tags: ['outdoor', 'seasonal'],
    icon: 'Armchair',
    color: '25:3',
    cardStyle: '',
    notes: 'Bring out patio furniture in April. Store after Labor Day.',
  },
  {
    name: 'Keepsakes & Memories',
    location: 'storage',
    area: '',
    items: ['Wedding album', 'Baby books (x2)', 'Kids artwork portfolio', 'Family photo prints', 'Childhood trophies'],
    tags: ['family', 'documents'],
    icon: 'Heart',
    color: '340:1',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '280:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: 'Handle with care. Consider digitizing photos.',
  },
];

const TAG_COLORS: Record<string, string> = {
  tools: '0:3',
  dad: '25:3',
  seasonal: '45:1',
  holiday: '140:2',
  food: '25:1',
  baking: '25:2',
  school: '220:2',
  kids: '280:1',
  medical: '0:4',
  emergency: '0:3',
  clothing: '245:2',
  electronics: '170:2',
  cables: '170:3',
  art: '280:2',
  hobbies: '320:1',
  games: '280:3',
  family: '200:1',
  pets: '25:3',
  dog: '25:4',
  outdoor: '140:3',
  sports: '200:2',
  baby: '320:1',
  costumes: '280:2',
  supplies: '200:3',
  cleaning: '140:1',
  documents: 'neutral:3',
  financial: 'neutral:4',
  beverages: '25:4',
  garden: '80:2',
  toys: '340:1',
};

function createLocation(userId: string, name: string): string {
  const locationId = generateUuid();
  const inviteCode = crypto.randomBytes(16).toString('hex');

  querySync(
    'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
    [locationId, name, userId, inviteCode],
  );
  querySync(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), locationId, userId, 'admin'],
  );

  return locationId;
}

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

    // Create locations
    const homeLocationId = createLocation(userId, 'Our House');
    const storageLocationId = createLocation(userId, 'Self Storage Unit');

    // Set active location to home
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userId]);

    // Create areas for home location only (storage has no areas)
    const areaMap = new Map<string, string>();
    for (const areaName of HOME_AREAS) {
      const areaId = generateUuid();
      areaMap.set(areaName, areaId);
      querySync(
        'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
        [areaId, homeLocationId, areaName, userId],
      );
    }

    // Create bins with items
    const binIdMap = new Map<string, string>();
    const homeBinCount = DEMO_BINS.filter((b) => b.location === 'home').length;
    const storageBinCount = DEMO_BINS.filter((b) => b.location === 'storage').length;

    for (const bin of DEMO_BINS) {
      const binId = generateShortCode(bin.name);
      binIdMap.set(bin.name, binId);
      const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
      const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;

      querySync(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, userId],
      );

      for (let i = 0; i < bin.items.length; i++) {
        querySync(
          'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
          [generateUuid(), binId, bin.items[i], i],
        );
      }
    }

    // Add tag colors to both locations
    for (const locId of [homeLocationId, storageLocationId]) {
      for (const [tag, color] of Object.entries(TAG_COLORS)) {
        querySync(
          'INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)',
          [generateUuid(), locId, tag, color],
        );
      }
    }

    // Pin frequently accessed bins
    const pinnedBinNames = ['First Aid Kit', 'School Supplies', 'Dog Supplies', 'Cables & Chargers', 'Coffee & Tea'];
    for (let i = 0; i < pinnedBinNames.length; i++) {
      const binId = binIdMap.get(pinnedBinNames[i]);
      if (binId) {
        querySync(
          'INSERT INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
          [userId, binId, i],
        );
      }
    }

    // Add saved searches (saved views)
    const savedViews = [
      { name: 'Kids stuff', search_query: '', sort: 'name', filters: JSON.stringify({ tags: ['kids'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
      { name: 'Outdoor & sports', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['outdoor', 'sports'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
      { name: 'Everything in the garage', search_query: '', sort: 'name', filters: JSON.stringify({ tags: [], tagMode: 'any', colors: [], areas: [areaMap.get('Garage')!], hasItems: false, hasNotes: false }) },
      { name: 'Holiday & seasonal', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['seasonal', 'holiday'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    ];
    for (const view of savedViews) {
      querySync(
        'INSERT INTO saved_views (id, user_id, name, search_query, sort, filters) VALUES ($1, $2, $3, $4, $5, $6)',
        [generateUuid(), userId, view.name, view.search_query, view.sort, view.filters],
      );
    }

    // Seed scan history (simulate recent QR scans)
    const scannedBinNames = [
      'Dog Supplies', 'Coffee & Tea', 'School Supplies', 'First Aid Kit',
      'Baking Supplies', 'Board Games', 'Cleaning Supplies', 'Baby & Toddler',
    ];
    for (const name of scannedBinNames) {
      const binId = binIdMap.get(name);
      if (binId) {
        querySync(
          'INSERT INTO scan_history (id, user_id, bin_id) VALUES ($1, $2, $3)',
          [generateUuid(), userId, binId],
        );
      }
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
    const homeBins = DEMO_BINS.filter((b) => b.location === 'home').length;
    const storageBins = DEMO_BINS.filter((b) => b.location === 'storage').length;
    const message = `Demo data seeded in ${elapsed}ms (${homeBins} + ${storageBins} bins across 2 locations, ${HOME_AREAS.length} areas)`;
    console.log(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    console.error('Failed to seed demo data:', err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
