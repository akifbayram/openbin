/** Pre-computed AI responses for demo mode — keyed by scenario ID. */

interface DemoAnalysis {
  name: string;
  items: Array<{ name: string; quantity?: number }>;
  tags: string[];
  notes: string;
}

interface DemoQuery {
  answer: string;
  matches: Array<{
    bin_id: string;
    name: string;
    area_name: string;
    items: string[];
    tags: string[];
    relevance: string;
  }>;
}

interface DemoCommand {
  actions: Array<Record<string, unknown>>;
  interpretation: string;
}

interface DemoReorganize {
  bins: Array<{ name: string; items: string[]; tags?: string[] }>;
  summary: string;
}

type DemoResponse = DemoAnalysis | DemoQuery | DemoCommand | DemoReorganize;

const responses: Record<string, DemoResponse> = {
  'demo-photo-single': {
    name: 'Tech Accessories',
    items: [
      { name: 'Raspberry Pi 4 Model B', quantity: 1 },
      { name: 'USB-C cables', quantity: 3 },
      { name: 'Zigbee USB dongle', quantity: 1 },
      { name: '5-port Ethernet switch', quantity: 1 },
      { name: 'Logitech webcam', quantity: 1 },
      { name: 'MicroSD cards', quantity: 4 },
      { name: 'SDR receiver', quantity: 1 },
      { name: 'Outdoor security camera' },
    ],
    tags: ['electronics', 'networking', 'iot'],
    notes: 'Mix of networking gear, single-board computers, and peripherals. Keep anti-static bags for storage.',
  },
  'demo-photo-tools': {
    name: 'Hand Tools',
    items: [
      { name: 'Claw hammer' },
      { name: 'Tape measure' },
      { name: 'Adjustable wrench' },
      { name: 'Screwdriver set', quantity: 6 },
      { name: 'Pliers' },
      { name: 'Level' },
      { name: 'Utility knife' },
    ],
    tags: ['tools', 'hardware'],
    notes: 'Basic hand tools for household repairs and projects.',
  },
  'demo-photo-crafts': {
    name: 'Craft Supplies',
    items: [
      { name: 'Acrylic paint tubes', quantity: 8 },
      { name: 'Paint brushes', quantity: 5 },
      { name: 'Sketch pad' },
      { name: 'Colored pencils', quantity: 24 },
      { name: 'Washi tape rolls', quantity: 6 },
      { name: 'Hot glue gun' },
    ],
    tags: ['art', 'crafts', 'hobbies'],
    notes: 'Assorted art and craft materials for projects.',
  },
  'demo-photo-kitchen': {
    name: 'Kitchen Gadgets',
    items: [
      { name: 'Silicone spatulas', quantity: 3 },
      { name: 'Measuring cups' },
      { name: 'Whisk' },
      { name: 'Garlic press' },
      { name: 'Peeler' },
      { name: 'Kitchen shears' },
      { name: 'Citrus juicer' },
    ],
    tags: ['kitchen', 'cooking'],
    notes: 'Common utensils and prep tools. Check drawer divider for small items.',
  },
  'demo-query-tools': {
    answer: 'Your power tools are in the Power Tools bin on the Workbench in the Garage. That bin has a cordless drill, circular saw, jigsaw, orbital sander, and more.',
    matches: [
      {
        bin_id: '',
        name: 'Power Tools',
        area_name: 'Workbench',
        items: ['Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander', 'Drill bit set', 'Impact driver'],
        tags: ['tools', 'dad'],
        relevance: 'direct match',
      },
    ],
  },
  'demo-query-cleaner': {
    answer: 'The glass cleaner is in the Cleaning Supplies bin in the Kitchen, along with other household cleaners and cloths.',
    matches: [
      {
        bin_id: '',
        name: 'Cleaning Supplies',
        area_name: 'Kitchen',
        items: ['All-purpose cleaner', 'Glass cleaner', 'Sponges', 'Microfiber cloths', 'Disinfectant spray'],
        tags: ['cleaning', 'supplies'],
        relevance: 'direct match',
      },
    ],
  },
  'demo-cmd-add': {
    actions: [
      {
        type: 'add_items',
        bin_name: 'Power Tools',
        items: ['Phillips screwdriver'],
      },
    ],
    interpretation: 'Adding a Phillips screwdriver to the Power Tools bin.',
  },
  'demo-cmd-create': {
    actions: [
      {
        type: 'create_bin',
        name: 'Puzzles',
        area_name: "Kids' Room",
        items: [],
      },
    ],
    interpretation: "Creating a new Puzzles bin in the Kids' Room area.",
  },
  'demo-cmd-tag': {
    actions: [
      {
        type: 'add_tags',
        bin_name: 'Camping Gear',
        tags: ['summer'],
      },
    ],
    interpretation: "Adding the 'summer' tag to the Camping Gear bin.",
  },
  'demo-reorganize-garage': {
    bins: [
      {
        name: 'Outdoor Recreation',
        items: [
          'Tent', 'Sleeping bags', 'Headlamps', 'Camping stove', 'Water filter',
          'Tarp', 'Cooler (hard shell)', 'Fire starters', 'Camping hammock',
          'Mess kit (plates & utensils)', 'Paracord (50 ft)',
          'Soccer ball', 'Frisbee', 'Badminton set', 'Kickball',
          'Wiffle ball & bat', 'Foam football',
        ],
        tags: ['outdoor', 'family', 'seasonal'],
      },
      {
        name: 'Cycling & Fitness',
        items: [
          'Helmets', 'Bike pump', 'Tire patch kit', 'Bike lock',
          'Training wheels', 'Spoke wrench', 'Chain lube', 'Bike lights',
          'Multi-tool (hex keys)', 'Reflective vest',
          'Jump ropes', 'Tennis rackets', 'Cones', 'Baseball gloves',
          'Basketball',
        ],
        tags: ['sports', 'outdoor', 'kids'],
      },
      {
        name: 'Power & Hand Tools',
        items: [
          'Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander',
          'Drill bit set', 'Impact driver', 'Reciprocating saw',
          'Clamp set', 'Safety glasses', 'Shop vacuum',
        ],
        tags: ['tools', 'dad'],
      },
      {
        name: 'Paint & Finishing',
        items: [
          'Interior paint (eggshell white)', 'Deck stain', 'Paint rollers',
          'Drop cloths', 'Painter tape', 'Brushes', 'Paint tray liners',
          'Sandpaper sheets (assorted grit)', 'Wood filler',
          'Caulk gun & tube', 'Stir sticks',
        ],
        tags: ['tools', 'supplies'],
      },
      {
        name: 'Automotive & Emergency',
        items: [
          'Jumper cables', 'Tire pressure gauge', 'Windshield washer fluid',
          'Ice scraper', 'Emergency flares', 'First aid kit (car)',
          'Reflective triangles', 'Tow strap', 'Funnel',
          'Tire inflator (12V)', 'Flashlight (dashboard)',
        ],
        tags: ['tools', 'emergency'],
      },
      {
        name: 'Garden & Yard',
        items: [
          'Trowel', 'Pruning shears', 'Garden gloves', 'Seed packets',
          'Plant food', 'Watering can', 'Knee pad', 'Hand rake',
          'Garden twine', 'Spray nozzle', 'Potting soil (bag)',
        ],
        tags: ['outdoor', 'garden'],
      },
    ],
    summary: 'Merged overlapping outdoor and sports items into two focused bins. Tools, paint, automotive, and garden bins were already well-organized and kept mostly intact.',
  },
};

export function getDemoResponse(scenario: string): DemoResponse | undefined {
  return responses[scenario];
}

export const DEMO_SCENARIO_KEYS = Object.keys(responses);
