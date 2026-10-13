/**
 * TNPSC 3-Tier Syllabus Hierarchy & Topic Classifier Service
 *
 * 3-Tier Architecture:
 *   - Level 1: Unit (Broad Subject — e.g. Unit 1: General Science, Part A: General Tamil)
 *   - Level 2: Macro-Topic (Sub-category — e.g. Physics, Ilakkanam (Grammar))
 *   - Level 3: Micro-Topic (Exact Chapter — e.g. Mechanics & Properties of Matter)
 *
 * Golden Rule: Every question is tagged down to the micro_topic level.
 */

// ─── 1. Canonical 12-Unit TNPSC Taxonomy (from Official Syllabus CSV) ─────────
export const TNPSC_TAXONOMY = [
  // ── Unit 1: General Science ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 1: General Science',
    unit_number: 1,
    macro_topics: [
      {
        macro_topic_name: 'Physics',
        micro_topics: [
          'Mechanics & Properties of Matter',
          'Light, Sound, Heat & Magnetism',
          'Universe & Solar System'
        ]
      },
      {
        macro_topic_name: 'Chemistry',
        micro_topics: [
          'Elements, Compounds, Acids, Bases & Salts',
          'Petroleum Products, Fertilizers & Pesticides'
        ]
      },
      {
        macro_topic_name: 'Biology',
        micro_topics: [
          'Main Concepts of Life Science & Classification',
          'Blood, Circulation & Human Body Systems',
          'Human Diseases (Causes & Cures)'
        ]
      },
      {
        macro_topic_name: 'Environment',
        micro_topics: [
          'Environment, Ecology & Diet'
        ]
      }
    ]
  },

  // ── Unit 2: Current Events ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 2: Current Events',
    unit_number: 2,
    macro_topics: [
      {
        macro_topic_name: 'History & Politics',
        micro_topics: [
          'Latest Diary of Events & National Symbols',
          'Prominent Personalities & Places in News',
          'Public Awareness & General Administration'
        ]
      },
      {
        macro_topic_name: 'Geography & Science',
        micro_topics: [
          'Geographical Landmarks',
          'Latest Inventions in Science & Technology'
        ]
      }
    ]
  },

  // ── Unit 3: Geography of India ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 3: Geography of India',
    unit_number: 3,
    macro_topics: [
      {
        macro_topic_name: 'Physical Geography',
        micro_topics: [
          'Location & Physical Features of India'
        ]
      },
      {
        macro_topic_name: 'Climate & Weather',
        micro_topics: [
          'Monsoon, Rainfall & Weather Patterns'
        ]
      },
      {
        macro_topic_name: 'Water & Soil',
        micro_topics: [
          'Water Resources & Rivers in India',
          'Soil, Minerals & Natural Resources'
        ]
      },
      {
        macro_topic_name: 'Economic & Human',
        micro_topics: [
          'Agriculture Patterns',
          'Transport, Communication & Population Density',
          'Disaster Management & Environmental Impact'
        ]
      }
    ]
  },

  // ── Unit 4: History & Culture ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 4: History & Culture',
    unit_number: 4,
    macro_topics: [
      {
        macro_topic_name: 'Ancient India',
        micro_topics: [
          'Indus Valley Civilization',
          'Guptas'
        ]
      },
      {
        macro_topic_name: 'Medieval India',
        micro_topics: [
          'Delhi Sultanate',
          'Mughals & Marathas'
        ]
      },
      {
        macro_topic_name: 'South Indian History',
        micro_topics: [
          'Cholas, Pandyas, Pallavas'
        ]
      },
      {
        macro_topic_name: 'Culture & Heritage',
        micro_topics: [
          'Characteristics of Indian Culture (Unity in Diversity)',
          'India as a Secular State'
        ]
      }
    ]
  },

  // ── Unit 5: Indian Polity ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 5: Indian Polity',
    unit_number: 5,
    macro_topics: [
      {
        macro_topic_name: 'Constitution Basics',
        micro_topics: [
          'Making of the Constitution & Salient Features',
          'Preamble, Citizenship, Union & Territories'
        ]
      },
      {
        macro_topic_name: 'Rights & Duties',
        micro_topics: [
          'Fundamental Rights',
          'Fundamental Duties & Directive Principles (DPSP)'
        ]
      },
      {
        macro_topic_name: 'Executive & Legislature',
        micro_topics: [
          'Union Executive (President, PM, Cabinet)',
          'State Executive (Governor, CM, Council)',
          'Parliament & State Legislature'
        ]
      },
      {
        macro_topic_name: 'Judiciary & Local Govt',
        micro_topics: [
          'Supreme Court & High Courts',
          'Local Government (Panchayati Raj)',
          'Constitutional & Non-Constitutional Bodies (EC, CAG, UPSC)'
        ]
      }
    ]
  },

  // ── Unit 6: Indian Economy ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 6: Indian Economy',
    unit_number: 6,
    macro_topics: [
      {
        macro_topic_name: 'Nature of Economy',
        micro_topics: [
          'Nature of Indian Economy & Five Year Plans',
          'Planning Commission & NITI Aayog'
        ]
      },
      {
        macro_topic_name: 'Finance & Banking',
        micro_topics: [
          'Reserve Bank of India (RBI) & Monetary Policy',
          'Finance Commission & Fiscal Policy'
        ]
      },
      {
        macro_topic_name: 'Sectors of Economy',
        micro_topics: [
          'Agriculture, Industry & Rural Development',
          'GST & Taxation'
        ]
      }
    ]
  },

  // ── Unit 7: National Movement ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 7: National Movement',
    unit_number: 7,
    macro_topics: [
      {
        macro_topic_name: 'Early Uprisings',
        micro_topics: [
          'Early Uprisings against British Rule (1857 Revolt)'
        ]
      },
      {
        macro_topic_name: 'INC & Moderates',
        micro_topics: [
          'Indian National Congress Formation',
          'Emergence of Leaders (B.R. Ambedkar, Bhagat Singh, etc.)'
        ]
      },
      {
        macro_topic_name: 'Gandhian Era',
        micro_topics: [
          'Non-Cooperation, Civil Disobedience, Quit India'
        ]
      }
    ]
  },

  // ── Unit 8: TN History & Culture ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 8: TN History & Culture',
    unit_number: 8,
    macro_topics: [
      {
        macro_topic_name: 'Ancient Tamilakam',
        micro_topics: [
          'History of Tamil Society & Archaeological Discoveries',
          'Sangam Literature'
        ]
      },
      {
        macro_topic_name: 'Thirukkural',
        micro_topics: [
          'Significance as Secular Literature & Everyday Relevance'
        ]
      },
      {
        macro_topic_name: 'Freedom Struggle in TN',
        micro_topics: [
          'Early Agitations against British Rule',
          'Role of Women in Freedom Struggle'
        ]
      },
      {
        macro_topic_name: 'Social Movements',
        micro_topics: [
          '19th & 20th Century Socio-Political Movements',
          'Justice Party, Dravidian Movement & Periyar'
        ]
      }
    ]
  },

  // ── Unit 9: TN Administration ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 9: TN Administration',
    unit_number: 9,
    macro_topics: [
      {
        macro_topic_name: 'Welfare & Governance',
        micro_topics: [
          'Social Justice & Social Harmony',
          'Education & Health Systems in Tamil Nadu',
          'E-Governance in Tamil Nadu'
        ]
      },
      {
        macro_topic_name: 'TN Geography',
        micro_topics: [
          'Geography of Tamil Nadu & its Economic Impact'
        ]
      }
    ]
  },

  // ── Unit 10: Aptitude ──
  {
    exam_group: 'ALL_GROUPS',
    unit_name: 'Unit 10: Aptitude',
    unit_number: 10,
    macro_topics: [
      {
        macro_topic_name: 'Quantitative Aptitude',
        micro_topics: [
          'Simplification, LCM & HCF',
          'Ratio & Proportion',
          'Percentage, Simple & Compound Interest',
          'Area & Volume',
          'Time & Work'
        ]
      },
      {
        macro_topic_name: 'Logical Reasoning',
        micro_topics: [
          'Logical Reasoning & Puzzles',
          'Dice & Visual Reasoning',
          'Alpha-Numeric & Number Series'
        ]
      }
    ]
  },

  // ── Part A: General Tamil (Group 2 & 4) ──
  {
    exam_group: 'GROUP_2_AND_4',
    unit_name: 'Part A: General Tamil',
    unit_number: 11,
    macro_topics: [
      {
        macro_topic_name: 'Ilakkanam (Grammar)',
        micro_topics: [
          'Poruthuthal & Pirithu Ezhudhuthal',
          'Pizhai Thiruththam & Sol Porul'
        ]
      },
      {
        macro_topic_name: 'Ilakkaiyam (Literature)',
        micro_topics: [
          'Thirukkural & Ettuthogai',
          'Paththuppaattu & Iymperum Kaapiyangal'
        ]
      },
      {
        macro_topic_name: 'Tamil Arignargal (Scholars)',
        micro_topics: [
          'Tamil Thondu & Bharathiyar/Bharathidasan',
          'Urainadai & Samudhaya Thondu'
        ]
      }
    ]
  },

  // ── Part A: General English (Group 2 & 4) ──
  {
    exam_group: 'GROUP_2_AND_4',
    unit_name: 'Part A: General English',
    unit_number: 12,
    macro_topics: [
      {
        macro_topic_name: 'Grammar',
        micro_topics: [
          'Match the following & Synonyms/Antonyms',
          'Prefix/Suffix & Articles/Prepositions'
        ]
      },
      {
        macro_topic_name: 'Literature',
        micro_topics: [
          'Figures of Speech & Poetry Comprehension',
          'Important Lines from Poems'
        ]
      },
      {
        macro_topic_name: 'Authors & Literary Works',
        micro_topics: [
          'Match Authors with Stories',
          'Biographies & Characters'
        ]
      }
    ]
  }
]

