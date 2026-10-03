import pytest

def calculate_points(w, w_ot, w_so, l_ot, l_so, l, rule="2-1-0-ot"):
    if rule in ["2-1-0", "2-1-0-ot"]:
        return 2 * (w + w_ot + w_so) + 1 * (l_ot + l_so)
    elif rule == "3-2-1-0":
        return 3 * w + 2 * (w_ot + w_so) + 1 * (l_ot + l_so)
    raise ValueError(f"Unknown rule: {rule}")

def test_points_calculation_nhl_khl_modern():
    # 6 wins in regulation, 1 in OT, 1 OTL, 2 L in regulation
    pts = calculate_points(w=6, w_ot=1, w_so=0, l_ot=1, l_so=0, l=2, rule="2-1-0-ot")
    # 2*(6+1) + 1*(1) = 14 + 1 = 15
    assert pts == 15

def test_points_calculation_classic_european():
    # 6 wins in reg (18 pts), 1 win in OT (2 pts), 1 OTL (1 pt), 2 L (0 pts)
    pts = calculate_points(w=6, w_ot=1, w_so=0, l_ot=1, l_so=0, l=2, rule="3-2-1-0")
    # 3*6 + 2*1 + 1*1 = 18 + 2 + 1 = 21
    assert pts == 21
