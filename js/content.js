export const TOPICS = {
  easy: [
    'Your favourite food and why', 'Describe your morning routine', 'The best trip you have taken', 'Your favourite app on your phone',
    'A movie you would watch again', 'What you did last weekend', 'Your dream house', 'A skill you want to learn',
    'Your favourite season', 'Describe your city to a tourist', 'The best gift you ever got', 'Tea or coffee?',
    'Your first phone', 'A teacher who influenced you', 'Your favourite festival', 'What makes a good friend',
    'Describe your desk right now', 'A hobby you had as a kid', 'Your favourite song right now', 'Cats or dogs?',
    'The last thing that made you laugh', 'What you would do with a free day', 'Your favourite place to relax', 'A habit you are proud of',
  ],
  medium: [
    'Should everyone learn to code?', 'Is remote work better than office work?', 'The most useful thing AI does for you', 'Explain your job to a 10-year-old',
    'What makes a great YouTube video', 'Social media: good or bad for us?', 'Why people procrastinate', 'How to learn anything faster',
    'The best advice you ever received', 'A mistake that taught you something', 'What would you change about your city?', 'Is it better to be a specialist or a generalist?',
    'Why do some apps become addictive?', 'How would you explain the internet to your grandparents?', 'What makes a good manager', 'Books vs videos for learning',
    'Should phones be banned in schools?', 'The future of electric cars in India', 'Is money the best motivator?', 'What is one thing schools should teach?',
    'Describe a bug you spent too long fixing', 'Why do people fear public speaking?', 'Your take on working at a big company vs a startup', 'Morning person or night owl and why',
  ],
  hard: [
    'Will AI replace software engineers? Argue both sides', 'Convince me to try your favourite programming language', 'Explain how a database index works without jargon', 'What does “success” really mean?',
    'Pitch a startup idea in 60 seconds', 'The ethics of AI-generated content', 'Should social media be regulated by governments?', 'Explain the cloud to someone who has never used a computer',
    'Defend an unpopular opinion you hold', 'What will work look like in 2035?', 'Is open source sustainable?', 'Why most new year resolutions fail, and how to fix that',
    'Explain recursion using a real-life example', 'Hot take: the most overrated tech trend', 'Tell a story about a time you were brave', 'How would you make your company 10x better?',
  ],
  creator: [
    'Hook: “Nobody talks about this…” about a dev tool you love', 'Reel: 3 VS Code tricks in 60 seconds', 'Reel: why I switched from X to Y', 'Reel: the biggest mistake junior devs make',
    'Reel: explain an API in 45 seconds', 'Reel: my honest take on the newest AI model', 'Reel: one productivity hack that changed my week', 'Reel: what I learned working at a big tech company',
    'Reel: debunk a popular coding myth', 'Reel: a day in my life as an engineer', 'Reel: rate 3 AI coding tools out of 10', 'Reel: how I would learn programming from zero today',
  ],
};

export const RESCUE_PHRASES = [
  { phrase: "What's the word… the thing that…", use: 'Buy time and describe the object' },
  { phrase: "It's like a kind of…", use: 'Approximate with a category' },
  { phrase: "What I mean is…", use: 'Restate the idea a simpler way' },
  { phrase: "In other words…", use: 'Paraphrase without restarting' },
  { phrase: "Basically, the idea is…", use: 'Zoom out to the main point' },
  { phrase: "The thing you use to…", use: 'Describe by function' },
  { phrase: "It's the opposite of…", use: 'Describe by contrast' },
  { phrase: "Something similar to…", use: 'Describe by comparison' },
  { phrase: "Let me put it this way…", use: 'Reframe smoothly' },
  { phrase: "How do I say this…", use: 'Honest, natural time-buyer' },
  { phrase: "The point is…", use: 'Skip the missing word, land the meaning' },
  { phrase: "You know when you…", use: 'Describe the situation instead' },
  { phrase: "It's that feeling when…", use: 'Describe an emotion by situation' },
  { phrase: "Anyway, the main thing is…", use: 'Abandon the detail, keep going' },
  { phrase: "Think of it like…", use: 'Use an analogy' },
];

export const BRIDGE_TIPS = [
  'Describe it: what does it DO?', 'Use a simpler word', 'Say “the thing that…” and keep going',
  'Compare it: “it’s like a…”', 'Skip the detail, say the point', 'Keep the same sentence. Don’t restart!',
];

