import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { ConfirmHostComponent } from './confirm-host.component';
import { ConfirmService } from './confirm.service';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(ConfirmHostComponent);
  return { fixture, service: TestBed.inject(ConfirmService) };
}
const actionButton = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-testid="confirm-action"]')!;

describe('Contextual confirmation dialog', () => {
  it('shows the action and record, the consequences, "cannot be undone", and a button named after the action', async () => {
    const { fixture, service } = setup();
    void service.confirm({ heading: 'Delete ticket #TK-1042?', message: 'This permanently deletes the ticket.', details: ['Its comments and screenshots go too.'], irreversible: true, confirmLabel: 'Delete Ticket', cancelLabel: 'Cancel', variant: 'danger' });
    const root = await settle(fixture);
    expect(root.querySelector('#confirm-heading')!.textContent).toBe('Delete ticket #TK-1042?');
    expect(root.querySelector('#confirm-message')!.textContent).toContain('Its comments and screenshots go too.');
    expect(root.querySelector('#confirm-message')!.textContent).toContain('confirm.irreversible');
    expect(actionButton(root).textContent!.trim()).toBe('Delete Ticket');
    expect(actionButton(root).className).toContain('bg-destructive');
    const dialog = root.querySelector('dialog')!;
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-heading');
    expect(dialog.getAttribute('aria-describedby')).toBe('confirm-message');
  });

  it('the risk sets the style: danger, warning, default', async () => {
    const { fixture, service } = setup();
    void service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Reset Password', cancelLabel: 'Cancel', variant: 'warning' });
    let root = await settle(fixture);
    expect(actionButton(root).className).toContain('bg-warning');
    await service.answer(false);
    void service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Resolve Ticket', cancelLabel: 'Cancel' });
    root = await settle(fixture);
    expect(actionButton(root).className).toContain('bg-primary');
  });

  it('Cancel never runs the action', async () => {
    const { fixture, service } = setup();
    const action = vi.fn(() => new Subject<void>());
    const answer = service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Deactivate Employee', cancelLabel: 'Cancel', action });
    const root = await settle(fixture);
    [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancel')!.click();
    expect(await answer).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('confirming runs the action once: the button is disabled and busy until the API answers, then the dialog closes', async () => {
    const { fixture, service } = setup();
    const response = new Subject<void>();
    const action = vi.fn(() => response);
    const answer = service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Revoke Session', cancelLabel: 'Cancel', variant: 'danger', action });
    let root = await settle(fixture);
    actionButton(root).click();
    root = await settle(fixture);
    expect(actionButton(root).disabled).toBe(true);
    expect(actionButton(root).getAttribute('aria-busy')).toBe('true');
    // A second click (or Enter) while it runs sends nothing more.
    actionButton(root).click();
    await service.answer(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(service.pending()).not.toBeNull();
    response.next();
    response.complete();
    expect(await answer).toBe(true);
    root = await settle(fixture);
    expect(service.pending()).toBeNull();
  });

  it('a failed request keeps the dialog open with the error, and it can be tried again', async () => {
    const { fixture, service } = setup();
    let attempt = 0;
    const action = vi.fn(() => (attempt++ === 0 ? throwError(() => new ApiError(403, { message: 'errors.forbidden' })) : new Subject<void>()));
    void service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Delete Ticket', cancelLabel: 'Cancel', variant: 'danger', action });
    let root = await settle(fixture);
    actionButton(root).click();
    await tick();
    root = await settle(fixture);
    expect(service.pending()).not.toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(actionButton(root).disabled).toBe(false);
    actionButton(root).click();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('a high-risk action stays locked until the exact words are typed', async () => {
    const { fixture, service } = setup();
    void service.confirm({ heading: 'Delete all tickets?', message: 'm', confirmLabel: 'Delete All Tickets', cancelLabel: 'Cancel', variant: 'danger', irreversible: true, requireText: 'DELETE' });
    let root = await settle(fixture);
    const field = root.querySelector<HTMLInputElement>('#confirm-typed')!;
    expect(actionButton(root).disabled).toBe(true);
    field.value = 'delete';
    field.dispatchEvent(new Event('input'));
    root = await settle(fixture);
    expect(actionButton(root).disabled).toBe(true);
    field.value = 'DELETE';
    field.dispatchEvent(new Event('input'));
    root = await settle(fixture);
    expect(actionButton(root).disabled).toBe(false);
  });

  it('the older `tone: "destructive"` callers still get the danger style', async () => {
    const { fixture, service } = setup();
    void service.confirm({ heading: 'h', message: 'm', confirmLabel: 'Discard changes', cancelLabel: 'Stay', tone: 'destructive' });
    const root = await settle(fixture);
    expect(actionButton(root).className).toContain('bg-destructive');
  });
});
