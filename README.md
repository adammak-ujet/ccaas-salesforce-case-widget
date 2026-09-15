# Salesforce Case Widget

An iframe-embeddable widget that looks up every Salesforce Service Cloud Case
matching the customer's phone or email, lists them newest-first for the agent to
pick from, then shows a subset of fields for the selected Case (editable, with
real write-back) plus its activity (Chatter feed + Task/Email history) with a
refresh button. Carries the Salesforce logo plus a swappable customer logo for
white-labeling.

- `public/` — the static widget. This is what you deploy to GitHub Pages.
- `functions/` — three small Cloud Run Functions that hold the Salesforce
  credentials server-side and proxy REST/SOQL calls for the widget. Salesforce
  OAuth secrets can never live in a static site, so this piece is required.

## 1. Preview the widget with no backend (mock mode)

```
npx serve -l 8020 salesforce-case-widget/public
```

Open `http://localhost:8020?mock=1&phone=5551234567` — the widget renders bundled
fixture data from `public/js/mock-data.js`. Useful for checking layout/branding
without touching a real org.

## 2. Set up the Salesforce side (JWT Bearer flow)

This lets the backend authenticate as a specific Salesforce user with no
interactive login and no client secret to leak — the JWT names one username
(`SF_USERNAME`), and Salesforce mints a token acting as that user.

> **Which user?** In a real deployment this should be a dedicated,
> minimally-privileged service account. But since this is a demo/POC
> environment and the free `Salesforce Integration` license hard-excludes
> Case (see the license note further down), the pragmatic choice here is to
> just point `SF_USERNAME` at an **existing, already fully-licensed user**
> (e.g. your own admin login) instead of provisioning a new one. Tradeoff:
> Case edits made through the widget show up in Salesforce as made by that
> person, not a distinct "integration" identity — revisit this if the
> widget ever moves beyond a demo. If that user is a System Administrator,
> they likely already have full Case/Contact/Task/Email access via their
> profile, which makes step 6 below mostly a verification step rather than
> new configuration — but step 4 (pre-authorizing the app) still applies
> regardless of profile, since that's an OAuth policy check, not a data
> permission.

