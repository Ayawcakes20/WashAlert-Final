import re
import sys

def check_tags(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'{\/\*.*?\*\/}', '', content, flags=re.DOTALL)
    
    # Find tags. Ignore self-closing tags like <br />, <img ... />
    # Also ignore component tags that are self-closing like <Button ... />
    
    # Regex to find all tags
    # Group 1: Opening tag name
    # Group 2: Closing tag name
    # Group 3: Self-closing tag suffix
    tag_pattern = re.compile(r'<([a-zA-Z0-9]+)[^>]*?(\/?)>|<\/([a-zA-Z0-9]+)>')
    
    stack = []
    for m in tag_pattern.finditer(content):
        open_name, self_close, close_name = m.groups()
        
        if open_name:
            if self_close == '/':
                continue
            # List of standard HTML self-closing tags
            if open_name.lower() in ['img', 'br', 'hr', 'input', 'link', 'meta', 'col']:
                continue
            stack.append((open_name, content.count('\n', 0, m.start()) + 1))
        elif close_name:
            if not stack:
                print(f"Unmatched closing tag </{close_name}> at line {content.count('\n', 0, m.start()) + 1}")
                continue
            last_tag, line_num = stack.pop()
            if last_tag != close_name:
                print(f"Mismatch: <{last_tag}> (line {line_num}) closed by </{close_name}> at line {content.count('\n', 0, m.start()) + 1}")

    if stack:
        print(f"Unclosed tags:")
        for t, l in stack:
            print(f"  <{t}> at line {l}")
    else:
        print("Tags seem balanced (simplified check)")

check_tags(sys.argv[1])
