import { Routes } from '@angular/router';
import { RepairListComponent } from './components/repair-list/repair-list.component';
import { RepairFormComponent } from './components/repair-form/repair-form.component';
import { RepairCompleteComponent } from './components/repair-complete/repair-complete.component';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'repairs', component: RepairListComponent },
  { path: 'register', loadComponent: () => import('./components/intake/intake.component').then(m => m.IntakeComponent) },
  { path: 'investigate/:id', loadComponent: () => import('./components/investigation/investigation.component').then(m => m.InvestigationComponent) },
  { path: 'new', component: RepairFormComponent },
  { path: 'edit/:id', component: RepairFormComponent },
  { path: 'item/:id', loadComponent: () => import('./components/repair-detail/repair-detail.component').then(m => m.RepairDetailComponent) },
  { path: 'complete/:id', component: RepairCompleteComponent },
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
      },
      {
        path: 'users',
        loadComponent: () => import('./components/admin/user-manager/user-manager.component').then(m => m.UserManagerComponent)
      },
      {
        path: 'activity',
        loadComponent: () => import('./components/admin/activity-log/activity-log.component').then(m => m.ActivityLogComponent)
      },
      {
        path: 'backup',
        loadComponent: () => import('./components/admin/backup-manager/backup-manager.component').then(m => m.BackupManagerComponent)
      },
      {
        path: 'clear',
        loadComponent: () => import('./components/admin/clear-data/clear-data.component').then(m => m.ClearDataComponent)
      },
      {
        path: 'version',
        loadComponent: () => import('./components/admin/version-manager/version-manager.component').then(m => m.VersionManagerComponent)
      }
    ]
  },
  {
    path: 'issues',
    loadComponent: () => import('./components/issues/issues.component').then(m => m.IssuesComponent)
  },
  {
    path: 'schedule',
    loadComponent: () => import('./components/schedule/schedule.component').then(m => m.ScheduleComponent)
  },
  {
    path: 'rcd-dashboard/:date',
    loadComponent: () => import('./components/rcd-dashboard/rcd-dashboard.component').then(m => m.RcdDashboardComponent)
  },
  {
    path: 'repairer-dashboard/:name',
    loadComponent: () => import('./components/repairer-dashboard/repairer-dashboard.component').then(m => m.RepairerDashboardComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./components/legal/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'data-deletion',
    loadComponent: () => import('./components/legal/data-deletion.component').then(m => m.DataDeletionComponent)
  },
  {
    path: 'stats',
    loadComponent: () => import('./components/public-stats/public-stats.component').then(m => m.PublicStatsComponent)
  },
  {
    path: 'analytics',
    loadComponent: () => import('./components/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent)
  }
];
