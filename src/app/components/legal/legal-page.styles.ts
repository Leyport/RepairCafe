// Shared look for the public privacy and data deletion pages.
export const LEGAL_PAGE_STYLES = `
  .legal {
    max-width: 760px;
    margin: 1.5rem auto 3rem;
    padding: 2rem 2.25rem;
    border-radius: 14px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.8);
  }
  @media (max-width: 600px) {
    .legal { padding: 1.25rem 1rem; margin-top: 0.5rem; }
  }
  h1 { margin: 0 0 0.25rem; color: white; font-size: 1.7rem; }
  .updated { margin: 0 0 1.75rem; font-size: 0.85rem; color: rgba(255, 255, 255, 0.45); }
  h2 { margin: 1.75rem 0 0.5rem; color: var(--accent-color); font-size: 1.1rem; }
  p, li { font-size: 0.95rem; }
  ul, ol { padding-left: 1.3rem; }
  li { margin-bottom: 0.35rem; }
  a { color: var(--accent-color); }
  strong { color: white; }
`;
