import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_EMAIL, ORGANISATION_NAME } from '../../constants/venue';
import { LEGAL_PAGE_STYLES } from './legal-page.styles';

@Component({
  selector: 'app-data-deletion',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="legal glass">
      <h1>Deleting your data</h1>
      <p class="updated">Last updated {{ lastUpdated }}</p>

      <p>
        You can ask {{ org }} to delete the personal information we hold about you at any time.
        This applies whether you signed in with Facebook, Google, Apple or an email address, and to
        visitors whose details were recorded when they brought an item for repair.
      </p>

      <h2>How to ask</h2>
      <ol>
        <li>
          Email <a [href]="mailtoLink">{{ email }}</a> with the subject <strong>"Delete my data"</strong>.
        </li>
        <li>
          Tell us the name and the email address (or telephone number) you used, and whether you signed
          in with Facebook, Google, Apple or email, so we can find your records.
        </li>
        <li>
          We will delete your account and personal details and email you to confirm when it has been done.
          Anonymous repair records (for example "toaster, repaired") may be kept for our statistics, with
          nothing that identifies you.
        </li>
      </ol>

      <h2>Removing the app from Facebook</h2>
      <p>You can also stop the app having any access to your Facebook account:</p>
      <ol>
        <li>On Facebook, open <strong>Settings &amp; privacy → Settings</strong>.</li>
        <li>Go to <strong>Apps and websites</strong>.</li>
        <li>Find <strong>{{ org }}</strong> and choose <strong>Remove</strong>.</li>
      </ol>
      <p>
        Removing the app on Facebook stops future access but does not delete what we already hold,
        so please email us as well if you want that deleted.
      </p>

      <p>See our <a routerLink="/privacy">privacy policy</a> for what we collect and why.</p>
    </article>
  `,
  styles: [LEGAL_PAGE_STYLES]
})
export class DataDeletionComponent {
  readonly org = ORGANISATION_NAME;
  readonly email = CONTACT_EMAIL;
  readonly mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Delete my data')}`;
  readonly lastUpdated = '4 November 2026';
}
