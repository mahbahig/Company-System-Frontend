import type { SupportAttachmentPolicy } from '../models/support-attachment-policy.interface';

/** Why a chosen screenshot cannot be sent (the server checks again, by content). */
export type ScreenshotProblem = 'wrongType' | 'tooLarge' | 'empty';

/** Used until the server's policy arrives (the same defaults as the API). */
export const DEFAULT_ATTACHMENT_POLICY: SupportAttachmentPolicy = {
  available: true,
  maxAttachments: 5,
  maxAttachmentBytes: 10 * 1024 * 1024,
  acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
  acceptedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
};

/**
 * The browser-side check of one screenshot, for immediate feedback: type and
 * extension from the policy, size, and not empty. Only a convenience — the
 * API validates the actual file content and limits regardless.
 */
export function screenshotProblem(file: Pick<File, 'name' | 'type' | 'size'>, policy: SupportAttachmentPolicy): ScreenshotProblem | null {
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!policy.acceptedTypes.includes(file.type) || !policy.acceptedExtensions.includes(extension)) return 'wrongType';
  if (file.size === 0) return 'empty';
  if (file.size > policy.maxAttachmentBytes) return 'tooLarge';
  return null;
}

/** The `accept` attribute of the file input. */
export function acceptAttribute(policy: SupportAttachmentPolicy): string {
  return [...policy.acceptedTypes, ...policy.acceptedExtensions.map((extension) => `.${extension}`)].join(',');
}
