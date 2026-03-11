"""Tests for the wall detection endpoint (contour-based)."""

import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from detect_walls import app, _process_image, _snap_contour_ortho


client = TestClient(app)


def _make_base64_image(img: np.ndarray) -> str:
    """Encode a numpy image as base64 PNG string."""
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf.tobytes()).decode()


def _white_image(w=400, h=400):
    """Create a blank white image."""
    return np.ones((h, w, 3), dtype=np.uint8) * 255


def _draw_thick_rect(img, x, y, w, h):
    """Draw a filled black rectangle (simulating a wall section)."""
    cv2.rectangle(img, (x, y), (x + w, y + h), (0, 0, 0), -1)
    return img


class TestDetectWallContours:
    """Test that thick wall-like rectangles are detected as contours."""

    def test_detects_single_wall_block(self):
        img = _white_image()
        _draw_thick_rect(img, 50, 180, 300, 10)
        b64 = _make_base64_image(img)

        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_thickness": 3,
            "min_wall_length": 20,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1
        for wall in data["walls"]:
            assert len(wall["points"]) >= 3

    def test_detects_l_shaped_wall(self):
        img = _white_image()
        _draw_thick_rect(img, 50, 180, 300, 10)
        _draw_thick_rect(img, 340, 180, 10, 150)
        b64 = _make_base64_image(img)

        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_thickness": 3,
            "min_wall_length": 20,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1


class TestEmptyImage:
    def test_no_walls_on_blank_image(self):
        img = _white_image()
        b64 = _make_base64_image(img)

        resp = client.post("/detect-walls", json={"image_base64": b64})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["walls"] == []


class TestThinFeaturesFiltered:
    def test_thin_line_not_detected(self):
        img = _white_image()
        cv2.line(img, (50, 200), (350, 200), (0, 0, 0), 1)
        b64 = _make_base64_image(img)

        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_thickness": 4,
        })
        data = resp.json()
        assert data["count"] == 0

    def test_thick_wall_detected_thin_annotation_ignored(self):
        img = _white_image()
        _draw_thick_rect(img, 50, 180, 300, 10)
        cv2.line(img, (50, 100), (350, 100), (0, 0, 0), 1)
        b64 = _make_base64_image(img)

        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_thickness": 4,
            "min_wall_length": 20,
        })
        data = resp.json()
        assert data["count"] >= 1


class TestSnapContourOrtho:
    def test_near_horizontal_snapped(self):
        points = [{"x": 0, "y": 0}, {"x": 100, "y": 2}]
        result = _snap_contour_ortho(points, angle_tolerance=5.0)
        assert result[1]["y"] == result[0]["y"]

    def test_near_vertical_snapped(self):
        points = [{"x": 0, "y": 0}, {"x": 2, "y": 100}]
        result = _snap_contour_ortho(points, angle_tolerance=5.0)
        assert result[1]["x"] == result[0]["x"]

    def test_diagonal_not_snapped(self):
        points = [{"x": 0, "y": 0}, {"x": 100, "y": 100}]
        result = _snap_contour_ortho(points, angle_tolerance=5.0)
        assert result[1]["x"] == 100
        assert result[1]["y"] == 100


class TestParameterValidation:
    def test_min_wall_thickness_out_of_range(self):
        img = _white_image()
        b64 = _make_base64_image(img)
        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_thickness": 0,
        })
        assert resp.status_code == 422

    def test_min_wall_length_out_of_range(self):
        img = _white_image()
        b64 = _make_base64_image(img)
        resp = client.post("/detect-walls", json={
            "image_base64": b64,
            "min_wall_length": 5,
        })
        assert resp.status_code == 422
