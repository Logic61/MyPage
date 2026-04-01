import glob
import re

files = glob.glob('src/**/*.astro', recursive=True)

patterns = [
    (r'href="/blog"', r'href="/MyPage/blog"'),
    (r'href="/projects"', r'href="/MyPage/projects"'),
    (r'href="/en/blog"', r'href="/MyPage/en/blog"'),
    (r'href="/en"', r'href="/MyPage/en"'),
    (r'href="\/"', r'href="/MyPage/"'),
    
    (r'href=\{isEn \? "\/en" : "\/"\}', r'href={isEn ? "/MyPage/en" : "/MyPage/"}'),
    (r'href=\{isEn \? "\/en\/blog" : "\/blog"\}', r'href={isEn ? "/MyPage/en/blog" : "/MyPage/blog"}'),
    (r'href=\{isEn \? "\/en\/projects" : "\/projects"\}', r'href={isEn ? "/MyPage/en/projects" : "/MyPage/projects"}'),
    
    (r'href=\{`\/blog\/\$\{post\.id\}`\}', r'href={`/MyPage/blog/${post.id}`}'),
    (r'href=\{`\/en\/blog\/\$\{post\.id\}`\}', r'href={`/MyPage/en/blog/${post.id}`}'),
    
    (r'href="/favicon.svg"', r'href="/MyPage/favicon.svg"'),
    (r'href="/favicon.ico"', r'href="/MyPage/favicon.ico"'),
    
    # also fetch('/api/search.json') in Navigation.astro
    (r'fetch\(' + r"'/api/search\.json'\)", r"fetch('/MyPage/api/search.json')")
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for old, new in patterns:
        new_content = re.sub(old, new, new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")
