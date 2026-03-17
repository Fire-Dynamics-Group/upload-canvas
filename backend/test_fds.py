"""Tests for fds.py - FDS generation with controls and header integration."""
import pytest
from fds import sim_header, testFunction, add_door_holes_to_fds
from controls import Control_ID_Apartment, Control_ID_Stair


class TestSimHeader:
    def test_contains_head(self):
        result = sim_header(chid='test_model', sim_end_time=300)
        assert any("&HEAD" in line for line in result)
        assert any("test_model" in line for line in result)

    def test_contains_time(self):
        result = sim_header(sim_end_time=1800)
        time_lines = [l for l in result if "&TIME" in l]
        assert len(time_lines) == 1
        assert "T_END=1800" in time_lines[0]

    def test_contains_dump(self):
        result = sim_header()
        assert any("&DUMP" in line for line in result)

    def test_contains_comb(self):
        result = sim_header()
        assert any("&COMB" in line for line in result)


class TestDoorHolesWithCtrl:
    def setup_method(self):
        self.elements = [
            {"comments": "door", "id": 0, "points": [{"x": 5.0, "y": 3.0}, {"x": 5.0, "y": 4.0}], "type": "polyline"},
            {"comments": "door", "id": 1, "points": [{"x": 10.0, "y": 3.0}, {"x": 10.0, "y": 4.0}], "type": "polyline"},
        ]
        self.roles = {"0": "apartment", "1": "stair"}

    def test_ctrl_id_added_for_moe(self):
        result = add_door_holes_to_fds(self.elements, z=10, wall_height=3, wall_thickness=0.2, fds_array=[], scenario_type="MOE", door_roles=self.roles)
        assert len(result) == 2
        assert f"CTRL_ID='{Control_ID_Apartment}'" in result[0]
        assert f"CTRL_ID='{Control_ID_Stair}'" in result[1]

    def test_ctrl_id_added_for_fsa(self):
        result = add_door_holes_to_fds(self.elements, z=10, wall_height=3, wall_thickness=0.2, fds_array=[], scenario_type="FSA", door_roles=self.roles)
        assert f"CTRL_ID='{Control_ID_Apartment}'" in result[0]

    def test_no_ctrl_for_none_scenario(self):
        result = add_door_holes_to_fds(self.elements, z=10, wall_height=3, wall_thickness=0.2, fds_array=[], scenario_type="none", door_roles=self.roles)
        assert "CTRL_ID" not in result[0]

    def test_no_ctrl_when_no_role_assigned(self):
        result = add_door_holes_to_fds(self.elements, z=10, wall_height=3, wall_thickness=0.2, fds_array=[], scenario_type="MOE", door_roles={})
        assert "CTRL_ID" not in result[0]
        assert "CTRL_ID" not in result[1]

    def test_hole_id_uses_role_name(self):
        result = add_door_holes_to_fds(self.elements, z=10, wall_height=3, wall_thickness=0.2, fds_array=[], scenario_type="MOE", door_roles=self.roles)
        assert "Apartment Door Hole" in result[0]
        assert "Stair Door Hole" in result[1]


class TestTestFunctionIntegration:
    def setup_method(self):
        self.elements = [
            {"comments": "obstruction", "id": 0, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}, {"x": 100, "y": 50}, {"x": 0, "y": 50}, {"x": 0, "y": 0}], "type": "polyline"},
            {"comments": "mesh", "id": 1, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 50}], "type": "rect"},
            {"comments": "door", "id": 2, "points": [{"x": 50, "y": 0}, {"x": 50, "y": 10}], "type": "polyline"},
            {"comments": "fire", "id": 3, "points": [{"x": 25, "y": 25}], "type": "point"},
        ]

    def test_moe_output_contains_header(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="MOE", sim_end_time=300,
            door_openings={"apartment_open": "30", "apartment_close": "60", "stair_open": "35", "stair_close": "65"}
        )
        assert "&HEAD CHID='model'" in result
        assert "&TIME T_END=300" in result
        assert "&TAIL" in result

    def test_moe_output_contains_controls(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="MOE", sim_end_time=300,
            door_openings={"apartment_open": "30", "apartment_close": "60"}
        )
        assert "&RAMP" in result
        assert "&CTRL" in result
        assert "Apartment Door Hole" in result

    def test_fsa_output_contains_controls(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="FSA", sim_end_time=300,
        )
        assert "&RAMP" in result
        assert "Apartment Door Hole" in result

    def test_both_output_contains_hybrid_controls(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="Both", sim_end_time=1800,
            door_openings={
                "apartment_open": "30", "apartment_close": "60",
                "stair_open": "35", "stair_close": "65",
                "fsa_apartment_open": "900", "fsa_stair_open": "900"
            }
        )
        assert "&TIME T_END=1800" in result
        assert "Apartment Door Hole" in result
        assert "Stair Door Hole" in result

    def test_output_contains_reaction(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="MOE", sim_end_time=300,
        )
        assert "POLYURETHANE" in result

    def test_door_holes_have_ctrl_id_with_roles(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="MOE", sim_end_time=300,
            door_roles={"2": "apartment"},
        )
        assert "CTRL_ID='Apartment Door Hole'" in result

    def test_door_holes_no_ctrl_without_roles(self):
        result = testFunction(
            self.elements, z=10, wall_height=3, wall_thickness=0.2,
            stair_height=30, px_per_m=10, fire_floor=2, total_floors=7,
            stair_enclosure_roof_z=40, scenario_type="MOE", sim_end_time=300,
            door_roles={},
        )
        assert "CTRL_ID" not in result
