"""Tests for stairs_fds.py - Stair landing setup with role assignment and direction."""
import pytest
from stairs_fds import setup_landings


class TestSetupLandingsBasic:
    """Test setup_landings returns landing and step FDS lines."""

    def setup_method(self):
        # Two landing rectangles stacked vertically (y offset > x offset)
        self.elements = [
            {"comments": "landing", "id": 10, "points": [{"x": 0, "y": 0}, {"x": 2, "y": 2}], "type": "rect"},
            {"comments": "landing", "id": 20, "points": [{"x": 0, "y": 10}, {"x": 2, "y": 12}], "type": "rect"},
            {"comments": "obstruction", "id": 99, "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}], "type": "polyline"},
        ]

    def test_returns_list(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20
        )
        assert isinstance(result, list)

    def test_contains_landing_lines(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20
        )
        landing_lines = [l for l in result if "LANDING" in l]
        assert len(landing_lines) > 0

    def test_contains_halflanding_lines(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20
        )
        halflanding_lines = [l for l in result if "HALFLANDING" in l]
        assert len(halflanding_lines) > 0

    def test_contains_step_lines(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20
        )
        step_lines = [l for l in result if "STEP" in l]
        assert len(step_lines) > 0

    def test_no_matching_elements_returns_empty(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=[{"comments": "obstruction", "id": 1, "points": [{"x": 0, "y": 0}], "type": "polyline"}],
            px_per_m=1, z=6, stair_enclosure_roof_z=20
        )
        assert result == []


class TestLandingRoles:
    """Test that landing_roles correctly assigns floor vs half landing."""

    def setup_method(self):
        # Landing id=20 is the floor, landing id=10 is the half
        # Placed vertically (y offset > x offset)
        self.elements = [
            {"comments": "landing", "id": 10, "points": [{"x": 0, "y": 10}, {"x": 2, "y": 12}], "type": "rect"},
            {"comments": "landing", "id": 20, "points": [{"x": 0, "y": 0}, {"x": 2, "y": 2}], "type": "rect"},
        ]
        self.roles = {"20": "floor", "10": "half"}

    def test_roles_swap_landing_assignment(self):
        """When roles are provided, id=20 should be floor landing regardless of array order."""
        result_with_roles = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20,
            landing_roles=self.roles
        )
        result_without_roles = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20,
        )
        # Both should return non-empty results
        assert len(result_with_roles) > 0
        assert len(result_without_roles) > 0
        # With roles, LANDING lines should use id=20's coords (y=0..2)
        landing_lines_roles = [l for l in result_with_roles if l.startswith("&OBST ID='LANDING'")]
        assert len(landing_lines_roles) > 0
        # Without roles, first array element (id=10 at y=10..12) is floor landing
        landing_lines_no_roles = [l for l in result_without_roles if l.startswith("&OBST ID='LANDING'")]
        assert len(landing_lines_no_roles) > 0
        # The two should differ because roles swap the assignment
        assert landing_lines_roles[0] != landing_lines_no_roles[0]

    def test_roles_none_falls_back_to_array_order(self):
        """Without roles, first element in array is floor landing."""
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20,
            landing_roles=None
        )
        assert len(result) > 0

    def test_empty_roles_falls_back_to_array_order(self):
        """Empty roles dict should behave same as None."""
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements, px_per_m=1, z=6, stair_enclosure_roof_z=20,
            landing_roles={}
        )
        assert len(result) > 0


class TestLandingUpSide:
    """Test that landing_up_side overrides the stair direction heuristic."""

    def setup_method(self):
        # Vertical orientation: landings offset in y
        self.elements_vertical = [
            {"comments": "landing", "id": 10, "points": [{"x": 0, "y": 0}, {"x": 2, "y": 2}], "type": "rect"},
            {"comments": "landing", "id": 20, "points": [{"x": 0, "y": 10}, {"x": 2, "y": 12}], "type": "rect"},
        ]

    def test_vertical_top_produces_output(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements_vertical, px_per_m=1, z=6,
            stair_enclosure_roof_z=20, landing_up_side="top"
        )
        assert len(result) > 0

    def test_vertical_bottom_produces_output(self):
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements_vertical, px_per_m=1, z=6,
            stair_enclosure_roof_z=20, landing_up_side="bottom"
        )
        assert len(result) > 0

    def test_vertical_top_vs_bottom_differ(self):
        """Top and bottom should produce different stair step coordinates."""
        result_top = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements_vertical, px_per_m=1, z=6,
            stair_enclosure_roof_z=20, landing_up_side="top"
        )
        result_bottom = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements_vertical, px_per_m=1, z=6,
            stair_enclosure_roof_z=20, landing_up_side="bottom"
        )
        steps_top = [l for l in result_top if "STEP1" in l]
        steps_bottom = [l for l in result_bottom if "STEP1" in l]
        assert steps_top != steps_bottom

    def test_none_up_side_uses_heuristic(self):
        """When landing_up_side is None, heuristic determines direction."""
        result = setup_landings(
            comments="landing", fire_floor=2, total_floors=5,
            elements=self.elements_vertical, px_per_m=1, z=6,
            stair_enclosure_roof_z=20, landing_up_side=None
        )
        assert len(result) > 0
        step_lines = [l for l in result if "STEP" in l]
        assert len(step_lines) > 0


class TestIntegrationWithFds:
    """Test that landing_roles and landing_up_side pass through testFunction."""

    def setup_method(self):
        from fds import testFunction
        self.testFunction = testFunction
        # Vertical orientation landings
        self.elements = [
            {"comments": "obstruction", "id": 0, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}, {"x": 100, "y": 50}, {"x": 0, "y": 50}, {"x": 0, "y": 0}], "type": "polyline"},
            {"comments": "mesh", "id": 1, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 50}], "type": "rect"},
            {"comments": "fire", "id": 3, "points": [{"x": 25, "y": 25}], "type": "point"},
            {"comments": "landing", "id": 10, "points": [{"x": 10, "y": 10}, {"x": 20, "y": 15}], "type": "rect"},
            {"comments": "landing", "id": 20, "points": [{"x": 10, "y": 40}, {"x": 20, "y": 45}], "type": "rect"},
        ]

    def test_testfunction_accepts_landing_params(self):
        """testFunction should accept landing_roles and landing_up_side without error."""
        result = self.testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=5,
            stair_enclosure_roof_z=20, scenario_type="MOE", sim_end_time=300,
            landing_roles={"10": "floor", "20": "half"},
            landing_up_side="bottom"
        )
        assert "LANDING" in result
        assert "HALFLANDING" in result
        assert "&TAIL" in result

    def test_testfunction_works_without_landing_params(self):
        """testFunction should work with default None for landing params."""
        result = self.testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=5,
            stair_enclosure_roof_z=20, scenario_type="MOE", sim_end_time=300,
        )
        assert "LANDING" in result
        assert "&TAIL" in result
