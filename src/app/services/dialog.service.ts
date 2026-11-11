import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, for deletes and other things that can't be undone. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * In-app replacement for the browser's confirm(), which shows the site's web address
 * ("repaircafe-6792c.web.app says…") and can't be styled.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<PendingConfirm | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(false); // only one dialog at a time
    return new Promise(resolve => this.current.set({ ...options, resolve }));
  }

  close(ok: boolean) {
    const pending = this.current();
    if (!pending) return;
    this.current.set(null);
    pending.resolve(ok);
  }
}
