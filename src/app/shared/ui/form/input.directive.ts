import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Text-like input (Next `Input`); red border when `aria-invalid="true"`.
 * A number field shows no spin arrows (global CSS) and ignores the mouse
 * wheel, so scrolling the page over a focused field never changes its value.
 */
@Directive({
  selector: 'input[appInput]',
  host: {
    class:
      'flex h-10 w-full rounded-lg border border-input bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-premium hover:border-foreground/25 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70 disabled:shadow-none disabled:hover:border-input file:border-0 file:bg-transparent file:text-sm file:font-medium aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
    '(wheel)': 'onWheel()',
  },
})
export class InputDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  /** The browser steps a focused number field on wheel; leaving focus lets the page scroll instead. */
  protected onWheel(): void {
    if (this.element.type === 'number' && this.element === this.element.ownerDocument.activeElement) this.element.blur();
  }
}
