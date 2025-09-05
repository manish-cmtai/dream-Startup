class Contact {
  constructor(data) {
    this.name = data.name;
    this.phoneNumber = data.phoneNumber;
    this.email = data.email;
    this.message = data.message;
    this.timestamp = data.timestamp || new Date();
    this.status = data.status || 'pending';
  }

  validate() {
    if (!this.name || !this.phoneNumber || !this.email) {
      throw new Error('Name, phone number, and email are required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error('Invalid email format');
    }
  }
}

export default Contact;
