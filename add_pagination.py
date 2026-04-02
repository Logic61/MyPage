with open('src/pages/blog.astro', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('<script>')

new_script = """<script>
  const buttons = document.querySelectorAll('.category-btn');
  const postElements = Array.from(document.querySelectorAll('.post-item'));
  
  let paginationContainer = document.getElementById('pagination-container');
  if(!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'pagination-container';
    paginationContainer.className = 'mt-12';
    document.querySelector('.space-y-12').after(paginationContainer);
  }

  const POSTS_PER_PAGE = 8;
  let currentPage = 1;
  let currentCategory = 'all';

  function renderPosts() {
    const filteredPosts = postElements.filter(post => 
      currentCategory === 'all' || post.dataset.category === currentCategory
    );
    
    const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = 1;
    
    postElements.forEach(post => post.style.display = 'none');
    
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    filteredPosts.slice(startIndex, endIndex).forEach(post => {
      post.style.display = 'block';
    });
    
    renderPaginationControls(totalPages);
  }

  function renderPaginationControls(totalPages) {
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    let html = `<div class="flex justify-center items-center gap-4">`;
    
    if (currentPage > 1) {
      html += `<button id="prev-page" class="px-5 py-2 rounded-full border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">&larr;</button>`;
    } else {
      html += `<button disabled class="px-5 py-2 rounded-full border bg-slate-50 opacity-40 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed text-sm">&larr;</button>`;
    }
    
    html += `<span class="text-sm text-slate-500 dark:text-slate-400 font-mono tracking-widest">${currentPage} / ${totalPages}</span>`;
    
    if (currentPage < totalPages) {
      html += `<button id="next-page" class="px-5 py-2 rounded-full border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">&rarr;</button>`;
    } else {
      html += `<button disabled class="px-5 py-2 rounded-full border bg-slate-50 opacity-40 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed text-sm">&rarr;</button>`;
    }
    
    html += `</div>`;
    paginationContainer.innerHTML = html;
    
    const prevBtn = document.getElementById('prev-page');
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    
    const nextBtn = document.getElementById('next-page');
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));
  }

  function changePage(delta) {
    currentPage += delta;
    renderPosts();
    const filterEl = document.getElementById('category-filter') || document.querySelector('header');
    if(filterEl) window.scrollTo({ top: filterEl.offsetTop - 40, behavior: 'smooth' });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('bg-slate-800', 'text-slate-100', 'border-slate-800', 'dark:bg-slate-200', 'dark:text-slate-900', 'dark:border-slate-200');
        b.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200', 'dark:bg-slate-900', 'dark:text-slate-400', 'dark:border-slate-800');
      });
      btn.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-200', 'dark:bg-slate-900', 'dark:text-slate-400', 'dark:border-slate-800');
      btn.classList.add('bg-slate-800', 'text-slate-100', 'border-slate-800', 'dark:bg-slate-200', 'dark:text-slate-900', 'dark:border-slate-200');

      currentCategory = btn.getAttribute('data-target') || 'all';
      currentPage = 1;
      renderPosts();
    });
  });

  renderPosts();
</script>"""

if idx != -1:
    with open('src/pages/blog.astro', 'w', encoding='utf-8') as f:
        f.write(text[:idx] + new_script)

with open('src/pages/en/blog.astro', 'r', encoding='utf-8') as f:
    text_en = f.read()
idx_en = text_en.find('<script>')
if idx_en != -1:
    with open('src/pages/en/blog.astro', 'w', encoding='utf-8') as f:
        f.write(text_en[:idx_en] + new_script)
