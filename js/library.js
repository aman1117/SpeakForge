// Content for the explanation, vocabulary, filler and calm tracks, plus the great-speaker playbook.

// Vague word → precise alternatives. Each option says when it fits, because precision means choosing, not decorating.
export const UPGRADES = {
  'very good': [['excellent', 'top quality'], ['solid', 'reliable, no complaints'], ['impressive', 'better than expected'], ['outstanding', 'the best of a group']],
  'very bad': [['terrible', 'strong, casual'], ['poorly done', 'quality was low'], ['harmful', 'it caused damage'], ['flawed', 'has a specific weakness']],
  good: [['useful', 'it helps'], ['effective', 'it works'], ['solid', 'dependable'], ['valuable', 'worth the cost or time'], ['well-made', 'quality of build']],
  bad: [['unreliable', 'breaks or fails'], ['slow', 'performance'], ['confusing', 'hard to understand'], ['risky', 'could go wrong'], ['poor', 'low quality']],
  big: [['major', 'importance'], ['significant', 'measurable effect'], ['huge', 'casual, size'], ['large-scale', 'scope'], ['serious', 'problems']],
  small: [['minor', 'not important'], ['slight', 'tiny change'], ['limited', 'scope'], ['compact', 'physical size']],
  thing: [['issue', 'a problem'], ['feature', 'part of a product'], ['factor', 'something that affects a result'], ['step', 'part of a process'], ['idea', 'a thought'], ['tool', 'something you use']],
  things: [['details', 'small parts'], ['tasks', 'work to do'], ['options', 'choices'], ['features', 'parts of a product'], ['reasons', 'why']],
  stuff: [['material', 'content'], ['work', 'tasks'], ['equipment', 'physical things'], ['details', 'information']],
  nice: [['pleasant', 'experience'], ['friendly', 'person'], ['thoughtful', 'kind and careful'], ['well-designed', 'product']],
  interesting: [['surprising', 'unexpected'], ['clever', 'smart idea'], ['promising', 'could be great later'], ['unusual', 'rare']],
  important: [['critical', 'must not fail'], ['essential', 'cannot skip'], ['key', 'central'], ['urgent', 'needs action now'], ['high-impact', 'big effect']],
  'a lot of': [['plenty of', 'more than enough'], ['a wide range of', 'variety'], ['dozens of', 'roughly countable'], ['most', 'majority']],
  get: [['receive', 'something arrives'], ['understand', 'an idea'], ['become', 'change state'], ['reach', 'a target'], ['fetch', 'data']],
  make: [['build', 'software, products'], ['create', 'something new'], ['cause', 'a result'], ['prepare', 'food, documents']],
  do: [['handle', 'a task'], ['run', 'a process'], ['complete', 'finish'], ['carry out', 'a plan']],
  show: [['demonstrate', 'prove by example'], ['reveal', 'make visible'], ['highlight', 'draw attention']],
  'very hard': [['challenging', 'needs effort'], ['complex', 'many parts'], ['demanding', 'takes energy']],
  'very easy': [['straightforward', 'no surprises'], ['simple', 'few steps'], ['effortless', 'no effort']],
  'very fast': [['rapid', 'speed'], ['instant', 'no delay'], ['efficient', 'little waste']],
  'very tired': [['exhausted', 'no energy left'], ['drained', 'mentally'], ['worn out', 'casual']],
  'very happy': [['thrilled', 'excited'], ['delighted', 'pleased'], ['relieved', 'worry gone']],
  'kind of': [['somewhat', 'a bit'], ['roughly', 'approximately'], ['partly', 'not fully']],
  basically: [['in short', 'summary'], ['the core idea is', 'explanation'], ['(silence)', 'just drop it']],
  problem: [['bottleneck', 'slows everything'], ['bug', 'software fault'], ['risk', 'might happen'], ['obstacle', 'blocks progress'], ['trade-off', 'gain one, lose another']],
  change: [['adjust', 'small'], ['transform', 'complete'], ['replace', 'swap'], ['improve', 'better']],
  think: [['believe', 'opinion'], ['suspect', 'not sure yet'], ['assume', 'without proof'], ['expect', 'future']],
  said: [['explained', 'gave reasons'], ['pointed out', 'noticed'], ['argued', 'defended a view'], ['suggested', 'proposed']],
};

