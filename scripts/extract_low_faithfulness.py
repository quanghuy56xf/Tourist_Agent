import json
import os

def extract_low_faithfulness():
    json_path = r"d:\ai_project\C2-App-060\docs\reports\ragas_golden_70_results.json"
    md_path = r"d:\ai_project\C2-App-060\docs\reports\ragas_low_faithfulness_cases.md"

    if not os.path.exists(json_path):
        print(f"Error: Could not find {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_faithfulness = data.get('targets', {}).get('faithfulness', 0.85)
    cases = data.get('cases', [])
    case_scores = data.get('case_scores', [])

    # Map scores by case index just in case they are out of order
    scores_by_index = {cs['case_index']: cs['scores'] for cs in case_scores}

    low_cases = []
    for i, case in enumerate(cases):
        scores = scores_by_index.get(i)
        if not scores:
            continue
        
        faithfulness = scores.get('faithfulness')
        if faithfulness is not None and faithfulness < target_faithfulness:
            low_cases.append({
                'index': i,
                'question': case.get('question', ''),
                'answer': case.get('answer', ''),
                'faithfulness': faithfulness,
                'contexts': case.get('contexts', []),
                'scope': case.get('scope', 'unknown')
            })

    print(f"Found {len(low_cases)} cases with faithfulness < {target_faithfulness}")

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f"# RAGAS Low Faithfulness Cases (Target: {target_faithfulness})\n\n")
        f.write(f"Total cases found: {len(low_cases)}\n\n")
        
        for case in low_cases:
            f.write(f"## Case #{case['index']} (Scope: {case['scope']})\n")
            f.write(f"**Faithfulness Score:** `{case['faithfulness']}`\n\n")
            f.write(f"**Question:**\n> {case['question']}\n\n")
            f.write(f"**Answer:**\n{case['answer']}\n\n")
            f.write("**Contexts:**\n")
            for j, ctx in enumerate(case['contexts'], 1):
                f.write(f"- [Context {j}]: {ctx}\n")
            f.write("\n---\n\n")

    print(f"Saved markdown report to {md_path}")

if __name__ == '__main__':
    extract_low_faithfulness()
