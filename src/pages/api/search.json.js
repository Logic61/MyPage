import { getCollection } from 'astro:content';
import { postDescription } from '../../utils/posts';

export const GET = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  
  const searchIndex = posts.map(post => ({
    title: post.data.title,
    description: postDescription(post),
    category: post.data.category || '',
    slug: post.id,
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: { 'Content-Type': 'application/json' },
  });
};
