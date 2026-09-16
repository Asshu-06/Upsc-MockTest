"""
UPSC Question Paper Structure Parser
Transforms extracted question paper text into JSON formatted for bulk platform import.
"""

import sys
import os
import json
import re

def parse_questions_from_text(txt_content):
    """
    Regex pattern parser for standard UPSC objective questions.
    Expects patterns like:
    1. Question text...
    (a) Option A
    (b) Option B
    (c) Option C
    (d) Option D
    """
    questions = []
    
    # Split text by question numbers: e.g. "1.", "2.", "Q1.", etc.
    q_blocks = re.split(r'\n(?=\d{1,3}\.\s)', txt_content)

    for block in q_blocks:
        block = block.strip()
        if not block:
            continue

        match_num = re.match(r'^(\d{1,3})\.\s*(.*)', block, re.DOTALL)
        if not match_num:
            continue

        q_num = int(match_num.group(1))
        q_body = match_num.group(2)

        # Look for options (a), (b), (c), (d) or (A), (B), (C), (D)
        opt_pattern = r'\(([a-dA-D])\)\s*([^(\n]+(?:\n(?!\([a-dA-D]\)).*)*)'
        options = re.findall(opt_pattern, q_body)

        option_dict = {'A': '', 'B': '', 'C': '', 'D': ''}
        q_text = q_body

        if len(options) >= 4:
            # Extract question text before the first option
            first_opt_pos = re.search(r'\([a-dA-D]\)', q_body)
            if first_opt_pos:
                q_text = q_body[:first_opt_pos.start()].strip()

            for key, val in options[:4]:
                k_upper = key.upper()
                option_dict[k_upper] = val.strip().replace('\n', ' ')

        questions.append({
            "question_number": q_num,
            "question_text": q_text.strip(),
            "option_a": option_dict['A'],
            "option_b": option_dict['B'],
            "option_c": option_dict['C'],
            "option_d": option_dict['D'],
            "correct_option": "A", # Default fallback for review in Admin preview
            "explanation": ""
        })

    return questions

def convert_txt_to_json(txt_file, json_output_file):
    if not os.path.exists(txt_file):
        print(f"Error: Text file not found at {txt_file}")
        return

    with open(txt_file, "r", encoding="utf-8") as f:
        content = f.read()

    questions = parse_questions_from_text(content)

    with open(json_output_file, "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"Parsed {len(questions)} questions into JSON file: {json_output_file}")
    print("Please review and verify correct_option and explanation fields in Admin Importer before publishing.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parser.py <extracted_text_file> [output_json_file]")
        sys.exit(1)

    txt_in = sys.argv[1]
    json_out = sys.argv[2] if len(sys.argv) > 2 else "questions_import.json"
    convert_txt_to_json(txt_in, json_out)
