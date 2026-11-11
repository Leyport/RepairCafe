import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, for deletes and other things that can't be undone. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
}

export type DialogTone = 'question' | 'danger' | 'info' | 'success' | 'error';

/** What the dialog component renders. */
export interface DialogState {
  kind: 'confirm' | 'alert' | 'prompt';
  tone: DialogTone;
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  placeholder?: string;
  value: string;
  resolve: (result: { ok: boolean; value: string }) => void;
}

/**
 * In-app replacement for the browser's confirm(), alert() and prompt(), which show the
 * site's web address ("repaircafe-6792c.web.app says…") and can't be styled.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<DialogState | null>(null);

  /** Ask a yes/no question. Resolves true if the user confirms. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const r = await this.open({
      kind: 'confirm',
      tone: options.danger ? 'danger' : 'question',
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
    });
    return r.ok;
  }

  /** Something went wrong. */
  error(message: string, title = 'Something went wrong'): Promise<void> {
    return this.notice('error', title, message);
  }

  /** A plain notice, e.g. "Done: 5 items updated". */
  info(message: string, title = ''): Promise<void> {
    return this.notice('info', title, message);
  }

  /** Something finished successfully. */
  success(message: string, title = 'Done'): Promise<void> {
    return this.notice('success', title, message);
  }

  /** Ask for a line of text. Resolves to the trimmed text, or null if cancelled. */
  async prompt(options: PromptOptions): Promise<string | null> {
    const r = await this.open({
      kind: 'prompt',
      tone: 'question',
      title: options.title,
      message: options.message,
      placeholder: options.placeholder,
      value: options.initialValue || '',
      confirmText: options.confirmText || 'OK',
      cancelText: 'Cancel',
    });
    return r.ok ? r.value.trim() : null;
  }

  close(ok: boolean) {
    const d = this.current();
    if (!d) return;
    this.current.set(null);
    d.resolve({ ok, value: d.value });
  }

  private async notice(tone: DialogTone, title: string, message: string): Promise<void> {
    await this.open({ kind: 'alert', tone, title, message, confirmText: 'OK', cancelText: '' });
  }

  private open(state: Omit<DialogState, 'resolve' | 'value'> & { value?: string }): Promise<{ ok: boolean; value: string }> {
    this.close(false); // only one dialog at a time
    return new Promise(resolve => this.current.set({ value: '', ...state, resolve }));
  }
}
