class Blog {
  constructor(data) {
    this.title = data.title;
    this.content = data.content;
    this.author = data.author;
    this.category = data.category;
    this.tags = data.tags || [];
    this.image = data.image;
    this.seo = data.seo || {};
    this.timestamp = data.timestamp || new Date();
    this.isPublished = data.isPublished || false;
  }

  validate() {
    if (!this.title || !this.content || !this.author) {
      throw new Error('Title, content, and author are required');
    }
  }
}

export default Blog;
