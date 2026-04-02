import glob
import re

files = glob.glob('src/content/blog/离散/*.md')

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()

    content = re.sub(r'<p>\s*(\$\$.*?\$\$)\s*</p>', r'\1', content, flags=re.DOTALL)
    
    content = re.sub(r'>\s*!\[.*?\]\(.*?\)[ \t]*\n', r'> \n', content)
    content = re.sub(r'>\s*!\[.*?\]\(.*?\)', r'> ', content)

    # Need careful negative lookahead so we don't mess up $$
    content = re.sub(r'([A-Za-z0-9\u4e00-\u9fa5])\$(?!\$)', r'\1 $', content)
    content = re.sub(r'(?<!\$)\$([A-Za-z0-9\u4e00-\u9fa5])', r'$ \1', content)

    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    print("Formatted " + f)
