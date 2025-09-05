class User {
  constructor(data) {
    this.uid = data.uid || data.email;
    this.name = data.name;
    this.phone = data.phone;
    this.email = data.email;
    this.password = data.password; // Will be hashed
    this.role = data.role || 'user';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.isActive = data.isActive !== false;
  }

  validate() {
    const errors = [];

    if (!this.name) errors.push('Name is required');
    if (!this.phone) errors.push('Phone is required');
    if (!this.email) errors.push('Email is required');
    if (!this.password) errors.push('Password is required');

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (this.email && !emailRegex.test(this.email)) {
      errors.push('Invalid email format');
    }

    // Phone validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (this.phone && !phoneRegex.test(this.phone)) {
      errors.push('Invalid phone number format');
    }

    // Role validation
    const validRoles = ['super_admin', 'admin', 'editor', 'user'];
    if (!validRoles.includes(this.role)) {
      errors.push('Invalid role');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return true;
  }
}

export default User;
