"""
Wall detection endpoint for floor plan images.

Uses contour detection to find wall perimeters, not individual line segments.

Include this router in your main FastAPI app:

    from detect_walls import router
    app.include_router(router)
"""

import base64
import math
from typing import List

import cv2
import numpy as np
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Router (import this into your main app)
# ---------------------------------------------------------------------------
router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class Point(BaseModel):
    x: int
    y: int


class DetectWallsRequest(BaseModel):
    image_base64: str
    min_wall_thickness: int = Field(default=4, ge=1, le=50)
    min_wall_length: int = Field(default=50, ge=10, le=500)
    simplify_tolerance: float = Field(default=2.0, ge=0.5, le=20.0)


class WallContour(BaseModel):
    points: List[Point]


class DetectWallsResponse(BaseModel):
    walls: List[WallContour]
    count: int


# ---------------------------------------------------------------------------
# Image processing pipeline
# ---------------------------------------------------------------------------

def _process_image(
    image_bytes: bytes,
    min_wall_thickness: int = 4,
    min_wall_length: int = 50,
    simplify_tolerance: float = 2.0,
) -> List[List[dict]]:
    """Detect wall contours in a floor plan image.

    Pipeline:
    1. Grayscale → blur → adaptive threshold → binary
    2. Morphological open to remove thin features (text, dimensions, fixtures)
    3. Morphological close to fill gaps in wall lines
    4. Find contours around remaining solid regions (walls)
    5. Filter by perimeter length (remove tiny noise)
    6. Simplify with approxPolyDP to reduce point count
    7. Snap near-orthogonal segments to axis-aligned
    """
    # Decode
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return []

    # Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Gaussian blur
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold — picks up dark lines on any background
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=11, C=2,
    )

    # Morphological open — erode then dilate to remove thin features
    # (annotations, dimension lines, text, door swings, fixtures)
    # Only thick wall lines survive.
    open_size = max(min_wall_thickness - 1, 2)
    open_kernel = np.ones((open_size, open_size), dtype=np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, open_kernel)

    # Morphological close — fill small gaps in wall lines so contours close
    close_size = max(min_wall_thickness, 3)
    close_kernel = np.ones((close_size, close_size), dtype=np.uint8)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, close_kernel)

    # Find contours — these trace the perimeter of each wall region
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    walls = []
    for contour in contours:
        perimeter = cv2.arcLength(contour, closed=True)

        # Filter out small contours (noise, small fixtures)
        if perimeter < min_wall_length * 2:
            continue

        # Simplify contour to reduce point count
        epsilon = simplify_tolerance
        approx = cv2.approxPolyDP(contour, epsilon, closed=True)

        # Convert to list of {x, y} points
        points = [{"x": int(pt[0][0]), "y": int(pt[0][1])} for pt in approx]

        # Snap near-orthogonal segments
        points = _snap_contour_ortho(points)

        if len(points) >= 3:
            walls.append(points)

    return walls


def _snap_contour_ortho(points: List[dict], angle_tolerance: float = 5.0) -> List[dict]:
    """Snap near-horizontal and near-vertical segments in a contour
    so they become exactly axis-aligned."""
    if len(points) < 2:
        return points

    result = [dict(points[0])]
    for i in range(1, len(points)):
        prev = result[-1]
        curr = dict(points[i])
        dx = abs(curr["x"] - prev["x"])
        dy = abs(curr["y"] - prev["y"])

        if dx == 0 and dy == 0:
            continue

        angle = math.degrees(math.atan2(dy, dx))

        if angle <= angle_tolerance:
            # Near-horizontal — snap y to previous
            curr["y"] = prev["y"]
        elif angle >= 90 - angle_tolerance:
            # Near-vertical — snap x to previous
            curr["x"] = prev["x"]

        result.append(curr)

    return result


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/detect-walls", response_model=DetectWallsResponse)
async def detect_walls(req: DetectWallsRequest):
    image_bytes = base64.b64decode(req.image_base64)
    walls = _process_image(
        image_bytes,
        min_wall_thickness=req.min_wall_thickness,
        min_wall_length=req.min_wall_length,
        simplify_tolerance=req.simplify_tolerance,
    )
    wall_contours = [WallContour(points=[Point(**p) for p in w]) for w in walls]
    return DetectWallsResponse(walls=wall_contours, count=len(wall_contours))


# ---------------------------------------------------------------------------
# Standalone runner (for local development / Railway)
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Create a full FastAPI application with CORS and the detect-walls router."""
    application = FastAPI(title="Wall Detection Service")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(router)
    return application


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