export const TONGUE_TWISTERS = [
  { text: 'Red lorry, yellow lorry, red lorry, yellow lorry', focus: 'R / L' },
  { text: 'Very well, Victor, we will visit the village with Walter', focus: 'V / W' },
  { text: 'We were very weary of the vivid violet vests', focus: 'V / W' },
  { text: 'Three thin thinkers thinking thick thoughtful thoughts', focus: 'TH' },
  { text: 'The thirty-three thieves thought that they thrilled the throne throughout Thursday', focus: 'TH' },
  { text: 'Unique New York, unique New York, you know you need unique New York', focus: 'Agility' },
  { text: 'She sells seashells by the seashore', focus: 'S / SH' },
  { text: 'Peter Piper picked a peck of pickled peppers', focus: 'P (aspirated)' },
  { text: 'Fred fed Ted bread, and Ted fed Fred bread', focus: 'F / D' },
  { text: 'A proper copper coffee pot', focus: 'P / K / F' },
  { text: 'Better butter makes the batter better', focus: 'Flap T' },
  { text: 'Betty bought a bit of better butter', focus: 'Flap T' },
  { text: 'Rural juror, rural juror, rural juror', focus: 'R + L (final boss)' },
  { text: 'Worldwide words were written while we worked', focus: 'W + R' },
  { text: 'Irish wristwatch, Swiss wristwatch', focus: 'SH / S / W' },
  { text: 'Eleven benevolent elephants', focus: 'L / V' },
  { text: 'Truly rural, truly rural, truly rural', focus: 'R / L' },
  { text: 'The great Greek grape growers grow great Greek grapes', focus: 'GR clusters' },
  { text: 'Six slippery snails slid slowly seaward', focus: 'S clusters' },
  { text: 'Thirty thousand feathers on a thrush’s throat', focus: 'TH + R' },
  { text: 'Whether the weather is warm or whether the weather is not', focus: 'W + TH' },
  { text: 'Pad kid poured curd pulled cod', focus: 'Final boss (stops)' },
];

export const MINIMAL_PAIRS = [
  { group: 'V vs W', pairs: [['vest', 'west'], ['vine', 'wine'], ['vet', 'wet'], ['veil', 'whale'], ['verse', 'worse'], ['vow', 'wow'], ['vent', 'went'], ['viper', 'wiper']], tip: 'V: top teeth touch the lower lip, buzz. W: round the lips like a kiss, NO teeth.' },
  { group: 'TH vs T', pairs: [['thin', 'tin'], ['three', 'tree'], ['thought', 'taught'], ['thank', 'tank'], ['thick', 'tick'], ['bath', 'bat']], tip: 'TH: tongue tip lightly between teeth, blow air. T: tongue tip on the ridge behind teeth.' },
  { group: 'TH vs D', pairs: [['they', 'day'], ['then', 'den'], ['those', 'doze'], ['though', 'dough'], ['breathe', 'breed']], tip: 'Voiced TH: tongue between teeth and hum. D: quick tap on the ridge.' },
  { group: 'Short i vs long ee', pairs: [['ship', 'sheep'], ['live', 'leave'], ['fill', 'feel'], ['bit', 'beat'], ['sit', 'seat'], ['hit', 'heat']], tip: 'Short i: relaxed, quick. Long ee: smile and stretch it.' },
  { group: 'a (cat) vs e (bed)', pairs: [['bad', 'bed'], ['man', 'men'], ['sat', 'set'], ['pan', 'pen'], ['had', 'head'], ['bat', 'bet']], tip: 'cat/bad: drop your jaw wide open. bed: jaw half open.' },
  { group: 'oo (pull) vs ooo (pool)', pairs: [['pull', 'pool'], ['full', 'fool'], ['look', 'Luke'], ['could', 'cooed'], ['should', 'shooed']], tip: 'pull: short and relaxed. pool: long with rounded lips.' },
  { group: 'S vs SH', pairs: [['sip', 'ship'], ['see', 'she'], ['sore', 'shore'], ['seat', 'sheet'], ['sell', 'shell'], ['save', 'shave']], tip: 'S: smile, tongue tip behind teeth. SH: lips pushed forward.' },
  { group: 'P vs F', pairs: [['pan', 'fan'], ['pile', 'file'], ['pool', 'fool'], ['pace', 'face'], ['copy', 'coffee'], ['pine', 'fine']], tip: 'P: both lips pop. F: top teeth on lower lip, blow.' },
  { group: 'Z vs J', pairs: [['zest', 'jest'], ['Zane', 'Jane'], ['buzz', 'budge'], ['raising', 'raging']], tip: 'Z: buzzing S sound. J: tongue blade on the ridge, then release.' },
];

