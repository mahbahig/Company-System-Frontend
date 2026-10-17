import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { RowLinkDirective } from './row-link.directive';

@Component({
  imports: [RowLinkDirective],
  template: `
    <table>
      <tbody>
        <tr [appRowLink]="['/', 'leads', 'l1']" data-testid="row">
          <td data-testid="cell">Lead L-1</td>
          <td><button type="button" data-testid="action" (click)="acted = true">Assign</button></td>
          <td><a href="/elsewhere" data-testid="link" (click)="$event.preventDefault()">Customer</a></td>
          <td><input type="checkbox" data-testid="check" /></td>
        </tr>
        <tr [appRowLink]="null" data-testid="inert"><td data-testid="inert-cell">No link</td></tr>
      </tbody>
    </table>
  `,
})
class HostComponent {
  acted = false;
}

describe('RowLinkDirective (whole row opens the record)', () => {
  let navigate: ReturnType<typeof vi.spyOn>;
  let root: HTMLElement;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
    host = fixture.componentInstance;
  });

  const el = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

  it('a click anywhere on the row opens the record', () => {
    el('cell').click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toBe('/leads/l1');
    expect(el('row').classList).toContain('cursor-pointer');
  });

  it('buttons, links and inputs inside the row keep their own action and never navigate', () => {
    el('action').click();
    expect(host.acted).toBe(true);
    el('link').click();
    el('check').click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Ctrl / ⌘ click opens the record in a new tab instead', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    el('cell').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(open).toHaveBeenCalledWith('/leads/l1', '_blank', 'noopener');
    expect(navigate).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('a row without a link stays inert', () => {
    el('inert-cell').click();
    expect(navigate).not.toHaveBeenCalled();
    expect(el('inert').classList).not.toContain('cursor-pointer');
  });
});
