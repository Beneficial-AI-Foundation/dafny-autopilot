import re
import argparse


def extract_code_from_llm_output(reply):
    i = reply.find("<answer>")
    if i != -1:
        reply = reply[i + 8 :]
        i = reply.find("</answer>")
        reply = reply[:i]
        return reply
    i = reply.find("```dafny")
    if i != -1:
        reply = reply[i + 8 :]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    i = reply.find("```Dafny")
    if i != -1:
        reply = reply[i + 8 :]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    i = reply.find("```")
    if i != -1:
        reply = reply[i + 3 :]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    return reply


def save_extracted_code(extracted_code, file_path):
    with open(file_path, "w") as f:
        f.write(extracted_code)
    return file_path


def run_dafny(program, file_path, dafny_path):
    import subprocess

    dafny_file = save_extracted_code(program, file_path)
    try:
        s = subprocess.run(
            f"{dafny_path} verify \"{dafny_file}\" --allow-warnings",
            shell=True,
            capture_output=True,
            timeout=15,
        )
    except Exception as e:
        return "", str(e)
    return str(s.stdout), str(s.stderr)


def check_no_cheating(body, body_reconstructed):
    spec_orig, spec_llm = [], []
    in_doc, in_doc_hints = False, False

    for line in body.split("\n"):
        if line.strip().startswith("/*"):
            in_doc = not in_doc
        is_comment = line.strip().startswith("//")
        if ("requires" in line or "ensures" in line) and (not in_doc) and (not is_comment):
            spec_orig.append(line.strip().replace(" ", ""))
        if line.strip().endswith("*/"):
            in_doc = not in_doc

    for line_hints in body_reconstructed.split("\n"):
        if line_hints.strip().startswith("/*"):
            in_doc_hints = not in_doc_hints
        is_comment_hints = line_hints.strip().startswith("//")
        if ("requires" in line_hints or "ensures" in line_hints) and (not in_doc_hints) and (not is_comment_hints):
            spec_llm.append(line_hints.strip().replace(" ", ""))
        if line_hints.strip().endswith("*/"):
            in_doc_hints = not in_doc_hints

    spec_preserved = all(spec in spec_llm for spec in spec_orig)  # Given spec should be a subset of LLM spec
    no_avoid_verify = not '{:verify false}' in body_reconstructed and not 'assume false' in body_reconstructed
    error_msg = ""
    if not spec_preserved:
        error_msg += "\nLLM fails to exactly preserve preconditions and/or postconditions from input program."
    if not no_avoid_verify:
        error_msg += "\nLLM cheats by using {:verify false} or assume false."
    return error_msg


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Dafny verifier on LLM output")
    parser.add_argument("file_path", type=str, help="Path to input Dafny program")
    parser.add_argument("new_file_path", type=str, help="Path to LLM output program")
    parser.add_argument("dafny_path", type=str, help="Path to Dafny executable")

    args = parser.parse_args()
    file_path = args.file_path
    new_file_path = args.new_file_path
    dafny_path = args.dafny_path

    llm_output = open(new_file_path, "r").read()
    body_with_hints = extract_code_from_llm_output(llm_output)
    save_extracted_code(body_with_hints, new_file_path)

    out, _ = run_dafny(body_with_hints, new_file_path, dafny_path)
    print(out)

    input_program = open(file_path, "r").read()
    print(check_no_cheating(input_program, body_with_hints))
