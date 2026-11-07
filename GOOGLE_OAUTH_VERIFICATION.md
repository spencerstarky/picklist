# Google OAuth 2.0 Verification Kit — PickList

> Use this exact information when completing the **OAuth Consent Screen** in Google Cloud Console (`console.cloud.google.com`) for Google Tasks API verification.

---

## 1. OAuth Consent Screen Metadata

| Field | Value to Enter |
|---|---|
| **App Name** | PickList : Daily Order Pulls for Nifty |
| **User Support Email** | picklist.help@gmail.com |
| **App Logo** | Upload `icons/icon128.png` (128×128 PNG) |
| **Application Home Page** | Your Vercel URL (e.g., `https://picklist-....vercel.app`) |
| **Application Privacy Policy Link** | `https://<your-vercel-domain>/privacy` |
| **Application Terms of Service Link** | `https://<your-vercel-domain>/terms` |
| **Developer Contact Information** | picklist.help@gmail.com |

---

## 2. Requested Scopes

| Scope | Type | Purpose |
|---|---|---|
| `https://www.googleapis.com/auth/tasks` | Sensitive | Used exclusively to create and update the user's "Daily Pull List" checklist in Google Tasks. |

---

## 3. Scope Justification (Copy & Paste for Google Reviewer)

When Google asks: *"Explain why you need each requested scope and how your app uses it:"*

```text
PickList is a productivity Google Chrome extension built for online inventory resellers. The application's sole purpose is to retrieve sold orders from the seller's active Nifty session, sequence items according to their physical warehouse locations (racks, bins, and shelves), and synchronize the sorted list into a dedicated task list in Google Tasks titled "Daily Pull List".

We request the 'https://www.googleapis.com/auth/tasks' scope specifically to:
1. Verify if a task list named "Daily Pull List" exists in the user's Google Tasks account, and create it if it does not.
2. Insert the sequenced daily picking items as checklist tasks so the seller can walk their physical warehouse floor with their smartphone and check items off as they are pulled.
3. Check for existing tasks to avoid inserting duplicate orders during subsequent syncs.

Data Handling & Privacy Commitment:
- All order parsing and task creation execute locally on the user's machine within the extension sandbox.
- PickList does not transmit, store, or broker Google user data on any remote servers or third-party databases.
- PickList does not use Google Tasks data for advertising, market research, or artificial intelligence/machine learning model training.
- PickList strictly complies with the Google API Services User Data Policy, including the Limited Use requirements.
```

---

## 4. Demo Video Requirements (Google Review Checklist)

Google requires a short YouTube video (can be Unlisted) showing the OAuth flow in action:

1. **Client ID Visibility:** The video must clearly show the Google OAuth Consent dialog with your Client ID in the browser URL bar matching the Client ID in your console (`231991706388-...`).
2. **Step-by-Step Flow:**
   - Show the PickList extension icon being clicked.
   - Show clicking "Sign in with Google".
   - Show granting access on the Google OAuth prompt.
   - Show clicking "Sync Pull List Now".
   - Switch to Google Tasks (`tasks.google.com` or mobile app) and demonstrate the newly created tasks appearing under "Daily Pull List".
3. **Audio/Text Explanation:** Explain briefly in narration or captions that the scope is used only to create the "Daily Pull List" tasks.
