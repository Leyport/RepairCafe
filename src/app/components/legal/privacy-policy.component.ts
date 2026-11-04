import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_EMAIL, ORGANISATION_NAME } from '../../constants/venue';
import { LEGAL_PAGE_STYLES } from './legal-page.styles';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="legal glass">
      <h1>Privacy Policy</h1>
      <p class="updated">Last updated {{ lastUpdated }}</p>

      <p>
        This policy explains what personal information the {{ org }} app collects, why, and how it
        is looked after. {{ org }} is a volunteer-run charity. We use this app to run our repair
        sessions: registering the items people bring in, assigning them to volunteer repairers and
        recording the outcome.
      </p>

      <h2>Volunteers who sign in</h2>
      <p>When you sign in with Google, Facebook or an email address and password, we receive and store:</p>
      <ul>
        <li>your name, email address and profile picture (if your account has one)</li>
        <li>when you last signed in</li>
      </ul>
      <p>
        When you sign in with Facebook we ask only for your public profile (name and picture) and email
        address. We do not see your password, posts, friends or any other Facebook data, and we never
        post anything to Facebook on your behalf.
      </p>

      <h2>Visitors who bring items for repair</h2>
      <p>To run the session and let you know about your item, volunteers may record:</p>
      <ul>
        <li>your name and a contact telephone number</li>
        <li>whether you need physical, visual or hearing assistance on the day</li>
        <li>details and photos of the item, the fault, the repair notes and the outcome</li>
        <li>whether you were satisfied with the repair and whether you made a donation</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>to run repair sessions and contact you about your item</li>
        <li>to let volunteers sign in and see the items they are working on</li>
        <li>to produce statistics about repairs (for example how many items were fixed), which do not identify anyone</li>
      </ul>
      <p>We do not sell your information, share it for marketing, or use it for advertising.</p>

      <h2>Where it is stored</h2>
      <p>
        The app is built on Google Firebase. Information is stored by Google on servers in Europe
        and is only available to signed-in {{ org }} volunteers.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep information only for as long as we need it to run the Repair Cafe. Visitors' personal
        details can be removed or anonymised while keeping the anonymous repair records for our statistics.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK data protection law you can ask to see the information we hold about you, ask us to
        correct it, or ask us to delete it. See <a routerLink="/data-deletion">how to delete your data</a>,
        or email us at <a [href]="'mailto:' + email">{{ email }}</a>.
      </p>
      <p>
        If you are unhappy with how we have handled your information you can complain to the
        Information Commissioner's Office at <a href="https://ico.org.uk" target="_blank" rel="noopener">ico.org.uk</a>.
      </p>

      <h2>Contact</h2>
      <p>{{ org }} · <a [href]="'mailto:' + email">{{ email }}</a></p>
    </article>
  `,
  styles: [LEGAL_PAGE_STYLES]
})
export class PrivacyPolicyComponent {
  readonly org = ORGANISATION_NAME;
  readonly email = CONTACT_EMAIL;
  readonly lastUpdated = '4 November 2026';
}
