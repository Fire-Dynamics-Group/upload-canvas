"""
CLI tool to process a floor plan PDF: detect scale and extract wall obstructions.

Usage:
    python process_plan.py <pdf_path> [--scale METERS] [--page PAGE] [--threshold T] [--min-length L] [--max-gap G]

If --scale is not provided, attempts to auto-detect scale bars in the drawing.
Outputs detected walls as JSON elements compatible with the canvas app.
"""

import argparse
import base64
import json
import math
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

from detect_walls import _process_image


def filter_grid_and_border_lines(
    lines: List[dict],
    img_width: int,
    img_height: int,
    span_ratio: float = 0.5,
    margin_ratio: float = 0.02,
) -> List[dict]:
    """Remove lines that are likely grid lines, borders, or title block edges.

    Filters out:
    - Lines spanning more than span_ratio of the image (grid/border lines)
    - Lines within margin_ratio of the image edges (border frame)
    """
    filtered = []
    margin_x = img_width * margin_ratio
    margin_y = img_height * margin_ratio
    max_span_x = img_width * span_ratio
    max_span_y = img_height * span_ratio

    for ln in lines:
        x1, y1, x2, y2 = ln["x1"], ln["y1"], ln["x2"], ln["y2"]
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)

        # Skip lines spanning too much of the image (grid lines)
        if dx > max_span_x or dy > max_span_y:
            continue

        # Skip lines hugging the image border
        mid_x = (x1 + x2) / 2
        mid_y = (y1 + y2) / 2
        if mid_x < margin_x or mid_x > img_width - margin_x:
            continue
        if mid_y < margin_y or mid_y > img_height - margin_y:
            continue

        filtered.append(ln)

    return filtered


def crop_title_block(
    img: np.ndarray,
    right_crop_ratio: float = 0.18,
    bottom_crop_ratio: float = 0.08,
) -> Tuple[np.ndarray, int, int]:
    """Crop the title block area (typically right side and bottom).

    Returns (cropped_image, crop_offset_x, crop_offset_y).
    Offsets are 0 since we crop from the right/bottom edges.
    """
    h, w = img.shape[:2]
    new_w = int(w * (1 - right_crop_ratio))
    new_h = int(h * (1 - bottom_crop_ratio))
    return img[:new_h, :new_w], 0, 0