// Definition → precise word. Mid-frequency words that upgrade everyday and work speech.
export const PRECISE_WORDS = [
  ['Slowing everything else down; the narrowest point', 'bottleneck'], ['To make a bad situation worse', 'worsen'], ['Open to more than one meaning', 'ambiguous'],
  ['Done ahead of time to prevent a problem', 'proactive'], ['To put something off until later', 'postpone'], ['Able to work well in many situations', 'versatile'],
  ['Giving up one benefit to gain another', 'trade-off'], ['To say something is true without proof', 'claim'], ['Easy to see through; honest and open', 'transparent'],
  ['A first rough version to test an idea', 'prototype'], ['To check carefully that something is correct', 'verify'], ['Very careful about every detail', 'meticulous'],
  ['Happening again and again', 'recurring'], ['Able to grow to handle more users or work', 'scalable'], ['To make something simpler and quicker', 'streamline'],
  ['A guess you treat as true for now', 'assumption'], ['Clear and short; no extra words', 'concise'], ['To explain something by giving more detail', 'elaborate'],
  ['To decide what matters most first', 'prioritise'], ['The most important part', 'core'], ['Strongly convincing', 'compelling'],
  ['Unwilling to do something', 'reluctant'], ['Not done carefully; quick and careless', 'sloppy'], ['To agree after each side gives something up', 'compromise'],
  ['A sudden, great new idea or discovery', 'breakthrough'], ['Too much to handle', 'overwhelming'], ['Lasting only for a short time', 'temporary'],
  ['Can be depended on', 'reliable'], ['Not possible to avoid', 'inevitable'], ['To make sure every part is included', 'comprehensive'],
  ['Making sense; well connected', 'coherent'], ['To ask yourself if something is really true', 'question'], ['Changing often and unpredictably', 'volatile'],
  ['A problem that keeps the team from moving forward', 'blocker'], ['To give someone else a task', 'delegate'], ['Having a lot of experience and skill', 'seasoned'],
  ['To come up with ideas as a group', 'brainstorm'], ['Something you must have; cannot be skipped', 'essential'], ['To reach an agreement by discussion', 'negotiate'],
  ['To look at closely to understand', 'analyse'], ['An unexpected side effect', 'consequence'], ['Saying little; quiet and private', 'reserved'],
  ['Very happy and excited', 'thrilled'], ['Feeling of being let down', 'disappointed'], ['Tired in your mind after too much work', 'burnt out'],
  ['Feeling calm because a worry is gone', 'relieved'], ['To admit something is true', 'acknowledge'], ['To make a short version of the main points', 'summarise'],
  ['To show something is true with evidence', 'demonstrate'], ['Without any planning', 'spontaneous'], ['Large in amount or importance', 'substantial'],
  ['Small and not important', 'negligible'], ['Quick to recover after problems', 'resilient'], ['To slowly lose strength or quality', 'deteriorate'],
  ['Working together toward the same goal', 'collaborate'], ['Gives a lot of value for the effort', 'efficient'], ['Too complicated', 'convoluted'],
  ['Short and memorable phrase that captures an idea', 'catchphrase'], ['A rule of thumb or mental shortcut', 'heuristic'], ['A strong feeling that something is true', 'intuition'],
  ['Done every year', 'annual'], ['To bring a product to users', 'launch'], ['Things that slowly build up and need fixing later (software)', 'technical debt'],
  ['A general agreement among a group', 'consensus'], ['Directly to the point; honest', 'straightforward'], ['To make something stronger', 'reinforce'],
  ['Hard to believe', 'far-fetched'], ['Unclear and not specific', 'vague'], ['A small mistake caused by not paying attention', 'oversight'],
];

