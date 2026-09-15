const { soqlQuery, soqlEscape } = require("./salesforce");
const { applyCors, checkApiKey } = require("./http");

const MAX_ITEMS = 15;

exports.getActivity = async (req, res) => {
  if (applyCors(req, res)) return;
  if (!checkApiKey(req, res)) return;

  const caseId = (req.query.caseId || "").trim();
  if (!caseId) {
    res.status(400).json({ error: "Provide a caseId query param." });
    return;
  }
  const id = soqlEscape(caseId);

  // Each source is independently optional -- e.g. FeedItem/Chatter isn't
  // enabled in every org (INVALID_TYPE, not a permissions error), and that
  // shouldn't take down Task/EmailMessage just because they ran in the same
  // Promise.all. Log and fall back to an empty list per source instead.
  const safeQuery = (label, soql) =>
    soqlQuery(soql).catch((err) => {
      console.error(`${label} activity query failed, continuing without it:`, err.message);
      return [];
    });

  try {
    const [feedItems, tasks, emails] = await Promise.all([
      safeQuery(
        "FeedItem",
        `SELECT Id, Body, CreatedDate, CreatedBy.Name FROM FeedItem WHERE ParentId = '${id}' ORDER BY CreatedDate DESC LIMIT ${MAX_ITEMS}`
      ),
      safeQuery(
        "Task",
        `SELECT Id, Subject, Description, Status, CreatedDate, Who.Name FROM Task WHERE WhatId = '${id}' ORDER BY CreatedDate DESC LIMIT ${MAX_ITEMS}`
      ),
      safeQuery(
        "EmailMessage",
        `SELECT Id, Subject, TextBody, FromAddress, MessageDate FROM EmailMessage WHERE ParentId = '${id}' ORDER BY MessageDate DESC LIMIT ${MAX_ITEMS}`
      ),
    ]);

    const items = [
      ...feedItems.map((f) => ({
        type: "chatter",
        author: (f.CreatedBy && f.CreatedBy.Name) || "Unknown",
        text: f.Body || "",
        date: f.CreatedDate,
      })),
      ...tasks.map((t) => ({
        type: "task",
        author: (t.Who && t.Who.Name) || "Unknown",
        text: [t.Subject, t.Status].filter(Boolean).join(" — "),
        date: t.CreatedDate,
      })),
      ...emails.map((e) => ({
        type: "email",
        author: e.FromAddress || "Unknown",
        text: [e.Subject, e.TextBody].filter(Boolean).join(" — "),
        date: e.MessageDate,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, MAX_ITEMS);

    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
};