def pdf_to_image(pdf_path: str, page: int = 0, scale: float = 2.0) -> np.ndarray:
    """Convert a PDF page to a numpy image array."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("ERROR: PyMuPDF (fitz) is required. Install with: pip install PyMuPDF")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    if page >= len(doc):
        print(f"ERROR: Page {page} does not exist. PDF has {len(doc)} pages.")
        sys.exit(1)

    pg = doc[page]
    mat = fitz.Matrix(scale, scale)
    pix = pg.get_pixmap(matrix=mat)

    # Convert to numpy array (RGB)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)

    # Convert RGB to BGR for OpenCV
    if pix.n == 4:  # RGBA
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif pix.n == 3:  # RGB
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    doc.close()
    return img


def detect_scale_bar(img: np.ndarray) -> Optional[Tuple[float, float]]:
    """
    Attempt to auto-detect a scale bar in the drawing.

    Returns (pixels_per_meter, detected_bar_length_meters) or None if not found.

    Strategy:
    - Look for horizontal lines near the bottom/edges of the drawing
    - Look for nearby text containing measurements (e.g. "5m", "10m", "1:100")
    - Use OCR if available, otherwise look for common scale ratios
    """
    h, w = img.shape[:2]

    # Look in bottom 15% and right 20% of the image where scale bars typically live
    regions = [
        img[int(h * 0.85):, :],           # bottom strip
        img[:, int(w * 0.80):],            # right strip
        img[int(h * 0.85):, int(w * 0.60):]  # bottom-right corner
    ]

    for region in regions:
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180,
            threshold=30,
            minLineLength=50,
            maxLineGap=5
        )

        if lines is not None:
            # Find horizontal lines (potential scale bars)
            horizontal_lines = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(math.atan2(y2 - y1, x2 - x1))
                if angle < math.radians(5):  # nearly horizontal
                    length = math.hypot(x2 - x1, y2 - y1)
                    horizontal_lines.append((length, x1, y1, x2, y2))

            if horizontal_lines:
                horizontal_lines.sort(key=lambda x: x[0], reverse=True)
                # Return the longest horizontal line as a candidate
                best = horizontal_lines[0]
                return best[0], None  # pixels, unknown meters

    return None


def try_ocr_scale(img: np.ndarray) -> Optional[str]:
    """Try to find scale text like '1:100' or '5m' using OCR."""
    try:
        import pytesseract
    except ImportError:
        return None

    h, w = img.shape[:2]
    # Scan bottom 20% for scale annotations
    bottom = img[int(h * 0.80):, :]
    gray = cv2.cvtColor(bottom, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray)

    # Look for patterns like "1:100", "1:50", "5m", "10 m"
    import re
    scale_match = re.search(r'1\s*:\s*(\d+)', text)
    if scale_match:
        return f"1:{scale_match.group(1)}"

    meter_match = re.search(r'(\d+(?:\.\d+)?)\s*m\b', text)
    if meter_match:
        return f"{meter_match.group(1)}m"

    return None


def lines_to_elements(lines: List[dict], start_id: int = 0) -> List[dict]:
    """Convert detected line segments to canvas-compatible element objects."""
    elements = []
    for i, line in enumerate(lines):
        elements.append({
            "type": "polyline",
            "points": [
                {"x": line["x1"], "y": line["y1"]},
                {"x": line["x2"], "y": line["y2"]}
            ],
            "comments": "obstruction",
            "id": start_id + i
        })
    return elements


def process_plan(
    pdf_path: str,
    page: int = 0,
    scale_meters: Optional[float] = None,
    threshold: int = 50,
    min_line_length: int = 30,
    max_line_gap: int = 10,
    render_scale: float = 2.0,
    min_wall_thickness: Optional[int] = None,
    output_preview: bool = True,
) -> dict:
    """
    Full pipeline: PDF -> image -> detect walls -> output elements.

    Returns dict with:
      - elements: list of canvas-compatible obstruction elements
      - image_size: {width, height} of the rendered image
      - scale_info: detected or provided scale information
      - wall_count: number of walls detected
    """
    print(f"Loading PDF: {pdf_path} (page {page + 1})")
    img = pdf_to_image(pdf_path, page=page, scale=render_scale)
    h, w = img.shape[:2]
    print(f"Image size: {w}x{h} pixels")

    # Scale detection
    scale_info = {}
    if scale_meters is not None:
        scale_info["provided_meters"] = scale_meters
        scale_info["source"] = "user-provided"
        print(f"Using provided scale: {scale_meters}m")
    else:
        print("Attempting auto-detect scale...")
        result = detect_scale_bar(img)
        if result:
            bar_pixels, _ = result
            scale_info["bar_pixels"] = bar_pixels
            scale_info["source"] = "auto-detected"
            print(f"Found potential scale bar: {bar_pixels:.0f} pixels long")

            # Try OCR for the actual measurement
            ocr_result = try_ocr_scale(img)
            if ocr_result:
                scale_info["ocr_text"] = ocr_result
                print(f"OCR detected scale text: {ocr_result}")
            else:
                print("Could not read scale text. Please provide --scale METERS manually.")
        else:
            scale_info["source"] = "none"
            print("No scale bar detected. Please provide --scale METERS manually.")

    # Crop out title block area before detection
    print("Cropping title block region...")
    cropped, offset_x, offset_y = crop_title_block(img)
    crop_h, crop_w = cropped.shape[:2]
    print(f"Cropped image: {crop_w}x{crop_h} pixels")

    # Wall detection
    if min_wall_thickness is None:
        min_wall_thickness = max(4, int(render_scale * 2))
    print(f"Detecting walls (threshold={threshold}, minLength={min_line_length}, maxGap={max_line_gap}, minThickness={min_wall_thickness})...")
    _, img_encoded = cv2.imencode('.png', cropped)
    image_bytes = img_encoded.tobytes()

    lines = _process_image(image_bytes, threshold, min_line_length, max_line_gap, min_wall_thickness=min_wall_thickness)
    print(f"Detected {len(lines)} raw wall segments")

    # Filter out grid lines and border lines
    lines = filter_grid_and_border_lines(lines, crop_w, crop_h)
    print(f"After filtering grid/border lines: {len(lines)} wall segments")

    # Convert to elements
    elements = lines_to_elements(lines)

    # Save preview image with detected walls drawn on the full image
    if output_preview:
        preview = img.copy()
        for line in lines:
            cv2.line(
                preview,
                (line["x1"] + offset_x, line["y1"] + offset_y),
                (line["x2"] + offset_x, line["y2"] + offset_y),
                (0, 255, 0), 2
            )
        preview_path = str(Path(pdf_path).with_suffix('.walls_preview.png'))
        cv2.imwrite(preview_path, preview)
        print(f"Preview saved: {preview_path}")

    result = {
        "source_pdf": pdf_path,
        "page": page,
        "image_size": {"width": w, "height": h},
        "scale_info": scale_info,
        "wall_count": len(lines),
        "elements": elements,
    }

    return result


def main():
    parser = argparse.ArgumentParser(description="Process a floor plan PDF to detect walls")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--page", type=int, default=0, help="Page number (0-indexed, default: 0)")
    parser.add_argument("--scale", type=float, default=None, help="Known scale bar length in meters")
    parser.add_argument("--threshold", type=int, default=50, help="Line detection sensitivity (default: 50)")
    parser.add_argument("--min-length", type=int, default=30, help="Minimum wall segment length in px (default: 30)")
    parser.add_argument("--max-gap", type=int, default=10, help="Maximum gap to connect segments in px (default: 10)")
    parser.add_argument("--render-scale", type=float, default=2.0, help="PDF render scale factor (default: 2.0)")
    parser.add_argument("--min-thickness", type=int, default=None, help="Minimum wall thickness in px (default: auto based on render scale)")
    parser.add_argument("--json", action="store_true", help="Output elements as JSON to stdout")
    parser.add_argument("--no-preview", action="store_true", help="Skip preview image generation")

    args = parser.parse_args()

    if not Path(args.pdf_path).exists():
        print(f"ERROR: File not found: {args.pdf_path}")
        sys.exit(1)

    result = process_plan(
        pdf_path=args.pdf_path,
        page=args.page,
        scale_meters=args.scale,
        threshold=args.threshold,
        min_line_length=args.min_length,
        max_line_gap=args.max_gap,
        render_scale=args.render_scale,
        min_wall_thickness=args.min_thickness,
        output_preview=not args.no_preview,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\nSummary:")
        print(f"  Walls detected: {result['wall_count']}")
        print(f"  Image size: {result['image_size']['width']}x{result['image_size']['height']}")
        print(f"  Scale: {result['scale_info'].get('source', 'unknown')}")
        if result['scale_info'].get('ocr_text'):
            print(f"  Scale text: {result['scale_info']['ocr_text']}")


if __name__ == "__main__":
    main()