// Vague sentences to rephrase precisely ("Say it better"). keys = words the better version should avoid.
export const SAY_BETTER = [
  { vague: 'The meeting was very bad.', avoid: ['very', 'bad'], hint: 'What exactly was wrong with it?', ideas: ['unproductive', 'went off track', 'ran over time', 'no decision was made'] },
  { vague: 'The app is very good.', avoid: ['very', 'good'], hint: 'Good in what way: fast, reliable, easy?', ideas: ['responsive', 'reliable', 'intuitive', 'well-designed'] },
  { vague: 'There are a lot of things to do.', avoid: ['lot', 'things'], hint: 'How many, and what kind?', ideas: ['a long backlog', 'twelve open tasks', 'several urgent fixes'] },
  { vague: 'This thing is kind of slow.', avoid: ['thing', 'kind'], hint: 'Name the thing and the size of the problem.', ideas: ['the checkout page', 'takes four seconds to load', 'noticeably sluggish'] },
  { vague: 'He is a very nice person.', avoid: ['very', 'nice'], hint: 'Which quality makes him nice?', ideas: ['generous', 'patient', 'supportive', 'easy to work with'] },
  { vague: 'The movie was interesting.', avoid: ['interesting'], hint: 'Why did it hold your attention?', ideas: ['gripping', 'thought-provoking', 'unpredictable'] },
  { vague: 'It is a big problem for us.', avoid: ['big', 'problem'], hint: 'What kind of problem, and how serious?', ideas: ['a major risk', 'a bottleneck', 'costs us customers'] },
  { vague: 'I got the stuff from the server.', avoid: ['got', 'stuff'], hint: 'What did you do, with what data?', ideas: ['fetched', 'downloaded the logs', 'pulled the user records'] },
  { vague: 'The new update made things better.', avoid: ['made', 'things', 'better'], hint: 'What improved, by how much?', ideas: ['cut load time in half', 'reduced crashes', 'simplified sign-up'] },
  { vague: 'The food was really good.', avoid: ['really', 'good'], hint: 'Taste, texture, freshness?', ideas: ['delicious', 'perfectly spiced', 'fresh', 'rich'] },
  { vague: 'I was very tired after work.', avoid: ['very', 'tired'], hint: 'How tired, and why?', ideas: ['exhausted', 'drained', 'completely worn out'] },
  { vague: 'The talk was important for my career.', avoid: ['important'], hint: 'What did it change?', ideas: ['a turning point', 'opened doors', 'shaped how I work'] },
  { vague: 'It is a good idea, basically.', avoid: ['good', 'basically'], hint: 'Why is it good?', ideas: ['practical', 'low-risk', 'cheap to try', 'promising'] },
  { vague: 'The weather was bad so we did nothing.', avoid: ['bad', 'did', 'nothing'], hint: 'Describe the weather and what happened.', ideas: ['pouring rain', 'stayed in', 'cancelled the trip'] },
  { vague: 'Our team did a lot of work this sprint.', avoid: ['did', 'lot'], hint: 'What did you ship?', ideas: ['shipped three features', 'fixed twenty bugs', 'delivered the migration'] },
  { vague: 'The book was very long and kind of boring.', avoid: ['very', 'kind', 'boring'], hint: 'Why did it drag?', ideas: ['repetitive', 'slow-paced', 'padded'] },
  { vague: 'She said the plan is bad.', avoid: ['said', 'bad'], hint: 'How did she say it, and what was the issue?', ideas: ['argued', 'pointed out', 'too risky', 'unrealistic'] },
  { vague: 'I think it is a nice place to live.', avoid: ['nice'], hint: 'What makes it good to live in?', ideas: ['safe', 'affordable', 'peaceful', 'well-connected'] },
  { vague: 'We need to change some things in the code.', avoid: ['change', 'things'], hint: 'What kind of change, to what?', ideas: ['refactor the payment module', 'remove dead code', 'rename confusing functions'] },
  { vague: 'The customer was really angry about the stuff.', avoid: ['really', 'stuff'], hint: 'How angry, about what?', ideas: ['furious', 'frustrated', 'the late delivery', 'the double charge'] },
  { vague: 'That presentation was very big and had a lot of slides.', avoid: ['very', 'big', 'lot'], hint: 'What was the real issue?', ideas: ['overloaded', 'eighty slides', 'too dense'] },
  { vague: 'This laptop is good for doing stuff.', avoid: ['good', 'stuff'], hint: 'Good for which tasks?', ideas: ['ideal for video editing', 'powerful', 'portable'] },
  { vague: 'The interview went kind of okay.', avoid: ['kind', 'okay'], hint: 'What went well, what did not?', ideas: ['went smoothly', 'mixed', 'strong start, weak finish'] },
  { vague: 'He made a very big mistake.', avoid: ['made', 'very', 'big'], hint: 'How serious, and what kind?', ideas: ['a costly mistake', 'a critical error', 'a serious misjudgement'] },
];