// Flat lookup table of all 79 micro topics with their parents
export const FLAT_MICRO_TOPICS = TNPSC_TAXONOMY.flatMap(u =>
  u.macro_topics.flatMap(m =>
    m.micro_topics.map(t => ({
      micro_topic_name: t,
      macro_topic_name: m.macro_topic_name,
      unit_name: u.unit_name,
      unit_number: u.unit_number,
      exam_group: u.exam_group,
    }))
  )
)

// ─── 2. NLP Classification Pattern Rules ─────────────────────────────────────
const MICRO_CLASSIFICATION_RULES = [
  // ── Part A: General Tamil ──
  {
    micro: 'Poruthuthal & Pirithu Ezhudhuthal',
    macro: 'Ilakkanam (Grammar)',
    unit: 'Part A: General Tamil',
    patterns: [/பொருத்துக/i, /பொருத்து/i, /பொருத்தமான/i, /பொருந்தாத/i, /பிரித்தெழுதுக/i, /சேர்த்தெழுதுக/i, /பிரித்து/i]
  },
  {
    micro: 'Pizhai Thiruththam & Sol Porul',
    macro: 'Ilakkanam (Grammar)',
    unit: 'Part A: General Tamil',
    patterns: [/இலக்கணக் குறிப்பு/i, /பெயர்ச்சொல்/i, /பண்புத்தொகை/i, /பிழையற்ற/i, /எதிர்ச்சொல்/i, /வேர்ச்சொல்/i, /அகரவரிசை/i, /சொல் பொருள்/i]
  },
  {
    micro: 'Thirukkural & Ettuthogai',
    macro: 'Ilakkaiyam (Literature)',
    unit: 'Part A: General Tamil',
    patterns: [/திருக்குறள்/i, /வள்ளுவர்/i, /நற்றிணை/i, /குறுந்தொகை/i, /ஐங்குறுநூறு/i, /பதிற்றுப்பத்து/i, /பரிபாடல்/i, /கலித்தொகை/i, /அகநானூறு/i, /புறநானூறு/i]
  },
  {
    micro: 'Paththuppaattu & Iymperum Kaapiyangal',
    macro: 'Ilakkaiyam (Literature)',
    unit: 'Part A: General Tamil',
    patterns: [/பத்துப்பாட்டு/i, /சிலப்பதிகாரம்/i, /மணிமேகலை/i, /சீவக சிந்தாமணி/i, /கம்பராமாயணம்/i, /பெரியபுராணம்/i, /காப்பியம்/i]
  },
  {
    micro: 'Tamil Thondu & Bharathiyar/Bharathidasan',
    macro: 'Tamil Arignargal (Scholars)',
    unit: 'Part A: General Tamil',
    patterns: [/பாரதியார்/i, /பாரதிதாசன்/i, /நாமக்கல் கவிஞர்/i, /கவிமணி/i, /கண்ணதாசன்/i, /தமிழ் தொண்டு/i]
  },
  {
    micro: 'Urainadai & Samudhaya Thondu',
    macro: 'Tamil Arignargal (Scholars)',
    unit: 'Part A: General Tamil',
    patterns: [/உ.வே.சா/i, /மறைமலையடிகள்/i, /திரு.வி.க/i, /பெரியார்/i, /அண்ணா/i, /உரைநடை/i, /சமுதாயத் தொண்டு/i]
  },

  // ── Unit 5: Indian Polity ──
  {
    micro: 'Preamble, Citizenship, Union & Territories',
    macro: 'Constitution Basics',
    unit: 'Unit 5: Indian Polity',
    patterns: [/preamble/i, /citizenship/i, /union territory/i, /schedule/i, /article 1/i, /states reorganization/i]
  },
  {
    micro: 'Making of the Constitution & Salient Features',
    macro: 'Constitution Basics',
    unit: 'Unit 5: Indian Polity',
    patterns: [/constituent assembly/i, /dr ambedkar/i, /drafting committee/i, /constitution/i, /features of constitution/i]
  },
  {
    micro: 'Fundamental Rights',
    macro: 'Rights & Duties',
    unit: 'Unit 5: Indian Polity',
    patterns: [/fundamental right/i, /habeas corpus/i, /mandamus/i, /article 21/i, /article 19/i, /article 14/i, /article 32/i, /writ/i]
  },
  {
    micro: 'Fundamental Duties & Directive Principles (DPSP)',
    macro: 'Rights & Duties',
    unit: 'Unit 5: Indian Polity',
    patterns: [/directive principle/i, /dpsp/i, /fundamental duty/i, /article 51a/i, /welfare state/i]
  },
  {
    micro: 'Parliament & State Legislature',
    macro: 'Executive & Legislature',
    unit: 'Unit 5: Indian Polity',
    patterns: [/parliament/i, /lok sabha/i, /rajya sabha/i, /speaker/i, /bill/i, /money bill/i, /legislative assembly/i]
  },
  {
    micro: 'Union Executive (President, PM, Cabinet)',
    macro: 'Executive & Legislature',
    unit: 'Unit 5: Indian Polity',
    patterns: [/president/i, /prime minister/i, /cabinet/i, /vice-president/i, /ordinance/i]
  },
  {
    micro: 'State Executive (Governor, CM, Council)',
    macro: 'Executive & Legislature',
    unit: 'Unit 5: Indian Polity',
    patterns: [/governor/i, /chief minister/i, /council of ministers/i]
  },
  {
    micro: 'Supreme Court & High Courts',
    macro: 'Judiciary & Local Govt',
    unit: 'Unit 5: Indian Polity',
    patterns: [/supreme court/i, /high court/i, /judiciary/i, /chief justice/i, /judicial review/i]
  },
  {
    micro: 'Local Government (Panchayati Raj)',
    macro: 'Judiciary & Local Govt',
    unit: 'Unit 5: Indian Polity',
    patterns: [/panchayat/i, /municipality/i, /73rd amendment/i, /74th amendment/i, /gram sabha/i, /balwant rai/i]
  },
  {
    micro: 'Constitutional & Non-Constitutional Bodies (EC, CAG, UPSC)',
    macro: 'Judiciary & Local Govt',
    unit: 'Unit 5: Indian Polity',
    patterns: [/election commission/i, /cag/i, /comptroller/i, /upsc/i, /finance commission/i, /niti aayog/i]
  },

  // ── Unit 1: General Science ──
  {
    micro: 'Mechanics & Properties of Matter',
    macro: 'Physics',
    unit: 'Unit 1: General Science',
    patterns: [/newton/i, /force/i, /gravit/i, /motion/i, /friction/i, /viscosity/i, /elasticity/i, /pascal/i, /surface tension/i]
  },
  {
    micro: 'Light, Sound, Heat & Magnetism',
    macro: 'Physics',
    unit: 'Unit 1: General Science',
    patterns: [/optics/i, /light/i, /lens/i, /sound/i, /doppler/i, /heat/i, /temperature/i, /thermodynamics/i, /magnet/i, /current/i, /electric/i]
  },
  {
    micro: 'Universe & Solar System',
    macro: 'Physics',
    unit: 'Unit 1: General Science',
    patterns: [/solar system/i, /planet/i, /galaxy/i, /satellite/i, /isro/i, /universe/i, /chandrayaan/i, /orbit/i]
  },
  {
    micro: 'Elements, Compounds, Acids, Bases & Salts',
    macro: 'Chemistry',
    unit: 'Unit 1: General Science',
    patterns: [/acid/i, /base/i, /salt/i, /ph value/i, /element/i, /compound/i, /periodic table/i, /metal/i, /alloy/i]
  },
  {
    micro: 'Petroleum Products, Fertilizers & Pesticides',
    macro: 'Chemistry',
    unit: 'Unit 1: General Science',
    patterns: [/petroleum/i, /fertilizer/i, /pesticide/i, /urea/i, /polymer/i, /plastic/i]
  },
  {
    micro: 'Blood, Circulation & Human Body Systems',
    macro: 'Biology',
    unit: 'Unit 1: General Science',
    patterns: [/blood/i, /heart/i, /circulation/i, /brain/i, /nervous/i, /digest/i, /respirat/i, /kidney/i, /hormone/i]
  },
  {
    micro: 'Human Diseases (Causes & Cures)',
    macro: 'Biology',
    unit: 'Unit 1: General Science',
    patterns: [/disease/i, /virus/i, /bacteria/i, /vaccine/i, /infection/i, /malaria/i, /tuberculosis/i, /vitamin/i, /deficiency/i]
  },
  {
    micro: 'Main Concepts of Life Science & Classification',
    macro: 'Biology',
    unit: 'Unit 1: General Science',
    patterns: [/cell/i, /dna/i, /rna/i, /photosynthesis/i, /chlorophyll/i, /classification/i, /botany/i, /zoology/i]
  },
  {
    micro: 'Environment, Ecology & Diet',
    macro: 'Environment',
    unit: 'Unit 1: General Science',
    patterns: [/ecology/i, /environment/i, /pollution/i, /biodiversity/i, /ecosystem/i, /food chain/i, /nutrient/i, /diet/i]
  },

  // ── Unit 10: Aptitude & Mental Ability ──
  {
    micro: 'Simplification, LCM & HCF',
    macro: 'Quantitative Aptitude',
    unit: 'Unit 10: Aptitude',
    patterns: [/simplification/i, /lcm/i, /hcf/i, /bodmas/i, /square root/i]
  },
  {
    micro: 'Ratio & Proportion',
    macro: 'Quantitative Aptitude',
    unit: 'Unit 10: Aptitude',
    patterns: [/ratio/i, /proportion/i, /partnership/i]
  },
  {
    micro: 'Percentage, Simple & Compound Interest',
    macro: 'Quantitative Aptitude',
    unit: 'Unit 10: Aptitude',
    patterns: [/percentage/i, /simple interest/i, /compound interest/i, /profit and loss/i]
  },
  {
    micro: 'Area & Volume',
    macro: 'Quantitative Aptitude',
    unit: 'Unit 10: Aptitude',
    patterns: [/area/i, /volume/i, /perimeter/i, /cylinder/i, /sphere/i, /cone/i, /cube/i]
  },
  {
    micro: 'Time & Work',
    macro: 'Quantitative Aptitude',
    unit: 'Unit 10: Aptitude',
    patterns: [/time and work/i, /speed and distance/i, /pipe and cistern/i, /train/i]
  },
  {
    micro: 'Logical Reasoning & Puzzles',
    macro: 'Logical Reasoning',
    unit: 'Unit 10: Aptitude',
    patterns: [/logical reasoning/i, /puzzle/i, /blood relation/i, /direction/i, /seating arrangement/i]
  },
  {
    micro: 'Dice & Visual Reasoning',
    macro: 'Logical Reasoning',
    unit: 'Unit 10: Aptitude',
    patterns: [/dice/i, /cube reasoning/i, /mirror image/i, /water image/i, /visual/i]
  },
  {
    micro: 'Alpha-Numeric & Number Series',
    macro: 'Logical Reasoning',
    unit: 'Unit 10: Aptitude',
    patterns: [/series/i, /sequence/i, /coding decoding/i, /analogy/i, /odd man out/i]
  },

  // ── Unit 4: History & Culture ──
  {
    micro: 'Indus Valley Civilization',
    macro: 'Ancient India',
    unit: 'Unit 4: History & Culture',
    patterns: [/indus valley/i, /harappa/i, /mohenjodaro/i, /lothal/i, /great bath/i]
  },
  {
    micro: 'Guptas',
    macro: 'Ancient India',
    unit: 'Unit 4: History & Culture',
    patterns: [/gupta/i, /samudragupta/i, /chandragupta/i, /kalidasa/i, /aryabhata/i]
  },
  {
    micro: 'Delhi Sultanate',
    macro: 'Medieval India',
    unit: 'Unit 4: History & Culture',
    patterns: [/delhi sultanate/i, /alauddin khilji/i, /qutb minar/i, /tughlaq/i, /balban/i]
  },
  {
    micro: 'Mughals & Marathas',
    macro: 'Medieval India',
    unit: 'Unit 4: History & Culture',
    patterns: [/mughal/i, /akbar/i, /babur/i, /aurangzeb/i, /shivaji/i, /maratha/i, /peshwa/i]
  },
  {
    micro: 'Cholas, Pandyas, Pallavas',
    macro: 'South Indian History',
    unit: 'Unit 4: History & Culture',
    patterns: [/chola/i, /rajaraja/i, /rajendra/i, /pandya/i, /pallava/i, /mahabalipuram/i, /brihadisvara/i]
  },

  // ── Unit 7: National Movement ──
  {
    micro: 'Early Uprisings against British Rule (1857 Revolt)',
    macro: 'Early Uprisings',
    unit: 'Unit 7: National Movement',
    patterns: [/revolt of 1857/i, /sepoy mutiny/i, /manghal pandey/i, /rani laxmi bai/i, /vellore mutiny/i]
  },
  {
    micro: 'Indian National Congress Formation',
    macro: 'INC & Moderates',
    unit: 'Unit 7: National Movement',
    patterns: [/indian national congress/i, /a.o. hume/i, /w.c. bonnerjee/i, /moderates/i, /extremists/i, /surat split/i]
  },
  {
    micro: 'Non-Cooperation, Civil Disobedience, Quit India',
    macro: 'Gandhian Era',
    unit: 'Unit 7: National Movement',
    patterns: [/gandhi/i, /non-cooperation/i, /civil disobedience/i, /quit india/i, /dandi march/i, /chauri chaura/i]
  },

  // ── Unit 8: TN History & Culture ──
  {
    micro: 'Sangam Literature',
    macro: 'Ancient Tamilakam',
    unit: 'Unit 8: TN History & Culture',
    patterns: [/sangam/i, /tholkappiyam/i, /keeladi/i, /sangam literature/i]
  },
  {
    micro: 'Justice Party, Dravidian Movement & Periyar',
    macro: 'Social Movements',
    unit: 'Unit 8: TN History & Culture',
    patterns: [/justice party/i, /periyar/i, /self-respect/i, /dravidian/i, /c.n. annadurai/i]
  },

  // ── Unit 6: Indian Economy ──
  {
    micro: 'Nature of Indian Economy & Five Year Plans',
    macro: 'Nature of Economy',
    unit: 'Unit 6: Indian Economy',
    patterns: [/five year plan/i, /niti aayog/i, /planning commission/i, /gdp/i, /national income/i]
  },
  {
    micro: 'Reserve Bank of India (RBI) & Monetary Policy',
    macro: 'Finance & Banking',
    unit: 'Unit 6: Indian Economy',
    patterns: [/rbi/i, /reserve bank/i, /monetary policy/i, /repo rate/i, /inflation/i, /banking/i]
  },
  {
    micro: 'GST & Taxation',
    macro: 'Sectors of Economy',
    unit: 'Unit 6: Indian Economy',
    patterns: [/gst/i, /taxation/i, /direct tax/i, /indirect tax/i, /fiscal deficit/i]
  },

  // ── Unit 3: Geography of India ──
  {
    micro: 'Location & Physical Features of India',
    macro: 'Physical Geography',
    unit: 'Unit 3: Geography of India',
    patterns: [/himalaya/i, /peninsula/i, /western ghats/i, /eastern ghats/i, /coastal plain/i]
  },
  {
    micro: 'Monsoon, Rainfall & Weather Patterns',
    macro: 'Climate & Weather',
    unit: 'Unit 3: Geography of India',
    patterns: [/monsoon/i, /rainfall/i, /southwest monsoon/i, /northeast monsoon/i, /cyclone/i]
  },
  {
    micro: 'Water Resources & Rivers in India',
    macro: 'Water & Soil',
    unit: 'Unit 3: Geography of India',
    patterns: [/cauvery/i, /ganga/i, /brahmaputra/i, /godavari/i, /krishna/i, /dam/i, /river/i]
  }
]

