import { Routes } from '@angular/router';
import { RepairListComponent } from './components/repair-list/repair-list.component';
import { RepairFormComponent } from './components/repair-form/repair-form.component';

export const routes: Routes = [
  { path: '', component: RepairListComponent },
  { path: 'new', component: RepairFormComponent },
  { path: 'edit/:id', component: RepairFormComponent },
  { path: 'item/:id', loadComponent: () => import('./components/repair-detail/repair-detail.component').then(m => m.RepairDetailComponent) }
];
