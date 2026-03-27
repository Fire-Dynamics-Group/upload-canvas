"""
Run the actual EXE Python code on test corridor polygons and output
fixture data (rectangles + sensor positions) for JS test comparison.

Usage:
    python __tests__/fixtures/generate_exe_fixtures.py

Output:
    __tests__/fixtures/exe_sensor_fixtures.json
"""
import sys
import json
import os

# Import the actual EXE code
exe_path = r'C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\05 R&D\11 IS\Common Corridor FDS Gen\populate_fds_file'
sys.path.insert(0, exe_path)
from centerline import get_best_rectangles, return_centrelines, point_in_polygon
import pandas as pd


def run_exe_algorithm(name, vertices_m):
    """Run getBestRectangles + returnCenterlines on a polygon (in metres)."""
    df = pd.DataFrame(vertices_m, columns=['X', 'Y'])
    rects = get_best_rectangles(df)

    # Parse rectangles
    rect_list = []
    for i in range(0, len(rects), 4):
        rect_list.append({
            'xmin': rects[i], 'xmax': rects[i+1],
            'ymin': rects[i+2], 'ymax': rects[i+3],
        })

    sensors = return_centrelines(rects, spacing=0.5)
    sensor_list = [{'x': s[0], 'y': s[1]} for s in sensors]

    # Check which sensors are inside the polygon
    polyX = [v[0] for v in vertices_m]
    polyY = [v[1] for v in vertices_m]
    inside_count = sum(1 for s in sensors if point_in_polygon(s, polyX, polyY))

    result = {
        'name': name,
        'vertices': [{'x': v[0], 'y': v[1]} for v in vertices_m],
        'vertex_count': len(vertices_m),
        'rectangles': rect_list,
        'rectangle_count': len(rect_list),
        'sensors': sensor_list,
        'sensor_count': len(sensor_list),
        'sensors_inside_polygon': inside_count,
    }

    print(f"\n=== {name} ({len(vertices_m)} vertices) ===")
    print(f"Rectangles: {len(rect_list)}")
    for r in rect_list:
        print(f"  [{r['xmin']},{r['xmax']}] x [{r['ymin']},{r['ymax']}]")
    print(f"Sensors: {len(sensor_list)} ({inside_count} inside polygon)")

    return result


# ─── Test polygons ───────────────────────────────────────────────────

# North Finchley CC_Corner (4 vertices, from CSV)
nf_cc = [(15.9, 32.1), (28.8, 32.1), (28.8, 33.6), (15.9, 33.6)]

# North Finchley Lobby_corner (10 vertices, from CSV)
nf_lobby = [
    (17.6, 36.9), (17.6, 35.5), (18.2, 35.5), (18.2, 33.1),
    (15.8, 33.1), (15.8, 31.6), (22.1, 31.7), (22.1, 33.1),
    (19.7, 33.1), (19.7, 36.9),
]

# North Finchley combined corridor (8 vertices, web app zone polygon in metres)
nf_combined = [
    (15.9, 32.1), (28.8, 32.1), (28.8, 33.6), (19.9, 33.6),
    (19.9, 37.4), (17.8, 37.4), (17.8, 33.6), (15.9, 33.6),
]

# Ian Test 2 corridor (16 vertices, web app zone polygon in metres)
pxPerM_it2 = 4.260011737073032 * 10
it2_px = [
    (1819.03, 1043.70), (2040.55, 1043.70), (2040.55, 1035.18),
    (2108.71, 1035.18), (2108.71, 1043.70), (2142.79, 1043.70),
    (2142.79, 1252.44), (1912.75, 1252.44), (1912.75, 1307.82),
    (2083.15, 1307.82), (2083.15, 1333.38), (2142.79, 1333.38),
    (2142.79, 1295.04), (2155.57, 1295.04), (2155.57, 1252.44),
    (2142.79, 1252.44),
]
it2_m = [(round(x / pxPerM_it2, 1), round(y / pxPerM_it2, 1)) for x, y in it2_px]


# ─── Run ─────────────────────────────────────────────────────────────

fixtures = {
    'generated_by': 'Python EXE centerline.py',
    'exe_path': exe_path,
    'tests': []
}

fixtures['tests'].append(run_exe_algorithm('North Finchley CC_Corner', nf_cc))
fixtures['tests'].append(run_exe_algorithm('North Finchley Lobby_corner', nf_lobby))
fixtures['tests'].append(run_exe_algorithm('North Finchley Combined', nf_combined))
fixtures['tests'].append(run_exe_algorithm('Ian Test 2', it2_m))

# Write fixtures
out_path = os.path.join(os.path.dirname(__file__), 'exe_sensor_fixtures.json')
with open(out_path, 'w') as f:
    json.dump(fixtures, f, indent=2)
print(f"\n\nFixtures written to: {out_path}")
