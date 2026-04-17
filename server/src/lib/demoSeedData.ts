export type DemoMember = 'demo' | 'sarah' | 'alex' | 'jordan' | 'pat';

export type DemoItem = string | { name: string; quantity: number };

export interface DemoBin {
  name: string;
  location: 'home' | 'storage';
  area: string;
  items: DemoItem[];
  tags: string[];
  icon: string;
  color: string;
  cardStyle: string;
  notes: string;
  createdBy?: DemoMember;
  visibility?: 'location' | 'private';
}

export const DEMO_USERS: Record<DemoMember, { email: string; displayName: string }> = {
  demo: { email: 'demo@openbin.local', displayName: 'Darrin DeYoung' },
  sarah: { email: 'sarah@openbin.local', displayName: 'Sarah DeYoung' },
  alex: { email: 'alex@openbin.local', displayName: 'Alex DeYoung' },
  jordan: { email: 'jordan@openbin.local', displayName: 'Jordan DeYoung' },
  pat: { email: 'pat@openbin.local', displayName: 'Pat DeYoung' },
};

export const DEMO_MEMBERS = Object.keys(DEMO_USERS) as DemoMember[];

export const HOME_AREAS = ['Garage', 'Kitchen', "Kids' Room", 'Basement', 'Closet', 'Office'];

export const NESTED_AREAS: Record<string, string[]> = {
  Garage: ['Workbench'],
  Kitchen: ['Pantry'],
  Office: ['Server Rack'],
};

export const STORAGE_AREAS = ['Unit A', 'Unit B', 'Climate Controlled'];

export const PINNED_BIN_NAMES = ['Networking Gear', 'Brewing Equipment', 'Yarn Stash'];

export const PINNED_BIN_NAMES_PAT = ['Board Games'];

export const SCANNED_BIN_NAMES = [
  'Dog Supplies', 'Board Games', 'Cleaning Supplies',
  'Baby & Toddler', 'Power Tools', 'Camping Gear',
  'SBCs & Dev Boards', 'Mineral Specimens', 'D&D Rulebooks',
];

export const SCANNED_BIN_NAMES_SARAH = [
  'Brewing Equipment', 'Coffee Accessories', 'Yarn Stash', 'Patterns & WIPs',
];

export const SCANNED_BIN_NAMES_ALEX = [
  'D&D Rulebooks', 'Dice & Accessories', 'Art & Craft Supplies', 'Print Fails',
];

export const SCANNED_BIN_NAMES_PAT = [
  'Board Games', 'Cleaning Supplies', 'Dog Supplies',
];

