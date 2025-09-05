class Training {
  constructor(data) {
    this.title = data.title;
    this.description = data.description;
    this.ytLink = data.ytLink;
    this.seo = data.seo || {};
    this.category = data.category;
    this.level = data.level; // beginner, intermediate, advanced
    this.duration = data.duration;
    this.timestamp = data.timestamp || new Date();
    this.isActive = data.isActive !== false;
  }

  validate() {
    if (!this.title || !this.ytLink) {
      throw new Error('Title and YouTube link are required');
    }
    
    const ytRegex = /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+$/;
    if (!ytRegex.test(this.ytLink)) {
      throw new Error('Invalid YouTube link format');
    }
  }
}

export default Training;
