# Shared PDF fixture

`24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf` is the designated plan for local and cloud UI testing. It is an unchanged copy of the PDF supplied by the user, included with their permission for cloud-instance access.

Upload the file through the app's normal PDF upload flow. In automated tests, resolve it from the checkout (for example with `path.resolve('e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf')`). No Dropbox, local Windows path, or external download is required.

The drawing still requires a verified scale calibration before calculation results are meaningful. Keep this file out of publicly served directories.