export const DEMO_BINS: DemoBin[] = [
  {
    name: 'Power Tools',
    location: 'home',
    area: 'Workbench',
    items: ['Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander', 'Drill bit set', 'Impact driver', 'Reciprocating saw', { name: 'Clamp set', quantity: 6 }, { name: 'Safety glasses', quantity: 2 }, 'Shop vacuum'],
    tags: ['tools', 'dad'],
    icon: 'Wrench',
    color: '0:3',
    cardStyle: '',
    notes: '',
    createdBy: 'demo',
  },
  {
    name: 'Camping Gear',
    location: 'home',
    area: 'Garage',
    items: ['Tent', { name: 'Sleeping bags', quantity: 4 }, { name: 'Headlamps', quantity: 3 }, 'Camping stove', 'Water filter', 'Tarp', 'Cooler (hard shell)', { name: 'Fire starters', quantity: 12 }, 'Camping hammock', 'Mess kit (plates & utensils)', 'Paracord (50 ft)'],
    tags: ['outdoor', 'seasonal', 'family'],
    icon: 'Leaf',
    color: '140:3',
    cardStyle: '',
    notes: 'Dry tent completely before storing to prevent mildew.',
    createdBy: 'sarah',
  },
  {
    name: 'Bike Gear',
    location: 'home',
    area: 'Garage',
    items: [{ name: 'Helmets', quantity: 4 }, 'Bike pump', 'Tire patch kit', 'Bike lock', 'Training wheels', 'Spoke wrench', 'Chain lube', { name: 'Bike lights', quantity: 2 }, 'Multi-tool (hex keys)', 'Reflective vest'],
    tags: ['outdoor', 'sports'],
    icon: 'Bike',
    color: '45:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: 'neutral:3', stripePosition: 'top', stripeWidth: 3 }),
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'Sports Equipment',
    location: 'home',
    area: 'Garage',
    items: ['Soccer ball', 'Baseball gloves', 'Basketball', { name: 'Jump ropes', quantity: 3 }, 'Frisbee', 'Badminton set', { name: 'Tennis rackets', quantity: 2 }, { name: 'Cones', quantity: 12 }, 'Kickball', 'Wiffle ball & bat', 'Foam football'],
    tags: ['sports', 'kids', 'outdoor'],
    icon: 'Star',
    color: '200:2',
    cardStyle: '',
    notes: 'Deflate balls slightly for storage. Pump in bike gear bin.',
    createdBy: 'alex',
  },
  {
    name: 'Gardening',
    location: 'home',
    area: 'Garage',
    items: ['Trowel', 'Pruning shears', { name: 'Garden gloves', quantity: 2 }, { name: 'Seed packets', quantity: 8 }, 'Plant food', 'Watering can', 'Knee pad', 'Hand rake', 'Garden twine', 'Spray nozzle', 'Potting soil (bag)'],
    tags: ['outdoor', 'garden'],
    icon: 'Leaf',
    color: '80:2',
    cardStyle: '',
    notes: 'Start seeds indoors in March. Tomato cages in shed.',
    createdBy: 'sarah',
  },
  {
    name: 'Car Supplies',
    location: 'home',
    area: 'Garage',
    items: ['Jumper cables', 'Tire pressure gauge', 'Windshield washer fluid', 'Ice scraper', { name: 'Emergency flares', quantity: 3 }, 'First aid kit (car)', { name: 'Reflective triangles', quantity: 3 }, 'Tow strap', 'Funnel', 'Tire inflator (12V)', 'Flashlight (dashboard)'],
    tags: ['tools', 'emergency'],
    icon: 'Car',
    color: 'neutral:2',
    cardStyle: '',
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Paint & Stain',
    location: 'home',
    area: 'Garage',
    items: ['Interior paint (eggshell white)', 'Deck stain', 'Paint rollers', { name: 'Drop cloths', quantity: 3 }, 'Painter tape', { name: 'Brushes', quantity: 5 }, { name: 'Paint tray liners', quantity: 5 }, 'Sandpaper sheets (assorted grit)', 'Wood filler', 'Caulk gun & tube', { name: 'Stir sticks', quantity: 6 }],
    tags: ['tools', 'supplies'],
    icon: 'Paintbrush',
    color: '25:2',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Baking Supplies',
    location: 'home',
    area: 'Pantry',
    items: ['Flour', 'Sugar', 'Baking powder', 'Vanilla extract', { name: 'Cupcake liners', quantity: 48 }, 'Rolling pin', 'Cookie cutters (holiday set)', 'Measuring cups & spoons', 'Parchment paper', 'Piping bags & tips', 'Cake decorating turntable'],
    tags: ['food', 'baking'],
    icon: 'Utensils',
    color: '25:1',
    cardStyle: '',
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Dog Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['Kibble', { name: 'Treats', quantity: 3 }, 'Leash', 'Poop bags', { name: 'Chew toys', quantity: 4 }, 'Flea medicine', 'Collar (spare)', 'Nail clippers', 'Brush (deshedding)', 'Dog shampoo', 'Travel water bowl'],
    tags: ['pets', 'dog'],
    icon: 'Dog',
    color: '25:3',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Cleaning Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['All-purpose cleaner', { name: 'Sponges', quantity: 4 }, { name: 'Microfiber cloths', quantity: 6 }, 'Glass cleaner', 'Rubber gloves', 'Scrub brush', 'Broom & dustpan', { name: 'Mop refill pads', quantity: 3 }, 'Disinfectant spray', 'Stainless steel polish'],
    tags: ['cleaning', 'supplies'],
    icon: 'Home',
    color: '140:1',
    cardStyle: '',
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Lunch Boxes & Bottles',
    location: 'home',
    area: 'Kitchen',
    items: [{ name: 'Lunch boxes', quantity: 3 }, { name: 'Water bottles', quantity: 4 }, { name: 'Ice packs', quantity: 4 }, { name: 'Reusable snack bags', quantity: 6 }, 'Thermos', 'Bento box inserts', { name: 'Silicone straws', quantity: 6 }, 'Snack containers (stackable)', 'Insulated lunch tote', 'Spare lids & gaskets'],
    tags: ['kids', 'school'],
    icon: 'Box',
    color: '200:1',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Art & Craft Supplies',
    location: 'home',
    area: "Kids' Room",
    items: ['Watercolor paints', 'Construction paper', { name: 'Pipe cleaners', quantity: 20 }, { name: 'Googly eyes', quantity: 50 }, { name: 'Pom poms', quantity: 30 }, 'Markers', { name: 'Sticker sheets', quantity: 10 }, 'Modeling clay', 'Stamp pad & stamps', 'Perler beads & pegboards', { name: 'Glitter glue tubes', quantity: 4 }, 'Washi tape (assorted)'],
    tags: ['art', 'kids', 'hobbies'],
    icon: 'Paintbrush',
    color: '280:1',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '320:1' }),
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'Baby & Toddler',
    location: 'home',
    area: "Kids' Room",
    items: ['Diapers', 'Wipes', { name: 'Bottles', quantity: 4 }, { name: 'Pacifiers', quantity: 3 }, { name: 'Burp cloths', quantity: 5 }, 'Teething rings', 'Diaper cream', 'Baby nail clippers', { name: 'Swaddle blankets', quantity: 3 }, 'Bottle brush', 'Sippy cup (transition)'],
    tags: ['baby', 'kids'],
    icon: 'Baby',
    color: '320:1',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Costumes & Dress-Up',
    location: 'home',
    area: "Kids' Room",
    items: ['Princess dresses', { name: 'Superhero capes', quantity: 3 }, 'Pirate hat', 'Fairy wings', 'Face paint', 'Wigs', 'Knight shield & sword (foam)', { name: 'Animal ear headbands', quantity: 5 }, { name: 'Tutu skirts', quantity: 3 }, 'Cowboy hat', 'Costume jewelry bag'],
    tags: ['kids', 'costumes', 'seasonal'],
    icon: 'Scissors',
    color: '280:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '45:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
  },
  {
    name: 'LEGO & Building Toys',
    location: 'home',
    area: "Kids' Room",
    items: ['LEGO Classic bucket', 'LEGO City set', 'Magna-Tiles', 'Lincoln Logs', 'Instruction booklets', 'LEGO Star Wars set', 'Duplo blocks (toddler)', { name: 'Baseplate sheets', quantity: 4 }, { name: 'Brick separator tools', quantity: 2 }, { name: 'Sorting containers', quantity: 6 }],
    tags: ['kids', 'games'],
    icon: 'Blocks',
    color: '45:1',
    cardStyle: '',
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'Stuffed Animals & Dolls',
    location: 'home',
    area: "Kids' Room",
    items: ['Teddy bear', 'Bunny plush', 'Dinosaur collection', { name: 'Baby dolls', quantity: 2 }, 'Doll clothes', 'Unicorn plush', 'Paw Patrol figures', 'Puppet set (hand puppets)', 'Doll stroller', 'Weighted stuffed animal (bedtime)'],
    tags: ['kids', 'toys'],
    icon: 'Heart',
    color: '340:1',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Holiday Decorations',
    location: 'home',
    area: 'Basement',
    items: ['String lights', 'Ornaments box', 'Wreath', 'Tree stand', { name: 'Stockings', quantity: 5 }, 'Advent calendar', 'Tree skirt', 'Outdoor inflatable (snowman)', { name: 'Window clings', quantity: 8 }, 'Garland (faux pine)', 'Extension cord (outdoor rated)'],
    tags: ['seasonal', 'holiday'],
    icon: 'Gift',
    color: '140:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '0:3', stripePosition: 'left', stripeWidth: 4 }),
    notes: '',
  },
  {
    name: 'Important Documents',
    location: 'home',
    area: 'Basement',
    items: ['Birth certificates', 'Passports', 'Insurance policies', 'Property deed', 'Tax returns', 'Vehicle titles', 'Social security cards', 'Marriage certificate', 'Warranty documents folder', 'USB backup drive (encrypted)'],
    tags: ['documents', 'financial'],
    icon: 'Briefcase',
    color: 'neutral:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    visibility: 'private',
  },
  {
    name: 'Board Games',
    location: 'home',
    area: 'Basement',
    items: ['Candy Land', 'Uno', 'Sorry!', 'Jenga', 'Playing cards', { name: 'Puzzles', quantity: 4 }, 'Ticket to Ride', 'Scrabble', 'Monopoly', 'Catan', 'Codenames'],
    tags: ['games', 'family'],
    icon: 'Star',
    color: '280:3',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Winter Gear',
    location: 'home',
    area: 'Closet',
    items: ['Snow boots', 'Thermal gloves', 'Wool scarf', 'Beanie', { name: 'Hand warmers', quantity: 10 }, 'Ski goggles', { name: 'Thermal base layers', quantity: 2 }, 'Neck gaiter', { name: 'Insulated socks', quantity: 3 }, 'Snow pants (kids)'],
    tags: ['seasonal', 'clothing'],
    icon: 'Shirt',
    color: '245:2',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Backpacks & Bags',
    location: 'home',
    area: 'Closet',
    items: [{ name: 'School backpacks', quantity: 3 }, 'Gym bag', { name: 'Reusable grocery bags', quantity: 8 }, 'Diaper bag', 'Beach tote', { name: 'Drawstring bags', quantity: 4 }, 'Laptop sleeve', 'Fanny pack', 'Dry bag (waterproof)', { name: 'Packing cubes', quantity: 4 }],
    tags: ['kids', 'supplies'],
    icon: 'Backpack',
    color: '200:3',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Outgrown Kids Clothes',
    location: 'storage',
    area: 'Unit A',
    items: [{ name: '0-3 month onesies', quantity: 8 }, '6-12 month outfits', '2T winter jackets', '3T shoes', 'Newborn hats', '4T summer dresses', { name: '18-month sleepers', quantity: 4 }, 'Infant snowsuit', 'Baby socks bag', 'Toddler rain boots'],
    tags: ['kids', 'clothing'],
    icon: 'Shirt',
    color: '320:2',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Old Electronics',
    location: 'storage',
    area: 'Unit A',
    items: ['iPad (2nd gen)', 'Old laptop', 'Kindle', { name: 'Phone chargers', quantity: 5 }, 'Camera', 'External hard drive', 'Bluetooth speaker (broken)', 'Old router', 'Wii console & controllers', { name: 'USB flash drives', quantity: 6 }, 'Tangled earbuds bag'],
    tags: ['electronics'],
    icon: 'Laptop',
    color: 'neutral:2',
    cardStyle: '',
    notes: 'Wipe data before donating. Hard drive has family photos backup.',
  },
  {
    name: 'Keepsakes & Memories',
    location: 'storage',
    area: 'Climate Controlled',
    items: ['Wedding album', 'Baby books', 'Kids artwork', 'Family photo prints', 'Childhood trophies', 'Grandparent letters & cards', 'First-day-of-school signs', 'Hospital wristbands (births)', 'Pressed flowers from garden', { name: 'Home video DVDs', quantity: 6 }],
    tags: ['family', 'documents'],
    icon: 'Heart',
    color: '340:1',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '280:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
  },
  {
    name: 'Networking',
    location: 'home',
    area: 'Server Rack',
    items: ['UniFi 8-port switch', 'CAT6 keystone jacks (bag)', 'RJ45 crimping tool', 'Network cable tester', { name: 'SFP+ DAC cables', quantity: 2 }, { name: 'Velcro cable ties', quantity: 20 }, 'TP-Link EAP access point', 'Console cable (USB to RJ45)'],
    tags: ['homelab', 'networking', 'electronics'],
    icon: 'Briefcase',
    color: '200:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: '200:1', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    createdBy: 'demo',
  },
  {
    name: 'Hardware',
    location: 'home',
    area: 'Server Rack',
    items: ['Intel NUC i3', 'DDR5 SODIMM 32GBx2', 'Samsung 870 EVO 256GB SSD', 'WD Red 4TB HDD', 'SATA to USB 3.0 adapter', 'CPU thermal paste (Noctua NT-H1)', 'Anti-static wrist strap', 'Mini-ITX server motherboard (spare)', 'IPMI/BMC USB dongle'],
    tags: ['homelab', 'server', 'hardware'],
    icon: 'Laptop',
    color: '245:3',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '245:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
    createdBy: 'demo',
  },
  {
    name: 'SBCs & Dev Boards',
    location: 'home',
    area: 'Office',
    items: ['Raspberry Pi Zero 2 W', 'Arduino Uno R3', { name: 'ESP32-C3 dev boards', quantity: 4 }, 'Coral USB Edge TPU', { name: 'Micro SD cards 32GB', quantity: 3 }, 'GPIO breakout ribbon cables', { name: 'Breadboards', quantity: 2 }, 'Jumper wire kit', { name: 'USB-C power adapters 5V 3A', quantity: 2 }],
    tags: ['homelab', 'sbc', 'electronics', 'hobbies'],
    icon: 'Lightbulb',
    color: '80:3',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '140:2' }),
    notes: '',
    createdBy: 'demo',
  },
  {
    name: 'Brewing Equipment',
    location: 'home',
    area: 'Kitchen',
    items: ['Hario V60 dripper', 'Kalita Wave 185 dripper', 'Chemex 6-cup', 'AeroPress', 'Acaia Pearl scale (0.1g precision)', 'Fellow Atmos vacuum canister', 'Timemore C2 hand grinder', 'Melodrip pulse pouring tool','WDT distribution tool'],
    tags: ['coffee', 'brewing', 'hobbies', 'specialty'],
    icon: 'Coffee',
    color: '25:4',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '25:2', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Coffee Accessories',
    location: 'home',
    area: 'Kitchen',
    items: ['Bleached V60 filters', 'Kalita Wave 185 filters', 'Chemex bonded filters (square)', { name: 'AeroPress paper filters', quantity: 350 }, 'Cafec Abaca filters (light roast)', 'Barista Hustle brush (grinder cleaning)', 'Pallo grinder brush', { name: 'Dosing cups (58mm)', quantity: 2 }, 'Milk frother (Nanofoamer)', { name: 'Cupping spoons', quantity: 4 }, 'Tasting notebook (Brewista)', 'Coffee compass flavor wheel poster'],
    tags: ['coffee', 'brewing', 'specialty'],
    icon: 'Utensils',
    color: '45:2',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: '25:3', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Yarn Stash',
    location: 'home',
    area: 'Office',
    items: ['Merino wool', 'Chunky alpaca blend', 'Cotton yarn — cream', 'Sock yarn — self-striping', 'Lace weight mohair', 'DK weight superwash', 'Cashmere blend fingering weight (50g)', 'Recycled silk ribbon yarn (100g)', { name: 'Baby yarn — soft white (100g)', quantity: 2 }, { name: 'Tapestry wool remnants', quantity: 8 }, 'Yarn swift (for winding)'],
    tags: ['hobbies', 'knitting', 'yarn', 'crafts'],
    icon: 'Heart',
    color: '320:2',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '280:1' }),
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Knitting Needles & Tools',
    location: 'home',
    area: 'Office',
    items: ['Circular needles — US 2 (2.75mm), 32"', 'Circular needles — US 7 (4.5mm), 24"', 'Circular needles — US 10 (6mm), 40"', 'DPNs — US 1 set (2.25mm), 6"', 'DPNs — US 4 set (3.5mm), 8"', 'Interchangeable needle tips — US 4\u201310.5', 'Row counter (clicker style)', { name: 'Stitch markers (locking)', quantity: 20 }, { name: 'Tapestry needles (blunt tip)', quantity: 6 }, 'Cable needle (J-hook style)', 'Yarn cutter pendant', 'Needle gauge / ruler combo', { name: 'KnitPicks interchangeable cable cords', quantity: 5 }],
    tags: ['hobbies', 'knitting', 'tools', 'crafts'],
    icon: 'Scissors',
    color: '45:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'Patterns & WIPs',
    location: 'home',
    area: 'Office',
    items: ['WIP: Cabled sweater (navy merino, size M) — at yoke shaping', 'WIP: Lace shawl (mohair blend) — 60% done', 'WIP: Baby hat (white, gift for shower)', 'Pattern: Tin Can Knits — Seasons collection (printed)', 'Pattern: Churchmouse Yarns — Classic Shawl (printed)', 'Pattern notebook — swatches & row notes', { name: 'Project bags (drawstring cotton)', quantity: 3 }, { name: 'Blocking mats (foam)', quantity: 9 }, { name: 'Blocking wires (stainless)', quantity: 12 }, { name: 'T-pins', quantity: 50 }, { name: 'Stitch holders (large)', quantity: 4 }, 'Waste yarn scraps (for provisional cast-ons)'],
    tags: ['hobbies', 'knitting', 'crafts', 'wip'],
    icon: 'Book',
    color: '200:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '320:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
    createdBy: 'sarah',
  },
  {
    name: 'D&D Rulebooks',
    location: 'home',
    area: 'Basement',
    items: ["Player's Handbook (5e)", "Dungeon Master's Guide (5e)", "Monster Manual (5e)", "Xanathar's Guide to Everything", "Tasha's Cauldron of Everything", "Mordenkainen's Tome of Foes", "Volo's Guide to Monsters", "Fizban's Treasury of Dragons", 'Strixhaven: A Curriculum of Chaos', "Van Richten's Guide to Ravenloft", "Sword Coast Adventurer's Guide"],
    tags: ['d&d', 'tabletop-rpg', 'rulebooks', 'reference'],
    icon: 'Book',
    color: '30:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'Dice & Accessories',
    location: 'home',
    area: 'Basement',
    items: ['Chessex Gemini 7-piece polyhedral set (blue-green)', 'Metal d20 (critical hit die)', { name: 'Precision casino-grade d6 set', quantity: 6 }, 'Dispel Dice handmade set (resin, galaxy)', 'Koplow opaque set (backup dice)', { name: 'd4 caltrops set', quantity: 6 }, 'Dice tower (wooden)', 'Velvet dice tray (rolling surface)', 'Dice bag (leather drawstring)', 'Spin-down d20 life counter', { name: 'Card sleeves (standard)', quantity: 50 }, { name: 'Initiative tracker cards', quantity: 10 }],
    tags: ['d&d', 'tabletop-rpg', 'dice', 'accessories'],
    icon: 'Star',
    color: '260:2',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '200:1' }),
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'Miniatures & Terrain',
    location: 'home',
    area: 'Basement',
    items: [{ name: 'Reaper Bones heroes set (unpainted)', quantity: 12 }, "Nolzur's Marvelous Miniatures — adventurers pack", { name: 'WizKids pre-painted dungeon monsters', quantity: 8 }, { name: 'Goblin warband (painted green)', quantity: 10 }, 'Dragon miniature (large, WizKids Pathfinder)', 'Dungeon tiles — modular stone floor set', { name: 'OpenLock 3D-printed wall segments', quantity: 20 }, 'Woodland Scenics clump foliage (forest terrain)', 'Painted campfire scatter piece', 'Tavern furniture set (resin: tables, chairs, bar)', 'Basing paste (Vallejo Dark Earth)', 'Army Painter wash set (6 washes)'],
    tags: ['d&d', 'tabletop-rpg', 'miniatures', 'painting'],
    icon: 'Paintbrush',
    color: '120:3',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '45:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
    createdBy: 'alex',
  },
  {
    name: 'DM Toolkit',
    location: 'home',
    area: 'Basement',
    items: ['DM screen (Reaper foldout, 4-panel)', 'Kobold Press: Tome of Beasts 1', "Lazy DM's Workbook (Michael Shea)", 'Campaign notebook (graph paper, hardcover)', 'Initiative tracker (magnetic dry-erase board)', { name: 'Condition rings (silicone, color-coded)', quantity: 20 }, 'Wet-erase battle mat (1" grid, 24"x36")', { name: 'Wet-erase markers', quantity: 4 }, { name: 'Random encounter tables (laminated)', quantity: 8 }, "NPC name generator cards (Rory's Story Cubes)", 'Bluetooth speaker (for ambient dungeon audio)', 'Session notes binder with plastic sleeves'],
    tags: ['d&d', 'tabletop-rpg', 'dm', 'tools'],
    icon: 'Briefcase',
    color: '0:2',
    cardStyle: '',
    notes: "",
    createdBy: 'alex',
  },
  {
    name: 'Mineral Specimens',
    location: 'storage',
    area: 'Climate Controlled',
    items: ['Amethyst cluster (Uruguay)', 'Pyrite cube on matrix', 'Rhodochrosite stalactite slice', 'Malachite with azurite', 'Fluorite octahedron (Illinois)', 'Selenite desert rose', 'Tourmaline on albite matrix', 'Calcite dogtooth crystals', 'Apophyllite with stilbite', 'Labradorite rough slab', 'Vanadinite on barite', 'Celestite geode half'],
    tags: ['minerals', 'specimens', 'geology', 'display'],
    icon: 'Star',
    color: '270:2',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '200:2' }),
    notes: '',
    createdBy: 'jordan',
  },
  {
    name: 'Lapidary Tools & Supplies',
    location: 'storage',
    area: 'Unit B',
    items: ['Diamond lap discs (180 / 600 / 1200 / 3000 grit)', { name: 'Cabochon dopping sticks', quantity: 10 }, 'Dopping wax (brown)', 'Polishing felt pad', 'Cerium oxide polishing powder', 'Diamond polishing compound (14k grit)', 'Trim saw blade (4 in, diamond)', 'Safety glasses (splash-rated)', 'Flexible shaft handpiece bits', 'Aluminum dop block with holes', 'Lubricating oil (honing)', 'Caliper (digital, 6 in)'],
    tags: ['lapidary', 'tools', 'geology'],
    icon: 'Wrench',
    color: '30:3',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '45:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
    createdBy: 'jordan',
  },
  {
    name: 'Field Collecting Kit',
    location: 'storage',
    area: 'Unit B',
    items: ['Rock hammer (22 oz, Estwing)', 'Cold chisels (1/2 in and 3/4 in)', 'Hand lens (10x, Bausch & Lomb)', 'Field notebook (waterproof pages)', 'Streak plate (unglazed porcelain)', 'Hardness picks set (Mohs 2\u20139)', 'Dilute HCl dropper bottle (10%)', 'GPS unit (Garmin eTrex)', 'Newspaper for wrapping specimens', { name: 'Cotton specimen bags', quantity: 15 }, 'Leather gloves', 'UV flashlight (shortwave, 254 nm)'],
    tags: ['field-collecting', 'tools', 'geology', 'outdoor'],
    icon: 'Briefcase',
    color: '90:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: '',
    createdBy: 'jordan',
  },
  {
    name: 'Mystery Cables',
    location: 'home',
    area: 'Office',
    items: ['USB Mini-B cable', { name: 'Micro-USB cables', quantity: 5 }, 'VGA cable', 'DVI-D cable', 'Proprietary laptop charger (unknown model)', 'Coax cable (3 ft)', { name: 'Ethernet patch cables', quantity: 8 }, 'FireWire 400 cable', { name: '3.5mm aux cords', quantity: 4 }, 'Barrel jack adapters (assorted)', 'Cable that came with something'],
    tags: ['electronics', 'cables'],
    icon: 'Box',
    color: 'neutral:2',
    cardStyle: '',
    notes: 'If you throw one away you will need it within 48 hours. This is the law.',
    createdBy: 'demo',
  },
  {
    name: 'Pi Graveyard',
    location: 'home',
    area: 'Office',
    items: ['Pi 3A (was going to be a magic mirror)', 'Pi Zero W (planned as a PiHole)', 'Pi 4 2GB (briefly a NAS, regretted it)', 'Pi Zero 2 W (earmarked for OctoPrint)', { name: 'Micro SD cards with unknown images', quantity: 6 }, { name: 'Pi cases (assorted)', quantity: 5 }, { name: 'Official Pi power supplies', quantity: 3 }, 'Pi camera module V2', 'Sense HAT (used once)', 'GPIO ribbon cable (never used)'],
    tags: ['homelab', 'sbc', 'electronics'],
    icon: 'Lightbulb',
    color: '140:3',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '80:2' }),
    notes: 'Combined cost exceeds a used Dell Optiplex that would have been better for everything.',
    createdBy: 'demo',
  },
  {
    name: 'Upgrade Box',
    location: 'storage',
    area: 'Unit A',
    items: [{ name: 'DDR3 ECC sticks 8GB', quantity: 4 }, 'Intel i5-6500', '120GB SSD (honorably discharged)', 'Stock Intel cooler (never used)', '1GbE NIC', 'Old ATX power supply (500W)', 'PCIe x1 riser', { name: 'SATA cables', quantity: 6 }, { name: 'Case fans 120mm', quantity: 3 }, 'CPU bracket (wrong socket)'],
    tags: ['homelab', 'hardware', 'electronics'],
    icon: 'Archive',
    color: 'neutral:3',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: 'neutral:4', borderWidth: 2, borderStyle: 'solid' }),
    notes: 'Cannot throw away. Cannot use. This is purgatory for hardware.',
    createdBy: 'demo',
  },
  {
    name: 'Dead Drives',
    location: 'home',
    area: 'Office',
    items: ['Seagate 3TB (the SMR batch)', 'Samsung 840 EVO (firmware bug era)', 'WD MyBook 8TB (shucked, then dropped)', 'Crucial MX500 (worn out, 98% life used)', 'Laptop HDD 500GB (slow death)', 'USB thumb drive (lost partition table)'],
    tags: ['homelab', 'hardware', 'electronics'],
    icon: 'Archive',
    color: '0:2',
    cardStyle: '',
    notes: 'One of these has the only copy of the 2019 family photos. Unknown which. Bin stays.',
    createdBy: 'demo',
  },
  {
    name: 'NAS Spares',
    location: 'home',
    area: 'Office',
    items: [{ name: 'SATA cables', quantity: 8 }, 'HDD mounting screws (ziplock bag)', { name: 'Molex splitters', quantity: 2 }, { name: 'Anti-vibration grommets', quantity: 12 }, 'SATA power extensions', 'IEC C13 power cord (spare)', 'Drive sleds (wrong model)', 'Thermal pads (1mm, spare sheet)', 'Case fan splitter', { name: '80mm case fans', quantity: 2 }, 'Hot swap bay (unused)'],
    tags: ['homelab', 'nas', 'hardware'],
    icon: 'Wrench',
    color: '170:2',
    cardStyle: JSON.stringify({ variant: 'border', secondaryColor: '170:1', borderWidth: 2, borderStyle: 'solid' }),
    notes: 'Buy 4 SATA cables. Use 2. Lose 1. The 4th is insurance.',
    createdBy: 'demo',
  },
  {
    name: 'Print Fails',
    location: 'home',
    area: 'Office',
    items: ['Benchy (first layer shift)', { name: 'Calibration cubes', quantity: 11 }, 'Spaghetti blob (PLA)', 'Half a Mandalorian helmet', 'Cable clips (the only good prints)', 'Lithophane (wrong orientation)', 'Phone stand (warped)', 'Vase mode test (collapsed at 80%)', 'Flexi Rex with fused joints', 'Temp tower', 'Purge blocks bag'],
    tags: ['3d-printing', 'hobbies'],
    icon: 'Package',
    color: '280:2',
    cardStyle: JSON.stringify({ variant: 'gradient', secondaryColor: '200:1' }),
    notes: 'Filament cost exceeds printer cost.',
    createdBy: 'alex',
  },
  {
    name: 'Self-Hosted Gear',
    location: 'home',
    area: 'Office',
    items: ['YubiKey 5 NFC (Vaultwarden)', 'Zigbee coordinator (Sonoff USB stick)', 'RTL-SDR dongle (ADS-B tracking)', 'USB GPS receiver (NTP server)', 'PoE camera (Frigate, spare)', 'Webcam (replaced by PoE cam)', 'USB Bluetooth adapter (ESPresense)', 'Z-Wave stick (upgraded to Z-Wave LR)',],
    tags: ['homelab', 'self-hosted', 'electronics'],
    icon: 'Laptop',
    color: '245:2',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '200:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: 'Each item represents a weekend lost to networking issues and reverse proxy configs.',
    createdBy: 'demo',
    visibility: 'private',
  },
];