// ─── 3. Question Classifier ──────────────────────────────────────────────────
/**
 * Classifies any question down to the Micro-Topic (Level 3), Macro-Topic (Level 2), and Unit (Level 1).
 * Enforces the Golden Rule: Every question MUST be tagged to a micro_topic.
 */
export function classifyQuestion(question = {}, paper = {}) {
  // If question already has an explicit micro topic matching our taxonomy, return it
  if (question.micro_topic_name || question.topic_name) {
    const rawTopic = (question.micro_topic_name || question.topic_name).trim()
    const found = FLAT_MICRO_TOPICS.find(
      t => t.micro_topic_name.toLowerCase() === rawTopic.toLowerCase()
    )
    if (found) {
      return {
        unit_name: found.unit_name,
        macro_topic_name: found.macro_topic_name,
        micro_topic_name: found.micro_topic_name,
        unit_number: found.unit_number,
        subject: found.unit_name.includes('Tamil') ? 'General Tamil' : (found.unit_name.includes('English') ? 'General English' : 'General Studies'),
        exam_group: found.exam_group,
      }
    }
  }

  // Combine text for matching
  const fullText = [
    question.question_text || '',
    question.question_text_tamil || '',
    question.explanation || '',
    question.option_a || '',
    question.option_b || '',
    question.option_c || '',
    question.option_d || '',
  ].join(' ')

  const isTamil = /[\u0B80-\u0BFF]/.test(fullText) || (paper?.subject && paper.subject.toLowerCase().includes('tamil'))

  // 1. Try to match against explicit micro patterns
  for (const rule of MICRO_CLASSIFICATION_RULES) {
    if (rule.patterns.some(p => p.test(fullText))) {
      const match = FLAT_MICRO_TOPICS.find(t => t.micro_topic_name === rule.micro)
      if (match) {
        return {
          unit_name: match.unit_name,
          macro_topic_name: match.macro_topic_name,
          micro_topic_name: match.micro_topic_name,
          unit_number: match.unit_number,
          subject: match.unit_name.includes('Tamil') ? 'General Tamil' : 'General Studies',
          exam_group: match.exam_group,
        }
      }
    }
  }

  // 2. Fallbacks respecting Tamil vs General Studies
  if (isTamil) {
    const tamilFallback = FLAT_MICRO_TOPICS.find(t => t.micro_topic_name === 'Poruthuthal & Pirithu Ezhudhuthal')
    return {
      unit_name: tamilFallback.unit_name,
      macro_topic_name: tamilFallback.macro_topic_name,
      micro_topic_name: tamilFallback.micro_topic_name,
      unit_number: tamilFallback.unit_number,
      subject: 'General Tamil',
      exam_group: 'GROUP_2_AND_4'
    }
  }

  // General Studies fallback: Unit 5 Constitution Basics
  const gsFallback = FLAT_MICRO_TOPICS.find(t => t.micro_topic_name === 'Making of the Constitution & Salient Features')
  return {
    unit_name: gsFallback.unit_name,
    macro_topic_name: gsFallback.macro_topic_name,
    micro_topic_name: gsFallback.micro_topic_name,
    unit_number: gsFallback.unit_number,
    subject: 'General Studies',
    exam_group: 'ALL_GROUPS'
  }
}

