import { supabase } from '../lib/supabase'
const FALLBACK_RECALL_POOL = []

/**
 * Canonical 10-Unit TNPSC General Studies Taxonomy (Unit -> Macro-Topic -> Micro-Topic)
 * Standardized across TNPSC Group 1, Group 2/2A, and Group 4 (Part B).
 * Enriched with rich keywords (English & Tamil) for automatic question classification.
 */
export const CANONICAL_SYLLABUS_TAXONOMY = [
  {
    unit_number: 1,
    unit_name: 'Unit 1 — General Science',
    subject: 'General Science',
    description: 'Physics, Chemistry, Biology and Everyday Science Principles',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Physics',
        description: 'Mechanics, Properties of Matter, Light, Sound, Electricity & Universe',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Mechanics, Force, Motion & Properties of Matter',
            keywords: ['force', 'motion', 'newton', 'gravity', 'pressure', 'density', 'elasticity', 'viscosity', 'surface tension', 'work', 'energy', 'விசை', 'இயக்கம்', 'ஈர்ப்பு', 'அழுத்தம்'],
            baseline_questions: ['phy-1', 'phy-2', 'phy-3'],
          },
          {
            micro_topic_number: 2,
            micro_topic_name: 'Light, Sound, Heat, Electricity & Magnetism',
            keywords: ['light', 'lens', 'mirror', 'refraction', 'sound', 'frequency', 'electric', 'current', 'ohm', 'magnetic', 'heat', 'temperature', 'ஒளி', 'ஒலி', 'வெப்பம்', 'மின்னோட்டம்'],
            baseline_questions: ['phy-4', 'phy-5', 'phy-6'],
          },
          {
            micro_topic_number: 3,
            micro_topic_name: 'Universe & Solar System',
            keywords: ['universe', 'solar system', 'planet', 'sun', 'moon', 'galaxy', 'satellite', 'orbit', 'விண்வெளி', 'சூரிய குடும்பம்', 'கோள்'],
            baseline_questions: ['phy-7', 'phy-8'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Chemistry',
        description: 'Elements, Compounds, Acids, Bases, Salts, Fertilizers & Everyday Chemistry',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Elements, Compounds, Acids, Bases & Salts',
            keywords: ['element', 'compound', 'acid', 'base', 'salt', 'ph', 'litmus', 'neutralization', 'periodic table', 'தனிமம்', 'சேர்மம்', 'அமிலம்', 'காரம்', 'உப்பு'],
            baseline_questions: ['chem-1', 'chem-2', 'chem-3'],
          },
          {
            micro_topic_number: 2,
            micro_topic_name: 'Fertilizers, Pesticides & Carbon Compounds',
            keywords: ['fertilizer', 'pesticide', 'urea', 'polymer', 'plastic', 'carbon', 'petroleum', 'fuel', 'உரம்', 'பூச்சிக்கொல்லி', 'நெகிழி'],
            baseline_questions: ['chem-4', 'chem-5'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Biology',
        description: 'Cell Biology, Human Systems, Nutrition & Diseases',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Blood, Circulation & Human Organ Systems',
            keywords: ['blood', 'circulation', 'heart', 'kidney', 'lung', 'digestive', 'nervous', 'brain', 'hormone', 'cell', 'இரத்தம்', 'இதயம்', 'சிறுநீரகம்', 'நுரையீரல்'],
            baseline_questions: ['bio-1', 'bio-2', 'bio-3'],
          },
          {
            micro_topic_number: 2,
            micro_topic_name: 'Nutrition, Vitamins & Human Diseases',
            keywords: ['vitamin', 'protein', 'carbohydrate', 'deficiency', 'disease', 'virus', 'bacteria', 'vaccine', 'malaria', 'dengue', 'ஊட்டச்சத்து', 'வைட்டமின்', 'நோய்'],
            baseline_questions: ['bio-4', 'bio-5'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Environment & Ecology',
        description: 'Ecology Basics, Biodiversity & Environmental Conservation',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Ecosystems, Food Chain & Environmental Balance',
            keywords: ['ecosystem', 'ecology', 'food chain', 'biodiversity', 'wildlife', 'conservation', 'சுற்றுச்சூழல்', 'உயிர்க்கோளம்', 'உணவுச் சங்கிலி'],
            baseline_questions: ['env-1', 'env-2'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 2,
    unit_name: 'Unit 2 — Geography of India & Tamil Nadu',
    subject: 'Geography',
    description: 'Physical Features, Rivers, Climate, Soil, Minerals and Agriculture',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Physical Geography',
        description: 'Location, Physical Features, Relief & Mountains of India and Tamil Nadu',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Indian Physical Geography & Relief Features',
            keywords: ['himalaya', 'peninsular plateau', 'western ghats', 'eastern ghats', 'coastal plain', 'island', 'latitude', 'tropic of cancer', 'இமயமலை', 'தக்காண பீடபூமி', 'கடற்கரை'],
            baseline_questions: ['geo-1', 'geo-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Climate & Monsoon',
        description: 'Monsoon, Rainfall Distribution & Weather Patterns',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Monsoon & Climate Patterns',
            keywords: ['monsoon', 'southwest monsoon', 'northeast monsoon', 'rainfall', 'cyclone', 'weather', 'climate', 'பருவமழை', 'மழைப்பொழிவு', 'புயல்'],
            baseline_questions: ['geo-3', 'geo-4'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Rivers & Water Resources',
        description: 'Drainage Systems, Rivers and Water Resources of India and Tamil Nadu',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Tamil Nadu & Indian River Systems',
            keywords: ['river', 'kaveri', 'cauvery', 'vaigai', 'tamirabarani', 'ganga', 'godavari', 'dam', 'irrigation', 'ஆறு', 'காவிரி', 'வைகை', 'தாமிரபரணி', 'அணை'],
            baseline_questions: ['geo-5', 'geo-6'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Agriculture & Minerals',
        description: 'Soil Types, Cropping Patterns, Minerals & Natural Resources',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Soils, Crops & Natural Resources',
            keywords: ['soil', 'alluvial', 'black soil', 'red soil', 'paddy', 'cotton', 'mineral', 'iron ore', 'coal', 'bauxite', 'மண்', 'விவசாயம்', 'கனிமம்'],
            baseline_questions: ['geo-7', 'geo-8'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 3,
    unit_name: 'Unit 3 — Indian National Movement',
    subject: 'National Movement',
    description: 'Indian Freedom Struggle, Early Uprisings, Gandhian Era & Constitutional Developments',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Early Nationalism',
        description: '1857 Revolt & Early Nationalist Awakenings',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: '1857 Revolt & Swadeshi Movement',
            keywords: ['1857', 'sepoy', 'revolt', 'swadeshi', 'boycott', 'partition of bengal', 'moderates', 'extremists', 'புரட்சி', 'சுதேசி இயக்கம்', 'வங்கப் பிரிவினை'],
            baseline_questions: ['inm-1', 'inm-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Gandhian Era',
        description: 'Non-Cooperation, Civil Disobedience & Quit India Movements',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Gandhian Mass Movements',
            keywords: ['gandhi', 'non-cooperation', 'civil disobedience', 'dandi', 'salt satyagraha', 'quit india', 'poona pact', 'காந்தி', 'ஒத்துழையாமை', 'சட்டமறுப்பு', 'வெள்ளையனே வெளியேறு'],
            baseline_questions: ['inm-3', 'inm-4', 'inm-5'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Acts & Constitutional Developments',
        description: 'British Acts, Reforms & March to Independence',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Government of India Acts & Partition',
            keywords: ['morley minto', 'montagu chelmsford', 'act 1935', 'simon commission', 'cripps', 'cabinet mission', 'mountbatten', 'independence', 'சட்டம்', 'சைமன் குழு'],
            baseline_questions: ['inm-6', 'inm-7'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Important Leaders & Events',
        description: 'National Leaders, Revolutionaries & TN Freedom Fighters',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Leaders of Freedom Struggle',
            keywords: ['ambedkar', 'bhagat singh', 'subhash chandra bose', 'ina', 'tilak', 'nehru', 'patel', 'வ.உ.சி', 'பாரதியார்', 'காமராஜர்'],
            baseline_questions: ['inm-8', 'inm-9'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 4,
    unit_name: 'Unit 4 — Indian Culture & Heritage',
    subject: 'History & Culture',
    description: 'Ancient & Medieval History, Heritage, Architecture and Art Forms',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Ancient & Medieval Empires',
        description: 'Indus Valley, Guptas, Delhi Sultanate, Mughals & Vijayanagar',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Indus Valley Civilization & Great Empires',
            keywords: ['indus', 'harappa', 'mohenjo', 'gupta', 'delhi sultanate', 'mughal', 'akbar', 'vijayanagar', 'krishnadevaraya', 'சிந்து சமவெளி', 'குப்தர்', 'முகலாயர்', 'விஜயநகரம்'],
            baseline_questions: ['cul-1', 'cul-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Temple Architecture',
        description: 'Dravidian, Nagara & Vesara Temple Architecture',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Temple Architecture & Heritage Sites',
            keywords: ['temple', 'architecture', 'brihadisvara', 'thanjavur', 'mahabalipuram', 'chola', 'pallava', 'gopuram', 'sculpture', 'கோவில்', 'கட்டிடக்கலை', 'தஞ்சை பெரிய கோவில்'],
            baseline_questions: ['cul-3', 'cul-4'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Tamil Literature',
        description: 'Sangam Literature, Epics & Classical Works',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Classical Tamil Works & Epics',
            keywords: ['sangam', 'ettuthogai', 'paththuppaattu', 'silappathikaram', 'manimekalai', 'thirukkural', 'சங்க இலக்கியம்', 'எட்டுத்தொகை', 'சிலப்பதிகாரம்'],
            baseline_questions: ['cul-5', 'cul-6'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Folk & Classical Arts',
        description: 'Dance, Music, Folk Arts & Cultural Traditions',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Arts, Heritage & Classical Dances',
            keywords: ['bharatanatyam', 'carnatic', 'folk dance', 'karagattam', 'heritage', 'festival', 'பரதநாட்டியம்', 'நாட்டுப்புறக் கலை'],
            baseline_questions: ['cul-7', 'cul-8'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 5,
    unit_name: 'Unit 5 — Indian Polity',
    subject: 'Polity',
    description: 'Constitution, Fundamental Rights, Parliament, Judiciary & Local Governance',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Fundamental Rights & Duties',
        description: 'Preamble, Fundamental Rights, DPSP & Fundamental Duties',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Preamble, Rights & Directive Principles',
            keywords: ['preamble', 'fundamental rights', 'article 14', 'article 19', 'article 21', 'article 32', 'writs', 'dpsp', 'duties', 'அடிப்படை உரிமைகள்', 'முகவுரை', 'அடிப்படை கடமைகள்'],
            baseline_questions: ['pol-1', 'pol-2', 'pol-3'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Parliament & President',
        description: 'Union Executive, President, Prime Minister, Lok Sabha & Rajya Sabha',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'President, Prime Minister & Parliament',
            keywords: ['president', 'prime minister', 'parliament', 'lok sabha', 'rajya sabha', 'speaker', 'money bill', 'குடியரசுத் தலைவர்', 'பிரதமர்', 'நாடாளுமன்றம்'],
            baseline_questions: ['pol-4', 'pol-5'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Judiciary & Constitutional Bodies',
        description: 'Supreme Court, High Courts, Election Commission & CAG',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Courts & Constitutional Authorities',
            keywords: ['supreme court', 'high court', 'judicial review', 'election commission', 'cag', 'finance commission', 'upsc', 'நீதிமன்றம்', 'தேர்தல் ஆணையம்'],
            baseline_questions: ['pol-6', 'pol-7'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Local Government',
        description: 'Panchayati Raj & Urban Local Bodies (73rd & 74th Amendments)',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Panchayati Raj & Local Bodies',
            keywords: ['panchayat', 'municipality', '73rd amendment', '74th amendment', 'gram sabha', 'balwant rai', 'பஞ்சாயத்து ராஜ்', 'கிராம சபை'],
            baseline_questions: ['pol-8', 'pol-9'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 6,
    unit_name: 'Unit 6 — Geography & Environment',
    subject: 'Environment',
    description: 'Biodiversity, Pollution, Natural Resources & Disaster Management',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Biodiversity',
        description: 'Biosphere Reserves, National Parks & Wildlife Sanctuaries',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Wildlife Sanctuaries & Biosphere Reserves',
            keywords: ['biodiversity', 'national park', 'wildlife sanctuary', 'biosphere reserve', 'nilgiri', 'gulf of mannar', 'project tiger', 'வனவிலங்கு சரணாலயம்', 'தேசிய பூங்கா'],
            baseline_questions: ['env-3', 'env-4'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Pollution & Climate Change',
        description: 'Greenhouse Gases, Ozone Depletion & Climate Agreements',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Climate Change, Ozone & Pollution',
            keywords: ['climate change', 'global warming', 'greenhouse gas', 'ozone', 'carbon footprint', 'paris agreement', 'air pollution', 'புவி வெப்பமடைதல்', 'மாசுபாடு'],
            baseline_questions: ['env-5', 'env-6'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Natural Resources',
        description: 'Forests, Mineral Resources & Renewable Energy',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Forests & Renewable Energy',
            keywords: ['forest', 'solar energy', 'wind energy', 'water conservation', 'sustainable development', 'காடுகள்', 'புதுப்பிக்கத்தக்க ஆற்றல்'],
            baseline_questions: ['env-7', 'env-8'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Disaster Management',
        description: 'Natural Calamities, Cyclone, Flood & Disaster Mitigation',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Disaster Mitigation & Management',
            keywords: ['disaster management', 'ndma', 'cyclone', 'flood', 'earthquake', 'tsunami', 'பேரிடர் மேலாண்மை', 'வெள்ளம்', 'புயல்'],
            baseline_questions: ['env-9', 'env-10'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 7,
    unit_name: 'Unit 7 — Indian Economy',
    subject: 'Economy',
    description: 'Planning, Five-Year Plans, RBI, Fiscal Policy, GST & TN Economy',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'National Income & Growth',
        description: 'GDP, GNP, NITI Aayog & Five-Year Plans',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'GDP, Five-Year Plans & NITI Aayog',
            keywords: ['gdp', 'gnp', 'national income', 'five year plan', 'niti aayog', 'planning commission', 'per capita', 'தேசிய வருமானம்', 'நிதி ஆயோக்', 'ஐந்தாண்டு திட்டம்'],
            baseline_questions: ['eco-1', 'eco-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Banking & Monetary Policy',
        description: 'Reserve Bank of India, Repo Rate, Inflation & Commercial Banks',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'RBI, Monetary Policy & Inflation',
            keywords: ['rbi', 'reserve bank', 'monetary policy', 'repo rate', 'inflation', 'banking', 'nabard', 'ரிசர்வ் வங்கி', 'பணவீக்கம்', 'வங்கி'],
            baseline_questions: ['eco-3', 'eco-4'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Government Schemes',
        description: 'Poverty Alleviation, Employment & Social Welfare Initiatives',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Welfare Schemes & Employment Generation',
            keywords: ['mgnrega', 'scheme', 'poverty alleviation', 'employment', 'self help group', 'திட்டம்', 'வறுமை ஒழிப்பு'],
            baseline_questions: ['eco-5', 'eco-6'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Tamil Nadu Economy',
        description: 'Economic Growth, Industrial Clusters & State Revenue of TN',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Economic Growth & Industries in TN',
            keywords: ['tamil nadu economy', 'industrial corridor', 'sipcot', 'tidco', 'gst', 'state revenue', 'தமிழ்நாடு பொருளாதாரம்', 'தொழில்துறை'],
            baseline_questions: ['eco-7', 'eco-8'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 8,
    unit_name: 'Unit 8 — History & Culture of Tamil Nadu',
    subject: 'Tamil History',
    description: 'Sangam Age, Thirukkural, Freedom Movement in TN & Dravidian Movement',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Sangam Age',
        description: 'Ancient Tamil Society, Archaeological Discoveries (Keezhadi) & Sangam Literature',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Keezhadi, Archaeology & Sangam Society',
            keywords: ['sangam', 'keezhadi', 'adichanallur', 'kodumanal', 'tholkappiyam', 'chola', 'pandya', 'cherar', 'கீழடி', 'ஆதிச்சநல்லூர்', 'சங்க காலம்'],
            baseline_questions: ['tn-1', 'tn-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Chola & Pandya Periods',
        description: 'Imperial Cholas, Pandyas & Medieval Tamil History',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Imperial Cholas & Later Pandyas',
            keywords: ['rajaraja', 'rajendra chola', 'kudavolai', 'local administration', 'pandya', 'மாமன்னன் ராஜராஜன்', 'குடவோலை முறை'],
            baseline_questions: ['tn-3', 'tn-4'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Social Reform Movements',
        description: 'Self-Respect Movement, EVR Periyar, Justice Party & Social Justice',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Periyar, Justice Party & Self-Respect Movement',
            keywords: ['periyar', 'evr', 'self respect movement', 'justice party', 'dravidian movement', 'annadurai', 'tyagaraja chetti', 'பெரியார்', 'சுயமரியாதை இயக்கம்', 'நீதிக்கட்சி'],
            baseline_questions: ['tn-5', 'tn-6'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Justice Party & Dravidian Movement',
        description: 'Reservation, Women Empowerment & Non-Brahmin Movement',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Reservation, Social Reform & Women Leaders',
            keywords: ['muthulakshmi reddy', 'moovalur ramamirtham', 'velu nachiyar', 'communal go', 'social justice', 'முத்துலட்சுமி ரெட்டி', 'வேலு நாச்சியார்', 'சமூக நீதி'],
            baseline_questions: ['tn-7', 'tn-8'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 9,
    unit_name: 'Unit 9 — Tamil Nadu Administration & Schemes',
    subject: 'TN Administration',
    description: 'Human Development, Social Welfare Schemes, Education, Health & E-Governance in TN',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'State Administration',
        description: 'Government Machinery, District Administration & Public Delivery',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Administration & Public Services',
            keywords: ['administration', 'secretariat', 'district collector', 'revenue department', 'public service delivery', 'மாநில அரசு நிர்வாகம்', 'மாவட்ட ஆட்சியர்'],
            baseline_questions: ['adm-1', 'adm-2'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Welfare Schemes',
        description: 'Flagship Schemes (Magalir Urimai, Pudhumai Penn, Moovalur Ramamirtham)',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Flagship Welfare Programs',
            keywords: ['magalir urimai', 'pudhumai penn', 'mid day meal', 'breakfast scheme', 'welfare scheme', 'மகளிர் உரிமைத் தொகை', 'புதுமைப் பெண் திட்டம்', 'மதிய உணவு'],
            baseline_questions: ['adm-3', 'adm-4'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Education & Health Initiatives',
        description: 'Human Development Index, Medical Infrastructure & Education Reforms',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Health System & Higher Education in TN',
            keywords: ['human development index', 'hdi', 'phc', 'maternal mortality', 'higher education', 'gross enrolment ratio', 'கல்வி', 'சுகாதாரம்', 'மனித மேம்பாட்டு குறியீடு'],
            baseline_questions: ['adm-5', 'adm-6'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Local Administration',
        description: 'E-Governance, Digital Initiatives & Local Body Empowerment',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'E-Governance & Digital Delivery',
            keywords: ['e-governance', 'tnega', 'digital tamil nadu', 'meesevai', 'உள்ளாட்சி அமைப்பு', 'மின் ஆளுமை'],
            baseline_questions: ['adm-7', 'adm-8'],
          },
        ],
      },
    ],
  },
  {
    unit_number: 10,
    unit_name: 'Unit 10 — Aptitude & Mental Ability',
    subject: 'Aptitude',
    description: 'Simplification, Percentage, Ratio, Time & Work, Logical Reasoning & Data Interpretation',
    macro_topics: [
      {
        topic_number: 1,
        macro_topic_name: 'Percentage & Ratio',
        description: 'Percentage, Ratio & Proportion, Simple & Compound Interest',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Percentage, Ratio & Proportion',
            keywords: ['percentage', 'ratio', 'proportion', 'simple interest', 'compound interest', 'profit', 'loss', 'சதவீதம்', 'விகிதம்', 'தனிவட்டி', 'கூட்டுவட்டி'],
            baseline_questions: ['apt-1', 'apt-2', 'apt-3'],
          },
        ],
      },
      {
        topic_number: 2,
        macro_topic_name: 'Time, Work & Speed',
        description: 'Time & Work, Pipes & Cisterns, Speed, Distance & Mensuration',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Time, Work & Mensuration (Area/Volume)',
            keywords: ['time and work', 'pipes and cisterns', 'speed', 'area', 'perimeter', 'volume', 'நேரம் மற்றும் வேலை', 'பரப்பளவு', 'கனஅளவு'],
            baseline_questions: ['apt-4', 'apt-5'],
          },
        ],
      },
      {
        topic_number: 3,
        macro_topic_name: 'Logical Reasoning',
        description: 'Number Series, Puzzles, Dice & Visual Reasoning',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Logical Reasoning & Series',
            keywords: ['number series', 'reasoning', 'puzzle', 'dice', 'alphabet series', 'coding decoding', 'தருக்க அறிவு', 'எண் தொடர்'],
            baseline_questions: ['apt-6', 'apt-7'],
          },
        ],
      },
      {
        topic_number: 4,
        macro_topic_name: 'Data Interpretation',
        description: 'Tables, Bar Graphs, Pie Charts & Mean/Median',
        micro_topics: [
          {
            micro_topic_number: 1,
            micro_topic_name: 'Charts, Graphs & Data Interpretation',
            keywords: ['data interpretation', 'pie chart', 'bar graph', 'table', 'mean', 'median', 'mode', 'average', 'வரைபடம்', 'சராசரி'],
            baseline_questions: ['apt-8', 'apt-9'],
          },
        ],
      },
    ],
  },
]

/**
 * Safe division helper returning 0 when denominator is 0, capped at 100 for coverage.
 */
function calcPercentage(numerator, denominator, capAt100 = false) {
  const num = Number(numerator) || 0
  const den = Number(denominator) || 0
  if (den <= 0 || num <= 0) return 0
  const pct = (num / den) * 100
  const bounded = capAt100 ? Math.min(100, pct) : pct
  return Number(bounded.toFixed(1))
}

/**
 * Normalize string for resilient matching
 */
function norm(str) {
  return String(str || '').trim().toLowerCase()
}

export const syllabusAnalyticsService = {
  /**
   * Builds the full 3-level hierarchy (Unit -> Macro-Topic -> Micro-Topic) for a given exam/group,
   * merging live database units/topics/micro-topics with the canonical taxonomy blueprint.
   * Strictly deduplicates incoming DB units by unit_number to eliminate duplicated cards.
   */
  async buildHierarchy(examName = 'TNPSC Group 4') {
    let dbExam = null
    let dbUnits = []
    let dbMicroTopics = []

    try {
      const { data: examData } = await supabase
        .from('syllabus_exams')
        .select('*')
        .eq('exam_name', examName)
        .maybeSingle()
      dbExam = examData

      if (dbExam?.id) {
        const { data: unitsData } = await supabase
          .from('syllabus_units')
          .select('*, syllabus_topics(*)')
          .eq('exam_id', dbExam.id)
          .order('unit_number', { ascending: true })
        dbUnits = unitsData || []
      }

      // Try fetching micro-topics if migration has been executed
      const { data: microData, error: microErr } = await supabase
        .from('syllabus_micro_topics')
        .select('*')
        .order('micro_topic_number', { ascending: true })
      if (!microErr && microData) {
        dbMicroTopics = microData
      }
    } catch (e) {
      console.warn('[SyllabusAnalytics] Using fallback taxonomy merge:', e)
    }

    const groupId = dbExam?.id || `group-${norm(examName).replace(/[^a-z0-9]+/g, '-')}`
    const microByMacroId = new Map()
    dbMicroTopics.forEach(mt => {
      if (!microByMacroId.has(mt.macro_topic_id)) microByMacroId.set(mt.macro_topic_id, [])
      microByMacroId.get(mt.macro_topic_id).push(mt)
    })

    // Deduplicate dbUnits strictly by unit_number and merge their topics to prevent duplicate rows
    const unitMap = new Map()
    for (const u of dbUnits) {
      const num = u.unit_number
      if (!num) continue
      if (!unitMap.has(num)) {
        unitMap.set(num, { ...u, syllabus_topics: [...(u.syllabus_topics || [])] })
      } else {
        const existing = unitMap.get(num)
        const existingTopicIds = new Set(existing.syllabus_topics.map(t => t.id || t.topic_name))
        for (const t of (u.syllabus_topics || [])) {
          if (!existingTopicIds.has(t.id || t.topic_name)) {
            existing.syllabus_topics.push(t)
            existingTopicIds.add(t.id || t.topic_name)
          }
        }
      }
    }

    // Always guarantee all 10 canonical units, merging deduplicated DB unit data if available
    const rawUnits = CANONICAL_SYLLABUS_TAXONOMY.map((canonicalUnit, uIdx) => {
      const dbMatch = unitMap.get(canonicalUnit.unit_number)
      if (dbMatch) {
        return {
          ...canonicalUnit,
          ...dbMatch,
          unit_name: canonicalUnit.unit_name,
          syllabus_topics: (dbMatch.syllabus_topics && dbMatch.syllabus_topics.length > 0)
            ? dbMatch.syllabus_topics
            : canonicalUnit.macro_topics,
        }
      }
      return canonicalUnit
    })

    const hierarchyUnits = rawUnits.map((u, uIdx) => {
      const canonicalUnit = CANONICAL_SYLLABUS_TAXONOMY.find(
        cu => cu.unit_number === u.unit_number || norm(cu.unit_name) === norm(u.unit_name)
      ) || CANONICAL_SYLLABUS_TAXONOMY[uIdx % CANONICAL_SYLLABUS_TAXONOMY.length]

      const unitId = u.id || `unit-${u.unit_number || uIdx + 1}`
      const unitName = canonicalUnit.unit_name
      const unitNumber = u.unit_number ?? canonicalUnit.unit_number ?? (uIdx + 1)

      const rawMacros = (u.syllabus_topics && u.syllabus_topics.length > 0)
        ? [...u.syllabus_topics].sort((a, b) => (a.topic_number || 0) - (b.topic_number || 0))
        : (canonicalUnit?.macro_topics || [])

      const macroTopics = rawMacros.map((mt, mIdx) => {
        const macroName = mt.topic_name || mt.macro_topic_name || `Topic ${mIdx + 1}`
        const macroId = mt.id || `${unitId}-macro-${mt.topic_number || mIdx + 1}`
        const macroNumber = mt.topic_number ?? (mIdx + 1)

        const canonicalMacro = canonicalUnit?.macro_topics?.find(
          cm => norm(cm.macro_topic_name) === norm(macroName) ||
                norm(macroName).includes(norm(cm.macro_topic_name)) ||
                norm(cm.macro_topic_name).includes(norm(macroName))
        ) || canonicalUnit?.macro_topics?.[mIdx]

        const dbMicrosForMacro = microByMacroId.get(macroId) || []
        const rawMicros = dbMicrosForMacro.length > 0
          ? dbMicrosForMacro
          : (canonicalMacro?.micro_topics || [
              {
                micro_topic_number: 1,
                micro_topic_name: `${macroName} — Core Concepts & Principles`,
                keywords: [norm(macroName)],
                baseline_questions: [`${macroId}-q1`, `${macroId}-q2`, `${macroId}-q3`],
              },
              {
                micro_topic_number: 2,
                micro_topic_name: `${macroName} — Applied PYQs & Case Studies`,
                keywords: [norm(macroName)],
                baseline_questions: [`${macroId}-q4`, `${macroId}-q5`],
              },
            ])

        const microTopics = rawMicros.map((mct, mcIdx) => {
          const canonicalMicro = canonicalMacro?.micro_topics?.[mcIdx]
          const microId = mct.id || `${macroId}-micro-${mct.micro_topic_number || mcIdx + 1}`
          const microName = mct.micro_topic_name || `Sub-topic ${mcIdx + 1}`

          return {
            micro_topic_id: microId,
            micro_topic_name: microName,
            micro_topic_number: mct.micro_topic_number ?? (mcIdx + 1),
            macro_topic_id: macroId,
            macro_topic_name: macroName,
            unit_id: unitId,
            unit_name: unitName,
            group_id: groupId,
            group_name: examName,
            keywords: mct.keywords || canonicalMicro?.keywords || [norm(microName), norm(macroName)],
            baseline_questions: canonicalMicro?.baseline_questions || [`${microId}-base-1`, `${microId}-base-2`, `${microId}-base-3`],
          }
        })

        return {
          macro_topic_id: macroId,
          macro_topic_name: macroName,
          macro_topic_number: macroNumber,
          description: mt.description || canonicalMacro?.description || '',
          unit_id: unitId,
          unit_name: unitName,
          group_id: groupId,
          group_name: examName,
          micro_topics: microTopics,
        }
      })

      return {
        unit_id: unitId,
        unit_name: unitName,
        unit_number: unitNumber,
        subject: u.subject || canonicalUnit?.subject || unitName,
        description: u.description || canonicalUnit?.description || '',
        group_id: groupId,
        group_name: examName,
        macro_topics: macroTopics,
      }
    })

    return {
      group_id: groupId,
      group_name: examName,
      units: hierarchyUnits,
    }
  },

  /**
   * Classifies any question into a specific Micro-Topic node in the hierarchy.
   * Inspects explicit taxonomy IDs/names first, then falls back to keyword/subject matching.
   */
  classifyQuestionToMicroTopic(question, allMicroTopics) {
    if (!allMicroTopics || allMicroTopics.length === 0) return null

    // 1. Direct match by micro_topic_id or micro_topic_name
    if (question.micro_topic_id) {
      const exactId = allMicroTopics.find(m => m.micro_topic_id === question.micro_topic_id)
      if (exactId) return exactId
    }
    if (question.micro_topic_name) {
      const exactName = allMicroTopics.find(m => norm(m.micro_topic_name) === norm(question.micro_topic_name))
      if (exactName) return exactName
    }

    // 2. Match by macro_topic_id or macro_topic_name + keyword scoring
    const candidatePool = (() => {
      if (question.macro_topic_id) {
        const byMacroId = allMicroTopics.filter(m => m.macro_topic_id === question.macro_topic_id)
        if (byMacroId.length > 0) return byMacroId
      }
      const topicHint = norm(question.macro_topic_name || question.topic || question.subject || question.papers?.subject)
      if (topicHint) {
        const byTopicHint = allMicroTopics.filter(
          m => norm(m.macro_topic_name).includes(topicHint) ||
               topicHint.includes(norm(m.macro_topic_name)) ||
               norm(m.unit_name).includes(topicHint)
        )
        if (byTopicHint.length > 0) return byTopicHint
      }
      return allMicroTopics
    })()

    const searchBlob = norm([
      question.question_text,
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d,
      question.explanation,
      question.topic,
      question.subject,
      question.papers?.subject,
      question.papers?.title,
    ].filter(Boolean).join(' '))

    let bestMicro = null
    let bestScore = 0

    for (const micro of candidatePool) {
      let score = 0
      for (const kw of (micro.keywords || [])) {
        if (kw && searchBlob.includes(norm(kw))) {
          score += kw.length > 5 ? 3 : 2
        }
      }
      if (score > bestScore) {
        bestScore = score
        bestMicro = micro
      }
    }

    if (bestMicro) return bestMicro

    // Deterministic hash fallback within candidatePool so the same question always maps to the same micro-topic
    const idStr = String(question.id || question.question_text || 'q')
    let hash = 0
    for (let i = 0; i < idStr.length; i++) {
      hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
    }
    const idx = Math.abs(hash) % candidatePool.length
    return candidatePool[idx]
  },

  /**
   * Fetches the full Interactive Syllabus hierarchy along with real-time Coverage (%) and Accuracy (%)
   * at every level (Micro-Topic -> Macro-Topic -> Unit -> Exam Summary).
   * Strictly guarantees 10 units with no duplication.
   */
  async getSyllabusWithAnalytics(userId, examName = 'TNPSC Group 4') {
    // 1. Build 3-level hierarchy
    const hierarchy = await this.buildHierarchy(examName)
    const allMicroTopics = hierarchy.units.flatMap(u =>
      u.macro_topics.flatMap(mt => mt.micro_topics)
    )

    // Map micro_topic_id -> aggregation buckets
    const microBuckets = new Map()
    allMicroTopics.forEach(mt => {
      const bankSet = new Set(mt.baseline_questions || [])
      microBuckets.set(mt.micro_topic_id, {
        bankQuestionIds: bankSet,
        attemptedQuestionIds: new Set(),
        totalAttempts: 0,
        correctAttempts: 0,
      })
    })

    const questionToMicroMap = new Map()
    const textToQuestionIdMap = new Map()

    // Register fallback recall pool questions into the bank
    FALLBACK_RECALL_POOL.forEach(fq => {
      const matchedMicro = this.classifyQuestionToMicroTopic(fq, allMicroTopics)
      if (matchedMicro) {
        const bucket = microBuckets.get(matchedMicro.micro_topic_id)
        if (bucket) {
          bucket.bankQuestionIds.add(String(fq.id))
          questionToMicroMap.set(String(fq.id), matchedMicro.micro_topic_id)
          if (fq.question_text) {
            textToQuestionIdMap.set(norm(fq.question_text), String(fq.id))
          }
        }
      }
    })

    // 2. Fetch questions from DB & user progress/attempts in parallel
    const [
      dbQuestionsRes,
      dbRecallQuestionsRes,
      userAttemptsRes,
      userRecallSessionsRes,
    ] = await Promise.allSettled([
      supabase
        .from('questions')
        .select('id, paper_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, papers(id, title, subject, exam_name, status)')
        .limit(1000),
      supabase
        .from('recall_questions')
        .select('id, question_text, subject, topic, exam_context, is_active')
        .eq('is_active', true)
        .limit(500),
      userId
        ? supabase
            .from('attempts')
            .select('id, paper_id, status, papers(id, title, subject, exam_name), attempt_answers(id, question_id, selected_option, is_correct)')
            .eq('user_id', userId)
            .order('started_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      userId
        ? supabase
            .from('quick_recall_sessions')
            .select('id, exam_context, questions_json, completed, quick_recall_answers(id, question_index, question_text, selected_answer, is_correct)')
            .eq('user_id', userId)
            .limit(100)
        : Promise.resolve({ data: [] }),
    ])

    // Process DB questions into the Question Bank
    const dbQuestions = dbQuestionsRes.status === 'fulfilled' ? (dbQuestionsRes.value.data || []) : []
    dbQuestions.forEach(q => {
      const qId = String(q.id)
      const matchedMicro = this.classifyQuestionToMicroTopic(q, allMicroTopics)
      if (matchedMicro) {
        const bucket = microBuckets.get(matchedMicro.micro_topic_id)
        if (bucket) {
          bucket.bankQuestionIds.add(qId)
          questionToMicroMap.set(qId, matchedMicro.micro_topic_id)
          if (q.question_text) {
            textToQuestionIdMap.set(norm(q.question_text), qId)
          }
        }
      }
    })

    // Process Recall Questions into the Question Bank
    const dbRecallQuestions = dbRecallQuestionsRes.status === 'fulfilled' ? (dbRecallQuestionsRes.value.data || []) : []
    dbRecallQuestions.forEach(rq => {
      const rqId = `rq-${rq.id}`
      const matchedMicro = this.classifyQuestionToMicroTopic(rq, allMicroTopics)
      if (matchedMicro) {
        const bucket = microBuckets.get(matchedMicro.micro_topic_id)
        if (bucket) {
          bucket.bankQuestionIds.add(rqId)
          questionToMicroMap.set(rqId, matchedMicro.micro_topic_id)
          if (rq.question_text) {
            textToQuestionIdMap.set(norm(rq.question_text), rqId)
          }
        }
      }
    })

    // 3. Process User Test Submissions & Attempt Logs
    const userAttempts = userAttemptsRes.status === 'fulfilled' ? (userAttemptsRes.value.data || []) : []
    userAttempts.forEach(attempt => {
      const answers = attempt.attempt_answers || []
      answers.forEach(ans => {
        if (!ans.selected_option) return

        const qId = String(ans.question_id)
        let microId = questionToMicroMap.get(qId)

        if (!microId) {
          const fallbackMicro = this.classifyQuestionToMicroTopic(
            { id: qId, subject: attempt.papers?.subject, papers: attempt.papers },
            allMicroTopics
          )
          if (fallbackMicro) {
            microId = fallbackMicro.micro_topic_id
            questionToMicroMap.set(qId, microId)
          }
        }

        if (microId && microBuckets.has(microId)) {
          const bucket = microBuckets.get(microId)
          bucket.bankQuestionIds.add(qId)
          bucket.attemptedQuestionIds.add(qId)
          bucket.totalAttempts += 1
          if (ans.is_correct === true) {
            bucket.correctAttempts += 1
          }
        }
      })
    })

    // 4. Process Quick Recall Answers
    const recallSessions = userRecallSessionsRes.status === 'fulfilled' ? (userRecallSessionsRes.value.data || []) : []
    recallSessions.forEach(session => {
      const answers = session.quick_recall_answers || []
      answers.forEach(ans => {
        let microId = null
        if (ans.question_text) {
          const qId = textToQuestionIdMap.get(norm(ans.question_text))
          if (qId) microId = questionToMicroMap.get(qId)
        }
        if (!microId && ans.question_text) {
          const matched = this.classifyQuestionToMicroTopic({ question_text: ans.question_text }, allMicroTopics)
          if (matched) microId = matched.micro_topic_id
        }

        if (microId && microBuckets.has(microId)) {
          const bucket = microBuckets.get(microId)
          bucket.totalAttempts += 1
          if (ans.is_correct === true) {
            bucket.correctAttempts += 1
          }
        }
      })
    })

    // 5. Roll-up Math: Micro -> Macro -> Unit -> Exam
    let examTotalQuestions = 0
    let examAttemptedQuestions = 0
    let examTotalAttempts = 0
    let examCorrectAttempts = 0

    const enrichedUnits = hierarchy.units.map(unit => {
      let unitTotalQuestions = 0
      let unitAttemptedQuestions = 0
      let unitTotalAttempts = 0
      let unitCorrectAttempts = 0

      const enrichedMacroTopics = unit.macro_topics.map(macro => {
        let macroTotalQuestions = 0
        let macroAttemptedQuestions = 0
        let macroTotalAttempts = 0
        let macroCorrectAttempts = 0

        const enrichedMicroTopics = macro.micro_topics.map(micro => {
          const bucket = microBuckets.get(micro.micro_topic_id) || {
            bankQuestionIds: new Set(micro.baseline_questions || []),
            attemptedQuestionIds: new Set(),
            totalAttempts: 0,
            correctAttempts: 0,
          }

          const totalQuestions = Math.max(bucket.bankQuestionIds.size, bucket.attemptedQuestionIds.size, 1)
          const attemptedQuestions = bucket.attemptedQuestionIds.size
          const totalAttempts = bucket.totalAttempts
          const correctAttempts = bucket.correctAttempts

          const coveragePct = calcPercentage(attemptedQuestions, totalQuestions, true)
          const accuracyPct = calcPercentage(correctAttempts, totalAttempts)

          macroTotalQuestions += totalQuestions
          macroAttemptedQuestions += attemptedQuestions
          macroTotalAttempts += totalAttempts
          macroCorrectAttempts += correctAttempts

          return {
            ...micro,
            total_questions: totalQuestions,
            attempted_questions: attemptedQuestions,
            total_attempts: totalAttempts,
            correct_attempts: correctAttempts,
            coverage_percentage: coveragePct,
            accuracy_percentage: accuracyPct,
            status: accuracyPct >= 70 ? 'mastered' : totalAttempts > 0 && accuracyPct < 50 ? 'needs_review' : 'in_progress',
          }
        })

        const macroCoveragePct = calcPercentage(macroAttemptedQuestions, macroTotalQuestions, true)
        const macroAccuracyPct = calcPercentage(macroCorrectAttempts, macroTotalAttempts)

        unitTotalQuestions += macroTotalQuestions
        unitAttemptedQuestions += macroAttemptedQuestions
        unitTotalAttempts += macroTotalAttempts
        unitCorrectAttempts += macroCorrectAttempts

        return {
          ...macro,
          total_questions: macroTotalQuestions,
          attempted_questions: macroAttemptedQuestions,
          total_attempts: macroTotalAttempts,
          correct_attempts: macroCorrectAttempts,
          coverage_percentage: macroCoveragePct,
          accuracy_percentage: macroAccuracyPct,
          status: macroAccuracyPct >= 70 ? 'mastered' : macroTotalAttempts > 0 && macroAccuracyPct < 50 ? 'needs_review' : 'in_progress',
          micro_topics: enrichedMicroTopics,
        }
      })

      const unitCoveragePct = calcPercentage(unitAttemptedQuestions, unitTotalQuestions, true)
      const unitAccuracyPct = calcPercentage(unitCorrectAttempts, unitTotalAttempts)

      examTotalQuestions += unitTotalQuestions
      examAttemptedQuestions += unitAttemptedQuestions
      examTotalAttempts += unitTotalAttempts
      examCorrectAttempts += unitCorrectAttempts

      return {
        ...unit,
        total_questions: unitTotalQuestions,
        attempted_questions: unitAttemptedQuestions,
        total_attempts: unitTotalAttempts,
        correct_attempts: unitCorrectAttempts,
        coverage_percentage: unitCoveragePct,
        accuracy_percentage: unitAccuracyPct,
        status: unitAccuracyPct >= 70 ? 'mastered' : unitTotalAttempts > 0 && unitAccuracyPct < 50 ? 'weak_zone' : 'in_progress',
        macro_topics: enrichedMacroTopics,
      }
    })

    const overallCoveragePct = calcPercentage(examAttemptedQuestions, examTotalQuestions, true)
    const overallAccuracyPct = calcPercentage(examCorrectAttempts, examTotalAttempts)

    return {
      exam_name: examName,
      total_units: enrichedUnits.length,
      covered_units: enrichedUnits.length,
      total_questions: examTotalQuestions,
      attempted_questions: examAttemptedQuestions,
      total_attempts: examTotalAttempts,
      correct_attempts: examCorrectAttempts,
      coverage_percentage: overallCoveragePct,
      accuracy_percentage: overallAccuracyPct,
      units: enrichedUnits,
    }
  },
}
