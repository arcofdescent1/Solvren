export function ThemeInitScript() {
  // Inline script to prevent flash of wrong theme.
  const code = `
  (function () {
    try {
      var key = "rg.theme";
      var stored = localStorage.getItem(key);
      var mode = (stored === "light" || stored === "dark") ? stored : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", mode);
    } catch (e) {}
  })();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