export const NAMING_EMOJI = [
  ['🍎', 'apple'], ['🚲', 'bicycle'], ['🔑', 'key'], ['🕯️', 'candle'], ['🧲', 'magnet'], ['🪜', 'ladder'], ['🧺', 'basket'], ['⏳', 'hourglass'],
  ['🧯', 'fire extinguisher'], ['🪒', 'razor'], ['🧵', 'thread'], ['🪡', 'needle'], ['🔨', 'hammer'], ['🪛', 'screwdriver'], ['🧹', 'broom'], ['🪣', 'bucket'],
  ['🧽', 'sponge'], ['🔦', 'flashlight'], ['🕰️', 'clock'], ['📎', 'paperclip'], ['✂️', 'scissors'], ['📌', 'pin'], ['🧭', 'compass'], ['🔭', 'telescope'],
  ['🔬', 'microscope'], ['🎻', 'violin'], ['🥁', 'drum'], ['🎺', 'trumpet'], ['🦉', 'owl'], ['🦒', 'giraffe'], ['🦔', 'hedgehog'], ['🐢', 'turtle'],
  ['🦀', 'crab'], ['🐙', 'octopus'], ['🦇', 'bat'], ['🐿️', 'squirrel'], ['🌋', 'volcano'], ['🏝️', 'island'], ['🌉', 'bridge'], ['⛺', 'tent'],
  ['🧊', 'ice'], ['🌪️', 'tornado'], ['🌈', 'rainbow'], ['🍍', 'pineapple'], ['🥥', 'coconut'], ['🍆', 'eggplant'], ['🥕', 'carrot'], ['🧄', 'garlic'],
  ['🥨', 'pretzel'], ['🧇', 'waffle'], ['🍯', 'honey'], ['🧂', 'salt'], ['🥄', 'spoon'], ['🍴', 'fork'], ['🪑', 'chair'], ['🛏️', 'bed'],
  ['🪞', 'mirror'], ['🪟', 'window'], ['🚪', 'door'], ['🧳', 'suitcase'], ['🎒', 'backpack'], ['👓', 'glasses'], ['🧤', 'gloves'], ['🧣', 'scarf'],
  ['⚓', 'anchor'], ['🛶', 'canoe'], ['🚁', 'helicopter'], ['🚂', 'train'], ['🛞', 'wheel'], ['⛽', 'fuel pump'], ['🚦', 'traffic light'], ['🏰', 'castle'],
  ['🎈', 'balloon'], ['🪁', 'kite'], ['🧩', 'puzzle'], ['🎲', 'dice'], ['🪃', 'boomerang'], ['🏹', 'bow and arrow'], ['🛡️', 'shield'], ['⚖️', 'scale'],
];