// ─── 4. Hierarchy Getter for Specific Exam Groups ────────────────────────────
/**
 * Returns the 3-tier hierarchy applicable to the specified exam:
 *  - TNPSC Group 1: 10 General Studies Units
 *  - TNPSC Group 2 / 4: Part A (Language: General Tamil / General English) + 10 General Studies Units
 */
export function getSyllabusHierarchy(examName = 'TNPSC Group 4', languageOption = 'tamil') {
  const isGroup1 = examName?.toLowerCase().includes('group 1')
  const gsUnits = TNPSC_TAXONOMY.filter(u => u.exam_group === 'ALL_GROUPS')

  if (isGroup1) {
    return gsUnits
  }

  // For Group 2 & 4: include Language Paper (Part A)
  const languageUnit = languageOption === 'english'
    ? TNPSC_TAXONOMY.find(u => u.unit_name === 'Part A: General English')
    : TNPSC_TAXONOMY.find(u => u.unit_name === 'Part A: General Tamil')

  const languageUnits = languageUnit ? [languageUnit] : []
  return [...languageUnits, ...gsUnits]
}

// ─── 5. Mathematical Roll-Up Calculator ──────────────────────────────────────
/**
 * Computes roll-up progress:
 *   - Micro-Topic: calculates mastery/accuracy based on user attempts or manual status
 *   - Macro-Topic: mathematical average of all Micro-Topics in that category
 *   - Unit: mathematical average of all Macro-Topics in that unit
 *   - Overall: mathematical average of all Units
 */
