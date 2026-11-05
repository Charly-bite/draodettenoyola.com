const b = require('./api/blog');
const posts = b.readPosts();
posts.filter(p => p.status === 'published').forEach(p => b.generateStaticPost(p));
b.generateBlogIndex(posts);
console.log('REGENERATED_ALL_BLOG_POSTS_OK');