export const NAMING_DEFS = [
  ['A person who designs buildings', 'architect'], ['Fear of being in small closed spaces', 'claustrophobia'], ['To put something off until later', 'procrastinate'],
  ['A copy of data kept in case the original is lost', 'backup'], ['The ability to recover quickly from difficulty', 'resilience'], ['Done without any planning or script', 'spontaneous'],
  ['A short, catchy opening that grabs attention', 'hook'], ['To make something smaller in size or amount', 'reduce'], ['Not clear; having more than one meaning', 'ambiguous'],
  ['A strong feeling of wanting to do something', 'motivation'], ['To give up something for a greater goal', 'sacrifice'], ['Feeling of worry about what might happen', 'anxiety'],
  ['Someone who starts a business', 'entrepreneur'], ['To say something is true with confidence', 'claim'], ['A set of steps to solve a problem', 'algorithm'],
  ['Happening every year', 'annual'], ['To make something easier to understand', 'simplify'], ['A person who watches an event', 'spectator'],
  ['To agree to something reluctantly', 'compromise'], ['Something that stops progress', 'obstacle'], ['Very careful about small details', 'meticulous'],
  ['To look at something carefully to find mistakes', 'review'], ['Money paid to use a service every month', 'subscription'], ['A machine’s ability to do tasks that need intelligence', 'artificial intelligence'],
  ['Feeling thankful', 'grateful'], ['To come back after being away', 'return'], ['The main idea of a talk', 'message'],
  ['A plan of what will happen and when', 'schedule'], ['Too much to deal with', 'overwhelming'], ['Something you believe will happen', 'expectation'],
  ['A person who is new and inexperienced', 'beginner'], ['Clear and easy to see through', 'transparent'], ['To change to fit a new situation', 'adapt'],
  ['A small fault in software', 'bug'], ['A shortcut to do a task faster', 'hack'], ['Able to be trusted', 'reliable'],
  ['To speak about something in detail', 'elaborate'], ['To make a guess based on evidence', 'infer'], ['A habit you do without thinking', 'routine'],
  ['Feeling of tiredness after a long flight', 'jet lag'], ['Not sure about something', 'uncertain'], ['To show something is true', 'prove'],
];

export const TABOO_CARDS = [
  { word: 'umbrella', banned: ['rain', 'wet', 'open'] }, { word: 'laptop', banned: ['computer', 'screen', 'keyboard'] },
  { word: 'airport', banned: ['plane', 'fly', 'flight'] }, { word: 'password', banned: ['login', 'secret', 'account'] },
  { word: 'refrigerator', banned: ['cold', 'food', 'kitchen'] }, { word: 'wedding', banned: ['marriage', 'bride', 'groom'] },
  { word: 'deadline', banned: ['date', 'time', 'submit'] }, { word: 'traffic', banned: ['cars', 'road', 'jam'] },
  { word: 'cricket', banned: ['bat', 'ball', 'match'] }, { word: 'gym', banned: ['exercise', 'workout', 'weights'] },
  { word: 'interview', banned: ['job', 'questions', 'hire'] }, { word: 'battery', banned: ['charge', 'power', 'phone'] },
  { word: 'mirror', banned: ['reflection', 'face', 'glass'] }, { word: 'dentist', banned: ['teeth', 'doctor', 'mouth'] },
  { word: 'Wi-Fi', banned: ['internet', 'wireless', 'router'] }, { word: 'meeting', banned: ['call', 'team', 'discuss'] },
  { word: 'nervous', banned: ['scared', 'anxious', 'fear'] }, { word: 'subscribe', banned: ['channel', 'follow', 'youtube'] },
  { word: 'bug', banned: ['error', 'code', 'insect'] }, { word: 'salary', banned: ['money', 'pay', 'job'] },
  { word: 'holiday', banned: ['vacation', 'leave', 'trip'] }, { word: 'library', banned: ['books', 'read', 'quiet'] },
  { word: 'map', banned: ['directions', 'location', 'google'] }, { word: 'alarm', banned: ['wake', 'clock', 'ring'] },
  { word: 'chef', banned: ['cook', 'kitchen', 'restaurant'] }, { word: 'pillow', banned: ['sleep', 'bed', 'head'] },
  { word: 'calendar', banned: ['date', 'month', 'day'] }, { word: 'headphones', banned: ['music', 'ears', 'listen'] },
  { word: 'feedback', banned: ['opinion', 'review', 'comment'] }, { word: 'confidence', banned: ['believe', 'sure', 'self'] },
];

export const CATEGORIES = [
  'fruits', 'animals', 'things in a kitchen', 'programming languages', 'jobs', 'countries', 'things that are red', 'emotions',
  'things you find in an office', 'sports', 'apps on your phone', 'things that fly', 'body parts', 'vegetables', 'clothes',
  'adjectives to describe a person', 'verbs for movement', 'things in a bathroom', 'musical instruments', 'weather words',
  'tech companies', 'things you do in the morning', 'ways to say “good”', 'ways to say “bad”', 'words related to money',
];

export const SYNONYM_SPRINT = [
  'good', 'bad', 'big', 'small', 'happy', 'sad', 'fast', 'important', 'difficult', 'easy', 'interesting', 'tired',
  'angry', 'smart', 'beautiful', 'problem', 'idea', 'help', 'think', 'show', 'make', 'change', 'start', 'use',
];