export const TRASHED_BINS: DemoBin[] = [
  {
    name: 'Old Spice Rack',
    location: 'home',
    area: 'Kitchen',
    items: ['Expired cumin', 'Unlabeled mystery powder', 'Crystallized honey', 'Empty vanilla extract bottle', 'Paprika (circa 2019)'],
    tags: ['food', 'cleaning'],
    icon: 'Box',
    color: '25:1',
    cardStyle: '',
    notes: 'Replaced with new organizer.',
    createdBy: 'sarah',
  },
  {
    name: 'Broken Toys',
    location: 'home',
    area: "Kids' Room",
    items: ['Headless action figure', 'Puzzle with missing pieces', 'Deflated beach ball', 'Remote control car (no remote)', 'Board game with lost dice'],
    tags: ['kids', 'toys'],
    icon: 'Box',
    color: '280:1',
    cardStyle: '',
    notes: 'Awaiting donation or recycling.',
    createdBy: 'alex',
  },
];

/**
 * Heat-map usage profile for each bin. The shape of the dot pattern should
 * match how a real household would touch the bin — daily staples get dense
 * grids, seasonal gear gets peaks in the right months, and the comedy
 * "graveyard" bins stay mostly empty.
 */
export type BinUsageProfile =
  | 'daily'              // Kitchen/pet staples — most days
  | 'near-daily'         // Heavy ritual (coffee) — 4–6 days/week
  | 'weekdays'           // School-day pattern — Mon–Fri during school year
  | 'weekly'             // Hobby/game cadence — 1–2 days/week
  | 'biweekly'           // Occasional project use — every 1–2 weeks
  | 'occasional'         // Sporadic — a handful of hits across the year
  | 'rare'               // Opened only when you truly need it
  | 'archive-document'   // Cluster near tax season, otherwise silent
  | 'seasonal-summer'    // May–Sep peak (camping, gardening, field trips)
  | 'seasonal-winter'    // Dec–Mar peak (snow gear)
  | 'seasonal-holiday'   // Nov–Jan Christmas setup / teardown
  | 'seasonal-halloween' // Oct costume spike
  | 'silent';            // Literally untouched

