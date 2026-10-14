import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { signInAs } from '../../../../testing/as-role';
import type { PipelineDefinition } from './pipeline-definition.interface';
import { PipelineTrackerComponent, type PipelineActionRequest } from './pipeline-tracker.component';
import { PipelinesApi } from './pipelines-api.service';
import type { WorkflowView } from './workflow-view.interface';

const DEFINITION: PipelineDefinition = {
  code: 'opportunity',
  entity: 'opportunity',
  stageField: 'stage',
  stages: [
    { code: 'draft', key: 'O0', kind: 'open', responsibleRoles: ['sales_representative'] },
    { code: 'discovery', key: 'O1', kind: 'open', responsibleRoles: ['sales_representative'] },
    { code: 'survey', key: 'O2', kind: 'open', responsibleRoles: ['technical_proposal_engineer'] },
    { code: 'lost', key: 'Lost', kind: 'terminal', responsibleRoles: [] },
  ],
  transitions: [
    { from: ['discovery'], to: 'survey', action: 'accept_technical_request', kind: 'forward', performedBy: ['sales_representative'], approvedBy: ['project_manager'] },
    { from: ['discovery'], to: 'lost', action: 'close_lost', kind: 'close', performedBy: ['sales_representative'], approvedBy: [] },
    { from: ['lost'], to: 'discovery', action: 'reopen_opportunity', kind: 'reopen', performedBy: ['sales_manager'], approvedBy: [] },
  ],
};

function view(overrides: Partial<WorkflowView> = {}): WorkflowView {
  return {
    pipeline: 'opportunity',
    stage: 'discovery',
    history: [
      { fromStage: null, toStage: 'draft', enteredAt: '2026-10-01T08:00:00.000Z', action: 'capture' },
      { fromStage: 'draft', toStage: 'discovery', enteredAt: '2026-10-02T08:00:00.000Z', action: 'confirm_need', reason: 'Owner confirmed', evidence: [{ kind: 'meeting' }] },
    ],
    blockers: [{ code: 'site_missing', description: 'Customer to pick the plant', severity: 'blocking', ownerId: 'u1', dueAt: '2026-10-20T00:00:00.000Z', resolvedAt: null }],
    control: {
      controlled: true,
      missing: [],
      stage: 'discovery',
      stageEnteredAt: '2026-10-02T08:00:00.000Z',
      ownerId: 'u1',
      nextAction: 'accept_technical_request',
      nextActionOwnerId: 'u1',
      dueAt: '2026-10-25T00:00:00.000Z',
      escalation: 'on_track',
      nextApprovers: ['project_manager'],
    },
    transitions: [
      {
        pipeline: 'opportunity',
        action: 'accept_technical_request',
        from: 'discovery',
        to: 'survey',
        permitted: true,
        ready: false,
        requirements: [
          { code: 'site_linked', kind: 'field', met: false },
          { code: 'need_confirmed', kind: 'evidence', met: true },
        ],
        performedBy: ['sales_representative'],
        approvedBy: ['project_manager'],
      },
      {
        pipeline: 'opportunity',
        action: 'close_lost',
        from: 'discovery',
        to: 'lost',
        permitted: true,
        ready: true,
        requirements: [],
        performedBy: ['sales_representative'],
        approvedBy: [],
      },
    ],
    ...overrides,
  };
}

describe('PipelineTrackerComponent', () => {
  let fixture: ComponentFixture<PipelineTrackerComponent>;
  const emitted: PipelineActionRequest[] = [];

  async function render(value: WorkflowView): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PipelineTrackerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PipelinesApi, useValue: { definitions: () => of([DEFINITION]) } }],
    });
    signInAs('sales_representative');
    fixture = TestBed.createComponent(PipelineTrackerComponent);
    fixture.componentRef.setInput('view', value);
    emitted.length = 0;
    fixture.componentInstance.act.subscribe((request) => emitted.push(request));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const button = (root: HTMLElement, action: string) => root.querySelector(`[data-action="${action}"] button`) as HTMLButtonElement | null;

  it('shows the current stage with its business key and the pipeline it belongs to', async () => {
    const root = await render(view());
    expect(root.querySelector('[data-testid="current-stage"]')?.textContent).toContain('O1');
    expect(root.querySelectorAll('ol[aria-label] li').length).toBe(3);
  });

  it('a blocked move keeps its button disabled and lists exactly what is missing', async () => {
    const root = await render(view());
    expect(button(root, 'accept_technical_request')?.disabled).toBe(true);
    const unmet = root.querySelector('[data-action="accept_technical_request"] [data-testid="unmet"]')?.textContent ?? '';
    expect(unmet).toContain('Site linked');
    expect(unmet).not.toContain('Need confirmed');
  });

  it('a move the user may not perform gets no button, only who performs it', async () => {
    const value = view();
    value.transitions[0] = { ...value.transitions[0], permitted: false, ready: true };
    const root = await render(value);
    expect(button(root, 'accept_technical_request')).toBeNull();
    expect(root.querySelector('[data-action="accept_technical_request"]')?.textContent).toContain('pipeline.performedBy');
  });

  it('a hidden action shows where it is performed instead of a button', async () => {
    const value = view();
    value.transitions[0] = { ...value.transitions[0], ready: true };
    TestBed.resetTestingModule();
    const root = await render(value);
    fixture.componentRef.setInput('hidden', ['accept_technical_request']);
    fixture.componentRef.setInput('via', { accept_technical_request: 'pipeline.viaHandoff' });
    fixture.detectChanges();
    expect(button(root, 'accept_technical_request')).toBeNull();
    expect(root.textContent).toContain('pipeline.viaHandoff');
  });

  it('a closing move asks for the reason before it is emitted', async () => {
    const root = await render(view());
    button(root, 'close_lost')!.click();
    fixture.detectChanges();
    expect(emitted).toEqual([]);
    const textarea = root.querySelector('#reason-close_lost') as HTMLTextAreaElement;
    textarea.value = 'Customer chose a competitor';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (root.querySelector('[data-action="close_lost"] form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(emitted).toEqual([{ action: 'close_lost', reason: 'Customer chose a competitor' }]);
  });

  it('a ready forward move is emitted at once', async () => {
    const value = view();
    value.transitions[0] = { ...value.transitions[0], ready: true, requirements: [{ code: 'site_linked', kind: 'field', met: true }] };
    const root = await render(value);
    button(root, 'accept_technical_request')!.click();
    expect(emitted).toEqual([{ action: 'accept_technical_request' }]);
  });

  it('shows open blockers with their due date and the stage history newest first', async () => {
    const root = await render(view());
    expect(root.querySelector('[data-testid="blockers"]')?.textContent).toContain('Customer to pick the plant');
    const entries = [...root.querySelectorAll('details ol li')].map((item) => item.textContent ?? '');
    expect(entries[0]).toContain('Owner confirmed');
    expect(entries).toHaveLength(2);
  });

  it('shows the server refusal text it is given', async () => {
    const root = await render(view());
    fixture.componentRef.setInput('error', 'This move is blocked: Site linked');
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('This move is blocked');
  });
});