export const SHADOW_SCRIPTS = [
  { title: 'Tech hook (Theo-style)', text: "Okay, so this is kind of insane. I've been using this tool for a week, and it genuinely changed how I write code. To be clear, I'm not saying you should drop everything. But if you care about speed, you need to see this. Here's why." },
  { title: 'Opinion with structure', text: "I think most people get this wrong. The problem isn't the tool. The problem is how we use it. And once you understand that, everything gets easier. So let me show you what I mean." },
  { title: 'Clear explainer', text: "An API is basically a menu for software. You don't need to know how the kitchen works. You just pick what you want, send your order, and get the result back. That's it. That's the whole idea." },
  { title: 'Story opener', text: "Three years ago, I was terrified of speaking in meetings. My heart would race, my mind would go blank, and I'd just stay quiet. Today, I'm recording this video. Here's exactly what changed." },
  { title: 'Calm confident pacing', text: "Let me slow this down. There are three things that matter here. First, clarity. Second, consistency. And third, and this is the one people forget, patience. Get those right, and the rest follows." },
  { title: 'Persuasive close', text: "So here's my challenge for you. Pick one thing from this video. Just one. Try it tomorrow morning. And let me know in the comments how it went. I'll see you in the next one." },
  { title: 'Flap T + R drill passage', text: "Whatever it is, it's better to get started a little bit later than never. Our water heater broke, so Peter put a better heater in the attic, and it worked perfectly for the rest of the winter." },
  { title: 'V / W / TH drill passage', text: "We were very worried about the weather, so we waited. Then, three thousand visitors arrived with their vans and their wheels, and the whole village thought it was wonderful." },
  { title: 'R benchmark passage (monthly test)', text: "Her first word at work was learn. Thirty nerds were there, and the third person worked late. It hurt, but they learned a lot. Were they the first? It's certain. The girl who turned up first earned her first award, and her words were worth it." },
];

export const READING_PASSAGES = [
  "The most important thing about speaking well is not having a perfect accent. It is being understood easily, without the listener having to work hard. Clear speech comes from three habits: opening your mouth enough, finishing the ends of your words, and pausing between ideas instead of in the middle of them.",
  "Every morning, I spend ten minutes reading out loud. At first, it felt strange to hear my own voice in an empty room. But after a few weeks, my mouth started to move faster and more precisely, and I stopped tripping over long words. Small, daily practice beats occasional long sessions.",
  "When you build software for real people, the hardest part is rarely the code. It is understanding what the user actually needs, explaining your ideas to your team, and making decisions when nobody has all the answers. Communication is the skill that multiplies every other skill.",
  "Confidence is not the absence of fear. It is the decision to speak even when your heart is racing. The first time is uncomfortable. The tenth time is easier. By the hundredth time, you will wonder why you were ever worried at all.",
  "Her first word at work was learn. Thirty nerds were there, and the third person worked late. It hurt, but they learned a lot. Were they the first? It's certain. The girl who turned up first earned her first award, and her words were worth it.",
];