// Planning skeletons. Pre-task planning improves fluency and complexity (Foster & Skehan 1996; Ellis 2009).
export const FRAMES = {
  answer: { name: 'Answer first (Pyramid Principle)', who: 'Barbara Minto; the military calls it BLUF, bottom line up front', parts: ['Answer in one sentence', 'Reason 1', 'Reason 2', 'Example', 'Answer again'] },
  feynman: { name: 'Explain to a 12-year-old', who: 'Richard Feynman', parts: ['What it is, in plain words', 'It\u2019s like\u2026 (analogy)', 'Concrete example', 'Why it matters'] },
  story: { name: 'Story (Situation, Problem, Turn, Lesson)', who: 'Pixar story spine; STAR interview method', parts: ['Situation', 'Problem', 'What I did (the turn)', 'Result and lesson'] },
  process: { name: 'Walk-through', who: 'Signposting (Patrick Winston\u2019s verbal punctuation)', parts: ['Goal', 'First\u2026', 'Then\u2026', 'Finally\u2026', 'Watch out for\u2026'] },
  compare: { name: 'Compare', who: 'Near miss: say what it is NOT (Patrick Winston)', parts: ['Both in one line', 'The key difference', 'When to choose A', 'When to choose B'] },
};

export const EXPLAIN_PROMPTS = {
  answer: [
    'Should our team adopt TypeScript?', 'Why was the last release delayed?', 'What did you work on this week?', 'Should we build this feature or buy a tool?',
    'Why should we hire you?', 'Is remote work better for your team?', 'Should startups use microservices?', 'What is the biggest risk in your current project?',
    'Why do you want to change jobs?', 'Should junior developers use AI coding tools?', 'Which phone should I buy and why?', 'Is a master\u2019s degree worth it?',
    'Why do most New Year resolutions fail?', 'Should we rewrite this old service?', 'What would you improve in our onboarding?', 'Why did you choose computer science?',
  ],
  feynman: [
    'What is an API?', 'How does a database index work?', 'What is inflation?', 'How does GPS know where you are?', 'What is machine learning?',
    'How do vaccines work?', 'What is a race condition?', 'How does HTTPS keep your data safe?', 'What is recursion?', 'How does compound interest work?',
    'What is Docker?', 'What is the difference between latency and bandwidth?', 'How does a credit card payment work?', 'What is a large language model?',
    'Why is the sky blue?', 'What is caching?', 'How does a search engine rank pages?', 'What is version control?', 'What does a load balancer do?', 'What is a blockchain?',
  ],
  story: [
    'A time you fixed a hard bug', 'A time you disagreed with your manager', 'The hardest decision you made this year', 'A time you failed and what you learned',
    'A trip that went wrong', 'The day you started your first job', 'A time you helped someone', 'A moment you felt proud of your work',
    'A time you had to learn something fast', 'A misunderstanding at work and how you solved it',
  ],
  process: [
    'How you deploy code to production', 'How to make a perfect cup of tea', 'How to prepare for a job interview', 'How you review a pull request',
    'How to set up a new laptop for development', 'How to plan a trip on a budget', 'How you debug a production incident', 'How to learn a new programming language',
  ],
  compare: [
    'SQL vs NoSQL databases', 'iPhone vs Android', 'Working at a startup vs a big company', 'Renting vs buying a house', 'Python vs JavaScript for a beginner',
    'Books vs videos for learning', 'Monolith vs microservices', 'Tea vs coffee', 'Freelancing vs a full-time job', 'Unit tests vs end-to-end tests',
  ],
};

