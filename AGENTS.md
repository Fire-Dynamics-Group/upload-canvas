# Shared drawing test fixture

For PDF upload, canvas, panning, drawing-tool sidebar, and assessment-panel UI checks, use:

`e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf`

This is the user's designated test plan. It is committed so local and cloud agents can use the same drawing. Resolve the path relative to the repository checkout, not the original Windows Documents directory. Keep the fixture outside `public/`; it must not become a publicly served application asset.

Use the actual running app and real screenshots for visual verification. Do not substitute mockups for evidence. Uploading this PDF does not establish its drawing scale: calibrate against a verified dimension or ask the user. Do not invent a scale or represent results from an unverified scale as an engineering assessment.
