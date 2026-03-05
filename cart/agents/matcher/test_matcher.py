def test_cosine_similarity():
    from agent_matcher import _cosine
    a = [1.0, 0.0]
    b = [1.0, 0.0]
    assert _cosine(a, b) == 1.0

def test_cosine_orthogonal():
    from agent_matcher import _cosine
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert abs(_cosine(a, b)) < 1e-6
