import re
import argparse
import subprocess
from typing import Tuple, Optional


def extract_code_from_llm_output(reply: str) -> str:
    i = reply.find("<answer>")
    if i != -1:
        reply = reply[i + 8:]
        i = reply.find("</answer>")
        reply = reply[:i]
        return reply
    i = reply.find("```dafny")
    if i != -1:
        reply = reply[i + 8:]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    i = reply.find("```Dafny")
    if i != -1:
        reply = reply[i + 8:]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    i = reply.find("```")
    if i != -1:
        reply = reply[i + 3:]
        i = reply.find("```")
        reply = reply[:i]
        return reply
    return reply


def save_extracted_code(extracted_code: str, file_path: str) -> str:
    with open(file_path, "w") as f:
        f.write(extracted_code)
    return file_path


def parse_dafny_output(output: str) -> Tuple[int, int, str]:
    """Parse Dafny output to extract error and warning counts."""
    error_count = len(re.findall(r"Error[^s]", output))  # Count "Error:" but not "Errors:"
    warning_count = len(re.findall(r"Warning[^s]", output))  # Count "Warning:" but not "Warnings:"
    return error_count, warning_count, output


def run_dafny(program: str, file_path: str, dafny_path: str) -> Tuple[str, str]:
    dafny_file = save_extracted_code(program, file_path)
    try:
        # Run Dafny with updated command line arguments
        result = subprocess.run(
            f'{dafny_path} verify "{dafny_file}" --allow-warnings',
            shell=True,
            capture_output=True,
            text=True,  # Use text mode instead of bytes
            timeout=60
        )
        
        # Combine stdout and stderr for error detection
        full_output = result.stdout + result.stderr
        
        # Parse the output
        error_count, warning_count, parsed_output = parse_dafny_output(full_output)
        
        # Format the verification result message
        output_message = f"Dafny verification output:\n\n{parsed_output}\n"
        status_message = f"\nErrors: {error_count}, Warnings: {warning_count}"
        
        if error_count > 0:
            status_message += "\nVerification failed with errors"
        elif warning_count > 0:
            status_message += "\nVerification completed with warnings"
        else:
            status_message += "\nVerification successful"
            
        return output_message + status_message, result.stderr
        
    except subprocess.TimeoutExpired:
        return "Verification timed out after 60 seconds", "Timeout error"
    except Exception as e:
        return "", f"Error running Dafny: {str(e)}"


def check_no_cheating(body: str, body_reconstructed: str) -> str:
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

    spec_preserved = all(spec in spec_llm for spec in spec_orig)
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
    
    try:
        llm_output = open(args.new_file_path, "r").read()
        body_with_hints = extract_code_from_llm_output(llm_output)
        save_extracted_code(body_with_hints, args.new_file_path)

        stdout, stderr = run_dafny(body_with_hints, args.new_file_path, args.dafny_path)
        print(stdout)
        if stderr:
            print("\nError output:", stderr)

        input_program = open(args.file_path, "r").read()
        cheating_check = check_no_cheating(input_program, body_with_hints)
        if cheating_check:
            print(cheating_check)
            
    except Exception as e:
        print(f"Error: {str(e)}")