export function calculateSyllabusRollup(hierarchy = [], microProgressMap = {}) {
  let totalUnitScore = 0

  const calculatedUnits = hierarchy.map(unit => {
    let totalMacroScore = 0

    const calculatedMacros = (unit.macro_topics || []).map(macro => {
      let totalMicroScore = 0

      const calculatedMicros = (macro.micro_topics || []).map(microName => {
        const prog = microProgressMap[microName] || {}
        let score = 0
        let status = 'not_started'

        if (prog.attempted && prog.attempted > 0) {
          const acc = Math.round((prog.correct / prog.attempted) * 100)
          score = acc
          status = acc >= 70 ? 'completed' : (acc < 50 ? 'needs_revision' : 'in_progress')
        } else if (prog.status) {
          status = prog.status
          score = prog.score !== undefined ? prog.score : (status === 'completed' ? 85 : status === 'in_progress' ? 60 : status === 'needs_revision' ? 35 : 0)
        } else if (prog.score !== undefined) {
          score = prog.score
          status = score >= 70 ? 'completed' : (score < 50 ? 'needs_revision' : 'in_progress')
        } else {
          // Default baseline estimate if untouched
          score = unit.unit_number === 8 ? 31 : (unit.unit_number === 5 ? 46 : 65)
          status = score >= 70 ? 'completed' : (score < 50 ? 'needs_revision' : 'in_progress')
        }

        totalMicroScore += score
        return {
          micro_topic_name: microName,
          score,
          status,
          attempted: prog.attempted || 0,
          correct: prog.correct || 0,
        }
      })

      const macroCount = calculatedMicros.length || 1
      const macroScore = Math.round(totalMicroScore / macroCount)
      totalMacroScore += macroScore

      return {
        macro_topic_name: macro.macro_topic_name,
        score: macroScore,
        micro_topics: calculatedMicros,
      }
    })

    const macroCount = calculatedMacros.length || 1
    const unitScore = Math.round(totalMacroScore / macroCount)
    totalUnitScore += unitScore

    return {
      ...unit,
      score: unitScore,
      macro_topics: calculatedMacros,
    }
  })

  const unitCount = calculatedUnits.length || 1
  const overallMastery = Math.round(totalUnitScore / unitCount)
  const strongUnits = calculatedUnits.filter(u => u.score >= 65).length
  const needsRevision = calculatedUnits.filter(u => u.score <= 55).length

  return {
    units: calculatedUnits,
    overallMastery,
    strongUnits,
    needsRevision,
    unitsCovered: `${calculatedUnits.length} / ${calculatedUnits.length}`,
  }
}

