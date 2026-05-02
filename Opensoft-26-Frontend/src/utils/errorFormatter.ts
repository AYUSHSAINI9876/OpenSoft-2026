/**
 * Formats raw backend error messages into human-readable strings.
 * Handles Go validation tags and database constraint errors.
 */
export const formatAuthError = (error: string): string => {
  if (!error) return '';

  // Handle Go validation errors: Key: 'AuthRequest.Password' Error:Field validation for 'Password' failed on the 'min' tag
  const validationMatch = error.match(/Field validation for '(\w+)' failed on the '(\w+)' tag/);
  if (validationMatch) {
    const [, field, tag] = validationMatch;
    
    // Normalize field names
    const fieldName = field.charAt(0).toUpperCase() + field.slice(1).toLowerCase();

    switch (tag) {
      case 'min':
        if (field.toLowerCase() === 'password') {
          return 'Password is too short (minimum 8 characters).';
        }
        return `${fieldName} is too short.`;
      case 'max':
        return `${fieldName} is too long.`;
      case 'email':
        return 'Please enter a valid email address.';
      case 'required':
        return `${fieldName} is required.`;
      default:
        return `Invalid ${field.toLowerCase()} (${tag} validation failed).`;
    }
  }

  // Handle MySQL duplicate entry errors
  if (error.includes('Duplicate entry')) {
    if (error.includes('users.username_unique') || error.includes("key 'username'")) {
      return 'This username is already taken.';
    }
    if (error.includes('users.email_unique') || error.includes("key 'email'")) {
      return 'This email is already registered.';
    }
    return 'This record already exists.';
  }

  // Common descriptive errors
  if (error.toLowerCase().includes('invalid credentials') || 
      error.toLowerCase().includes('incorrect password') ||
      error.toLowerCase().includes('failed to login')) {
    return 'Invalid username or password.';
  }
  
  if (error.includes('Network error')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  return error;
};
