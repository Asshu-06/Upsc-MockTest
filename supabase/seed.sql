-- Seed SQL for UPSC Prelims Previous Year Paper Practice Platform

-- Sample Published UPSC Prelims 2023 Paper
INSERT INTO public.papers (
    id,
    title,
    exam_name,
    exam_type,
    year,
    subject,
    description,
    duration_minutes,
    total_questions,
    maximum_marks,
    marks_per_question,
    negative_marking,
    status
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'UPSC Civil Services Prelims 2023 - General Studies Paper I',
    'UPSC CSE Prelims',
    'Prelims',
    2023,
    'General Studies',
    'Official UPSC Civil Services (Preliminary) Examination 2023 General Studies Paper I containing standard objective questions across Polity, History, Economy, and Environment.',
    120,
    10,
    20.0,
    2.0,
    0.66,
    'published'
) ON CONFLICT (id) DO NOTHING;

-- Sample Questions for Paper 2023
INSERT INTO public.questions (
    paper_id,
    question_number,
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation
) VALUES
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    1,
    'Consider the following statements regarding the Preamble of the Constitution of India:\n1. It is based on the Objective Resolution moved by Jawaharlal Nehru in 1946.\n2. It has been amended only once by the 42nd Constitutional Amendment Act, 1976.\nWhich of the statements given above is/are correct?',
    '1 only',
    '2 only',
    'Both 1 and 2',
    'Neither 1 nor 2',
    'C',
    'Both statements are correct. The Preamble is based on Nehru''s Objective Resolution of 1946 and was amended once by the 42nd Amendment Act in 1976, adding "Socialist", "Secular", and "Integrity".'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    2,
    'In the context of Indian economy, which of the following best describes the term "Capital Adequacy Ratio (CAR)"?',
    'The amount of funds a bank has to keep with the RBI in the form of cash reserves.',
    'The ratio of a bank''s capital to its risk-weighted assets.',
    'The minimum interest rate fixed by RBI below which banks cannot lend.',
    'The percentage of deposits that banks must invest in government securities.',
    'B',
    'Capital Adequacy Ratio (CAR), also known as Capital to Risk-Weighted Assets Ratio (CRAR), is a measurement of a bank''s available capital expressed as a percentage of a bank''s risk-weighted credit exposures.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    3,
    'With reference to the Indian Parliament, consider the following statements:\n1. A Money Bill can be introduced only in the Lok Sabha.\n2. The Rajya Sabha has no power to reject or amend a Money Bill.\nWhich of the statements given above is/are correct?',
    '1 only',
    '2 only',
    'Both 1 and 2',
    'Neither 1 nor 2',
    'C',
    'Under Article 109 of the Constitution of India, a Money Bill can only be introduced in the Lok Sabha. Rajya Sabha cannot reject or amend it; it can only make recommendations within 14 days.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    4,
    'Which one of the following national parks is unique in being a swamp with floating vegetation that supports a rich biodiversity?',
    'Bhitarkanika National Park',
    'Keibul Lamjao National Park',
    'Keoladeo Ghana National Park',
    'Sultanpur National Park',
    'B',
    'Keibul Lamjao National Park in Manipur is the world''s only floating national park, located on Loktak Lake, famous for its floating phumdis and the endangered Sangai deer.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    5,
    'Which one of the following reflects the most appropriate relationship between Law and Liberty?',
    'If there are more laws, there is less liberty.',
    'If there are no laws, there is no liberty.',
    'If there is liberty, laws have to be made by the people.',
    'If laws are changed too often, liberty is in danger.',
    'B',
    'As famously noted by John Locke: "Where there is no law, there is no freedom." Laws create the protective framework that guarantees and preserves individual liberty.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    6,
    'Consider the following statements regarding the Monetary Policy Committee (MPC):\n1. It is a 6-member committee constituted under the RBI Act, 1934.\n2. The RBI Governor acts as the ex-officio Chairman of the MPC.\nWhich of the statements given above is/are correct?',
    '1 only',
    '2 only',
    'Both 1 and 2',
    'Neither 1 nor 2',
    'C',
    'The MPC consists of 6 members (3 from RBI, 3 appointed by Central Govt) under Section 45ZB of RBI Act, 1934. The RBI Governor is its ex-officio Chairman.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    7,
    'Which of the following pollutants are considered in computing the National Air Quality Index (AQI) in India?\n1. Carbon Monoxide\n2. Nitrogen Dioxide\n3. Ozone\n4. Methane\nSelect the correct answer using the code given below:',
    '1, 2 and 3 only',
    '1 and 4 only',
    '2 and 3 only',
    '1, 2, 3 and 4',
    'A',
    'India''s National AQI considers 8 pollutants: PM2.5, PM10, NO2, SO2, CO, O3, NH3, and Pb. Methane (CH4) is a greenhouse gas but is NOT one of the 8 criteria pollutants for AQI.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    8,
    'The term "Western Disturbances", which frequently brings winter precipitation to North-West India, originates over which of the following regions?',
    'Bay of Bengal',
    'Arabian Sea',
    'Mediterranean Sea',
    'Indian Ocean',
    'C',
    'Western Disturbances are extra-tropical storms originating in the Mediterranean region that bring sudden winter rain to the northwestern parts of the Indian subcontinent.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    9,
    'Who among the following was the founder of the Servants of India Society in 1905?',
    'Lala Lajpat Rai',
    'Gopal Krishna Gokhale',
    'Bal Gangadhar Tilak',
    'Bipin Chandra Pal',
    'B',
    'The Servants of India Society was formed in Pune, Maharashtra, on June 12, 1905, by Gopal Krishna Gokhale to unite and train Indians of different castes and religions in welfare work.'
),
(
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    10,
    'Consider the following rivers:\n1. Brahmani\n2. Nagavali\n3. Subarnarekha\n4. Vamsadhara\nWhich of the above rise from the Eastern Ghats?',
    '1 and 2',
    '2 and 4',
    '3 and 4',
    '1 and 3',
    'B',
    'Nagavali and Vamsadhara rivers originate in the Eastern Ghats (Odisha). Brahmani originates from Chota Nagpur Plateau and Subarnarekha originates near Ranchi.'
)
ON CONFLICT (paper_id, question_number) DO NOTHING;