// ─── 6. Micro-Topic X-Ray Diagnostic Engine ──────────────────────────────────
/**
 * Evaluates performance down to the exact chapter for Master Analytics.
 * Generates specific diagnostic observations:
 * "You are strong in Biology (Macro), but failing Universe & Solar System (Micro)."
 */
export function calculateMicroTopicXRay(attempts = []) {
  const microStats = {}

  attempts.forEach(attempt => {
    if (!Array.isArray(attempt.attempt_answers)) return
    attempt.attempt_answers.forEach(ans => {
      const q = ans.questions || {}
      const classification = classifyQuestion(q, attempt.papers)
      const key = classification.micro_topic_name

      if (!microStats[key]) {
        microStats[key] = {
          micro_topic_name: classification.micro_topic_name,
          macro_topic_name: classification.macro_topic_name,
          unit_name: classification.unit_name,
          attempted: 0,
          correct: 0,
        }
      }

      microStats[key].attempted += 1
      const isCorrect = ans.is_correct ?? (Boolean(ans.selected_option) && ans.selected_option === q.correct_option)
      if (isCorrect) microStats[key].correct += 1
    })
  })

  // Compute accuracy per micro topic
  const list = Object.values(microStats).map(item => ({
    ...item,
    accuracy: item.attempted > 0 ? Math.round((item.correct / item.attempted) * 100) : 0,
  }))

  // Macro-level aggregations
  const macroStats = {}
  list.forEach(m => {
    if (!macroStats[m.macro_topic_name]) {
      macroStats[m.macro_topic_name] = {
        macro_topic_name: m.macro_topic_name,
        unit_name: m.unit_name,
        attempted: 0,
        correct: 0,
        microTopics: [],
      }
    }
    macroStats[m.macro_topic_name].attempted += m.attempted
    macroStats[m.macro_topic_name].correct += m.correct
    macroStats[m.macro_topic_name].microTopics.push(m)
  })

  const macroList = Object.values(macroStats).map(mac => ({
    ...mac,
    accuracy: mac.attempted > 0 ? Math.round((mac.correct / mac.attempted) * 100) : 0,
  }))

  // Diagnostic insights (X-Ray Findings)
  const findings = []
  macroList.forEach(mac => {
    // If macro accuracy is good (>= 60%), but there is a failing micro topic (< 50%)
    if (mac.accuracy >= 60) {
      const failingMicro = mac.microTopics.find(mic => mic.attempted >= 2 && mic.accuracy < 50)
      if (failingMicro) {
        findings.push({
          type: 'targeted_weakness',
          macro: mac.macro_topic_name,
          macroAccuracy: mac.accuracy,
          micro: failingMicro.micro_topic_name,
          microAccuracy: failingMicro.accuracy,
          unit: mac.unit_name,
          message: `You are strong in ${mac.macro_topic_name} (${mac.accuracy}%), but failing ${failingMicro.micro_topic_name} (${failingMicro.accuracy}%).`
        })
      }
    }
  })

  return {
    microTopics: list.sort((a, b) => b.attempted - a.attempted),
    macroTopics: macroList.sort((a, b) => b.attempted - a.attempted),
    findings,
  }
}