/**
 * Explicit per-bin usage profile. Falls back to 'occasional' for any bin
 * name missing here. Kept next to the bin list so the two stay in sync.
 */
export const BIN_USAGE_PROFILES: Record<string, BinUsageProfile> = {
  // Daily-use household staples
  'Dog Supplies': 'daily',
  'Cleaning Supplies': 'daily',
  'Baby & Toddler': 'daily',

  // Near-daily rituals
  'Brewing Equipment': 'near-daily',
  'Coffee Accessories': 'near-daily',

  // Weekday / school-year pattern
  'Lunch Boxes & Bottles': 'weekdays',
  'Backpacks & Bags': 'weekdays',

  // Weekly-ish hobbies and family activities
  'Baking Supplies': 'weekly',
  'Board Games': 'weekly',
  'Bike Gear': 'weekly',
  'Sports Equipment': 'weekly',
  'Art & Craft Supplies': 'weekly',
  'LEGO & Building Toys': 'weekly',
  'Yarn Stash': 'weekly',
  'Patterns & WIPs': 'weekly',
  'Knitting Needles & Tools': 'weekly',
  'D&D Rulebooks': 'weekly',
  'Dice & Accessories': 'weekly',
  'DM Toolkit': 'weekly',

  // Every week or two — project cadence
  'Power Tools': 'biweekly',
  'Miniatures & Terrain': 'biweekly',
  'SBCs & Dev Boards': 'biweekly',
  'Print Fails': 'biweekly',
  'Hardware': 'biweekly',
  'Stuffed Animals & Dolls': 'biweekly',

  // Occasional — opened when needed
  'Car Supplies': 'occasional',
  'Paint & Stain': 'occasional',
  'Networking': 'occasional',
  'Self-Hosted Gear': 'occasional',
  'Lapidary Tools & Supplies': 'occasional',
  'Mineral Specimens': 'occasional',

  // Seasonal
  'Camping Gear': 'seasonal-summer',
  'Gardening': 'seasonal-summer',
  'Field Collecting Kit': 'seasonal-summer',
  'Winter Gear': 'seasonal-winter',
  'Holiday Decorations': 'seasonal-holiday',
  'Costumes & Dress-Up': 'seasonal-halloween',

  // Rare — only touched under specific circumstances
  'Mystery Cables': 'rare',
  'Pi Graveyard': 'rare',
  'NAS Spares': 'rare',
  'Outgrown Kids Clothes': 'rare',
  'Old Electronics': 'rare',
  'Keepsakes & Memories': 'rare',

  // Documents — tax-season cluster
  'Important Documents': 'archive-document',

  // Untouched — the bin's own notes call it out
  'Dead Drives': 'silent',
  'Upgrade Box': 'silent',
};

