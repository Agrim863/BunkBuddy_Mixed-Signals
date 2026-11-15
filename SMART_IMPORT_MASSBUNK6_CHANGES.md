# Smart Import refinement — based on massbunk6

- Timetable import now uses two tabs: Smart PDF and CSV / Excel, preserving the original CSV/Excel mapping workflow.
- PDF input is one section per one-page file; the A1–A8 selector is removed.
- Groq returns all discovered groups and all sessions in one call, with each session's `groups` list (`[]` = shared).
- Group selection appears only when more than one group was discovered, and switching groups does not call Groq again.
- Review allows changing weekday, code, name, start/end times and type, and removing rows before confirmation.
- The signed-in user's Supabase session access token is sent as the Bearer token; the anon key remains in the `apikey` header.
- The Edge Function accepts `kind` and `image` only and asks Groq to map visible time-column and weekday-row boundaries, merged cells, and parallel lab groups.
- The existing academic calendar import continues to use the same Groq gateway with the new request format.

## Deploy

From the project root:

```powershell
npx supabase login
npx supabase functions deploy smart-document-import
npm ci
npm run build
npm run dev
```

The Edge Function must be redeployed alongside the frontend: old functions expect `section` and `group` and will reject the new requests.

## Notes

- Groq may still make coordinate mistakes. Its grid instructions are improved, but this is **not** deterministic PDF grid reconstruction; always review slots.
- Local parser is a selectable-text fallback; its group identification is less reliable than Groq.
- For safety, multiple-section PDFs must be split into one-page section PDFs before import.
- No live Groq request was performed here; verify the model name configured in your deployed Groq account if it returns a model error.
