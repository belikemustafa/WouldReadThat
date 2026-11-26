/* ==========================================================================
   WOULD READ THAT — Configuration, Curated Literary Queries & Filter Presets
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
    CACHE_PREFIX: 'wrt_cache_v2_'
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
    fiction: { label: 'Fiction', query: 'subject:fiction' },
    nonfiction: {
      label: 'Non-Fiction',
      query: '(subject:history OR subject:biography OR subject:philosophy OR subject:science OR subject:psychology)'
    },
    classics: { label: 'Classics', query: 'subject:classics' },
    poetry: { label: 'Poetry & Essays', query: '(subject:poetry OR subject:essays)' },
    graphic: { label: 'Graphic Novels', query: '(subject:"graphic novels" OR subject:comics)' }
  },

  GENRES: [
    { id: 'literary fiction', name: 'Literary Fiction', query: 'subject:"literary fiction"' },
    { id: 'science fiction', name: 'Sci-Fi', query: 'subject:"science fiction"' },
    { id: 'fantasy', name: 'Fantasy', query: 'subject:fantasy' },
    { id: 'mystery', name: 'Mystery', query: 'subject:mystery' },
    { id: 'thriller', name: 'Thriller', query: 'subject:thriller' },
    { id: 'historical fiction', name: 'Historical Fiction', query: 'subject:"historical fiction"' },
    { id: 'philosophy', name: 'Philosophy', query: 'subject:philosophy' },
    { id: 'biography', name: 'Biography & Memoir', query: '(subject:biography OR subject:memoir)' },
    { id: 'history', name: 'History', query: 'subject:history' },
    { id: 'psychology', name: 'Psychology', query: 'subject:psychology' },
    { id: 'horror', name: 'Horror & Gothic', query: '(subject:horror OR subject:gothic)' },
    { id: 'romance', name: 'Romance', query: 'subject:romance' },
    { id: 'crime', name: 'Crime & Noir', query: '(subject:crime OR subject:"detective and mystery stories")' },
    { id: 'dystopia', name: 'Dystopian', query: 'subject:dystopia' },
    { id: 'science', name: 'Popular Science', query: 'subject:science' }
  ],

  // ISO 639-2 codes for Open Library `language:` filter + ISO 639-1 for `lang=` display preference
  LANGUAGES: [
    { code: '', iso1: 'en', name: 'All Languages' },
    { code: 'eng', iso1: 'en', name: 'English' },
    { code: 'jpn', iso1: 'ja', name: 'Japanese' },
    { code: 'fre', iso1: 'fr', name: 'French' },
    { code: 'spa', iso1: 'es', name: 'Spanish' },
    { code: 'ger', iso1: 'de', name: 'German' },
    { code: 'rus', iso1: 'ru', name: 'Russian' },
    { code: 'ita', iso1: 'it', name: 'Italian' },
    { code: 'kor', iso1: 'ko', name: 'Korean' },
    { code: 'hin', iso1: 'hi', name: 'Hindi' },
    { code: 'ara', iso1: 'ar', name: 'Arabic' },
    { code: 'por', iso1: 'pt', name: 'Portuguese' },
    { code: 'chi', iso1: 'zh', name: 'Chinese' }
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
    { id: 'all', label: 'All Books', query: '' },
    { id: 'booker', label: 'Booker Prize', query: 'subject:"Booker Prize"', badge: 'Booker Prize Honoree' },
    { id: 'pulitzer', label: 'Pulitzer Fiction', query: 'subject:"Pulitzer Prize"', badge: 'Pulitzer Prize Honoree' },
    { id: 'nobel', label: 'Nobel Laureates', query: 'subject:"Nobel Prize"', badge: 'Nobel Literature' },
    { id: 'hugo', label: 'Hugo & Nebula', query: '(subject:"Hugo Award" OR subject:"Nebula Award")', badge: 'Hugo / Nebula Honoree' }
  ],

  AVAILABILITY_OPTIONS: [
    { id: 'public', label: 'Free Public Domain' },
    { id: 'borrowable', label: 'Borrowable eBook' },
    { id: 'fulltext', label: 'Searchable Full Text' }
  ],

  // Known prize map by lowercase title for automatic laurel badges
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
    "midnight's children": 'Booker of Bookers',
    'the grapes of wrath': 'Pulitzer Prize · Nobel Laureate',
    'the old man and the sea': 'Pulitzer Prize · Nobel Laureate',
    'hyperion': 'Hugo Award Winner',
    'foundation': 'Hugo Award · Best All-Time Series',
    'the dispossessed': 'Hugo Award · Nebula Award',
    'shuggie bain': 'Booker Prize Winner',
    'pachinko': 'National Book Award Finalist',
    'piranesi': 'Women’s Prize for Fiction'
  },

  // Single-request Open Library queries for Home (fast, zero 429 bursts)
  HERO_QUERY: {
    q: 'subject:fiction',
    sort: 'trending',
    limit: 12
  },

  COLLECTIONS: [
    {
      id: 'prestige',
      eyebrow: 'GOLD STANDARD',
      title: 'Prize-Winning Literature',
      awardHint: 'Literary Prize',
      params: {
        q: '(subject:"Pulitzer Prize" OR subject:"Booker Prize")',
        sort: 'readinglog',
        limit: 16
      }
    },
    {
      id: 'literary_fiction',
      eyebrow: 'ESSENTIAL READING',
      title: 'Most Read Fiction',
      params: {
        q: 'subject:fiction',
        sort: 'readinglog',
        limit: 16
      }
    },
    {
      id: 'speculative',
      eyebrow: 'WORLDS BEYOND',
      title: 'Sci-Fi & Speculative Masterworks',
      params: {
        q: 'subject:"science fiction"',
        sort: 'readinglog',
        limit: 16
      }
    },
    {
      id: 'philosophy_nonfiction',
      eyebrow: 'IDEAS & INQUIRY',
      title: 'Philosophy, History & Biography',
      params: {
        q: '(subject:philosophy OR subject:history OR subject:biography)',
        sort: 'readinglog',
        limit: 16
      }
    },
    {
      id: 'world_lit',
      eyebrow: 'TIMELESS CANON',
      title: 'Enduring World Classics',
      params: {
        q: 'subject:classics',
        sort: 'editions',
        limit: 16
      }
    }
  ]
};
