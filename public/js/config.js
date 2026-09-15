// Per-deployment config. Edit these defaults for your GitHub Pages deployment,
// or override at runtime with ?listCasesUrl=&updateCaseUrl=&getActivityUrl=&logo=&apiKey=
// query params (handy for demos/testing against a different backend).
//
// Each Cloud Run Function gets its own URL (they don't share a path router), so
// this widget talks to three distinct endpoints rather than one base URL + paths.
window.WIDGET_CONFIG = {
  listCasesUrl: "https://listcases-iadsilko5a-uc.a.run.app",
  updateCaseUrl: "https://updatecase-iadsilko5a-uc.a.run.app",
  getActivityUrl: "https://getactivity-iadsilko5a-uc.a.run.app",

  // Default customer logo shown top-right. Leave blank to hide it.
  customerLogoUrl: "",

  // Sent as the X-Widget-Key header on every request. Matches WIDGET_API_KEY
  // on the backend. This is a basic anti-scraping check, not real auth — anyone
  // viewing this widget's source can see it.
  apiKey: "43f8e9aa227887f113a286603d2f9e6d9a21145b5b8defb5",
};
