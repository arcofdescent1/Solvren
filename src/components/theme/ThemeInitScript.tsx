/**
 * Sets html[data-theme] as early as possible to avoid a flash.
 *
 * Order of precedence:
 * 1) localStorage.theme ("light" | "dark")
 * 2) OS preference
 */
export default function ThemeInitScript() {
  const code = `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    // no-op
  }
})();`;

   
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