export const CUSTOM_FIELD_DEFINITIONS = [
  { name: 'Purchase Date', position: 0 },
  { name: 'Estimated Value', position: 1 },
  { name: 'Condition', position: 2 },
  { name: 'Last Checked', position: 3 },
];

export const CUSTOM_FIELD_VALUES: Record<string, Record<string, string>> = {
  'Important Documents': { Condition: 'Fireproof safe', 'Last Checked': '2026-01-15' },
  'Power Tools': { 'Estimated Value': '$1,200', 'Last Checked': '2026-02-28' },
  'Camping Gear': { Condition: 'Good', 'Last Checked': '2026-03-01' },
  'Networking': { 'Estimated Value': '$850', 'Purchase Date': '2024-06' },
  'Hardware': { 'Estimated Value': '$600', 'Purchase Date': '2025-03' },
  'SBCs & Dev Boards': { 'Estimated Value': '$350' },
  'Brewing Equipment': { 'Estimated Value': '$800', Condition: 'Excellent' },
  'Holiday Decorations': { 'Last Checked': '2025-12-26', Condition: 'Good' },
  'Board Games': { Condition: 'Well-loved', 'Last Checked': '2026-02-15' },
  'Self-Hosted Gear': { 'Estimated Value': '$450' },
};

export interface DemoActivityEntry {
  user: DemoMember;
  action: string;
  entityType: string;
  entityName?: string;
  binName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  daysAgo: number;
  location: 'home' | 'storage';
}

