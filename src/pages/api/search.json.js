import { getBlogPosts, postDescription, postSlug } from '../../utils/posts';

export const GET = async ({ url }) => {
  const posts = await getBlogPosts(url.pathname.endsWith('/en/api/search.json'));
  
  const searchIndex = posts.map(post => ({
    title: post.data.title,
    description: postDescription(post),
    category: post.data.category || '',
    slug: postSlug(post),
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: { 'Content-Type': 'application/json' },
  });
};
