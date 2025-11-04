export class ValidationHelper {
  static isValidObjectId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
