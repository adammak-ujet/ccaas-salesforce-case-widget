const { patchSObject } = require("./salesforce");
const { applyCors, checkApiKey } = require("./http");

const ALLOWED_CASE_FIELDS = ["Priority", "Description"];
const ALLOWED_CONTACT_FIELDS = ["Phone", "Email"];

function pickAllowed(fields, allowed) {
  const out = {};
  for (const key of allowed) {
    if (fields && Object.prototype.hasOwnProperty.call(fields, key)) out[key] = fields[key];
  }
  return out;
}

exports.updateCase = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Use PATCH." });
    return;
  }
  if (!checkApiKey(req, res)) return;

  const { caseId, contactId, case: caseFields, contact: contactFields } = req.body || {};

  if (!caseId) {
    res.status(400).json({ error: "caseId is required." });
    return;
  }

  const caseUpdates = pickAllowed(caseFields, ALLOWED_CASE_FIELDS);
  const contactUpdates = pickAllowed(contactFields, ALLOWED_CONTACT_FIELDS);

  if (Object.keys(caseUpdates).length === 0 && Object.keys(contactUpdates).length === 0) {
    res.status(400).json({ error: "No editable fields provided." });
    return;
  }
  if (Object.keys(contactUpdates).length > 0 && !contactId) {
    res.status(400).json({ error: "contactId is required to update contact fields." });
    return;
  }

  try {
    await Promise.all([
      Object.keys(caseUpdates).length ? patchSObject("Case", caseId, caseUpdates) : null,
      Object.keys(contactUpdates).length ? patchSObject("Contact", contactId, contactUpdates) : null,
    ]);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
};