// Fillers usually appear at the start of a sentence or a new idea. These prompts force many fresh starts.
export const FRESH_STARTS = [
  'What did you eat yesterday?', 'Describe your workspace.', 'What is your favourite app and why?', 'What would you change about your city?',
  'Tell me about your last weekend.', 'What is one skill you want to learn?', 'Describe your best friend.', 'What makes a good team?',
  'What do you do in your job?', 'What is overrated in tech?', 'What is your morning routine?', 'Describe a movie you liked.',
  'What advice would you give your younger self?', 'What is the best gift you have received?', 'What is a habit you are building?', 'Describe your hometown.',
];

// Feared outcomes for inhibitory-learning exposure: name the prediction, then test it (Craske et al. 2014).
export const FEARS = [
  'My mind will go blank', 'I will forget a word and restart', 'My voice will shake', 'I will say "um" constantly',
  'People will think my English is bad', 'I will lose my train of thought', 'People will look bored', 'I will speak too fast',
];

// Thought groups: "/" = pause, CAPS = stressed word. Pausing at phrase boundaries makes speech easier to follow
// (prosody-focused practice improved comprehensibility more than sound drills: Derwing, Munro & Wiebe 1998).
export const THOUGHT_GROUPS = [
  { title: 'Explaining an API', text: 'An API / is basically a MENU for software. / You don\u2019t need to know how the KITCHEN works. / You pick what you WANT, / send your ORDER, / and get the RESULT back.' },
  { title: 'A status update', text: 'Quick UPDATE on the migration. / We\u2019re about EIGHTY percent done. / The last PIECE / is the payments service, / and that\u2019s RISKY, / so we\u2019re testing it on FRIDAY.' },
  { title: 'An opinion', text: 'I think most people get this WRONG. / The problem isn\u2019t the TOOL. / The problem is how we USE it. / And once you SEE that, / everything gets EASIER.' },
  { title: 'A short story', text: 'Three years AGO, / I was TERRIFIED of meetings. / My heart would RACE, / my mind would go BLANK, / and I\u2019d stay QUIET. / Today, / I\u2019m leading ONE.' },
  { title: 'Introducing yourself', text: 'Hi, I\u2019m AMAN. / I\u2019m a SOFTWARE engineer, / and I build tools that help people PROTECT their data. / Outside work, / I\u2019m learning to SPEAK on camera.' },
  { title: 'Lincoln, Gettysburg (1863)', text: 'Four score and seven years AGO / our fathers brought forth on this CONTINENT, / a NEW nation, / conceived in LIBERTY, / and dedicated to the proposition / that all men are created EQUAL.' },
  { title: 'Roosevelt, first inaugural (1933)', text: 'So, first of ALL, / let me assert my firm BELIEF / that the only thing we have to FEAR / is fear ITSELF.' },
  { title: 'Kennedy, inaugural (1961)', text: 'And so, my fellow AMERICANS: / ask NOT / what your country can do for YOU / \u2014 ask what YOU can do / for your COUNTRY.' },
];