export const PHRASE_BANK = [
  { cat: 'Rescue', phrase: "what I mean is", cue: 'You lost the word; restate simply' },
  { cat: 'Rescue', phrase: "it's kind of like", cue: 'Approximate something you can’t name' },
  { cat: 'Rescue', phrase: "the thing that you use to", cue: 'Describe an object by its function' },
  { cat: 'Rescue', phrase: "let me put it this way", cue: 'Reframe an explanation' },
  { cat: 'Rescue', phrase: "in other words", cue: 'Paraphrase' },
  { cat: 'Rescue', phrase: "how do I say this", cue: 'Buy a second naturally' },
  { cat: 'Rescue', phrase: "the point is", cue: 'Skip to the main idea' },
  { cat: 'Opinion', phrase: "to be clear", cue: 'Prevent a misunderstanding' },
  { cat: 'Opinion', phrase: "to be fair", cue: 'Acknowledge the other side' },
  { cat: 'Opinion', phrase: "I would argue that", cue: 'State a strong opinion politely' },
  { cat: 'Opinion', phrase: "here's the thing", cue: 'Introduce the key insight' },
  { cat: 'Opinion', phrase: "the problem is", cue: 'Point out what is wrong' },
  { cat: 'Opinion', phrase: "I genuinely think", cue: 'Sincere, strong belief' },
  { cat: 'Opinion', phrase: "honestly", cue: 'Signal a frank opinion' },
  { cat: 'Linking', phrase: "which means", cue: 'Show a consequence' },
  { cat: 'Linking', phrase: "and that's why", cue: 'Connect a reason to a result' },
  { cat: 'Linking', phrase: "on top of that", cue: 'Add another point' },
  { cat: 'Linking', phrase: "at the same time", cue: 'Show a contrast' },
  { cat: 'Linking', phrase: "not just", cue: '“Not just X, but Y”' },
  { cat: 'Linking', phrase: "especially", cue: 'Highlight a specific case' },
  { cat: 'Linking', phrase: "as a result", cue: 'Formal consequence' },
  { cat: 'Linking', phrase: "that said", cue: 'Introduce a counterpoint' },
  { cat: 'Hook', phrase: "if you had told me", cue: 'Surprise/reversal opening' },
  { cat: 'Hook', phrase: "nobody talks about", cue: 'Curiosity opening' },
  { cat: 'Hook', phrase: "this is a video I never wanted to make", cue: 'Confession opening' },
  { cat: 'Hook', phrase: "here's what happened", cue: 'Story opening' },
  { cat: 'Hook', phrase: "stop doing this", cue: 'Warning opening' },
  { cat: 'Audience', phrase: "let me know in the comments", cue: 'Call to action' },
  { cat: 'Audience', phrase: "if you want to", cue: 'Give the viewer an option' },
  { cat: 'Audience', phrase: "you get the idea", cue: 'Wrap up a list' },
  { cat: 'Audience', phrase: "hope this was helpful", cue: 'Closing line' },
  { cat: 'Chunk', phrase: "a lot of", cue: 'Very common quantity chunk' },
  { cat: 'Chunk', phrase: "a bunch of", cue: 'Casual quantity' },
  { cat: 'Chunk', phrase: "to make sure that", cue: 'Purpose' },
  { cat: 'Chunk', phrase: "at the end of the day", cue: 'Final conclusion' },
  { cat: 'Chunk', phrase: "it turns out that", cue: 'Reveal a surprising fact' },
  { cat: 'Chunk', phrase: "to the point where", cue: 'Show an extreme result' },
  { cat: 'Chunk', phrase: "the reason is", cue: 'Give a reason' },
  { cat: 'Chunk', phrase: "it is what it is", cue: 'Accept a situation' },
  { cat: 'Chunk', phrase: "more and more", cue: 'Show an increasing trend' },
];

export const EXPOSURE_LADDER = [
  { id: 'e1', level: 1, text: 'Read a paragraph aloud alone at normal volume' },
  { id: 'e2', level: 2, text: 'Read the same paragraph at “across the room” volume' },
  { id: 'e3', level: 2, text: 'Record a 1-minute video and watch it fully' },
  { id: 'e4', level: 3, text: 'Send an English voice note to a close friend' },
  { id: 'e5', level: 3, text: 'Ask a question in English to a shop/restaurant staff' },
  { id: 'e6', level: 4, text: 'Make a 5-minute English video call with a friend' },
  { id: 'e7', level: 4, text: 'Book and complete one online tutor session (Cambly/Preply)' },
  { id: 'e8', level: 5, text: 'Speak up once in a work meeting (question or comment)' },
  { id: 'e9', level: 5, text: 'Attend a Toastmasters meeting as a guest' },
  { id: 'e10', level: 6, text: 'Do a Table Topics (impromptu) answer at Toastmasters' },
  { id: 'e11', level: 6, text: 'Post a 30-second reel (close friends only)' },
  { id: 'e12', level: 7, text: 'Present a 3-minute demo/update to your team' },
  { id: 'e13', level: 8, text: 'Give your Toastmasters Ice Breaker speech (4-6 min)' },
  { id: 'e14', level: 9, text: 'Post a public Instagram reel' },
  { id: 'e15', level: 10, text: 'Post 3 reels a week for 4 weeks in a row' },
];

