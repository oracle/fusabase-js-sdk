/**
 * Password policy requirements.
 */
export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

/**
 * Password validation result.
 */
export interface PasswordValidationStatus {
  valid: boolean;
  errors?: string[];
}
