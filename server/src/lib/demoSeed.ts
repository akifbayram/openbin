import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { generateUuid, getDb, querySync } from '../db.js';
import { config } from './config.js';
import { pushLog } from './logBuffer.js';
import { generateShortCode } from './shortCode.js';

type DemoMember = 'demo' | 'sarah' | 'alex' | 'jordan';

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
  createdBy?: DemoMember;
}

const HOME_AREAS = ['Garage', 'Kitchen', "Kids' Room", 'Basement', 'Closet', 'Office'];

const DEMO_BINS: DemoBin[] = [
  {
    name: 'Power Tools',
    location: 'home',
    area: 'Garage',
    items: ['Cordless drill', 'Circular saw', 'Jigsaw', 'Orbital sander', 'Drill bit set', 'Impact driver', 'Reciprocating saw', 'Clamp set (6pc)', 'Safety glasses', 'Shop vacuum'],
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
    items: ['Tent', 'Sleeping bags (x4)', 'Headlamps', 'Camping stove', 'Water filter', 'Tarp', 'Cooler (hard shell)', 'Fire starters', 'Camping hammock', 'Mess kit (plates & utensils)', 'Paracord (50 ft)'],
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
    items: ['Helmets', 'Bike pump', 'Tire patch kit', 'Bike lock', 'Training wheels', 'Spoke wrench', 'Chain lube', 'Bike lights (front & rear)', 'Multi-tool (hex keys)', 'Reflective vest'],
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
    items: ['Soccer ball', 'Baseball gloves', 'Basketball', 'Jump ropes', 'Frisbee', 'Badminton set', 'Tennis rackets (x2)', 'Cones (12 pack)', 'Kickball', 'Wiffle ball & bat', 'Foam football'],
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
    items: ['Trowel', 'Pruning shears', 'Garden gloves', 'Seed packets', 'Plant food', 'Watering can', 'Knee pad', 'Hand rake', 'Garden twine', 'Spray nozzle', 'Potting soil (bag)'],
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
    items: ['Jumper cables', 'Tire pressure gauge', 'Windshield washer fluid', 'Ice scraper', 'Emergency flares', 'First aid kit (car)', 'Reflective triangles', 'Tow strap', 'Funnel', 'Tire inflator (12V)', 'Flashlight (dashboard)'],
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
    items: ['Interior paint (eggshell white)', 'Deck stain', 'Paint rollers', 'Drop cloths', 'Painter tape', 'Brushes', 'Paint tray liners (5 pack)', 'Sandpaper sheets (assorted grit)', 'Wood filler', 'Caulk gun & tube', 'Stir sticks'],
    tags: ['tools', 'supplies'],
    icon: 'Paintbrush',
    color: '25:2',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Baking Supplies',
    location: 'home',
    area: 'Kitchen',
    items: ['Flour', 'Sugar', 'Baking powder', 'Vanilla extract', 'Cupcake liners', 'Rolling pin', 'Cookie cutters (holiday set)', 'Measuring cups & spoons', 'Parchment paper', 'Piping bags & tips', 'Cake decorating turntable'],
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
    items: ['Kibble', 'Treats', 'Leash', 'Poop bags', 'Chew toys', 'Flea medicine', 'Collar (spare)', 'Nail clippers', 'Brush (deshedding)', 'Dog shampoo', 'Travel water bowl'],
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
    items: ['All-purpose cleaner', 'Sponges', 'Microfiber cloths', 'Glass cleaner', 'Rubber gloves', 'Scrub brush', 'Broom & dustpan', 'Mop refill pads', 'Disinfectant spray', 'Stainless steel polish'],
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
    items: ['Lunch boxes (x3)', 'Water bottles (x4)', 'Ice packs', 'Reusable snack bags', 'Thermos', 'Bento box inserts', 'Silicone straws (set of 6)', 'Snack containers (stackable)', 'Insulated lunch tote', 'Spare lids & gaskets'],
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
    items: ['Watercolor paints', 'Construction paper', 'Pipe cleaners', 'Googly eyes', 'Pom poms', 'Markers', 'Sticker sheets', 'Modeling clay', 'Stamp pad & stamps', 'Perler beads & pegboards', 'Glitter glue tubes', 'Washi tape (assorted)'],
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
    items: ['Diapers', 'Wipes', 'Bottles', 'Pacifiers', 'Burp cloths', 'Teething rings', 'Diaper cream', 'Baby nail clippers', 'Swaddle blankets (x3)', 'Bottle brush', 'Sippy cup (transition)'],
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
    items: ['Princess dresses', 'Superhero capes', 'Pirate hat', 'Fairy wings', 'Face paint', 'Wigs', 'Knight shield & sword (foam)', 'Animal ear headbands', 'Tutu skirts (x3)', 'Cowboy hat', 'Costume jewelry bag'],
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
    items: ['LEGO Classic bucket', 'LEGO City set', 'Magna-Tiles', 'Lincoln Logs', 'Instruction booklets', 'LEGO Star Wars set', 'Duplo blocks (toddler)', 'Baseplate sheets (x4)', 'Brick separator tools', 'Sorting containers (by color)'],
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
    items: ['Teddy bear', 'Bunny plush', 'Dinosaur collection', 'Baby dolls (x2)', 'Doll clothes', 'Unicorn plush', 'Paw Patrol figures', 'Puppet set (hand puppets)', 'Doll stroller', 'Weighted stuffed animal (bedtime)'],
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
    items: ['String lights', 'Ornaments box', 'Wreath', 'Tree stand', 'Stockings', 'Advent calendar', 'Tree skirt', 'Outdoor inflatable (snowman)', 'Window clings', 'Garland (faux pine)', 'Extension cord (outdoor rated)'],
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
  },
  {
    name: 'Board Games',
    location: 'home',
    area: 'Basement',
    items: ['Candy Land', 'Uno', 'Sorry!', 'Jenga', 'Playing cards', 'Puzzles', 'Ticket to Ride', 'Scrabble', 'Monopoly', 'Catan', 'Codenames'],
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
    items: ['Snow boots', 'Thermal gloves', 'Wool scarf', 'Beanie', 'Hand warmers', 'Ski goggles', 'Thermal base layers (x2)', 'Neck gaiter', 'Insulated socks (3 pair)', 'Snow pants (kids)'],
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
    items: ['School backpacks', 'Gym bag', 'Reusable grocery bags', 'Diaper bag', 'Beach tote', 'Drawstring bags', 'Laptop sleeve', 'Fanny pack', 'Dry bag (waterproof)', 'Packing cubes (set of 4)'],
    tags: ['kids', 'supplies'],
    icon: 'Backpack',
    color: '200:3',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Outgrown Kids Clothes',
    location: 'storage',
    area: '',
    items: ['0-3 month onesies', '6-12 month outfits', '2T winter jackets', '3T shoes', 'Newborn hats', '4T summer dresses', '18-month sleepers (x4)', 'Infant snowsuit', 'Baby socks bag', 'Toddler rain boots'],
    tags: ['kids', 'clothing'],
    icon: 'Shirt',
    color: '320:2',
    cardStyle: '',
    notes: '',
  },
  {
    name: 'Old Electronics',
    location: 'storage',
    area: '',
    items: ['iPad (2nd gen)', 'Old laptop', 'Kindle', 'Phone chargers', 'Camera', 'External hard drive', 'Bluetooth speaker (broken)', 'Old router', 'Wii console & controllers', 'USB flash drives (assorted)', 'Tangled earbuds bag'],
    tags: ['electronics'],
    icon: 'Laptop',
    color: 'neutral:2',
    cardStyle: '',
    notes: 'Wipe data before donating. Hard drive has family photos backup.',
  },
  {
    name: 'Keepsakes & Memories',
    location: 'storage',
    area: '',
    items: ['Wedding album', 'Baby books', 'Kids artwork', 'Family photo prints', 'Childhood trophies', 'Grandparent letters & cards', 'First-day-of-school signs', 'Hospital wristbands (births)', 'Pressed flowers from garden', 'Home video DVDs (x6)'],
    tags: ['family', 'documents'],
    icon: 'Heart',
    color: '340:1',
    cardStyle: JSON.stringify({ variant: 'stripe', secondaryColor: '280:1', stripePosition: 'left', stripeWidth: 3 }),
    notes: '',
  },
  {
    name: 'Networking',
    location: 'home',
    area: 'Office',
    items: ['UniFi 8-port switch', 'CAT6 keystone jacks (bag)', 'RJ45 crimping tool', 'Network cable tester', 'SFP+ DAC cables', 'Velcro cable ties', 'TP-Link EAP access point', 'Console cable (USB to RJ45)'],
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
    area: 'Office',
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
    items: ['Raspberry Pi Zero 2 W', 'Arduino Uno R3', 'ESP32-C3 dev boards (x4)', 'Coral USB Edge TPU', 'Micro SD cards 32GB (x3)', 'GPIO breakout ribbon cables', 'Breadboards (x2)', 'Jumper wire kit', 'USB-C power adapters 5V 3A (x2)'],
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
    items: ['Bleached V60 filters', 'Kalita Wave 185 filters', 'Chemex bonded filters (square)', 'AeroPress paper filters (350ct)', 'Cafec Abaca filters (light roast)', 'Barista Hustle brush (grinder cleaning)', 'Pallo grinder brush', 'Dosing cups (58mm, set of 2)', 'Milk frother (Nanofoamer)', 'Cupping spoons (set of 4)', 'Tasting notebook (Brewista)', 'Coffee compass flavor wheel poster'],
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
    items: ['Merino wool', 'Chunky alpaca blend', 'Cotton yarn — cream', 'Sock yarn — self-striping', 'Lace weight mohair', 'DK weight superwash', 'Cashmere blend fingering weight (50g)', 'Recycled silk ribbon yarn (100g)', 'Baby yarn — soft white (100g x2)', 'Tapestry wool remnants (assorted)', 'Yarn swift (for winding)'],
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
    items: ['Circular needles — US 2 (2.75mm), 32"', 'Circular needles — US 7 (4.5mm), 24"', 'Circular needles — US 10 (6mm), 40"', 'DPNs — US 1 set (2.25mm), 6"', 'DPNs — US 4 set (3.5mm), 8"', 'Interchangeable needle tips — US 4\u201310.5', 'Row counter (clicker style)', 'Stitch markers (locking, 20x)', 'Tapestry needles (blunt tip, 6x)', 'Cable needle (J-hook style)', 'Yarn cutter pendant', 'Needle gauge / ruler combo', 'KnitPicks interchangeable cable cords (various lengths)'],
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
    items: ['WIP: Cabled sweater (navy merino, size M) — at yoke shaping', 'WIP: Lace shawl (mohair blend) — 60% done', 'WIP: Baby hat (white, gift for shower)', 'Pattern: Tin Can Knits — Seasons collection (printed)', 'Pattern: Churchmouse Yarns — Classic Shawl (printed)', 'Pattern notebook — swatches & row notes', 'Project bags (drawstring cotton, x3)', 'Blocking mats (foam, 9-piece set)', 'Blocking wires (set of 12, stainless)', 'T-pins (50 pack)', 'Stitch holders (large, x4)', 'Waste yarn scraps (for provisional cast-ons)'],
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
    items: ['Chessex Gemini 7-piece polyhedral set (blue-green)', 'Metal d20 (critical hit die)', 'Precision casino-grade d6 set (6)', 'Dispel Dice handmade set (resin, galaxy)', 'Koplow opaque set (backup dice)', 'd4 caltrops set (6)', 'Dice tower (wooden)', 'Velvet dice tray (rolling surface)', 'Dice bag (leather drawstring)', 'Spin-down d20 life counter', 'Card sleeves (50 count, standard)', 'Initiative tracker cards (10)'],
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
    items: ['Reaper Bones heroes set (12 unpainted)', "Nolzur's Marvelous Miniatures — adventurers pack", 'WizKids pre-painted dungeon monsters (assorted)', 'Goblin warband (10, painted green)', 'Dragon miniature (large, WizKids Pathfinder)', 'Dungeon tiles — modular stone floor set', 'OpenLock 3D-printed wall segments (20)', 'Woodland Scenics clump foliage (forest terrain)', 'Painted campfire scatter piece', 'Tavern furniture set (resin: tables, chairs, bar)', 'Basing paste (Vallejo Dark Earth)', 'Army Painter wash set (6 washes)'],
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
    items: ['DM screen (Reaper foldout, 4-panel)', 'Kobold Press: Tome of Beasts 1', "Lazy DM's Workbook (Michael Shea)", 'Campaign notebook (graph paper, hardcover)', 'Initiative tracker (magnetic dry-erase board)', 'Condition rings — silicone, color-coded (20)', 'Wet-erase battle mat (1" grid, 24"x36")', 'Wet-erase markers (4-color set)', 'Random encounter tables (laminated reference cards)', "NPC name generator cards (Rory's Story Cubes)", 'Bluetooth speaker (for ambient dungeon audio)', 'Session notes binder with plastic sleeves'],
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
    area: '',
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
    area: '',
    items: ['Diamond lap discs (180 / 600 / 1200 / 3000 grit)', 'Cabochon dopping sticks', 'Dopping wax (brown)', 'Polishing felt pad', 'Cerium oxide polishing powder', 'Diamond polishing compound (14k grit)', 'Trim saw blade (4 in, diamond)', 'Safety glasses (splash-rated)', 'Flexible shaft handpiece bits', 'Aluminum dop block with holes', 'Lubricating oil (honing)', 'Caliper (digital, 6 in)'],
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
    area: '',
    items: ['Rock hammer (22 oz, Estwing)', 'Cold chisels (1/2 in and 3/4 in)', 'Hand lens (10x, Bausch & Lomb)', 'Field notebook (waterproof pages)', 'Streak plate (unglazed porcelain)', 'Hardness picks set (Mohs 2\u20139)', 'Dilute HCl dropper bottle (10%)', 'GPS unit (Garmin eTrex)', 'Newspaper for wrapping specimens', 'Cotton specimen bags (assorted)', 'Leather gloves', 'UV flashlight (shortwave, 254 nm)'],
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
    items: ['USB Mini-B cable', 'Micro-USB cables', 'VGA cable', 'DVI-D cable', 'Proprietary laptop charger (unknown model)', 'Coax cable (3 ft)', 'Ethernet patch cables (mixed lengths)', 'FireWire 400 cable', '3.5mm aux cords (x4)', 'Barrel jack adapters (assorted)', 'Cable that came with something'],
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
    items: ['Pi 3A (was going to be a magic mirror)', 'Pi Zero W (planned as a PiHole)', 'Pi 4 2GB (briefly a NAS, regretted it)', 'Pi Zero 2 W (earmarked for OctoPrint)', 'Micro SD cards with unknown images (x6)', 'Pi cases (assorted, none fit right)', 'Official Pi power supplies (x3)', 'Pi camera module V2', 'Sense HAT (used once)', 'GPIO ribbon cable (never used)'],
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
    area: '',
    items: ['DDR3 ECC sticks 8GB (x4)', 'Intel i5-6500', '120GB SSD (honorably discharged)', 'Stock Intel cooler (never used)', '1GbE NIC', 'Old ATX power supply (500W)', 'PCIe x1 riser', 'SATA cables (x6)', 'Case fans 120mm (x3)', 'CPU bracket (wrong socket)'],
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
    items: ['SATA cables (x8)', 'HDD mounting screws (ziplock bag)', 'Molex splitters (x2)', 'Anti-vibration grommets (x12)', 'SATA power extensions', 'IEC C13 power cord (spare)', 'Drive sleds (wrong model)', 'Thermal pads (1mm, spare sheet)', 'Case fan splitter', '80mm case fans (x2)', 'Hot swap bay (unused)'],
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
    items: ['Benchy (first layer shift)', 'Calibration cubes (x11)', 'Spaghetti blob (PLA)', 'Half a Mandalorian helmet', 'Cable clips (the only good prints)', 'Lithophane (wrong orientation)', 'Phone stand (warped)', 'Vase mode test (collapsed at 80%)', 'Flexi Rex with fused joints', 'Temp tower', 'Purge blocks bag'],
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

  // Demo household members: username -> display name
  const DEMO_USERS: Record<DemoMember, string> = {
    demo: 'Darrin DeYoung',
    sarah: 'Sarah DeYoung',
    alex: 'Alex DeYoung',
    jordan: 'Jordan DeYoung',
  };
  const DEMO_USERNAMES = Object.keys(DEMO_USERS) as DemoMember[];

  const runSeed = db.transaction(() => {
    // Delete existing demo users and their orphaned locations
    for (const username of DEMO_USERNAMES) {
      const existing = querySync<{ id: string }>(
        'SELECT id FROM users WHERE username = $1',
        [username],
      );
      if (existing.rows.length > 0) {
        // Delete locations created by this user (CASCADE cleans up bins, items, etc.)
        querySync('DELETE FROM locations WHERE created_by = $1', [existing.rows[0].id]);
        querySync('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
      }
    }

    // Create all demo users with random passwords (nobody needs credentials)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = bcrypt.hashSync(randomPassword, 4);

    const userIdMap = new Map<DemoMember, string>();
    for (const [username, displayName] of Object.entries(DEMO_USERS)) {
      const id = generateUuid();
      userIdMap.set(username as DemoMember, id);
      querySync(
        'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)',
        [id, username, passwordHash, displayName],
      );
    }

    const userId = userIdMap.get('demo')!;

    // Create locations (owned by primary demo user)
    const homeLocationId = createLocation(userId, 'Our House');
    const storageLocationId = createLocation(userId, 'Self Storage Unit');

    // Add household members to locations
    // Sarah: admin of both locations (partner)
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), homeLocationId, userIdMap.get('sarah')!, 'admin'],
    );
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), storageLocationId, userIdMap.get('sarah')!, 'admin'],
    );
    // Alex: member of home (teen)
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), homeLocationId, userIdMap.get('alex')!, 'member'],
    );
    // Jordan: member of storage unit only (friend helping with storage)
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), storageLocationId, userIdMap.get('jordan')!, 'member'],
    );

    // Set active location to home for all users who have access
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userId]);
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('sarah')!]);
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('alex')!]);
    querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [storageLocationId, userIdMap.get('jordan')!]);

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

    for (const bin of DEMO_BINS) {
      const binId = generateShortCode(bin.name);
      binIdMap.set(bin.name, binId);
      const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
      const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
      const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;

      querySync(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId],
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
    const pinnedBinNames = ['Dog Supplies', 'Networking Gear', 'Brewing Equipment', 'Board Games', 'Yarn Stash'];
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
      'Dog Supplies', 'Board Games', 'Cleaning Supplies',
      'Baby & Toddler', 'Power Tools', 'Camping Gear',
      'SBCs & Dev Boards', 'Mineral Specimens', 'D&D Rulebooks',
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

    // Mark onboarding completed for all demo users except the primary demo user
    for (const [username, id] of userIdMap.entries()) {
      const prefs = username === 'demo'
        ? { onboarding_completed: false, onboarding_step: 0 }
        : { onboarding_completed: true };
      querySync(
        'INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)',
        [generateUuid(), id, JSON.stringify(prefs)],
      );
    }
  });

  try {
    runSeed();
    const elapsed = Date.now() - startTime;
    const homeBins = DEMO_BINS.filter((b) => b.location === 'home').length;
    const storageBins = DEMO_BINS.filter((b) => b.location === 'storage').length;
    const message = `Demo data seeded in ${elapsed}ms (${DEMO_USERNAMES.length} users, ${homeBins} + ${storageBins} bins across 2 locations, ${HOME_AREAS.length} areas)`;
    console.log(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    console.error('Failed to seed demo data:', err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
