class Service {
  constructor(data) {
    this.name = data.name;
    this.category = data.category;
    this.shortDescription = data.shortDescription;
    this.longDescription = data.longDescription;
    this.timestamp = data.timestamp || new Date();
    this.image = data.image;
    this.tags = data.tags || [];
  }

  validate() {
    if (!this.name || !this.category || !this.shortDescription || !this.longDescription) {
      throw new Error('Required fields missing');
    }
  }
}

export default Service;
