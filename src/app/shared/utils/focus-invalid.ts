/**
 * After a rejected submit, moves focus to the first field marked invalid
 * (`aria-invalid="true"`) inside `root`, so keyboard and screen-reader users
 * land on what needs fixing. Runs after the error state has rendered.
 */
export function focusFirstInvalid(root: HTMLElement | null | undefined): void {
  if (!root) return;
  setTimeout(() => {
    const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus();
  });
}
