import glob
import os
import re

updates = {
    "数学随笔0.md": {"title": "数学随笔0：关于数学学习的思考", "desc": "时感学数学如隔雾看花，终究隔一层。开坑写写随笔，借此沉淀经验与建立思维库。"},
    "数学随笔1.md": {"title": "数学随笔1：添行与合成大矩阵", "desc": "主要介绍构造矩阵的想法，包括如何利用添行来计算复杂的行列式，以及Vandermonde行列式的简单推导。"},
    "数学随笔2.md": {"title": "数学随笔2：分块矩阵的行列式", "desc": "整理分块矩阵的行列式求解策略，利用高斯消元形成三角阵从而转化为易于计算的形式。"},
    "数学随笔3.md": {"title": "数学随笔3：基底思想与线性映射", "desc": "高中便强调的基底思想在线代中同样重要，通过基扩充定理将抽象的线性映射化为具象的研究对象。"},
    "数学随笔4.md": {"title": "数学随笔4：伴随矩阵相关性质", "desc": "伴随矩阵的重要推导及相关整理：通过代数余子式的正交性得出伴随矩阵和逆矩阵的运算关系。"},
    "数学随笔5.md": {"title": "数学随笔5：柯西不等式的证明构造", "desc": "巧妙利用非负性结合二次函数判别式，完成经典Cauchy不等式的严格证明。"},
    "数学随笔6.md": {"title": "数学随笔6：矩阵的LU分解", "desc": "基于高斯消元法的变形，展示如何在消元过程中同时构造下三角矩阵L和上三角矩阵U。"},
    "数学随笔7.md": {"title": "数学随笔7：Vandermonde行列式与特征子空间", "desc": "通过Vandermonde行列式的神秘出场，探究不同特征子空间的独立性与直和性质。"},
    "数学随笔8.md": {"title": "数学随笔8：线代中的归纳法运用", "desc": "数学归纳法在线性代数中的巧妙实践，用于推导证明实对称矩阵必可正交对角化。"},
    "数学随笔9.md": {"title": "数学随笔9：行列式与矩阵特征值", "desc": "跨越行列式繁琐的原始定义，探究将行列式的计算转化为矩阵对角化以及特征值的乘积。"},
    "数学随笔10.md": {"title": "数学随笔10：稠密性论证", "desc": "介绍稠密性论证这一核心范式：先在一个“好”的稠密子集上证明，再利用连续性或极限推广到一般情形。"},
    "数学随笔11.md": {"title": "数学随笔11：奇异值分解(SVD)", "desc": "The Singular Value Decomposition is a highlight of linear algebra. 浅探如何巧妙拆解一个任意矩阵。"},
    "数学随笔12.md": {"title": "数学随笔12：不变量与极值状态证明", "desc": "以3×3华容道为例：如果合法操作不改变系统的某个不变量，那么与其特征不同的末状态必定无法到达。"},
    "数学随笔13.md": {"title": "数学随笔13：算两次思想在组合数学上的应用", "desc": "在组合数学中采用“算两次”思想推导各种恒等式，理解分配组合和分组选择。"},
    "数学随笔14 带余除法.md": {"title": "数学随笔14：多项式带余除法", "desc": "关于多项式带余除法的一些补充和思考（整理中）。"}
}

files = glob.glob('src/content/blog/数学随笔/*.md')

for filepath in files:
    filename = os.path.basename(filepath)
    if filename not in updates:
        continue
        
    info = updates[filename]
    new_title = info["title"]
    new_desc = info["desc"]

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if not match:
        continue
    
    frontmatter, body = match.groups()
    lines = frontmatter.strip().split('\n')
    
    fm_dict = {}
    current_key = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if ':' in line and not line.startswith('- '):
            k, v = line.split(':', 1)
            fm_dict[k.strip()] = v.strip()
            current_key = k.strip()
        elif line.startswith('- ') and current_key:
            val = line[2:].strip()
            if isinstance(fm_dict[current_key], list):
                fm_dict[current_key].append(val)
            else:
                fm_dict[current_key] = [fm_dict[current_key], val]
                
    # Update title and description
    fm_dict['title'] = f'"{new_title}"'
    fm_dict['description'] = f'"{new_desc}"'
    
    # Rebuild frontmatter
    new_lines = []
    # Force order roughly
    order = ['title', 'description', 'pubDate', 'category', 'pinned', 'tags']
    for k in order:
        if k in fm_dict:
            new_lines.append(f"{k}: {fm_dict[k]}")
    for k, v in fm_dict.items():
        if k not in order:
            new_lines.append(f"{k}: {v}")
            
    new_fm = "\n".join(new_lines)
    new_content = f"---\n{new_fm}\n---\n{body.lstrip()}"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filename}")
