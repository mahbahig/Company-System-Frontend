import { passwordPolicyProblem } from './password-policy';

describe('password policy (mirror of the API) — 6+ characters with a letter', () => {
  it('passes letters with or without digits and symbols', () => {
    for (const password of ['abcdef', 'password', 'abc123', 'password1', 'abcdef!', 'abc!@#']) expect(passwordPolicyProblem(password), password).toBeNull();
  });

  it('fails anything shorter than 6, and anything without a letter', () => {
    expect(passwordPolicyProblem('abc')).toBe('validation.passwordTooShort');
    for (const password of ['123456', '!@#$%^', '12345!']) expect(passwordPolicyProblem(password), password).toBe('validation.passwordLetterRequired');
  });
});
