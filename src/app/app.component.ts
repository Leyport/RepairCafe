import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { APP_VERSION } from './constants/version';
import { RepairService } from './services/repair.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'RepairCafe';
  version = APP_VERSION.version;
  changeDescription = APP_VERSION.description;

  private repairService = inject(RepairService);
  issueCount$ = this.repairService.getIssues().pipe(
    map(issues => issues.length)
  );
}
