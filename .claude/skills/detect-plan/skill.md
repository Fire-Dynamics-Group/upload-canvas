---
name: detect-plan
description: Process a floor plan PDF to auto-detect scale and extract wall obstructions. Outputs elements ready for the canvas app.
---

# /detect-plan - Auto-detect walls from a floor plan PDF

Processes a floor plan PDF through the OpenCV wall detection pipeline and outputs obstruction elements.

## Arguments

`/detect-plan <pdf_path> [scale_meters]`

- `pdf_path` (required) - Path to the PDF floor plan
- `scale_meters` (optional) - Known scale bar length in meters. If omitted, attempts auto-detection.

## Workflow

### Step 1: Ensure dependencies are installed

Check if PyMuPDF is available. If not, install backend dependencies:

```bash
cd backend && pip install -r requirements.txt
```

### Step 2: Run the detection script

Run the process_plan.py script from the backend directory:

```bash
cd backend && python process_plan.py "<pdf_path>" --json [--scale <scale_meters>]
```

If the user provided a scale value, pass `--scale <value>`.
If not, omit it and the script will attempt auto-detection.

### Step 3: Review results

Show the user:
- Number of walls detected
- Image dimensions
- Scale detection result (auto-detected or user-provided)
- Path to the preview image (saved next to the PDF as `*.walls_preview.png`)

### Step 4: Ask about tuning

If the results look off (too many or too few walls), offer to re-run with adjusted parameters:
- `--threshold` (lower = more sensitive, default 50, range 20-150)
- `--min-length` (minimum wall segment in px, default 30)
- `--max-gap` (max gap to bridge between segments, default 10)

Ask: "Want me to adjust the detection sensitivity, or does this look right?"

### Step 5: Open preview

Tell the user to open the preview image to visually verify the detected walls:
- The preview is saved as `<pdf_name>.walls_preview.png` alongside the PDF
- Green lines = detected walls

### Step 6: Load into app (optional)

If the user wants to load the results into the running app:
1. The JSON output contains `elements` array in the exact format the canvas app uses
2. These can be imported via the browser console or added to the app's test data

## Examples

- `/detect-plan "C:\Plans\floor1.pdf"` - Auto-detect scale and walls
- `/detect-plan "C:\Plans\floor1.pdf" 5` - Scale bar represents 5 meters
- `/detect-plan "C:\Plans\floor1.pdf" 10` - Scale bar represents 10 meters
