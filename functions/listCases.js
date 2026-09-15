const { soqlQuery, soqlEscape } = require("./salesforce");
const { applyCors, checkApiKey } = require("./http");

const MAX_CASES = 25;

// Stored phone values are formatted (e.g. "+1-510-424-1199"), so a plain
// LIKE '%5104241199' never matches — the digits aren't contiguous in the
// field. Interleaving a wildcard between every digit matches the digits in
// order regardless of what separators sit between them.
function phoneLikePattern(digits) {
  return "%" + digits.split("").join("%") + "%";
}

function mapCase(record) {
  const contact = record.Contact || {};
  return {
    caseId: record.Id,
    caseNumber: record.CaseNumber,
    subject: record.Subject || "",
    status: record.Status || "",
    createdDate: record.CreatedDate,
    contactId: record.ContactId,
    contactName: contact.Name || "",
    priority: record.Priority || "",
    phone: contact.Phone || "",
    email: contact.Email || "",
    description: record.Description || "",
  };
}

exports.listCases = async (req, res) => {
  if (applyCors(req, res)) return;
  if (!checkApiKey(req, res)) return;

  const phone = (req.query.phone || "").trim();
  const email = (req.query.email || "").trim();

  if (!phone && !email) {
    res.status(400).json({ error: "Provide a phone and/or email query param." });
    return;
  }

  const conditions = [];
  if (email) conditions.push(`Contact.Email = '${soqlEscape(email)}'`);
  const digits = phone.replace(/\D/g, "");
  if (digits) {
    const last10 = digits.slice(-10);
    conditions.push(`Contact.Phone LIKE '${soqlEscape(phoneLikePattern(last10))}'`);
  }

  // Newest first, so the agent sees the most recent case at the top of the list.
  const soql = `
    SELECT Id, CaseNumber, Subject, Status, Priority, Description, CreatedDate, ContactId,
           Contact.Name, Contact.Phone, Contact.Email
    FROM Case
    WHERE (${conditions.join(" OR ")})
    ORDER BY CreatedDate DESC
    LIMIT ${MAX_CASES}
  `.replace(/\s+/g, " ");

  try {
    const records = await soqlQuery(soql);
    res.status(200).json(records.map(mapCase));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
};
