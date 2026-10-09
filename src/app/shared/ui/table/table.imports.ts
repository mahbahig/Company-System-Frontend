import { TableBodyDirective } from './table-body.directive';
import { TableCellDirective } from './table-cell.directive';
import { TableEmptyComponent } from './table-empty.component';
import { TableHeadDirective } from './table-head.directive';
import { TableHeaderDirective } from './table-header.directive';
import { TableRowDirective } from './table-row.directive';
import { TableWrapperComponent } from './table-wrapper.component';
import { TableDirective } from './table.directive';

/** Every table primitive, for a component's `imports` array. */
export const TABLE_IMPORTS = [
  TableWrapperComponent,
  TableDirective,
  TableHeaderDirective,
  TableBodyDirective,
  TableRowDirective,
  TableHeadDirective,
  TableCellDirective,
  TableEmptyComponent,
] as const;