export const PHASES = [
  { weeks: [1, 4], name: 'Foundation', goal: 'Daily habit + baseline. Breath, volume, pen-in-mouth, 1-min speeches, rescue phrases.', focus: ['warmup', 'articulation', 'volume', 'speak', 'retrieval'] },
  { weeks: [5, 10], name: 'Fluency engine', goal: 'Kill restarts: 4/3/2, Taboo, rapid naming, phrase bank, shadowing 10 min/day.', focus: ['speak432', 'retrieval', 'shadow', 'phrases', 'articulation'] },
  { weeks: [11, 18], name: 'Expression', goal: 'Pitch, pausing, stress, storytelling, PREP structure, Theo-style hooks. Toastmasters weekly.', focus: ['shadow', 'speak', 'phrases', 'volume', 'retrieval'] },
  { weeks: [19, 26], name: 'Creator mode', goal: '3 reels/week, filming under pressure, live practice, public exposure.', focus: ['speakCreator', 'shadow', 'articulation', 'phrases'] },
];

export const WEEK_THEMES = {
  1: 'Baseline + breathing', 2: 'Volume & projection', 3: 'Mouth gym (pen-in-mouth)', 4: 'Rescue phrases',
  5: '4/3/2 fluency', 6: 'Taboo & circumlocution', 7: 'V/W and TH', 8: 'Shadowing 10 min/day', 9: 'Rapid naming speed', 10: 'Phrase chunks',
  11: 'Pausing with purpose', 12: 'Word stress & rhythm', 13: 'Pitch variety', 14: 'PREP structure', 15: 'Storytelling', 16: 'Flap T & R',
  17: 'Opinions & debate', 18: 'Mid-point re-test',
  19: 'Hooks in 5 seconds', 20: 'Reel scripts', 21: 'Filming confidence', 22: 'Speed under control', 23: 'Q&A / live talk', 24: 'Humour & energy', 25: 'Public reels', 26: 'Final test + day 1 vs day 180',
};

export const SKILLS = [
  { name: 'Breath support', what: 'Steady air from the belly so your voice doesn’t fade or shake.', drill: 'Box breathing, “count to 20 on one breath”' },
  { name: 'Volume & projection', what: 'Being heard easily without shouting.', drill: 'Confidence Lab: hold the volume zone' },
  { name: 'Articulation', what: 'Precise lips/tongue/jaw movement so each sound is clean.', drill: 'Pen-in-mouth, tongue twisters, pa-ta-ka' },
  { name: 'Pronunciation (sounds)', what: 'Correct individual sounds: V/W, TH, R, vowels.', drill: 'Minimal pairs' },
  { name: 'Prosody', what: 'Stress, rhythm, pitch movement, intonation.', drill: 'Shadowing, stress-the-key-word reading' },
  { name: 'Pausing', what: 'Pausing BETWEEN ideas, not inside phrases.', drill: 'Slash-marked reading, 10-word sentences' },
  { name: 'Lexical retrieval', what: 'Finding words fast under pressure.', drill: 'Rapid naming, category sprint, synonym sprint' },
  { name: 'Repair fluency', what: 'Recovering from a lost word WITHOUT restarting.', drill: 'No-Restart speaking + rescue phrases + Taboo' },
  { name: 'Formulaic chunks', what: 'Ready-made phrases that let you speak without building every word.', drill: 'Phrase Bank (spaced repetition)' },
  { name: 'Structure', what: 'Organising thoughts: hook, point, reason, example, close.', drill: 'PREP mode, 4/3/2' },
  { name: 'Confidence & presence', what: 'Speaking up despite nerves; eye contact; energy.', drill: 'Exposure ladder, Toastmasters, filming daily' },
  { name: 'Listening & imitation', what: 'Hearing native patterns and copying them.', drill: 'Shadowing Theo/Mona clips' },
];