export const DEMO_ACTIVITY_ENTRIES: DemoActivityEntry[] = [
  { user: 'demo', action: 'create', entityType: 'location', entityName: 'Our House', daysAgo: 14, location: 'home' },
  { user: 'demo', action: 'create', entityType: 'area', entityName: 'Garage', daysAgo: 14, location: 'home' },
  { user: 'sarah', action: 'join', entityType: 'member', entityName: 'sarah', daysAgo: 13, location: 'home' },
  { user: 'demo', action: 'create', entityType: 'bin', entityName: 'Power Tools', binName: 'Power Tools', daysAgo: 13, location: 'home' },
  { user: 'sarah', action: 'create', entityType: 'bin', entityName: 'Brewing Equipment', binName: 'Brewing Equipment', daysAgo: 12, location: 'home' },
  { user: 'alex', action: 'join', entityType: 'member', entityName: 'alex', daysAgo: 12, location: 'home' },
  { user: 'alex', action: 'create', entityType: 'bin', entityName: 'D&D Rulebooks', binName: 'D&D Rulebooks', daysAgo: 12, location: 'home' },
  { user: 'sarah', action: 'create', entityType: 'bin', entityName: 'Coffee Accessories', binName: 'Coffee Accessories', daysAgo: 11, location: 'home' },
  { user: 'demo', action: 'create', entityType: 'area', entityName: 'Server Rack', daysAgo: 11, location: 'home' },
  { user: 'jordan', action: 'create', entityType: 'bin', entityName: 'Mineral Specimens', binName: 'Mineral Specimens', daysAgo: 10, location: 'storage' },
  { user: 'sarah', action: 'update', entityType: 'bin', entityName: 'Camping Gear', binName: 'Camping Gear', changes: { tags: { old: ['outdoor'], new: ['outdoor', 'seasonal', 'family'] } }, daysAgo: 10, location: 'home' },
  { user: 'jordan', action: 'create', entityType: 'area', entityName: 'Climate Controlled', daysAgo: 9, location: 'storage' },
  { user: 'demo', action: 'create', entityType: 'bin', entityName: 'Self-Hosted Gear', binName: 'Self-Hosted Gear', daysAgo: 9, location: 'home' },
  { user: 'demo', action: 'update', entityType: 'bin', entityName: 'Networking', binName: 'Networking', changes: { items_added: { old: null, new: ['Console cable (USB to RJ45)'] } }, daysAgo: 8, location: 'home' },
  { user: 'alex', action: 'update', entityType: 'bin', entityName: 'Miniatures & Terrain', binName: 'Miniatures & Terrain', changes: { items_added: { old: null, new: ['Army Painter wash set (6 washes)'] } }, daysAgo: 7, location: 'home' },
  { user: 'demo', action: 'update', entityType: 'bin', entityName: 'Hardware', binName: 'Hardware', changes: { area: { old: 'Office', new: 'Server Rack' } }, daysAgo: 6, location: 'home' },
  { user: 'pat', action: 'join', entityType: 'member', entityName: 'pat', daysAgo: 5, location: 'home' },
  { user: 'sarah', action: 'update', entityType: 'bin', entityName: 'Yarn Stash', binName: 'Yarn Stash', changes: { items_added: { old: null, new: ['Tapestry wool remnants'] } }, daysAgo: 4, location: 'home' },
  { user: 'sarah', action: 'delete', entityType: 'bin', entityName: 'Old Spice Rack', daysAgo: 3, location: 'home' },
  { user: 'alex', action: 'create', entityType: 'bin', entityName: 'Print Fails', binName: 'Print Fails', daysAgo: 1, location: 'home' },
];