Newer orgs only offer **External Client Apps (ECA)** — the "New Connected App"
option is gone from App Manager because Salesforce now recommends ECA for new
integrations (as of Spring '26). That's fine: ECA supports the JWT Bearer flow
too, and the OAuth token endpoint your backend calls
(`/services/oauth2/token`, `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`)
is identical either way — none of `functions/salesforce.js` needs to change,
only the setup steps below. If your org still shows "New Connected App", the
classic flow works the same way (Setup → App Manager → New Connected App →
Enable OAuth Settings → "Use digital signatures" → upload the cert) and you can
skip straight to step 6.

1. **Generate a certificate + private key** (self-signed is fine):
   ```
   openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:2048 \
     -keyout server.key -out server.crt
   ```
   Keep `server.key` — it becomes `SF_PRIVATE_KEY`. Never commit it.
2. **Create the app**: Setup → Quick Find → "External Client Apps" →
   **External Client App Manager** → **New External Client App**. Fill in
   Basic Information (App Name, API Name, Contact Email) and save.
3. **Enable OAuth + JWT Bearer Flow**: reopen the app → expand
   **API (Enable OAuth Settings)** → check **Enable OAuth**. Set any HTTPS
   Callback URL (e.g. `https://login.salesforce.com/services/oauth2/callback`
   — it's unused by the JWT flow), and add **both** of these OAuth Scopes:
   `Manage user data via APIs (api)` **and** `Perform requests on your behalf
   at any time (refresh_token, offline_access)`. The second one is easy to
   skip since the JWT flow never actually returns/uses a refresh token — but
   Salesforce requires the scope to be present anyway, and omitting it fails
   with `"refresh_token scope is required and the connected app should be
   installed and preauthorized"` when you test the token exchange. Check
   **Enable JWT Bearer Flow** and upload `server.crt` as the certificate.
   Save.
   > Exact field names can shift between Salesforce releases — if something
   > doesn't match what you see, the current authoritative steps are in
   > Salesforce Help: [Configure OAuth 2.0 JWT Bearer Flow for External Client Apps](https://help.salesforce.com/s/articleView?id=xcloud.meta_configure_oauth_jwt_flow_external_client_apps.htm&type=5).
4. **Pre-authorize your chosen user** (so no manual OAuth consent screen is
   ever shown): on the app, open the **Policies** section (configured
   separately from OAuth settings for ECA — edit it after the app is saved) →
   Permitted Users = "Admin approved users are pre-authorized". Then link a
   Permission Set to the app and assign it to that user:
   1. Setup → Quick Find → "Permission Sets" → **New** → label it e.g.
      `SF Case Widget Integration Access` (License = "—None—"). Save — this
      permission set will hold both app access (below) and, if needed, the
      object/field permissions from step 6, so it's one assignment either way.
   2. Link the app to it. The exact spot varies by release, so use whichever
      you see: on the **app's Policies** page there may be a Permission
      Sets/Profiles picker right there; otherwise open the **Permission
      Set** → under **Apps** look for "Connected App Access" / "External
      Client App Access" → Edit → move the app to Enabled → Save.
   3. Setup → Permission Sets → open it → **Manage Assignments** → **Add
      Assignment** → check your chosen user → **Assign**.
   If you get `invalid_grant`/`unauthorized_client` when testing the JWT flow
   later, this assignment is the most likely thing to double-check.
5. **Get the Consumer Key**: app → **Settings** tab → OAuth Settings →
   "Consumer Key and Secret" → copy the **Consumer Key** (this is
   `SF_CONSUMER_KEY`). You don't need the Secret — the JWT flow only uses the
   Consumer Key (as the `iss` claim) plus your certificate's private key.
6. **Check (or add) object/field permissions**, via Setup → Profiles →
   your chosen user's profile → Object Settings for Case/Contact. A System
   Administrator profile already has full Read/Edit on every standard object
   and field, so if that's who you're reusing, skip straight to step 7 — this
   step is only needed if the chosen user's profile doesn't already cover it.
   In that case, add it to the same permission set from step 4 (Setup →
   Permission Sets → `SF Case Widget Integration Access` → **Apps** →
   **Object Settings**):
   > **License note, if you ever switch to a dedicated user later**: the
   > user's **User License** must be a full `Salesforce` or `Service Cloud`
   > license. The free `Salesforce Integration` license (and `Salesforce
   > Platform`, `Force.com`, `Work.com Only`) hard-exclude Case, Lead,
   > Opportunity, and Campaign — no permission set can override that, and
   > you'll get "*The user license doesn't allow the permission: Edit/Read
   > Cases*" trying to save this permission set otherwise. That's exactly why
   > this setup reuses an existing fully-licensed user instead (see the note
   > at the top of this section).
   - **Case**: Edit → check Object Permissions **Read** + **Edit** → under
     Field Permissions, **Edit Access** on `Priority` and `Description`.
   - **Contact**: same — object **Read** + **Edit**, field **Edit Access**
     on `Phone` and `Email`.
   - **Task**, **Email** (EmailMessage): object **Read** only, no field
     edits needed.
   - Chatter/Case Feed (`FeedItem`) usually isn't its own entry here — feed
     read access follows from Read on the parent Case plus Chatter being
     enabled on the org, so no extra step is normally needed. If
     `getActivity` comes back with Tasks/Emails but no feed posts, that's
     the thing to check.
   - Also check **API Enabled** under **System Permissions** (left nav of
     the permission set, not inside Object Settings) — without it every
     REST/SOQL call from the backend is rejected regardless of object
     permissions.
7. Note your chosen user's **username** (`SF_USERNAME`) and your org's login
   URL (`SF_LOGIN_URL` — `https://login.salesforce.com`, `https://test.salesforce.com`
   for a sandbox, or your My Domain URL).

Fill these into `functions/.env` (copy from `functions/.env.example`) for local
testing — see `functions/.env.example` for the full list of variables.

## 3. Run the functions locally

```
cd salesforce-case-widget/functions
npm install
npm run dev:listCases     # http://localhost:8081
npm run dev:updateCase    # http://localhost:8082
npm run dev:getActivity   # http://localhost:8083
```

Each `dev:*` script loads `.env` automatically via `dotenv-cli` — `functions-framework`
does not read it on its own, so if you ever run it directly instead of through
these npm scripts, prefix it yourself: `npx dotenv -e .env -- functions-framework ...`.

Point the widget at them for a real end-to-end local test:

```
http://localhost:8020?phone=5551234567&listCasesUrl=http://localhost:8081&updateCaseUrl=http://localhost:8082&getActivityUrl=http://localhost:8083
```

## 4. Deploy the functions to Cloud Run

Each function deploys independently (2nd-gen Cloud Functions, HTTP-triggered).
Store `SF_PRIVATE_KEY` in Secret Manager rather than as a plain env var:

```
gcloud secrets create sf-widget-private-key --data-file=server.key

for FN in listCases updateCase getActivity; do
  gcloud functions deploy "$FN" \
    --gen2 \
    --runtime=nodejs20 \
    --region=us-central1 \
    --source=./functions \
    --entry-point="$FN" \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=SF_LOGIN_URL=https://login.salesforce.com,SF_CONSUMER_KEY=<your-consumer-key>,SF_USERNAME=<integration-user-username>,ALLOWED_ORIGIN=https://<your-org>.github.io,WIDGET_API_KEY=<pick-a-random-string> \
    --set-secrets=SF_PRIVATE_KEY=sf-widget-private-key:latest
done
```

Each deploy prints its own HTTPS URL — copy the three into `public/js/config.js`
(or pass them as `?listCasesUrl=&updateCaseUrl=&getActivityUrl=` query params from
the host page that embeds the iframe).

`--allow-unauthenticated` is required since GitHub Pages calls these directly
from the browser — the `WIDGET_API_KEY` / `X-Widget-Key` header is the only gate,
and it's visible in the widget's own source since it's a public static site. This
setup is meant for demos/POCs, not multi-tenant production use.

## 5. Deploy the widget to GitHub Pages

1. Fill in `public/js/config.js` with your three function URLs and (optionally) a
   default `customerLogoUrl`.
2. Push `salesforce-case-widget/public` to a `gh-pages` branch (or point GitHub
   Pages at this folder) in whichever repo you host demo assets from.
3. Embed it: `<iframe src="https://<org>.github.io/<repo>/?phone=5551234567"></iframe>`
   — the host page supplies `phone` and/or `email` in the iframe's `src`.

## Notes / known limitations

- **Case Number** and **Contact Name** are read-only. Contact `Name` is a
  Salesforce compound field computed from First/Last Name and isn't directly
  writable via the REST API, so it's display-only rather than a broken control.
- **Phone matching** strips formatting from the input, then matches the last 10
  digits against `Contact.Phone` with a digit-interleaved `LIKE` pattern (e.g.
  `%5%1%0%4%2%4%1%1%9%9%`) so it still matches however the stored value is
  formatted (`+1-510-424-1199`, `(510) 424-1199`, etc.) — fine at demo scale,
  not indexed/optimized for a high-volume org.
- The Salesforce logo is a bundled SVG (`public/assets/salesforce-logo.svg`);
  swap the customer logo per deployment via `config.js` or `?logo=`.
