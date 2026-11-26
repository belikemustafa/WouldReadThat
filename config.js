/* ==========================================================================
   WOULD READ THAT — Configuration, Curated Literary Pools & Filter Presets
   Powered by Open Library (No API Key Required) + Optional Gemini Grounding
   ========================================================================== */

window.WRT_CONFIG = {
  OPEN_LIBRARY_BASE: 'https://openlibrary.org',
  COVERS_BASE: 'https://covers.openlibrary.org/b/id/',
  GEMINI_MODEL: 'gemini-2.5-flash',
  CACHE_TTL_MS: 1000 * 60 * 60 * 12,

  STORAGE_KEYS: {
    GEMINI_KEY: 'wrt_override_gemini_key',
    THEME: 'wrt_theme',
    ACCENT: 'wrt_accent',
    USERS: 'wrt_users_v1',
    ACTIVE_USER: 'wrt_active_user_v1',
    SHELF_PREFIX: 'wrt_shelf_',
    CACHE_PREFIX: 'wrt_cache_v1_'
  },

  // 3 Refined Dark Surfaces
  THEMES: [
    { id: 'abyssal-carbon', name: 'Abyssal Carbon', swatch: '#0a0c0f' },
    { id: 'midnight-slate', name: 'Midnight Slate', swatch: '#0f1826' },
    { id: 'pure-obsidian', name: 'Pure Obsidian', swatch: '#000000' }
  ],

  // 5 Focused Formal Accents
  ACCENTS: [
    { id: 'royal-gold', name: 'Royal Gold', swatch: '#c9a23f' },
    { id: 'silver-nitrate', name: 'Silver Nitrate', swatch: '#bfc7d1' },
    { id: 'deep-teal', name: 'Deep Teal', swatch: '#1e8f8a' },
    { id: 'oxblood-noir', name: 'Oxblood Noir', swatch: '#8f2d3e' },
    { id: 'midnight-pine', name: 'Midnight Pine', swatch: '#246b56' }
  ],

  FORMATS: {
    fiction: { label: 'Fiction', subject: 'fiction' },
    nonfiction: { label: 'Non-Fiction', subject: 'nonfiction' },
    classics: { label: 'Classics', subject: 'classics' },
    poetry: { label: 'Poetry & Essays', subject: 'poetry' },
    graphic: { label: 'Graphic Novels', subject: 'graphic novels' }
  },

  GENRES: [
    { id: 'literary fiction', name: 'Literary Fiction' },
    { id: 'science fiction', name: 'Sci-Fi' },
    { id: 'fantasy', name: 'Fantasy' },
    { id: 'mystery', name: 'Mystery' },
    { id: 'thriller', name: 'Thriller' },
    { id: 'historical fiction', name: 'Historical Fiction' },
    { id: 'philosophy', name: 'Philosophy' },
    { id: 'biography', name: 'Biography & Memoir' },
    { id: 'history', name: 'History' },
    { id: 'psychology', name: 'Psychology' },
    { id: 'horror', name: 'Horror & Gothic' },
    { id: 'romance', name: 'Romance' },
    { id: 'crime', name: 'Crime & Noir' },
    { id: 'dystopia', name: 'Dystopian' },
    { id: 'science', name: 'Popular Science' }
  ],

  // ISO 639-2 3-letter codes used by Open Library
  LANGUAGES: [
    { code: '', name: 'All Languages' },
    { code: 'eng', name: 'English' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'fre', name: 'French' },
    { code: 'spa', name: 'Spanish' },
    { code: 'ger', name: 'German' },
    { code: 'rus', name: 'Russian' },
    { code: 'ita', name: 'Italian' },
    { code: 'kor', name: 'Korean' },
    { code: 'hin', name: 'Hindi' },
    { code: 'ara', name: 'Arabic' },
    { code: 'por', name: 'Portuguese' },
    { code: 'chi', name: 'Chinese' }
  ],

  // Tap-to-select & tap-again-to-deselect Essential Authors
  AUTHOR_PRESETS: [
    { id: 'Haruki Murakami', name: 'Haruki Murakami' },
    { id: 'Fyodor Dostoevsky', name: 'Fyodor Dostoevsky' },
    { id: 'Ursula K. Le Guin', name: 'Ursula K. Le Guin' },
    { id: 'Kazuo Ishiguro', name: 'Kazuo Ishiguro' },
    { id: 'Gabriel Garcia Marquez', name: 'Gabriel García Márquez' },
    { id: 'Toni Morrison', name: 'Toni Morrison' },
    { id: 'Jorge Luis Borges', name: 'Jorge Luis Borges' },
    { id: 'Donna Tartt', name: 'Donna Tartt' },
    { id: 'Cormac McCarthy', name: 'Cormac McCarthy' },
    { id: 'Albert Camus', name: 'Albert Camus' },
    { id: 'Frank Herbert', name: 'Frank Herbert' },
    { id: 'Octavia E. Butler', name: 'Octavia E. Butler' }
  ],

  THEMES_MOODS: [
    { id: 'philosophical', name: 'Philosophical', query: 'philosophy' },
    { id: 'atmospheric', name: 'Atmospheric', query: 'gothic' },
    { id: 'existential', name: 'Existential', query: 'existentialism' },
    { id: 'coming of age', name: 'Coming of Age', query: 'coming of age' },
    { id: 'magical realism', name: 'Magical Realism', query: 'magic realism' },
    { id: 'cyberpunk', name: 'Cyberpunk', query: 'cyberpunk' },
    { id: 'political', name: 'Political Intrigue', query: 'politics' },
    { id: 'war', name: 'War & Memory', query: 'war' },
    { id: 'mythology', name: 'Mythology', query: 'mythology' },
    { id: 'time travel', name: 'Time & Memory', query: 'time travel' },
    { id: 'nature', name: 'Nature & Solitude', query: 'nature' },
    { id: 'satire', name: 'Satire & Wit', query: 'satire' }
  ],

  PUBLISHER_PRESETS: [
    { id: 'Penguin', name: 'Penguin Classics' },
    { id: 'Vintage', name: 'Vintage' },
    { id: 'Knopf', name: 'Alfred A. Knopf' },
    { id: 'Faber', name: 'Faber & Faber' },
    { id: 'New Directions', name: 'New Directions' },
    { id: 'NYRB', name: 'NYRB Classics' },
    { id: 'Fitzcarraldo', name: 'Fitzcarraldo' },
    { id: 'Tor', name: 'Tor Books' }
  ],

  ERAS: [
    { id: 'all', label: 'All Eras', from: '', to: '' },
    { id: 'pre1900', label: 'Classic (<1900)', from: 1500, to: 1899 },
    { id: 'early20', label: '1900–1949', from: 1900, to: 1949 },
    { id: 'mid20', label: '1950–1979', from: 1950, to: 1979 },
    { id: 'late20', label: '1980–1999', from: 1980, to: 1999 },
    { id: '2000s', label: '2000s', from: 2000, to: 2009 },
    { id: '2010s', label: '2010s', from: 2010, to: 2019 },
    { id: '2020s', label: '2020s', from: 2020, to: 2026 }
  ],

  AWARDS_PRESETS: [
    { id: 'all', label: 'All Books' },
    { id: 'booker', label: 'Booker Prize' },
    { id: 'pulitzer', label: 'Pulitzer Fiction' },
    { id: 'nobel', label: 'Nobel Laureates' },
    { id: 'hugo', label: 'Hugo & Nebula' }
  ],

  AVAILABILITY_OPTIONS: [
    { id: 'public', label: 'Free Public Domain' },
    { id: 'borrowable', label: 'Borrowable eBook' },
    { id: 'fulltext', label: 'Searchable Full Text' }
  ],

  // Curated Literary Spotlight & Prize Pools (resolved dynamically via Open Library)
  HERO_CURATED: [
    {
      title: 'Dune',
      author: 'Frank Herbert',
      award: 'Hugo Award · Nebula Award',
      blurb: 'Set on the desert planet Arrakis, Paul Atreides navigates feudal treachery, ecology, and prophetic destiny in science fiction’s towering epic.'
    },
    {
      title: 'The Remains of the Day',
      author: 'Kazuo Ishiguro',
      award: 'Booker Prize · Nobel Laureate',
      blurb: 'On a motoring trip through postwar England, butler Stevens confronts a lifetime of devotion, restraint, and unspoken regret.'
    },
    {
      title: 'One Hundred Years of Solitude',
      author: 'Gabriel Garcia Marquez',
      award: 'Nobel Prize in Literature',
      blurb: 'Seven generations of the Buendía family rise and vanish in the mythic Colombian town of Macondo in the landmark of magical realism.'
    },
    {
      title: 'The Secret History',
      author: 'Donna Tartt',
      award: 'Modern Dark Academia Classic',
      blurb: 'At an elite New England college, a cloistered circle of Classics scholars crosses from aesthetic obsession into irreversible moral ruin.'
    },
    {
      title: 'The Left Hand of Darkness',
      author: 'Ursula K. Le Guin',
      award: 'Hugo Award · Nebula Award',
      blurb: 'An envoy journeys across the frozen world of Gethen, challenging every assumption of identity, loyalty, and human connection.'
    },
    {
      title: 'Crime and Punishment',
      author: 'Fyodor Dostoevsky',
      award: 'Essential World Classic',
      blurb: 'Through the fevered streets of St. Petersburg, Raskolnikov tests an extraordinary-man theory against the inescapable gravity of conscience.'
    }
  ],

  PRESTIGE_POOLS: {
    booker: [
      { title: 'The Remains of the Day', author: 'Kazuo Ishiguro', award: 'Booker Prize Winner' },
      { title: 'Wolf Hall', author: 'Hilary Mantel', award: 'Booker Prize Winner' },
      { title: 'Midnight’s Children', author: 'Salman Rushdie', award: 'Booker of Bookers' },
      { title: 'The God of Small Things', author: 'Arundhati Roy', award: 'Booker Prize Winner' },
      { title: 'The Sense of an Ending', author: 'Julian Barnes', award: 'Booker Prize Winner' },
      { title: 'Life of Pi', author: 'Yann Martel', award: 'Booker Prize Winner' },
      { title: 'Disgrace', author: 'J. M. Coetzee', award: 'Booker Prize · Nobel Laureate' },
      { title: 'Shuggie Bain', author: 'Douglas Stuart', award: 'Booker Prize Winner' },
      { title: 'The White Tiger', author: 'Aravind Adiga', award: 'Booker Prize Winner' },
      { title: 'Lincoln in the Bardo', author: 'George Saunders', award: 'Booker Prize Winner' }
    ],
    pulitzer: [
      { title: 'Beloved', author: 'Toni Morrison', award: 'Pulitzer Prize · Nobel Laureate' },
      { title: 'The Road', author: 'Cormac McCarthy', award: 'Pulitzer Prize for Fiction' },
      { title: 'The Goldfinch', author: 'Donna Tartt', award: 'Pulitzer Prize for Fiction' },
      { title: 'All the Light We Cannot See', author: 'Anthony Doerr', award: 'Pulitzer Prize for Fiction' },
      { title: 'To Kill a Mockingbird', author: 'Harper Lee', award: 'Pulitzer Prize for Fiction' },
      { title: 'The Overstory', author: 'Richard Powers', award: 'Pulitzer Prize for Fiction' },
      { title: 'Middlesex', author: 'Jeffrey Eugenides', award: 'Pulitzer Prize for Fiction' },
      { title: 'The Grapes of Wrath', author: 'John Steinbeck', award: 'Pulitzer Prize · Nobel Laureate' },
      { title: 'The Underground Railroad', author: 'Colson Whitehead', award: 'Pulitzer Prize for Fiction' },
      { title: 'Lonesome Dove', author: 'Larry McMurtry', award: 'Pulitzer Prize for Fiction' }
    ],
    nobel: [
      { title: 'One Hundred Years of Solitude', author: 'Gabriel Garcia Marquez', award: 'Nobel Prize in Literature' },
      { title: 'The Stranger', author: 'Albert Camus', award: 'Nobel Prize in Literature' },
      { title: 'Never Let Me Go', author: 'Kazuo Ishiguro', award: 'Nobel Prize in Literature' },
      { title: 'Beloved', author: 'Toni Morrison', award: 'Nobel Prize in Literature' },
      { title: 'Siddhartha', author: 'Hermann Hesse', award: 'Nobel Prize in Literature' },
      { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', award: 'Nobel Prize · Pulitzer' },
      { title: 'Drive Your Plow Over the Bones of the Dead', author: 'Olga Tokarczuk', award: 'Nobel Prize in Literature' },
      { title: 'The Vegetarian', author: 'Han Kang', award: 'Nobel Prize · International Booker' },
      { title: 'Blindness', author: 'Jose Saramago', award: 'Nobel Prize in Literature' },
      { title: 'My Name Is Red', author: 'Orhan Pamuk', award: 'Nobel Prize in Literature' }
    ],
    hugo: [
      { title: 'Dune', author: 'Frank Herbert', award: 'Hugo Award · Nebula Award' },
      { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', award: 'Hugo Award · Nebula Award' },
      { title: 'Neuromancer', author: 'William Gibson', award: 'Hugo · Nebula · Philip K. Dick' },
      { title: 'Hyperion', author: 'Dan Simmons', award: 'Hugo Award Winner' },
      { title: 'The Fifth Season', author: 'N. K. Jemisin', award: 'Hugo Award Winner' },
      { title: 'The Three-Body Problem', author: 'Cixin Liu', award: 'Hugo Award Winner' },
      { title: 'Foundation', author: 'Isaac Asimov', award: 'Hugo Award · Best All-Time Series' },
      { title: 'Ender’s Game', author: 'Orson Scott Card', award: 'Hugo Award · Nebula Award' },
      { title: 'Ancillary Justice', author: 'Ann Leckie', award: 'Hugo Award · Nebula Award' },
      { title: 'The Dispossessed', author: 'Ursula K. Le Guin', award: 'Hugo Award · Nebula Award' }
    ]
  },

  // Known prize map by lowercase title fragment for automatic laurel badges
  KNOWN_AWARDS: {
    'dune': 'Hugo Award · Nebula Award',
    'the remains of the day': 'Booker Prize · Nobel Laureate',
    'one hundred years of solitude': 'Nobel Prize in Literature',
    'beloved': 'Pulitzer Prize · Nobel Laureate',
    'the road': 'Pulitzer Prize for Fiction',
    'the left hand of darkness': 'Hugo Award · Nebula Award',
    'to kill a mockingbird': 'Pulitzer Prize for Fiction',
    'wolf hall': 'Booker Prize Winner',
    'the goldfinch': 'Pulitzer Prize for Fiction',
    'the stranger': 'Nobel Prize in Literature',
    'never let me go': 'Nobel Laureate · Booker Shortlist',
    'neuromancer': 'Hugo · Nebula · Philip K. Dick',
    'the three-body problem': 'Hugo Award Winner',
    'the fifth season': 'Hugo Award Winner',
    'all the light we cannot see': 'Pulitzer Prize for Fiction',
    'the god of small things': 'Booker Prize Winner',
    'the vegetarian': 'Nobel Prize · International Booker',
    'midnight\'s children': 'Booker of Bookers',
    'the grapes of wrath': 'Pulitzer Prize · Nobel Laureate',
    'the old man and the sea': 'Pulitzer Prize · Nobel Laureate',
    'hyperion': 'Hugo Award Winner',
    'foundation': 'Hugo Award · Best All-Time Series',
    'the dispossessed': 'Hugo Award · Nebula Award',
    'shuggie bain': 'Booker Prize Winner',
    'pachinko': 'National Book Award Finalist',
    'piranesi': 'Women’s Prize for Fiction'
  },

  COLLECTIONS: [
    {
      id: 'prestige',
      eyebrow: 'GOLD STANDARD',
      title: 'Prize-Winning Literature',
      type: 'curated',
      poolKey: 'booker'
    },
    {
      id: 'literary_fiction',
      eyebrow: 'ESSENTIAL READING',
      title: 'Acclaimed Modern & Classic Fiction',
      type: 'search',
      params: {
        q: 'subject:"literary fiction" language:eng',
        sort: 'readinglog',
        limit: 14
      }
    },
    {
      id: 'speculative',
      eyebrow: 'WORLDS BEYOND',
      title: 'Hugo & Nebula Sci-Fi Masterworks',
      type: 'curated',
      poolKey: 'hugo'
    },
    {
      id: 'philosophy_nonfiction',
      eyebrow: 'IDEAS & INQUIRY',
      title: 'Philosophy, History & Non-Fiction',
      type: 'search',
      params: {
        q: '(subject:philosophy OR subject:history) language:eng',
        sort: 'readinglog',
        limit: 14
      }
    },
    {
      id: 'world_lit',
      eyebrow: 'NOBEL & INTERNATIONAL',
      title: 'Masterpieces of World Literature',
      type: 'curated',
      poolKey: 'nobel'
    }
  ]
};