/** Tag hierarchy: parent → children. Single-level only. */
export const TAG_HIERARCHY: Record<string, string[]> = {
  outdoor: ['sports', 'garden', 'field-collecting'],
  homelab: ['networking', 'server', 'hardware', 'sbc', 'nas', 'self-hosted', 'smart-home'],
  kids: ['baby', 'toys', 'school'],
  'd&d': ['tabletop-rpg', 'rulebooks', 'dice', 'miniatures', 'dm'],
  coffee: ['brewing', 'specialty'],
  knitting: ['yarn', 'crafts', 'wip'],
  geology: ['minerals', 'specimens', 'lapidary'],
};

/** Items that are currently checked out (active). bin → item name → checked out by */
export const DEMO_CHECKOUTS: Array<{
  binName: string;
  itemName: string;
  checkedOutBy: DemoMember;
  daysAgo: number;
}> = [
  { binName: 'Power Tools', itemName: 'Cordless drill', checkedOutBy: 'demo', daysAgo: 2 },
  { binName: 'Camping Gear', itemName: 'Cooler (hard shell)', checkedOutBy: 'sarah', daysAgo: 1 },
  { binName: 'Board Games', itemName: 'Catan', checkedOutBy: 'alex', daysAgo: 3 },
  { binName: 'Brewing Equipment', itemName: 'AeroPress', checkedOutBy: 'demo', daysAgo: 0 },
];

