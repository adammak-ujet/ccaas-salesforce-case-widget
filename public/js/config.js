// Per-deployment config. Edit these defaults for your GitHub Pages deployment,
// or override at runtime with ?listCasesUrl=&updateCaseUrl=&getActivityUrl=&logo=&apiKey=
// query params (handy for demos/testing against a different backend).
//
// Each Cloud Run Function gets its own URL (they don't share a path router), so
// this widget talks to three distinct endpoints rather than one base URL + paths.
window.WIDGET_CONFIG = {
  // e.g. "https://us-central1-my-project.cloudfunctions.net/listCases"
  listCasesUrl: "",
  updateCaseUrl: "",
  getActivityUrl: "",

  // Default customer logo shown top-right. Leave blank to hide it.
  customerLogoUrl: "",

  // Sent as the X-Widget-Key header on every request. Matches WIDGET_API_KEY
  // on the backend. This is a basic anti-scraping check, not real auth — anyone
  // viewing this widget's source can see it.
  apiKey: "",
};