// Public-domain speeches (US government / 19th century) for shadowing slow, deliberate delivery.
export const CLASSIC_SPEECHES = [
  { title: 'Lincoln: Gettysburg Address (1863)', text: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.' },
  { title: 'Roosevelt: First inaugural (1933)', text: 'So, first of all, let me assert my firm belief that the only thing we have to fear is fear itself, nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance.' },
  { title: 'Kennedy: Inaugural address (1961)', text: 'And so, my fellow Americans: ask not what your country can do for you, ask what you can do for your country. My fellow citizens of the world: ask not what America will do for you, but what together we can do for the freedom of man.' },
];

// What great speakers and explainers actually did, each linked to the drill that trains it.
export const PLAYBOOK = [
  { who: 'Demosthenes', era: 'Athens, 4th c. BC', did: 'Born with weak, unclear speech. Plutarch records that he practised with pebbles in his mouth, spoke over the roar of the sea, and recited while walking uphill to build breath.', lesson: 'Articulation and projection are trained like muscles.', drill: ['#/mouth?t=pen', 'Pebble drill'] },
  { who: 'Abraham Lincoln', era: '1863', did: 'The Gettysburg Address is 272 words and about two minutes long. The previous speaker talked for two hours. Nobody remembers that speech.', lesson: 'Short beats long. Say less, mean more.', drill: ['#/explain?f=answer&one=1', 'One-sentence answer'] },
  { who: 'Winston Churchill', era: '1940s', did: 'Typed his speech notes in short broken lines, like a poem, so every line was one thought and one breath. He rehearsed relentlessly and favoured short, old words.', lesson: 'Speak in thought groups and pause between them.', drill: ['#/mouth?t=groups', 'Thought groups'] },
  { who: 'Martin Luther King Jr.', era: '1963', did: 'Built speeches on repetition (anaphora) and rhythm, so listeners could follow and remember the structure without notes.', lesson: 'Repeat the key line. Repetition is structure you can hear.', drill: ['#/explain?f=answer', 'Answer first'] },
  { who: 'Richard Feynman', era: 'Physicist, teacher', did: 'Rebuilt ideas from scratch in everyday words and examples. If he couldn\u2019t explain it at a beginner level, he took that as a sign he didn\u2019t understand it yet.', lesson: 'Plain words + one concrete example beats jargon.', drill: ['#/explain?f=feynman', 'Explain to a 12-year-old'] },
  { who: 'Patrick Winston', era: 'MIT, "How to Speak"', did: 'Taught: open with an empowerment promise (what they\u2019ll gain), cycle back to the main idea three times, use verbal punctuation ("first", "now the key point"), and show a near miss (what it is NOT).', lesson: 'Signpost, repeat the core idea, contrast with what it is not.', drill: ['#/explain?f=compare', 'Compare (near miss)'] },
  { who: 'Barbara Minto', era: 'McKinsey, The Pyramid Principle', did: 'Start with the answer, then group the supporting reasons under it. The military version is BLUF: bottom line up front.', lesson: 'Answer first. Then why. Then an example.', drill: ['#/explain?f=answer', 'Answer first'] },
  { who: 'Chip and Dan Heath', era: 'Made to Stick', did: 'The curse of knowledge: once you know something, you can\u2019t imagine not knowing it, so you skip steps. Fix it with the core message, concrete examples and checking what the listener heard.', lesson: 'Test your explanation on a confused listener.', drill: ['#/explain?f=feynman&listener=1', 'Confused listener'] },
  { who: 'Toastmasters', era: 'since 1924', did: 'The Ah-Counter role counts every "um" and "uh" out loud at the end of the meeting. Table Topics trains answering a surprise question for 1-2 minutes.', lesson: 'Awareness kills fillers. Impromptu answers are a trainable skill.', drill: ['#/fillers', 'Filler lab'] },
  { who: 'Steve Jobs', era: 'Keynotes', did: 'Gave every launch a one-line headline, grouped ideas in threes, and rehearsed for days until the delivery felt effortless.', lesson: 'Headline first, rule of three, rehearse.', drill: ['#/explain?f=answer&one=1', 'One-sentence headline'] },
  { who: 'Theo Browne', era: 't3.gg', did: 'We measured him: 42% of sentences are 10 words or fewer, only 3% of pauses fall mid-phrase, and he almost never restarts. He patches forward.', lesson: 'Short sentences, pause at boundaries, never rewind.', drill: ['#/theo', 'Learn from Theo'] },
  { who: 'Mona (@babystepstothemic)', era: 'Instagram', did: 'Went from blacking out in a 7-minute speech to stand-up comedy in a year: 1-minute random topics daily, 100 days of shadowing, pen-in-mouth reading, 10-word sentences, Toastmasters every week.', lesson: 'Daily small reps, recorded and reviewed.', drill: ['#/speak?mode=oneMin', '1-minute topic'] },
];