/** Past returned checkouts for history. */
export const DEMO_RETURNED_CHECKOUTS: Array<{
  binName: string;
  itemName: string;
  checkedOutBy: DemoMember;
  returnedBy: DemoMember;
  checkedOutDaysAgo: number;
  returnedDaysAgo: number;
}> = [
  { binName: 'Bike Gear', itemName: 'Bike pump', checkedOutBy: 'alex', returnedBy: 'alex', checkedOutDaysAgo: 7, returnedDaysAgo: 5 },
  { binName: 'Power Tools', itemName: 'Impact driver', checkedOutBy: 'demo', returnedBy: 'demo', checkedOutDaysAgo: 10, returnedDaysAgo: 8 },
  { binName: 'D&D Rulebooks', itemName: "Player's Handbook (5e)", checkedOutBy: 'alex', returnedBy: 'pat', checkedOutDaysAgo: 6, returnedDaysAgo: 4 },
];

/** Bins to create share links for. */
export const DEMO_BIN_SHARES: Array<{
  binName: string;
  createdBy: DemoMember;
  visibility: 'public' | 'unlisted';
  viewCount: number;
}> = [
  { binName: 'Board Games', createdBy: 'demo', visibility: 'unlisted', viewCount: 3 },
  { binName: 'D&D Rulebooks', createdBy: 'alex', visibility: 'public', viewCount: 12 },
  { binName: 'Mineral Specimens', createdBy: 'jordan', visibility: 'unlisted', viewCount: 7 },
];

export const TAG_COLORS: Record<string, string> = {
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
  homelab: '200:3',
  networking: '200:2',
  server: '245:3',
  hardware: '245:2',
  sbc: '80:3',
  kvm: '170:2',
  adapters: '170:1',
  coffee: '25:4',
  brewing: '25:3',
  specialty: '45:2',
  knitting: '320:2',
  yarn: '280:2',
  crafts: '280:1',
  wip: '45:2',
  'd&d': '30:3',
  'tabletop-rpg': '260:2',
  rulebooks: '30:2',
  reference: '30:1',
  dice: '260:1',
  accessories: '260:3',
  miniatures: '120:3',
  painting: '120:2',
  dm: '0:2',
  'game-master': '0:3',
  minerals: '270:2',
  specimens: '270:3',
  geology: '90:3',
  display: '270:1',
  lapidary: '30:3',
  'field-collecting': '90:2',
  'smart-home': '200:2',
  nas: '170:3',
  '3d-printing': '280:2',
  'self-hosted': '245:2',
};
