// Fixture data used when the widget is loaded with ?mock=1 — lets the widget be
// previewed and demoed with no backend/Salesforce org at all.
window.WIDGET_MOCK = {
  // Listed newest-first, same order the real backend returns.
  cases: [
    {
      caseId: "500000000000mck1",
      caseNumber: "00001234",
      subject: "Dropped calls switching from Wi-Fi to cellular",
      status: "Working",
      priority: "High",
      createdDate: "2026-09-09T11:32:00Z",
      contactId: "003000000000mock",
      contactName: "Jamie Rivera",
      phone: "(555) 123-4567",
      email: "jamie.rivera@example.com",
      description:
        "Customer reports intermittent dropped calls on the mobile app when switching from Wi-Fi to cellular data.",
    },
    {
      caseId: "500000000000mck2",
      caseNumber: "00001190",
      subject: "Billing question about overage charges",
      status: "Closed",
      priority: "Low",
      createdDate: "2026-08-02T09:15:00Z",
      contactId: "003000000000mock",
      contactName: "Jamie Rivera",
      phone: "(555) 123-4567",
      email: "jamie.rivera@example.com",
      description: "Customer wants clarification on data overage charges from last billing cycle.",
    },
    {
      caseId: "500000000000mck3",
      caseNumber: "00000987",
      subject: "Unable to log in to mobile app",
      status: "Closed",
      priority: "Medium",
      createdDate: "2026-06-14T16:40:00Z",
      contactId: "003000000000mock",
      contactName: "Jamie Rivera",
      phone: "(555) 123-4567",
      email: "jamie.rivera@example.com",
      description: "Customer was locked out after too many failed login attempts, resolved via password reset.",
    },
  ],

  // Reused for whichever mock case is selected, just to demo the activity panel.
  activity: [
    {
      type: "chatter",
      author: "Priya Natarajan",
      text: "Escalated to Tier 2 — network engineering is looking at the handoff logs.",
      date: "2026-09-09T15:32:00Z",
    },
    {
      type: "task",
      author: "Priya Natarajan",
      text: "Follow-up call scheduled",
      date: "2026-09-09T14:10:00Z",
    },
    {
      type: "email",
      author: "jamie.rivera@example.com",
      text: "Subject: Re: Case 00001234 — still happening on iOS 18.1",
      date: "2026-09-08T19:45:00Z",
    },
    {
      type: "chatter",
      author: "Priya Natarajan",
      text: "Reproduced on a test device, filing a bug against the mobile SDK.",
      date: "2026-09-08T11:02:00Z",
    },
  ],
};