export const QUESTIONS = [
  'What did you do last weekend?', 'What is the best decision you made this year?', 'If you could live in any city, which one and why?',
  'What is something most people don’t know about your job?', 'What app could you not live without?', 'What would you teach a class on?',
  'What is the most useful thing you learned at work recently?', 'Describe a person who inspires you.', 'What is your opinion on working from home?',
  'If you had one extra hour every day, how would you use it?', 'What is a skill you are learning right now?', 'Tell me about a problem you solved recently.',
  'What makes a good team?', 'What advice would you give your 18-year-old self?', 'What is overrated in tech right now?',
  'What would you build if you had unlimited time?', 'How do you relax after a stressful day?', 'What is your favourite way to learn something new?',
  'What is one habit that changed your life?', 'Describe your perfect weekend.', 'What do you think AI will change most in 5 years?',
  'What was the hardest bug you ever fixed?', 'What is a movie everyone should watch?', 'Why do you want to create content on Instagram?',
  'What is something you changed your mind about?', 'What is the best compliment you have received?', 'Explain your favourite hobby to a beginner.',
  'What would you do if you were the CEO of your company for a day?', 'What is a common mistake people make when learning English?', 'Describe your hometown.',
  'What is a tool or product you recommend to everyone?', 'What does a great day at work look like for you?', 'Which festival do you enjoy most and why?',
  'What is your morning routine?', 'If you started a YouTube channel, what would it be about?', 'What is something you are proud of?',
  'How would you explain your work to a child?', 'What is the most interesting place you have visited?', 'What do you think makes someone a good speaker?',
  'What is one thing you want to achieve in the next 6 months?',
];

export const BENCHMARK_TOPIC = 'Benchmark: introduce yourself and what you do';

export const AFFIRMATIONS = [
  'I don’t need perfect English. I need to be understood. And I am.',
  'Every word I say out loud today makes the next one easier.',
  'Nervous energy is just excitement. I’ll use it.',
  'If I lose a word, I describe it and keep going. That’s what fluent people do.',
  'Nobody is judging me as hard as I judge myself.',
  'My voice deserves space. I’ll speak to the back of the room.',
  'Mistakes are proof I’m practising.',
];

export const LESSONS = {
  'Repair fluency': { good: 'Fluent speakers lose words too. They never rewind; they bridge ("the thing that…") and keep the same sentence.', how: ['Use P.B.C.: Pause → Bridge → Continue', 'Press SPACE every time you restart, to build awareness', 'Do one No-Restart challenge a day'], target: 'Under 1 freeze and 1 restart per minute' },
  'Lexical retrieval': { good: 'Words come out within ~1 s because they have been retrieved many times before.', how: ['Rapid naming daily', 'Add every word you lost to “My lost words”', 'Category and synonym sprints'], target: 'Naming average under 1.4 s at 90%+' },
  'Formulaic chunks': { good: 'Natives speak in pre-built chunks (“to be honest”, “which means”), which frees the brain to think.', how: ['Phrase Bank review daily', 'Use 3 phrases in every speech', 'Add phrases you hear from Theo/Mona'], target: 'Most phrases in box 3+' },
  'Pace': { good: 'Comfortable, clear pace: 140-170 wpm for impromptu speech.', how: ['4/3/2: same talk in less time', 'Shadow at 1× then 1.15×'], target: '150-170 wpm with clarity 90%+' },
  'Pausing (no fillers)': { good: 'Short silent pauses between ideas instead of “um/uh/basically”.', how: ['10-word sentences', 'Replace a filler with a silent half-second breath'], target: 'Under 2 fillers per minute' },
  'Articulation': { good: 'Every syllable is clean; word endings are finished; mouth opens enough.', how: ['Warm-up + pen-in-mouth daily', 'Tongue twisters slow → fast', 'Watch recognition clarity %'], target: 'Pen-reading clarity 95%, pa-ta-ka 6+/s' },
  'Pronunciation (sounds)': { good: 'Sounds that change meaning (V/W, TH, vowels) are distinct.', how: ['Minimal pairs for your first-language priorities', 'Listen: model vs you'], target: '85%+ on every group' },
  'Volume & projection': { good: 'Easily heard at 3 metres without strain; volume stays up at sentence ends.', how: ['Volume zone daily', 'Projection ladder', 'Arena speak-up nudge'], target: '85% of speech in the confident zone' },
  'Confidence': { good: 'You speak even when nervous, and nervousness after speaking is lower than before.', how: ['Pre-speech ritual (breath + self-talk)', 'Climb the exposure ladder weekly', 'Camera mode'], target: 'Nervousness after < 3/10; ladder L10+' },
  'Prosody (shadowing)': { good: 'Stress, rhythm and melody sound natural: key words stressed, small words reduced.', how: ['Shadow 10 min/day', 'Echo & score'], target: 'Echo clarity 90%+' },
  'Structure': { good: 'Listeners always know your point: hook → point → reason → example → close.', how: ['PREP mode', 'Creator mode', 'Question chain'], target: '20+ structured speeches' },
};
