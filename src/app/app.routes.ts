import { Routes } from '@angular/router';
import { RepairListComponent } from './components/repair-list/repair-list.component';
import { RepairFormComponent } from './components/repair-form/repair-form.component';

export const routes: Routes = [
  { path: '', component: RepairListComponent },
  { path: 'new', component: RepairFormComponent },
  { path: 'edit/:id', component: RepairFormComponent },
  { path: 'item/:id', loadComponent: () => import('./components/repair-detail/repair-detail.component').then(m => m.RepairDetailComponent) },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin-panel/admin-panel.component').then(m => m.AdminPanelComponent),
    children: [
      {
        path: 'repairers',
        loadComponent: () => import('./components/admin/repairer-manager/repairer-manager.component').then(m => m.RepairerManagerComponent)
      },
      {
        path: 'import',
        loadComponent: () => import('./components/admin/import-panel/import-panel.component').then(m => m.ImportPanelComponent)
      },
      {
        path: 'database',
        loadComponent: () => import('./components/admin/database-explorer/database-explorer.component').then(m => m.DatabaseExplorerComponent)
      }
    ]
  }
];
